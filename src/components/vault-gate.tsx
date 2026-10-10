"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Logo } from "./logo";
import { Button, Field, Input } from "./ui";
import { isPersonalMode } from "@/lib/supabase/config";
import { createVault, destroyVault, flushVault, hasPendingWrites, isUnlocked, isVaultSupported, lockVault, unlockVault, vaultExists } from "@/lib/data/vault";
import { clearFiles, isIdbAvailable } from "@/lib/data/local-files";

const IDLE_LOCK_MS = 15 * 60 * 1000; // bloqueia após 15 min sem uso

type State = "checking" | "unsupported" | "setup" | "locked" | "forgot" | "unlocked";

export function passphraseProblem(p: string) {
  if (p.length < 10) return "Use pelo menos 10 caracteres (uma frase curta é ótima: “café-azul-2026-lua”).";
  if (/^\d+$/.test(p)) return "Não use só números.";
  if (/^(.)\1+$/.test(p)) return "Evite repetir o mesmo caractere.";
  return null;
}

/** Modo pessoal: os dados só são abertos (descriptografados) depois da senha do cofre. Não é login nem conta. */
export function VaultGate({ children }: { children: React.ReactNode }) {
  if (!isPersonalMode) return <>{children}</>;
  return <Gate>{children}</Gate>;
}

function Gate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isVaultSupported()) return setState("unsupported");
    if (isUnlocked()) return setState("unlocked");
    vaultExists().then((e) => setState(e ? "locked" : "setup")).catch(() => setState("unsupported"));
  }, []);

  const lock = useCallback(async (everywhere: boolean) => {
    await lockVault(everywhere);
    // Recarrega a página para não sobrar nenhum dado na memória nem na tela
    window.location.reload();
  }, []);

  // Bloqueio manual (botão) e vindo de outra aba
  useEffect(() => {
    if (state !== "unlocked") return;
    const onLock = (e: Event) => lock(!(e as CustomEvent).detail?.remote);
    window.addEventListener("np:lock", onLock);
    return () => window.removeEventListener("np:lock", onLock);
  }, [state, lock]);

  // Bloqueio automático por inatividade + gravação ao sair da aba
  const last = useRef(Date.now());
  useEffect(() => {
    if (state !== "unlocked") return;
    const touch = () => { last.current = Date.now(); };
    const events = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const check = () => { if (Date.now() - last.current > IDLE_LOCK_MS) lock(false); };
    const iv = setInterval(check, 20_000);
    const onVis = () => { if (document.visibilityState === "hidden") void flushVault(); else check(); };
    // Se a gravação criptografada ainda estiver em andamento, o navegador pergunta antes de sair
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasPendingWrites()) return;
      void flushVault();
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
    };
  }, [state, lock]);

  if (state === "unlocked") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sage-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
          {state === "checking" && <p className="text-center text-sm text-ink-soft">Abrindo…</p>}
          {state === "unsupported" && (
            <p className="text-sm text-ink-soft">
              Este navegador não oferece o armazenamento seguro necessário (IndexedDB e criptografia). Use uma versão atual do Chrome, Edge, Firefox ou Safari, fora da janela anônima, e acesse pelo endereço com <b>https://</b>.
            </p>
          )}
          {state === "setup" && <SetupForm onDone={(migrated) => { setNotice(migrated ? "Os dados que já estavam neste navegador foram criptografados." : null); setState("unlocked"); }} />}
          {state === "locked" && <UnlockForm onDone={() => setState("unlocked")} onForgot={() => setState("forgot")} />}
          {state === "forgot" && <ForgotForm onBack={() => setState("locked")} />}
        </div>
        {notice && <p className="mt-3 text-center text-xs text-sage-700">{notice}</p>}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
          Uso pessoal: sem conta e sem servidor de dados. Tudo fica criptografado (AES-256) neste navegador, neste computador.
        </p>
      </div>
    </div>
  );
}

function SetupForm({ onDone }: { onDone: (migrated: boolean) => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passphraseProblem(p1);
    if (problem) return setErr(problem);
    if (p1 !== p2) return setErr("As duas senhas não são iguais.");
    if (!ack) return setErr("Confirme que anotou a senha.");
    setBusy(true);
    setErr(null);
    try {
      const r = await createVault(p1);
      onDone(r.migrated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível criar o cofre.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <h1 className="font-display text-lg font-semibold">Crie a senha do seu cofre</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Ela criptografa os dados dos pacientes neste computador. Não é cadastro: não pede e-mail e não sai daqui. Quem abrir o site sem a senha não vê nada.
          </p>
        </div>
      </div>
      <Field label="Senha do cofre" hint="Mínimo de 10 caracteres. Uma frase com palavras e números é fácil de lembrar e difícil de adivinhar.">
        <Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus />
      </Field>
      <Field label="Repita a senha">
        <Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
      </Field>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <b>Importante:</b> não existe “esqueci a senha”. Se você perder a senha, os dados deste navegador <b>não podem ser recuperados</b> — nem por mim, nem por ninguém. Anote-a em lugar seguro e faça backups.
      </div>
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        Anotei minha senha em lugar seguro e entendi que sem ela não há recuperação.
      </label>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <Button type="submit" className="w-full" loading={busy}>Criar cofre e entrar</Button>
    </form>
  );
}

function UnlockForm({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await unlockVault(pass);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível abrir o cofre.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <h1 className="font-display text-lg font-semibold">Cofre bloqueado</h1>
          <p className="mt-1 text-xs text-ink-soft">Digite a senha do cofre para abrir seus dados.</p>
        </div>
      </div>
      <Field label="Senha do cofre">
        <Input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
      </Field>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <Button type="submit" className="w-full" loading={busy}>Desbloquear</Button>
      <button type="button" onClick={onForgot} className="w-full text-center text-xs text-ink-faint hover:text-ink">Esqueci a senha</button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold">Esqueci a senha</h1>
      <p className="text-xs leading-relaxed text-ink-soft">
        Os dados são criptografados com a sua senha e não existe cópia dela em lugar nenhum, então <b>não há como recuperá-los</b>. A única saída é apagar o cofre deste navegador e começar de novo — e, se você tiver um backup, restaurá-lo em Configurações → Segurança (o backup abre com a senha que valia quando ele foi gerado).
      </p>
      <Field label='Para apagar tudo, digite "APAGAR"'>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onBack}>Voltar</Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={typed.trim().toUpperCase() !== "APAGAR"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await destroyVault();
            if (isIdbAvailable()) await clearFiles().catch(() => {});
            window.location.reload();
          }}
        >
          Apagar e recomeçar
        </Button>
      </div>
    </div>
  );
}
