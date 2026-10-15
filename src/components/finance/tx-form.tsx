"use client";
import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { MoneyInput } from "./kit";
import type { CostNature, Patient, TaxClass, Transaction } from "@/lib/types";
import { EXPENSE_CATEGORIES_FIN, NATURE_LABEL, PAYMENT_METHODS, SERVICE_TYPES, TAX_CLASS_LABEL, WITHDRAWAL_CATEGORY, expenseCategory } from "@/lib/finance/categories";
import { monthOf } from "@/lib/finance/calendar";
import { fromCents, toCents, formatBRL } from "@/lib/finance/money";
import type { FinanceSettings } from "@/lib/finance/settings";
import type { DataStore } from "@/lib/data/store";
import { STANDALONE } from "@/lib/finance/runtime";

export type TxDraft = Partial<Transaction>;

export function validateTx(t: TxDraft): string[] {
  const e: string[] = [];
  if (!t.type) e.push("Escolha o tipo.");
  if (!t.amount || t.amount <= 0) e.push("Informe um valor maior que zero.");
  if (!t.due_date) e.push(t.type === "retirada" ? "Informe a data." : "Informe o vencimento (ou a data prevista).");
  if (t.competence && !/^\d{4}-\d{2}$/.test(t.competence)) e.push("Competência inválida.");
  if (t.paid_at && t.status === "cancelado") e.push("Um lançamento cancelado não pode estar pago.");
  if (t.paid_at && t.status === "previsto") e.push("Lançamento pago não pode ficar como previsto: escolha \"Faturado\".");
  if (t.discount && t.discount < 0) e.push("Desconto não pode ser negativo.");
  if (t.type === "receita" && t.sessions_done !== null && t.sessions_done !== undefined && t.sessions && t.sessions_done > t.sessions + (t.replacements ?? 0)) e.push("Sessões realizadas maiores que as cobradas + reposições.");
  if (!t.category) e.push("Escolha a categoria.");
  return e;
}

