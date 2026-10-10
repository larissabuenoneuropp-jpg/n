"use client";
import { useEffect, useState } from "react";
import { Building2, Download, FileText, History, KeyRound, RotateCcw, Save, ShieldCheck, Upload } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Field, Input, PageHeader, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { useData } from "@/lib/data/provider";
import { DemoStore } from "@/lib/data/demo-store";
import { DEFAULT_TEMPLATES, REPORT_TYPES, TEMPLATE_VARS } from "@/lib/templates";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AuditLog, Profile } from "@/lib/types";
import { downloadBlob } from "@/lib/utils";

type Tab = "clinica" | "modelos" | "seguranca";

const TABLE_LABEL: Record<string, string> = {
  patients: "Paciente", assessments: "Avaliação", intervention_plans: "Plano", appointments: "Agenda", session_records: "Sessão",
  activities: "Atividade", documents: "Documento", transactions: "Financeiro", reports: "Relatório", profiles: "Configurações",
};
const ACTION_LABEL: Record<string, string> = { insert: "criou", update: "alterou", delete: "excluiu" };

function ImageUpload({ label, path, onChange }: { label: string; path?: string | null; onChange: (path: string) => void }) {
  const { store } = useData();
  const toast = useToast();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (path) store.fileUrl(path).then(setSrc).catch(() => {});
  }, [path, store]);
  return (
    <div className="flex items-center gap-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-14 w-24 rounded-lg border border-line object-contain" />
      ) : (
        <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-ink-faint">sem imagem</div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-canvas">
        <Upload className="h-3.5 w-3.5" /> {label}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            onChange(await store.upload(file, "clinica"));
          } catch (err) {
            toast(err instanceof Error ? err.message : "Falha no upload", "error");
          }
        }} />
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const { store, profile, refreshProfile } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("clinica");
  const [f, setF] = useState<Partial<Profile>>({});
  const [tplType, setTplType] = useState<string>("relatorio");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    if (profile) setF({ ...profile, templates: { ...DEFAULT_TEMPLATES, ...(profile.templates ?? {}) } });
  }, [profile]);
  useEffect(() => {
    if (tab === "seguranca") store.auditLogs(100).then(setLogs).catch(() => {});
  }, [tab, store]);

  async function save() {
    setSaving(true);
    try {
      await store.saveProfile(f);
      await refreshProfile();
      toast("Configurações salvas");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    const data = await store.exportAll();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `neuroplanner-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast("Backup exportado. Guarde o arquivo em local seguro.");
  }

  async function changePassword() {
    if (pwd.length < 10) return toast("Use pelo menos 10 caracteres.", "error");
    const { error } = await getSupabaseBrowser().auth.updateUser({ password: pwd });
    if (error) return toast(error.message, "error");
    setPwd("");
    toast("Senha alterada");
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((s) => ({ ...s, [k]: v }));

  return (
    <>
      <PageHeader title="Configurações" actions={tab !== "seguranca" && <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Salvar</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "clinica", label: "Clínica e profissional", icon: <Building2 className="h-4 w-4" /> },
        { value: "modelos", label: "Modelos de documentos", icon: <FileText className="h-4 w-4" /> },
        { value: "seguranca", label: "Segurança e LGPD", icon: <ShieldCheck className="h-4 w-4" /> },
      ]} />
      <div className="pt-5">
        {tab === "clinica" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Dados da clínica" />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="Nome da clínica" className="sm:col-span-2"><Input value={f.clinic_name ?? ""} onChange={(e) => set("clinic_name", e.target.value)} /></Field>
                <Field label="CPF/CNPJ"><Input value={f.document ?? ""} onChange={(e) => set("document", e.target.value)} /></Field>
                <Field label="Chave PIX"><Input value={f.pix_key ?? ""} onChange={(e) => set("pix_key", e.target.value)} /></Field>
                <Field label="Telefone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
                <Field label="E-mail"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label="Endereço" className="sm:col-span-2" hint="Formato sugerido: Rua, nº — Cidade/UF (a cidade é usada nos documentos)"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
                <div className="sm:col-span-2"><p className="mb-1.5 text-xs font-medium text-ink-soft">Logo</p><ImageUpload label="Enviar logo" path={f.logo_url} onChange={(p) => set("logo_url", p)} /></div>
              </div>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader title="Profissional" />
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Avatar name={f.professional_name || "?"} size={44} />
                    <Field label="Nome completo" className="flex-1"><Input value={f.professional_name ?? ""} onChange={(e) => set("professional_name", e.target.value)} /></Field>
                  </div>
                  <Field label="Profissão"><Select value={f.profession ?? "Neuropsicopedagoga"} onChange={(e) => set("profession", e.target.value)} options={["Neuropsicopedagoga", "Neuropsicopedagogo", "Psicopedagoga", "Psicopedagogo", "Psicóloga", "Psicólogo", "Fonoaudióloga", "Fonoaudiólogo", "Terapeuta Ocupacional"]} /></Field>
                  <Field label="Registro (CRNPP)"><Input value={f.crnpp ?? ""} onChange={(e) => set("crnpp", e.target.value)} /></Field>
                  <div className="sm:col-span-2">
                    <p className="mb-1.5 text-xs font-medium text-ink-soft">Assinatura (imagem para documentos)</p>
                    <ImageUpload label="Enviar assinatura" path={f.signature_url} onChange={(p) => set("signature_url", p)} />
                    <p className="mt-1.5 text-[11px] text-ink-faint">Imagem da assinatura inserida nos PDFs. Não equivale a assinatura digital certificada (ICP-Brasil).</p>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Valores e agenda" />
                <div className="grid gap-3 p-5 sm:grid-cols-4">
                  <Field label="Valor padrão da sessão (R$)" className="sm:col-span-2"><Input type="number" min={0} step="0.01" value={f.default_session_value ?? 0} onChange={(e) => set("default_session_value", Number(e.target.value))} /></Field>
                  <Field label="Duração (min)" className="sm:col-span-2"><Input type="number" min={15} step={5} value={f.session_minutes ?? 50} onChange={(e) => set("session_minutes", Number(e.target.value))} /></Field>
                  <Field label="Início do expediente" className="sm:col-span-2"><Input type="time" value={(f.work_start ?? "08:00").slice(0, 5)} onChange={(e) => set("work_start", e.target.value)} /></Field>
                  <Field label="Fim do expediente" className="sm:col-span-2"><Input type="time" value={(f.work_end ?? "19:00").slice(0, 5)} onChange={(e) => set("work_end", e.target.value)} /></Field>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "modelos" && (
          <Card>
            <CardHeader title="Modelos de documentos" subtitle="Use variáveis entre chaves duplas, ex.: {{paciente}}"
              action={<Button variant="ghost" size="sm" onClick={() => set("templates", { ...f.templates, [tplType]: DEFAULT_TEMPLATES[tplType] })}><RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão</Button>} />
            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_220px]">
              <div className="space-y-3">
                <Select value={tplType} onChange={(e) => setTplType(e.target.value)} options={REPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
                <Textarea className="min-h-[50vh] font-mono text-[13px]" value={f.templates?.[tplType] ?? ""} onChange={(e) => set("templates", { ...f.templates, [tplType]: e.target.value })} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-ink-soft">Variáveis disponíveis</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARS.map((v) => <code key={v} className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-ink-soft">{`{{${v}}}`}</code>)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === "seguranca" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader title="Proteção de dados" icon={<ShieldCheck className="h-4 w-4" />} />
                <ul className="space-y-2 p-5 text-sm text-ink-soft">
                  <li>• Tráfego criptografado (HTTPS/TLS) e cabeçalhos de segurança (HSTS, anti-iframe).</li>
                  <li>• Dados isolados por profissional com Row Level Security no banco.</li>
                  <li>• Arquivos em bucket privado com links temporários (10 min).</li>
                  <li>• Sessão encerrada após 30 minutos de inatividade.</li>
                  <li>• Registro de auditoria de criação, alteração e exclusão.</li>
                  <li>• A IA recebe apenas dados clínicos pseudonimizados (sem nome, contato ou escola).</li>
                </ul>
                {!isSupabaseConfigured && <p className="mx-5 mb-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Modo demonstração: os dados ficam somente no navegador e as proteções de servidor não se aplicam. Não insira dados reais de pacientes.</p>}
              </Card>
              <Card>
                <CardHeader title="Backup e portabilidade (LGPD)" icon={<Download className="h-4 w-4" />} />
                <div className="space-y-3 p-5 text-sm text-ink-soft">
                  <p>Exporte todos os seus dados em JSON. Recomendado periodicamente, além do backup do provedor.</p>
                  <Button variant="secondary" onClick={exportData}><Download className="h-4 w-4" /> Exportar meus dados</Button>
                  {store.mode === "demo" && (
                    <Button variant="danger" onClick={() => { if (confirm("Apagar os dados da demonstração e recarregar os exemplos?")) { DemoStore.reset(); location.reload(); } }}>
                      <RotateCcw className="h-4 w-4" /> Reiniciar demonstração
                    </Button>
                  )}
                </div>
              </Card>
              {isSupabaseConfigured && (
                <Card>
                  <CardHeader title="Alterar senha" icon={<KeyRound className="h-4 w-4" />} />
                  <div className="flex gap-2 p-5">
                    <Input type="password" placeholder="Nova senha (mín. 10 caracteres)" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
                    <Button onClick={changePassword}>Alterar</Button>
                  </div>
                </Card>
              )}
            </div>
            <Card>
              <CardHeader title="Registro de atividades" icon={<History className="h-4 w-4" />} subtitle="Últimas 100 ações" />
              <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
                {logs.length === 0 && <li className="px-5 py-6 text-center text-xs text-ink-faint">Nenhum registro.</li>}
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm">
                    <span>Você {ACTION_LABEL[l.action] ?? l.action} <b className="font-medium">{TABLE_LABEL[l.table_name] ?? l.table_name}</b></span>
                    <span className="shrink-0 text-xs text-ink-faint">{new Date(l.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
