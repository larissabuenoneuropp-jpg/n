// Meu Financeiro — app independente, sem internet. Abre um arquivo de dados criptografado,
// mostra as telas financeiras e grava as alterações de volta no arquivo.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FilePlus2, FolderOpen, KeyRound, Loader2, Lock, Save, ShieldCheck, WifiOff } from "lucide-react";
import { Button, Card, Field, Input, Modal, ToastProvider } from "@/components/ui";
import { FinanceNav } from "@/components/finance/kit";
import { passphraseStrength } from "@/lib/passphrase";
import { DataProvider } from "./shims/provider";
import { useLocationHash } from "./shims/navigation";
import { MemoryStore, emptySnapshot, type Snapshot } from "./storage/memory-store";
import { newSession, parseDataFile, seal, unseal, type DataFile, type Session } from "./storage/crypto";
import { downloadText, ensureWritePermission, forgetHandle, hasDirectWrite, isAbort, pickExisting, pickNewLocation, rememberHandle, rememberedHandle, writeToHandle, FILE_EXT, type FileHandle } from "./storage/file";
import Overview from "@/app/(app)/financeiro/page";
import Receitas from "@/app/(app)/financeiro/receitas/page";
import Despesas from "@/app/(app)/financeiro/despesas/page";
import Fluxo from "@/app/(app)/financeiro/fluxo/page";
import ProLabore from "@/app/(app)/financeiro/pro-labore/page";
import Orcamento from "@/app/(app)/financeiro/orcamento/page";
import Reservas from "@/app/(app)/financeiro/reservas/page";
import Projecoes from "@/app/(app)/financeiro/projecoes/page";
import Tributario from "@/app/(app)/financeiro/tributario/page";
import Relatorios from "@/app/(app)/financeiro/relatorios/page";
import Configuracoes from "@/app/(app)/financeiro/configuracoes/page";

const ROUTES: Record<string, () => React.ReactElement> = {
  "/financeiro": Overview,
  "/financeiro/receitas": Receitas,
  "/financeiro/despesas": Despesas,
  "/financeiro/fluxo": Fluxo,
  "/financeiro/pro-labore": ProLabore,
  "/financeiro/orcamento": Orcamento,
  "/financeiro/reservas": Reservas,
  "/financeiro/projecoes": Projecoes,
  "/financeiro/tributario": Tributario,
  "/financeiro/relatorios": Relatorios,
  "/financeiro/configuracoes": Configuracoes,
};

const IDLE_LOCK_MS = 15 * 60 * 1000;
const todayName = () => `meu-financeiro-${new Date().toISOString().slice(0, 10)}${FILE_EXT}`;

type SaveState = { kind: "salvo" | "salvando" | "pendente" | "erro"; at?: Date; error?: string };

interface OpenFile {
  session: Session;
  handle: FileHandle | null;
  name: string;
  snapshot: Snapshot;
}

/* --------------------------------- Entrada --------------------------------- */
function Brand() {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white"><ShieldCheck className="h-6 w-6" /></div>
      <h1 className="font-display text-2xl font-semibold text-ink">Meu Financeiro</h1>
      <p className="mt-1 text-sm text-ink-soft">Gestão financeira do consultório — funciona sem internet, só neste computador</p>
    </div>
  );
}

function PrivacyNote() {
  return (
    <div className="mt-6 space-y-1.5 rounded-xl border border-sage-200 bg-sage-50 p-4 text-xs leading-relaxed text-sage-700">
      <p className="flex items-center gap-1.5 font-medium"><WifiOff className="h-3.5 w-3.5" /> Sem internet, sem servidor</p>
      <p>Esta página é proibida pelo próprio navegador de se conectar à internet: nenhum dado sai do computador.</p>
      <p>Seus dados ficam num <b>arquivo criptografado</b> ({FILE_EXT}) no lugar que você escolher. Sem a sua senha ninguém consegue abrir — <b>nem você: não existe recuperação de senha</b>. Guarde a senha e uma cópia do arquivo num pendrive.</p>
    </div>
  );
}

