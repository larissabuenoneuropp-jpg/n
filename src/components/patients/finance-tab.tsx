"use client";
import { useMemo } from "react";
import { CheckCircle2, Plus, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Spinner, useToast } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { ReceiptsList } from "@/components/finance/receipts-list";
import { useCollection } from "@/lib/data/provider";
import { txStatus } from "@/lib/labels";
import type { Patient } from "@/lib/types";
import { MONTHS, formatDate, money, monthKey, today } from "@/lib/utils";

const compact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${Math.round(v)}`);

/** Controle financeiro individual do paciente: pagamentos, pendências, gráfico e recibos. */
export function FinanceTab({ patient }: { patient: Patient }) {
  const toast = useToast();
  const txs = useCollection("transactions", { filter: { patient_id: patient.id }, orderBy: "due_date" });
  const appts = useCollection("appointments", { filter: { patient_id: patient.id } });

  const paid = txs.data.filter((t) => t.paid_at).reduce((s, t) => s + Number(t.amount), 0);
  const pending = txs.data.filter((t) => !t.paid_at && txStatus(t).key === "pendente").reduce((s, t) => s + Number(t.amount), 0);
  const overdue = txs.data.filter((t) => txStatus(t).key === "atrasado").reduce((s, t) => s + Number(t.amount), 0);
  const done = appts.data.filter((a) => a.status === "realizado").length;

  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const k = monthKey(d);
      const ofMonth = txs.data.filter((t) => monthKey(t.due_date) === k);
      return {
        x: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        pago: ofMonth.filter((t) => t.paid_at).reduce((s, t) => s + Number(t.amount), 0),
        aberto: ofMonth.filter((t) => !t.paid_at).reduce((s, t) => s + Number(t.amount), 0),
      };
    });
  }, [txs.data]);

  async function charge(kind: "Sessão" | "Avaliação") {
    const amount = Number(kind === "Avaliação" ? patient.assessment_value : patient.session_value) || 0;
    if (!amount) return toast("Informe o valor no cadastro do paciente.", "error");
    await txs.insert({ type: "receita", category: kind, patient_id: patient.id, amount, due_date: today(), description: `${kind} — ${patient.name}` });
    toast("Cobrança lançada");
  }

  if (txs.loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total pago", money(paid), "text-emerald-700"],
          ["A vencer", money(pending), "text-ink"],
          ["Em atraso", money(overdue), overdue ? "text-red-600" : "text-ink"],
          ["Sessões realizadas", String(done), "text-ink"],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-ink-soft">{l}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${c}`}>{v}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pagamentos por mês" subtitle="Por mês de vencimento, últimos 6 meses" />
          <div className="p-5">
            <BarChart data={chart} xKey="x" series={[{ key: "pago", label: "Pago" }, { key: "aberto", label: "Em aberto" }]} format={compact} />
          </div>
        </Card>
        <ReceiptsList patientId={patient.id} />
      </div>

      <Card>
        <CardHeader title="Lançamentos do paciente" icon={<Wallet className="h-4 w-4" />}
          action={<div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => charge("Avaliação")}><Plus className="h-3.5 w-3.5" /> Cobrar avaliação</Button>
            <Button size="sm" onClick={() => charge("Sessão")}><Plus className="h-3.5 w-3.5" /> Cobrar sessão</Button>
          </div>} />
        {txs.data.length === 0 ? <EmptyState title="Nenhum lançamento" /> : (
          <ul className="divide-y divide-line">
            {txs.data.map((t) => {
              const st = txStatus(t);
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.description || t.category}</p>
                    <p className="text-xs text-ink-faint">Venc. {formatDate(t.due_date)}{t.paid_at ? ` · pago em ${formatDate(t.paid_at)}` : ""}</p>
                  </div>
                  <span className="text-sm tabular-nums">{money(t.amount)}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {!t.paid_at && (
                    <Button variant="ghost" size="sm" title="Registrar pagamento e emitir recibo"
                      onClick={async () => { await txs.update(t.id, { paid_at: today() }); toast("Pagamento registrado — recibo emitido"); }}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
