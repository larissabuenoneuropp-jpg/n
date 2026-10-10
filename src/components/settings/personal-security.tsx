"use client";
import { useEffect, useState } from "react";
import { KeyRound, Lock, Server } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { passphraseProblem, StrengthMeter } from "@/components/vault-gate";
import { changePassphrase, decryptBackup, isEncryptedBackup, vaultKdf, type Kdf } from "@/lib/data/vault";
import { getLockSettings, setLockSettings, type LockSettings } from "@/lib/lock-settings";
import { getAccessKey, setAccessKey } from "@/lib/api-client";
import { DemoStore } from "@/lib/data/demo-store";

/** Senha do cofre: trocar e bloquear agora. */
export function VaultCard() {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockCfg, setLockCfg] = useState<LockSettings>(getLockSettings);
  const [kdf, setKdf] = useState<Kdf | null>(null);
  useEffect(() => { vaultKdf().then(setKdf).catch(() => {}); }, [busy]);
  const saveLock = (patch: Partial<LockSettings>) => {
    const next = { ...lockCfg, ...patch };
    setLockCfg(next);
    setLockSettings(next);
    toast("Preferência de bloqueio salva");
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passphraseProblem(p1);
    if (problem) return toast(problem, "error");
    if (p1 !== p2) return toast("As novas senhas não são iguais.", "error");
    setBusy(true);
    try {
      await changePassphrase(cur, p1);
      setCur(""); setP1(""); setP2("");
      toast("Senha do cofre alterada. Backups antigos continuam abrindo com a senha antiga.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível alterar", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader title="Cofre (senha local)" icon={<Lock className="h-4 w-4" />} action={
        <Button size="sm" variant="secondary" onClick={() => window.dispatchEvent(new Event("np:lock"))}><Lock className="h-3.5 w-3.5" /> Bloquear agora</Button>
      } />
      <form onSubmit={submit} className="space-y-3 p-5">
        <p className="text-xs text-ink-soft">
          Os dados e arquivos ficam criptografados (AES-256) neste navegador.
          {kdf && <> Chave derivada da senha com <b>{kdf.name === "Argon2id" ? `Argon2id (${Math.round(kdf.memoryKiB / 1024)} MiB, ${kdf.iterations} passadas)` : `PBKDF2-SHA256 (${kdf.iterations.toLocaleString("pt-BR")} iterações)`}</b>.</>}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Bloquear após ficar sem uso">
            <Select value={String(lockCfg.idleMin)} onChange={(e) => saveLock({ idleMin: Number(e.target.value) as LockSettings["idleMin"] })}
              options={[5, 10, 15, 30].map((m) => ({ value: String(m), label: `${m} minutos` }))} aria-label="Bloquear após ficar sem uso" />
          </Field>
          <Field label="Ao minimizar ou trocar de aba">
            <Select value={lockCfg.onHide} onChange={(e) => saveLock({ onHide: e.target.value as LockSettings["onHide"] })} aria-label="Ao minimizar ou trocar de aba"
              options={[{ value: "now", label: "Bloquear na hora" }, { value: "1min", label: "Bloquear após 1 minuto" }, { value: "off", label: "Só pela inatividade" }]} />
          </Field>
        </div>
        <p className="text-[11px] text-ink-faint">A tela fica desfocada sempre que você sai da aba.</p>
        <Field label="Senha atual"><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nova senha"><Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
          <Field label="Repita a nova senha"><Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        </div>
        <StrengthMeter value={p1} />
        <Button type="submit" loading={busy} disabled={!cur || !p1}><KeyRound className="h-4 w-4" /> Trocar senha do cofre</Button>
      </form>
    </Card>
  );
}

/** Chave que libera as rotas do servidor (IA, Instagram, importação) só para quem a conhece. */
export function AccessKeyCard() {
  const toast = useToast();
  const [key, setKey] = useState(getAccessKey());
  const [show, setShow] = useState(false);
  return (
    <Card>
      <CardHeader title="Chave de acesso do servidor" icon={<Server className="h-4 w-4" />} />
      <div className="space-y-3 p-5 text-sm text-ink-soft">
        <p className="text-xs">
          Protege a sua chave da OpenAI e as métricas do Instagram: o servidor só atende quem enviar esta chave. Crie uma sequência longa (32+ caracteres),
          cadastre no Netlify como <code className="rounded bg-canvas px-1">APP_ACCESS_KEY</code> e cole a mesma aqui. Ela fica guardada dentro do cofre criptografado e não vai para os backups.
        </p>
        <div className="flex gap-2">
          <Input type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Cole a chave de acesso" />
          <Button variant="secondary" type="button" onClick={() => setShow((s) => !s)}>{show ? "Ocultar" : "Mostrar"}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setAccessKey(key); toast("Chave salva no cofre"); }}>Salvar chave</Button>
          <Button variant="ghost" onClick={() => {
            const bytes = crypto.getRandomValues(new Uint8Array(32));
            const k = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            setKey(k); setShow(true);
          }}>Gerar uma chave forte</Button>
        </div>
      </div>
    </Card>
  );
}

/** Restaurar backup (criptografado ou antigo, sem criptografia). */
export function RestoreBackup() {
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(data: Record<string, unknown>) {
    await DemoStore.importAll(data);
    toast("Backup restaurado");
    location.reload();
  }

  return (
    <>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
        Restaurar backup
        <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 600 * 1024 * 1024) return toast("Arquivo grande demais para ser um backup do NeuroPlanner.", "error");
          try {
            const data = JSON.parse(await file.text());
            if (isEncryptedBackup(data)) return setPending(data);
            if (!confirm("Este backup NÃO é criptografado (versão antiga). Restaurar mesmo assim? Os dados atuais deste navegador serão substituídos e passarão a ficar criptografados. Depois, apague o arquivo antigo.")) return;
            await apply(data);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Backup inválido", "error");
          }
        }} />
      </label>
      <Modal open={!!pending} onClose={() => { setPending(null); setPass(""); }} title="Abrir backup criptografado">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!pending) return;
          if (!confirm("Os dados atuais deste navegador serão substituídos pelo backup. Continuar?")) return;
          setBusy(true);
          try {
            await apply(await decryptBackup(pending, pass));
          } catch (err) {
            toast(err instanceof Error ? err.message : "Não foi possível abrir o backup", "error");
            setBusy(false);
          }
        }}>
          <p className="text-xs text-ink-soft">Digite a senha do cofre que estava em uso quando este backup foi gerado.</p>
          <Field label="Senha do backup"><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus /></Field>
          <Button type="submit" className="w-full" loading={busy} disabled={!pass}>Restaurar</Button>
        </form>
      </Modal>
    </>
  );
}