export function TxForm({
  open, onClose, initial, onSave, patients, settings, store,
}: {
  open: boolean;
  onClose: () => void;
  initial: TxDraft | null;
  onSave: (t: TxDraft) => Promise<unknown>;
  patients: Patient[];
  settings: FinanceSettings;
  store: DataStore;
}) {
  const toast = useToast();
  const [f, setF] = useState<TxDraft>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  if (initial !== last) {
    setLast(initial);
    setF(initial ?? {});
    setErrors([]);
  }
  const set = (patch: TxDraft) => setF((x) => ({ ...x, ...patch }));
  const type = f.type ?? "receita";

  // Receita: valor = sessões × valor unitário − desconto (pode ser ajustado à mão)
  const recompute = (patch: TxDraft) => {
    const next = { ...f, ...patch };
    if (next.sessions && next.unit_amount) next.amount = fromCents(toCents(next.unit_amount) * next.sessions - toCents(next.discount));
    setF(next);
  };

  const cat = expenseCategory(f.category);
  const taxDefault = settings.tax.deductibility[cat.name]?.tax_class ?? cat.taxClass;

  async function submit() {
    const draft: TxDraft = {
      ...f,
      type,
      competence: f.competence || monthOf(f.service_date) || monthOf(f.due_date) || null,
      paid_at: f.paid_at || null,
      patient_id: f.patient_id || null,
      status: f.status ?? (type === "receita" ? "faturado" : null),
    };
    if (type === "retirada") draft.category = WITHDRAWAL_CATEGORY;
    if (type === "receita") {
      draft.service_type = f.service_type || f.category || "Sessão avulsa";
      draft.category = f.category || draft.service_type;
    }
    if (type === "despesa") {
      draft.category = cat.name;
      draft.nature = f.nature ?? cat.nature;
      draft.tax_class = f.tax_class ?? null;
    }
    const errs = validateTx(draft);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Não foi possível salvar."]);
    } finally {
      setSaving(false);
    }
  }

  const titles = { receita: "receita", despesa: "despesa", retirada: "retirada pessoal" };
  return (
    <Modal open={open} onClose={onClose} wide title={`${f.id ? "Editar" : "Nova"} ${titles[type]}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-4">
        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        {type === "receita" && (
          <>
            <div className={STANDALONE ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-3"}>
              {!STANDALONE && <Field label="Paciente (opcional)">
                <Select value={f.patient_id ?? ""} onChange={(e) => set({ patient_id: e.target.value || null })} placeholder="—" options={patients.map((p) => ({ value: p.id, label: settings.anonymize ? initialsLabel(p.name) : p.name }))} />
              </Field>}
              <Field label="Identificador do pagador" hint="Ex.: iniciais ou código. Evite dados clínicos.">
                <Input value={f.payer_label ?? ""} onChange={(e) => set({ payer_label: e.target.value })} maxLength={40} />
              </Field>
              <Field label="Tipo de serviço">
                <Select value={f.service_type ?? f.category ?? "Sessão avulsa"} onChange={(e) => set({ service_type: e.target.value, category: e.target.value })} options={SERVICE_TYPES} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Sessões cobradas"><Input type="number" min={0} step="1" value={f.sessions ?? ""} onChange={(e) => recompute({ sessions: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label="Valor por sessão"><MoneyInput value={f.unit_amount} onChange={(v) => recompute({ unit_amount: v })} /></Field>
              <Field label="Desconto"><MoneyInput value={f.discount} onChange={(v) => recompute({ discount: v })} /></Field>
              <Field label="Valor final" hint={f.sessions && f.unit_amount ? `${f.sessions} × ${formatBRL(f.unit_amount)}${f.discount ? ` − ${formatBRL(f.discount)}` : ""}` : "Valor contratado"}><MoneyInput value={f.amount} onChange={(v) => set({ amount: v ?? 0 })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Sessões realizadas"><Input type="number" min={0} value={f.sessions_done ?? ""} onChange={(e) => set({ sessions_done: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label="Faltas"><Input type="number" min={0} value={f.absences ?? ""} onChange={(e) => set({ absences: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label="Reposições"><Input type="number" min={0} value={f.replacements ?? ""} onChange={(e) => set({ replacements: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label="Fonte pagadora" hint="Define se entra no Carnê-Leão">
                <Select value={f.payer_kind ?? "a_confirmar"} onChange={(e) => set({ payer_kind: e.target.value as Transaction["payer_kind"] })} options={[{ value: "pf", label: "Pessoa física (família)" }, { value: "pj", label: "Pessoa jurídica (plano/empresa)" }, { value: "a_confirmar", label: "A confirmar" }]} />
              </Field>
            </div>
          </>
        )}

        {type === "despesa" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Descrição"><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} maxLength={120} /></Field>
              <Field label="Categoria">
                <Select value={cat.name} onChange={(e) => { const c = expenseCategory(e.target.value); set({ category: c.name, nature: c.nature, tax_class: null }); }} options={EXPENSE_CATEGORIES_FIN.map((c) => c.name)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Valor"><MoneyInput value={f.amount} onChange={(v) => set({ amount: v ?? 0 })} /></Field>
              <Field label="Natureza" hint="Fixa, variável, extraordinária…">
                <Select value={f.nature ?? cat.nature} onChange={(e) => set({ nature: e.target.value as CostNature })} options={Object.entries(NATURE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Classificação fiscal" hint={`Padrão da categoria: ${TAX_CLASS_LABEL[taxDefault]}`}>
                <Select value={f.tax_class ?? ""} onChange={(e) => set({ tax_class: (e.target.value || null) as TaxClass | null })} placeholder="Usar o padrão da categoria" options={Object.entries(TAX_CLASS_LABEL).map(([value, label]) => ({ value, label }))} />
              </Field>
            </div>
          </>
        )}

        {type === "retirada" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor"><MoneyInput value={f.amount} onChange={(v) => set({ amount: v ?? 0 })} /></Field>
            <Field label="Tipo de retirada">
              <Select value={f.withdrawal_kind ?? "pro_labore"} onChange={(e) => set({ withdrawal_kind: e.target.value as Transaction["withdrawal_kind"] })} options={[{ value: "pro_labore", label: "Pró-labore (retirada mensal)" }, { value: "adicional", label: "Retirada adicional" }, { value: "distribuicao", label: "Distribuição de resultado" }]} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {type === "receita" && <Field label="Data do atendimento"><Input type="date" value={f.service_date ?? ""} onChange={(e) => set({ service_date: e.target.value || null, competence: f.competence || monthOf(e.target.value) })} /></Field>}
          {type !== "retirada" && <Field label="Competência (mês)"><Input type="month" value={f.competence ?? ""} onChange={(e) => set({ competence: e.target.value || null })} /></Field>}
          <Field label={type === "retirada" ? "Data" : type === "receita" ? "Pagamento previsto" : "Vencimento"}><Input type="date" value={f.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value, ...(type === "retirada" ? { paid_at: e.target.value } : {}) })} /></Field>
          {type !== "retirada" && <Field label={type === "receita" ? "Recebido em" : "Pago em"}><Input type="date" value={f.paid_at ?? ""} onChange={(e) => set({ paid_at: e.target.value || null, ...(e.target.value && f.status === "previsto" ? { status: "faturado" } : {}) })} /></Field>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {type !== "retirada" && (
            <Field label="Status">
              <Select value={f.status ?? "faturado"} onChange={(e) => set({ status: e.target.value as Transaction["status"] })}
                options={[{ value: "previsto", label: "Previsto (ainda não confirmado)" }, { value: "faturado", label: type === "receita" ? "Faturado / confirmado" : "Confirmado" }, { value: "cancelado", label: "Cancelado" }]} />
            </Field>
          )}
          <Field label="Forma de pagamento"><Select value={f.method ?? ""} onChange={(e) => set({ method: e.target.value })} placeholder="—" options={PAYMENT_METHODS} /></Field>
          {type === "receita" && (
            <>
              <Field label="Nota fiscal / recibo">
                <Select value={f.invoice_status ?? "nao_aplica"} onChange={(e) => set({ invoice_status: e.target.value as Transaction["invoice_status"] })} options={[{ value: "nao_aplica", label: "Não se aplica" }, { value: "pendente", label: "Emitir" }, { value: "emitida", label: "Emitida" }]} />
              </Field>
              <Field label="Nº da nota / IR retido">
                <div className="flex gap-2">
                  <Input value={f.invoice_number ?? ""} onChange={(e) => set({ invoice_number: e.target.value })} placeholder="Nº" />
                  {f.payer_kind === "pj" && <MoneyInput value={f.irrf_withheld} onChange={(v) => set({ irrf_withheld: v })} placeholder="IR retido" />}
                </div>
              </Field>
            </>
          )}
        </div>

        <Field label="Observações"><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} maxLength={500} placeholder="Sem dados clínicos." /></Field>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(f.estimated)} onChange={(e) => set({ estimated: e.target.checked })} /> Valor estimado (não confirmado)</label>
          {type === "despesa" && (
            f.proof ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <button type="button" className="text-brand-700 hover:underline" onClick={async () => window.open(await store.fileUrl(f.proof!.path), "_blank")}>{f.proof.name}</button>
                <button type="button" aria-label="Remover comprovante" onClick={() => set({ proof: null })}><X className="h-3.5 w-3.5" /></button>
              </span>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-brand-700 hover:underline">
                <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Anexar comprovante"}
                <input type="file" className="hidden" accept=".pdf,image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const path = await store.upload(file, "financeiro/comprovantes");
                    set({ proof: { name: file.name, path, mime: file.type, size: file.size } });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Falha ao enviar", "error");
                  } finally {
                    setUploading(false);
                  }
                }} />
              </label>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}

export function initialsLabel(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).join("").slice(0, 4) || "—";
}

/** Nome exibido do pagador, respeitando a anonimização. */
export function payerName(t: Pick<Transaction, "payer_label" | "patient_id" | "description">, patients: Map<string, Patient>, anonymize: boolean) {
  const p = t.patient_id ? patients.get(t.patient_id) : undefined;
  if (anonymize) return t.payer_label || (p ? initialsLabel(p.name) : "—");
  return p?.name || t.payer_label || "—";
}
