"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, useToast } from "@/components/ui";
import { Explain, FinChart, FinLoading, Kpi, MoneyInput, NumTable } from "@/components/finance/kit";
import { TxForm, type TxDraft } from "@/components/finance/tx-form";
import { useFinance } from "@/lib/finance/use-finance";
import type { Transaction } from "@/lib/types";
import { monthLabel, monthOf } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";

const KIND = { pro_labore: "Pró-labore", adicional: "Adicional", distribuicao: "Distribuição" };

export default function ProLaborePage() {
  const f = useFinance();
  const toast = useToast();
  const [planned, setPlanned] = useState<number | null | undefined>(undefined);
  const [modal, setModal] = useState<TxDraft | null>(null);
  const a = f.analysis;
  if (f.loading || !a) return <FinLoading />;
  const pl = a.prolabore;
  const value = planned === undefined ? f.settings.pro_labore_planned : planned;
  const withdrawals = f.data.transactions.filter((t) => t.type === "retirada").sort((x, y) => (y.paid_at ?? y.due_date).localeCompare(x.paid_at ?? x.due_date));
  const rec = pl.recommended.projection;

  return (
    <>
      <PageHeader title="Pró-labore e retiradas" subtitle="Quanto você pode retirar sem comprometer impostos, contas e o caixa mínimo"
        actions={<Button onClick={() => setModal({ type: "retirada", withdrawal_kind: "pro_labore", due_date: f.today, paid_at: f.today, category: "Retirada pessoal" })}><Plus className="h-4 w-4" /> Registrar retirada</Button>} />

      {pl.provisional && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Estimativa provisória — faltam dados:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{pl.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Kpi emphasis label="Pró-labore recomendado" value={formatBRL(pl.recommended.amount)} provisional={pl.provisional} hint="Cenário conservador, horizonte de 12 meses" steps={[pl.explanation[0], pl.explanation[1], pl.explanation[3]]} />
        <Kpi emphasis label="Pró-labore máximo sustentável" value={formatBRL(pl.maximum.amount)} provisional={pl.provisional} hint="Cenário realista — acima disso o caixa fura o piso" steps={[pl.explanation[2]]} />
        <Kpi emphasis label="Disponível para retirada neste mês" value={formatBRL(pl.availableNow)} provisional={a.budget.freeCash === null} hint={`Já retirado: ${formatBRL(pl.withdrawnThisMonth)}`} steps={pl.availableExplanation} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Seu pró-labore planejado" subtitle="Usado nas projeções e no orçamento" />
          <div className="space-y-3 p-5">
            <Field label="Retirada mensal planejada" hint="Deixe vazio para usar o recomendado"><MoneyInput value={value} onChange={setPlanned} /></Field>
            {value !== null && value !== undefined && value > pl.maximum.amount && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Acima do máximo sustentável ({formatBRL(pl.maximum.amount)}). Nesse valor, o caixa projetado fica abaixo do piso em {pl.maximum.bindingMonth ? monthLabel(pl.maximum.bindingMonth.month) : "algum mês"}.</p>}
            {value !== null && value !== undefined && value > pl.recommended.amount && value <= pl.maximum.amount && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Acima do recomendado: cabe no cenário realista, mas não no conservador.</p>}
            <Button className="w-full" onClick={async () => { await f.saveSettings({ pro_labore_planned: value ?? null }, `Pró-labore planejado: ${value === null || value === undefined ? "usar recomendado" : formatBRL(value)}`); setPlanned(undefined); toast("Pró-labore planejado salvo"); }}>Salvar</Button>
            <Explain title="Remuneração × distribuição de lucros" steps={[
              "Hoje, pelo arquivo do contador, você é tributada como pessoa física (Carnê-Leão). Nesse regime não existe pró-labore nem distribuição de lucros no sentido legal: todo o rendimento é seu e já é tributado no Carnê-Leão.",
              "Por isso o app separa as retiradas de forma gerencial: “pró-labore” é a retirada mensal fixa que remunera o seu trabalho; “adicional” e “distribuição” são retiradas extras quando sobra caixa.",
              "Se um dia houver CNPJ, pró-labore tem INSS/IR e lucro distribuído segue regras próprias — use o Planejamento tributário e confirme com o contador.",
            ]} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Teste do recomendado mês a mês" subtitle={`Cenário conservador com retirada de ${formatBRL(pl.recommended.amount)}/mês`} />
          <div className="p-5">
            <FinChart data={rec.months.map((m) => ({ x: monthLabel(m.month), caixa: m.cashEnd, piso: m.floor }))} xKey="x" series={[{ key: "caixa", label: "Caixa final", kind: "line", color: 1 }, { key: "piso", label: "Piso", kind: "line", dashed: true, color: 0 }]} />
            <p className="mt-3 text-xs text-ink-soft">{pl.recommended.infeasible ? `Mesmo sem retirada, o caixa conservador fica abaixo do piso em ${pl.recommended.bindingMonth ? monthLabel(pl.recommended.bindingMonth.month) : "algum mês"}.` : `Mês mais apertado: ${pl.recommended.bindingMonth ? monthLabel(pl.recommended.bindingMonth.month) : "—"} (folga ${formatBRL(pl.recommended.bindingMonth?.headroom ?? 0)}).`}</p>
            <Explain className="mt-2" title="Premissas do cenário" steps={rec.assumptions} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Retiradas registradas" subtitle="Saem do caixa, mas não são despesas do consultório" />
        {withdrawals.length === 0 ? <EmptyState title="Nenhuma retirada registrada" text="Registre cada transferência para a sua conta pessoal para acompanhar o que já foi retirado." /> : (
          <NumTable head={["Data", "Tipo", "Valor", "Mês", ""]}
            rows={withdrawals.map((t: Transaction) => [
              (t.paid_at ?? t.due_date).split("-").reverse().join("/"),
              <Badge key="k" tone={t.withdrawal_kind === "pro_labore" || !t.withdrawal_kind ? "blue" : "sage"}>{KIND[t.withdrawal_kind ?? "pro_labore"]}</Badge>,
              formatBRL(t.amount),
              monthLabel(monthOf(t.paid_at ?? t.due_date)!),
              <div key="a" className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setModal(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir esta retirada?")) await f.remove("transactions", t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>,
            ])} />
        )}
      </Card>

      <TxForm open={Boolean(modal)} initial={modal} onClose={() => setModal(null)} patients={f.patients} settings={f.settings} store={f.store}
        onSave={async (t) => { await f.save("transactions", { ...t, paid_at: t.paid_at ?? t.due_date } as Partial<Transaction> & { id?: string }); toast("Retirada registrada"); }} />
    </>
  );
}