function PasswordStep({ title, fileName, onSubmit, onBack }: { title: string; fileName: string; onSubmit: (pass: string) => Promise<void>; onBack: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fails = useRef(0);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setErr("");
      try {
        await onSubmit(pass);
      } catch (x) {
        fails.current++;
        // Espera crescente depois de senhas erradas
        await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** (fails.current - 1))));
        setErr(x instanceof Error ? x.message : "Não foi possível abrir.");
      } finally {
        setBusy(false);
      }
    }}>
      <p className="text-sm text-ink-soft">{title}: <b className="text-ink">{fileName}</b></p>
      <Field label="Senha do arquivo"><Input type="password" autoFocus autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>Voltar</Button>
        <Button type="submit" className="flex-1" loading={busy} disabled={!pass}>{busy ? "Abrindo…" : "Abrir"}</Button>
      </div>
    </form>
  );
}

function CreateStep({ onCreate, onBack }: { onCreate: (pass: string) => Promise<void>; onBack: () => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passphraseStrength(p1);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (strength.problem) return setErr(strength.problem);
      if (p1 !== p2) return setErr("As senhas não conferem.");
      if (!ack) return setErr("Confirme que anotou a senha.");
      setBusy(true);
      setErr("");
      try {
        await onCreate(p1);
      } catch (x) {
        if (!isAbort(x)) setErr(x instanceof Error ? x.message : "Não foi possível criar o arquivo.");
      } finally {
        setBusy(false);
      }
    }}>
      <Field label="Crie uma senha" hint="Mínimo de 12 caracteres. Junte 3 ou 4 palavras sem relação, com números ou símbolos.">
        <Input type="password" autoFocus autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
      </Field>
      {p1 && (
        <div>
          <div className="h-1.5 rounded-full bg-canvas"><div className={`h-1.5 rounded-full ${strength.score >= 3 ? "bg-emerald-600" : strength.score === 2 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${((strength.score + 1) / 5) * 100}%` }} /></div>
          <p className="mt-1 text-[11px] text-ink-faint">{strength.problem ?? "Senha forte."}</p>
        </div>
      )}
      <Field label="Repita a senha"><Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
      <label className="flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Anotei a senha em lugar seguro e entendi que, sem ela, os dados não podem ser recuperados.</label>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      {hasDirectWrite() && <p className="text-xs text-ink-faint">Em seguida o navegador pergunta onde salvar o arquivo (ex.: Documentos).</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>Voltar</Button>
        <Button type="submit" className="flex-1" loading={busy}>Criar arquivo</Button>
      </div>
    </form>
  );
}

function Start({ onOpen }: { onOpen: (f: OpenFile) => void }) {
  const [step, setStep] = useState<"menu" | "senha" | "criar">("menu");
  const [pending, setPending] = useState<{ file: DataFile; name: string; handle: FileHandle | null } | null>(null);
  const [recent, setRecent] = useState<FileHandle | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    rememberedHandle().then((h) => setRecent(h ?? null));
  }, []);

  async function choose(handle?: FileHandle) {
    setErr("");
    try {
      let text: string, name: string, h: FileHandle | null;
      if (handle) {
        if (!(await ensureWritePermission(handle))) throw new Error("Sem permissão para usar o arquivo. Clique de novo e escolha “Permitir”.");
        const file = await handle.getFile();
        text = await file.text();
        name = file.name;
        h = handle;
      } else {
        ({ text, name, handle: h } = await pickExisting());
        if (h && !(await ensureWritePermission(h))) h = null;
      }
      setPending({ file: parseDataFile(text), name, handle: h });
      setStep("senha");
    } catch (e) {
      if (!isAbort(e)) setErr(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Brand />
        <Card className="p-6">
          {step === "menu" && (
            <div className="space-y-3">
              {recent && (
                <Button className="w-full justify-start" onClick={() => choose(recent)}><FolderOpen className="h-4 w-4" /> Abrir “{recent.name}”</Button>
              )}
              <Button variant={recent ? "secondary" : "primary"} className="w-full justify-start" onClick={() => choose()}><FolderOpen className="h-4 w-4" /> {recent ? "Abrir outro arquivo" : "Abrir meu arquivo de dados"}</Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => setStep("criar")}><FilePlus2 className="h-4 w-4" /> Criar um arquivo novo (primeiro uso)</Button>
              {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
              {!hasDirectWrite() && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Este navegador não grava direto no arquivo: você vai usar o botão <b>Salvar arquivo</b> para baixar a versão atualizada. Para gravação automática, use <b>Google Chrome</b> ou <b>Microsoft Edge</b>.
                </p>
              )}
            </div>
          )}
          {step === "senha" && pending && (
            <PasswordStep title="Arquivo" fileName={pending.name} onBack={() => setStep("menu")} onSubmit={async (pass) => {
              const { content, session } = await unseal<Snapshot>(pending.file, pass);
              if (content?.app !== "meu-financeiro") throw new Error("O conteúdo do arquivo não é reconhecido.");
              if (pending.handle) await rememberHandle(pending.handle);
              onOpen({ session, handle: pending.handle, name: pending.name, snapshot: content });
            }} />
          )}
          {step === "criar" && (
            <CreateStep onBack={() => setStep("menu")} onCreate={async (pass) => {
              const handle = await pickNewLocation(todayName().replace(/-\d{4}-\d{2}-\d{2}/, ""));
              const session = await newSession(pass);
              const snapshot = emptySnapshot();
              const text = JSON.stringify(await seal(snapshot, session));
              if (handle) {
                await writeToHandle(handle, text);
                await rememberHandle(handle);
              } else {
                downloadText(`meu-financeiro${FILE_EXT}`, text);
              }
              onOpen({ session, handle, name: handle?.name ?? `meu-financeiro${FILE_EXT}`, snapshot });
            }} />
          )}
        </Card>
        <PrivacyNote />
      </div>
    </div>
  );
}

