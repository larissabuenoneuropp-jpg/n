"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Mail, MessageCircle, RefreshCw, Settings, ShieldCheck, XCircle } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { DEFAULT_BILLING_RULES, generateChargeQueue, STAGE_LABEL, whatsappLink } from "@/lib/billing";
import type { ChargeMessage } from "@/lib/types";
import { cn, formatDate, money } from "@/lib/utils";

const STATUS_TONE: Record<ChargeMessage["status"], { label: string; tone: "amber" | "green" | "gray" | "red" }> = {
  pendente: { label: "Aguardando aprovação", tone: "amber" },
  enviada: { label: "Enviada", tone: "green" },
  rejeitada: { label: "Rejeitada", tone: "gray" },
  cancelada: { label: "Cancelada", tone: "gray" },
  falhou: { label: "Falhou", tone: "red" },
};

function MessageCard({ m, auto, selected, onSelect, onUpdate, patientName }: {
  m: ChargeMessage; auto: { email: boolean; whatsapp: boolean }; selected: boolean; onSelect: (v: boolean) => void;
  onUpdate: (patch: Partial<ChargeMessage>) => Promise<unknown>; patientName?: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(m);
  const [sending, setSending] = useState(false);
  useEffect(() => setDraft(m), [m]);
  const pending = m.status === "pendente";
  const isAuto = m.channel === "email" ? auto.email : auto.whatsapp;

  async function approveAndSend() {
    if (!draft.recipient.trim()) return toast("Informe o destinatário (cadastre no paciente ou digite aqui).", "error");
    setSending(true);
    const now = new Date().toISOString();
    try {
      if (isAuto) {
        const res = await fetch("/api/messages/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m.channel === "email"
            ? { channel: "email", to: draft.recipient, subject: draft.subject, text: draft.body }
            : { channel: "whatsapp", to: draft.recipient, text: draft.body, params: [draft.recipient_name?.split(" ")[0] || "família", patientName?.split(" ")[0] ?? "", money(m.amount), formatDate(m.due_date)] }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          await onUpdate({ ...draft, status: "falhou", approved_at: now, error: json.error ?? "Falha no envio" });
          return toast(json.error ?? "Falha no envio", "error");
        }
        await onUpdate({ ...draft, status: "enviada", approved_at: now, sent_at: now, error: null });
        toast("Aprovada e enviada");
      } else {
        // Envio assistido: abre o WhatsApp/e-mail com a mensagem aprovada pronta para enviar
        const url = m.channel === "whatsapp"
          ? whatsappLink(draft.recipient, draft.body)
          : `mailto:${encodeURIComponent(draft.recipient)}?subject=${encodeURIComponent(draft.subject ?? "")}&body=${encodeURIComponent(draft.body)}`;
        window.open(url, "_blank", "noopener");
        await onUpdate({ ...draft, status: "enviada", approved_at: now, sent_at: now, error: "Envio assistido (aberto no WhatsApp/e-mail)" });
        toast(m.channel === "whatsapp" ? "Aprovada — confirme o envio no WhatsApp" : "Aprovada — confirme o envio no seu e-mail");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={cn("p-4", selected && "ring-2 ring-brand-200")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {pending && <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="Selecionar" />}
        {m.channel === "whatsapp" ? <MessageCircle className="h-4 w-4 text-emerald-600" /> : <Mail className="h-4 w-4 text-brand-600" />}
        <span className="text-sm font-medium">{patientName ?? "Paciente"}</span>
        <Badge>{STAGE_LABEL(m.stage)}</Badge>
        <span className="text-xs text-ink-faint">{money(m.amount)} · venc. {formatDate(m.due_date)}</span>
        <Badge tone={STATUS_TONE[m.status].tone} className="ml-auto">{STATUS_TONE[m.status].label}</Badge>
      </div>
      {pending ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={m.channel === "whatsapp" ? "WhatsApp do responsável" : "E-mail do responsável"}>
              <Input value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} />
            </Field>
            {m.channel === "email" && <Field label="Assunto"><Input value={draft.subject ?? ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>}
          </div>
          <Field label="Mensagem (edite se quiser antes de aprovar)"><Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
          {m.error && <p className="text-xs text-amber-700">⚠ {m.error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={async () => { await onUpdate({ status: "rejeitada" }); toast("Mensagem rejeitada — não será enviada"); }}><XCircle className="h-3.5 w-3.5" /> Rejeitar</Button>
            <Button size="sm" loading={sending} onClick={approveAndSend}><CheckCircle2 className="h-3.5 w-3.5" /> {isAuto ? "Aprovar e enviar" : `Aprovar e abrir ${m.channel === "whatsapp" ? "WhatsApp" : "e-mail"}`}</Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-ink-soft">
          <p className="whitespace-pre-wrap">{m.body}</p>
          <p className="mt-2 text-xs text-ink-faint">Para: {m.recipient || "—"}{m.sent_at ? ` · enviada em ${new Date(m.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}{m.error ? ` · ${m.error}` : ""}</p>
        </div>
      )}
    </Card>
  );
}

export default function ChargesPage() {
  const toast = useToast();
  const { store, profile, bump } = useData();
  const msgs = useCollection("charge_messages", { orderBy: "created_at" });
  const patients = useCollection("patients");
  const [tab, setTab] = useState<"pendentes" | "historico">("pendentes");
  const [auto, setAuto] = useState({ email: false, whatsapp: false });
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p.name])), [patients.data]);
  const rules = { ...DEFAULT_BILLING_RULES, ...(profile?.billing_rules ?? {}) };

  useEffect(() => {
    fetch("/api/messages/send").then((r) => r.json()).then((j) => setAuto({ email: Boolean(j.email), whatsapp: Boolean(j.whatsapp) })).catch(() => {});
  }, []);

  async function check() {
    setChecking(true);
    try {
      const r = await generateChargeQueue(store, profile);
      bump("charge_messages");
      toast(r.created ? `${r.created} mensagem(ns) aguardando sua aprovação` : "Nenhuma cobrança nova para hoje");
    } finally {
      setChecking(false);
    }
  }

  const pending = msgs.data.filter((m) => m.status === "pendente");
  const history = msgs.data.filter((m) => m.status !== "pendente");
  const list = tab === "pendentes" ? pending : history;

  async function bulkApprove() {
    const items = pending.filter((m) => selected.has(m.id));
    const now = new Date().toISOString();
    let ok = 0;
    for (const m of items) {
      const isAuto = m.channel === "email" ? auto.email : auto.whatsapp;
      if (!isAuto || !m.recipient) continue;
      const res = await fetch("/api/messages/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m.channel === "email" ? { channel: "email", to: m.recipient, subject: m.subject, text: m.body }
          : { channel: "whatsapp", to: m.recipient, text: m.body, params: [m.recipient_name?.split(" ")[0] || "família", pmap.get(m.patient_id ?? "")?.split(" ")[0] ?? "", money(m.amount), formatDate(m.due_date)] }),
      });
      const json = await res.json().catch(() => ({}));
      await store.update("charge_messages", m.id, res.ok ? { status: "enviada", approved_at: now, sent_at: now, error: null } : { status: "falhou", approved_at: now, error: json.error ?? "Falha" });
      if (res.ok) ok++;
    }
    bump("charge_messages");
    setSelected(new Set());
    toast(`${ok} de ${items.length} enviada(s). Itens sem envio automático configurado continuam pendentes.`);
  }

  return (
    <>
      <PageHeader title="Cobranças" subtitle="Mensagens geradas pelas datas de vencimento — nada é enviado sem a sua aprovação"
        actions={<>
          <Link href="/configuracoes?tab=cobrancas"><Button variant="secondary"><Settings className="h-4 w-4" /> Regras e mensagens</Button></Link>
          <Button onClick={check} loading={checking}><RefreshCw className="h-4 w-4" /> Verificar vencimentos</Button>
        </>} />

      <Card className="mb-4 flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-sage-700" />
        <div className="flex-1 text-ink-soft">
          {rules.enabled ? (
            <>Regras ativas: {rules.days_before ? `lembrete ${rules.days_before} dia(s) antes, ` : ""}{rules.on_due ? "no dia do vencimento, " : ""}{rules.days_after.length ? `após ${rules.days_after.join(", ")} dia(s) de atraso` : ""}. Canais: {[rules.whatsapp && "WhatsApp", rules.email && "e-mail"].filter(Boolean).join(" e ") || "nenhum"}.</>
          ) : <>As cobranças automáticas estão desligadas.</>}
          <span className="block text-xs text-ink-faint">
            Envio: e-mail {auto.email ? "automático" : "assistido (abre seu e-mail)"} · WhatsApp {auto.whatsapp ? "automático (API oficial)" : "assistido (abre o WhatsApp com a mensagem pronta)"}.
          </span>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: "pendentes", label: `Aguardando aprovação (${pending.length})` }, { value: "historico", label: `Histórico (${history.length})` }]} />
        {tab === "pendentes" && selected.size > 0 && (auto.email || auto.whatsapp) && (
          <Button size="sm" onClick={bulkApprove}><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar e enviar selecionadas ({selected.size})</Button>
        )}
      </div>

      {msgs.loading ? <Spinner /> : list.length === 0 ? (
        <Card><EmptyState icon={<BellRing className="h-5 w-5" />} title={tab === "pendentes" ? "Nenhuma cobrança aguardando aprovação" : "Nenhuma mensagem no histórico"}
          text="As mensagens são preparadas automaticamente quando você abre o sistema, conforme as datas de vencimento do Financeiro." /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <MessageCard key={m.id} m={m} auto={auto} patientName={pmap.get(m.patient_id ?? "")}
              selected={selected.has(m.id)} onSelect={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(m.id); else n.delete(m.id); return n; })}
              onUpdate={(patch) => msgs.update(m.id, patch)} />
          ))}
        </div>
      )}
    </>
  );
}