/* ------------------------------- Trocar senha ------------------------------- */
function ChangePassword({ open, forced, session, onClose, onChanged }: { open: boolean; forced: boolean; session: Session; onClose: () => void; onChanged: (s: Session) => Promise<void> }) {
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passphraseStrength(p1);
  async function submit() {
    setErr("");
    if (strength.problem) return setErr(strength.problem);
    if (p1 !== p2) return setErr("As senhas novas não conferem.");
    if (p1 === cur) return setErr("A senha nova precisa ser diferente da atual.");
    setBusy(true);
    try {
      // Confere a senha atual: um teste cifrado com a sessão atual só abre com ela
      const probe = await seal({ ok: true }, session);
      await unseal(probe, cur).catch(() => { throw new Error("A senha atual não confere."); });
      await onChanged(await newSession(p1));
      setCur(""); setP1(""); setP2("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={forced ? () => undefined : onClose} title={forced ? "Crie a sua senha" : "Trocar senha"}
      footer={<>{!forced && <Button variant="secondary" onClick={onClose}>Cancelar</Button>}<Button loading={busy} onClick={submit}>Salvar nova senha</Button></>}>
      <div className="space-y-3">
        {forced && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Este arquivo veio com uma <b>senha provisória</b>. Troque agora por uma senha só sua — depois disso, a provisória deixa de funcionar.</p>}
        <Field label={forced ? "Senha provisória" : "Senha atual"}><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Nova senha" hint="Mínimo de 12 caracteres. 3 ou 4 palavras sem relação, com números ou símbolos."><Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
        {p1 && <p className="text-[11px] text-ink-faint">{strength.problem ?? "Senha forte."}</p>}
        <Field label="Repita a nova senha"><Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        <p className="text-[11px] text-ink-faint">Não existe recuperação de senha. Anote a nova senha em lugar seguro. Cópias antigas do arquivo continuam abrindo só com a senha antiga.</p>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------ App com arquivo ------------------------------ */
function Workspace({ open, onLock }: { open: OpenFile; onLock: () => void }) {
  const [save, setSave] = useState<SaveState>({ kind: "salvo", at: new Date() });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writing = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  const storeRef = useRef<MemoryStore | null>(null);
  const sessionRef = useRef<Session>(open.session);
  const [pwOpen, setPwOpen] = useState(Boolean((open.snapshot.profile as { require_password_change?: boolean }).require_password_change));
  const [pwForced, setPwForced] = useState(pwOpen);

  const flush = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    if (!open.handle) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    // Gravações em sequência: nunca duas ao mesmo tempo no mesmo arquivo
    const run = async () => {
      dirty.current = false;
      setSave({ kind: "salvando" });
      try {
        await writeToHandle(open.handle!, JSON.stringify(await seal(store.snapshot(), sessionRef.current)));
        setSave(dirty.current ? { kind: "pendente" } : { kind: "salvo", at: new Date() });
      } catch (e) {
        dirty.current = true;
        setSave({ kind: "erro", error: e instanceof Error ? e.message : String(e) });
      }
    };
    writing.current = (writing.current ?? Promise.resolve()).then(run);
    await writing.current;
  }, [open]);

  const store = useMemo(() => {
    const s = new MemoryStore(open.snapshot, () => {
      dirty.current = true;
      setSave({ kind: "pendente" });
      if (open.handle) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 600);
      }
    });
    storeRef.current = s;
    return s;
  }, [open, flush]);

  const download = useCallback(async () => {
    downloadText(todayName(), JSON.stringify(await seal(store.snapshot(), sessionRef.current)));
    dirty.current = false;
    setSave({ kind: "salvo", at: new Date() });
  }, [store]);

  async function changeSession(next: Session) {
    sessionRef.current = next;
    // Tira a marca de senha provisória e grava já com a nova senha
    await store.saveProfile({ require_password_change: false } as never);
    if (open.handle) await flush();
    else await download();
    setPwOpen(false);
    setPwForced(false);
  }

  // Aviso ao fechar com alterações não gravadas
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirty.current || save.kind === "salvando") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [save.kind]);

  // Bloqueio automático por inatividade (grava antes; sem gravação automática, só bloqueia se estiver salvo)
  const [idleWarn, setIdleWarn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (open.handle) { await flush(); onLock(); } else if (!dirty.current) onLock(); else setIdleWarn(true);
      }, IDLE_LOCK_MS);
    };
    const ev = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    ev.forEach((x) => window.addEventListener(x, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); ev.forEach((x) => window.removeEventListener(x, reset)); };
  }, [open.handle, flush, onLock]);

  const hash = useLocationHash();
  const path = hash.split("?")[0];
  const Page = ROUTES[path] ?? Overview;
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  const status = save.kind === "salvo"
    ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> {open.handle ? "Salvo no arquivo" : "Arquivo baixado"} {save.at?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
    : save.kind === "salvando" ? <span className="flex items-center gap-1 text-ink-soft"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</span>
    : save.kind === "erro" ? <span className="flex items-center gap-1 text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Não salvou: {save.error}</span>
    : <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {open.handle ? "Alterações pendentes" : "Alterações NÃO salvas"}</span>;

  return (
    <DataProvider store={store}>
      <ToastProvider>
        <div className="min-h-screen bg-canvas">
          <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:px-10">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><ShieldCheck className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold leading-tight">Meu Financeiro</p>
                  <p className="truncate text-[11px] text-ink-faint">{open.name} · sem internet</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {status}
                {open.handle
                  ? save.kind === "erro" && <Button size="sm" variant="secondary" onClick={() => void flush()}>Tentar de novo</Button>
                  : <Button size="sm" variant={dirty.current ? "primary" : "secondary"} onClick={download}><Save className="h-3.5 w-3.5" /> Salvar arquivo</Button>}
                <Button size="sm" variant="ghost" onClick={() => { setPwForced(false); setPwOpen(true); }}><KeyRound className="h-3.5 w-3.5" /> Trocar senha</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (open.handle) await flush();
                  else if (dirty.current && !confirm("Há alterações não salvas. Bloquear mesmo assim? Elas serão perdidas.")) return;
                  onLock();
                }}><Lock className="h-3.5 w-3.5" /> Bloquear</Button>
              </div>
            </div>
            {!open.handle && dirty.current && (
              <p className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">Este navegador não grava sozinho no arquivo: clique em <b>Salvar arquivo</b> antes de fechar e guarde a versão mais nova (apague as antigas).</p>
            )}
            {idleWarn && <p className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">Bloqueio automático adiado porque há alterações não salvas. Salve o arquivo.</p>}
          </header>
          <ChangePassword open={pwOpen} forced={pwForced} session={sessionRef.current} onClose={() => setPwOpen(false)} onChanged={changeSession} />
          <main className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-10">
            <FinanceNav />
            <Suspense fallback={<div className="py-20 text-center text-ink-faint"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}>
              <Page />
            </Suspense>
          </main>
        </div>
      </ToastProvider>
    </DataProvider>
  );
}

export function App() {
  const [open, setOpen] = useState<OpenFile | null>(null);
  const lock = useCallback(() => {
    setOpen(null);
    window.location.hash = "/financeiro";
  }, []);
  if (!open) return <Start onOpen={setOpen} />;
  return <Workspace key={open.session.salt + open.name} open={open} onLock={lock} />;
}

export { forgetHandle };
