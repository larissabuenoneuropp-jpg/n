"use client";
import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { Explain, FinLoading, Kpi, MoneyInput, NumTable, pctLabel } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import type { FinReserve, ReserveKind } from "@/lib/types";
import { RESERVE_KIND_LABEL, reserveStatus, suggestAllocation, type ReserveBase } from "@/lib/finance/reserves";
import { formatBRL } from "@/lib/finance/money";
import { uid } from "@/lib/utils";

function ReserveForm({ open, initial, onClose, onSave }: { open: boolean; initial: Partial<FinReserve> | null; onClose: () => void; onSave: (r: Partial<FinReserve>) => Promise<unknown> }) {
  const [f, setF] = useState<Partial<FinReserve>>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [err, setErr] = useState("");
  if (initial !== last) { setLast(initial); setF(initial ?? {}); setErr(""); }
  const set = (p: Partial<FinReserve>) => setF((x) => ({ ...x, ...p }));
  const unit = f.target_mode === "percentual_receita" ? "% da receita mensal média" : f.target_mode === "meses_custos" ? "meses de custos fixos" : "R$";
  return (
    <Modal open={open} onClose={onClose} title={f.id ? "Editar reserva" : "Nova reserva"} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={async () => {
      if (!f.name?.trim()) return setErr("Informe o nome.");
      if (f.target_value === undefined || f.target_value < 0) return setErr("Informe a meta.");
      await onSave({ ...f, movements: f.movements ?? [] });
      onClose();
    }}>Salvar</Button></>}>
      <div className="space-y-3">
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select value={f.kind ?? "emergencia"} onChange={(e) => { const kind = e.target.value as ReserveKind; set({ kind, name: f.name || RESERVE_KIND_LABEL[kind] }); }} options={Object.entries(RESERVE_KIND_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} maxLength={60} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meta em"><Select value={f.target_mode ?? "valor"} onChange={(e) => set({ target_mode: e.target.value as FinReserve["target_mode"] })} options={[{ value: "valor", label: "Valor (R$)" }, { value: "meses_custos", label: "Meses de custos fixos" }, { value: "percentual_receita", label: "% da receita mensal" }]} /></Field>
          <Field label={`Meta (${unit})`}>{f.target_mode && f.target_mode !== "valor" ? <Input type="number" min={0} step="0.5" value={f.target_value ?? ""} onChange={(e) => set({ target_value: Number(e.target.value) })} /> : <MoneyInput value={f.target_value} onChange={(v) => set({ target_value: v ?? 0 })} />}</Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Prazo da meta"><Input type="date" value={f.target_date ?? ""} onChange={(e) => set({ target_date: e.target.value || null })} /></Field>
          <Field label="Prioridade" hint="1 = primeiro"><Input type="number" min={1} max={9} value={f.priority ?? 1} onChange={(e) => set({ priority: Number(e.target.value) || 1 })} /></Field>
          <Field label="Aporte mensal planejado"><MoneyInput value={f.monthly_contribution} onChange={(v) => set({ monthly_contribution: v })} /></Field>
        </div>
        <Field label="Observações"><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function ReservesPage() {
  const f = useFinance();
  const toast = useToast();
  const [modal, setModal] = useState<Partial<FinReserve> | null>(null);
  const [move, setMove] = useState<{ reserve: FinReserve; sign: 1 | -1; amount: number | null; note: string } | null>(null);
  const [available, setAvailable] = useState<number | null | undefined>(undefined);
  const a = f.analysis;
  if (f.loading || !a) return <FinLoading />;
  const proj = a.projections.realista.months;
  const base: ReserveBase = {
    avgMonthlyRevenue: a.stats.avgMonthlyRevenue ?? proj[0]?.grossRevenue ?? 0,
    avgMonthlyFixedCosts: a.stats.avgFixedCosts ?? (proj[0] ? proj[0].fixedCosts + proj[0].operatingTaxes : 0),
  };
  const statuses = f.data.reserves.map((r) => reserveStatus(r, base, f.today));
  const taxes = a.budget.lines.find((l) => l.key === "tributos")!;
  const surplus = proj.slice(0, 6).reduce((s, m) => s + Math.max(0, m.netResult - m.proLabore), 0) / Math.max(1, Math.min(6, proj.length));
  const avail = available === undefined ? Math.max(0, Math.min(a.budget.freeCash ?? 0, surplus)) : available ?? 0;
  const alloc = suggestAllocation(statuses, avail);

  return (
    <>
      <PageHeader title="Reservas" subtitle="Dinheiro separado por finalidade. Continua na conta, mas deixa de contar como disponível."
        actions={<Button onClick={() => setModal({ kind: "emergencia", name: RESERVE_KIND_LABEL.emergencia, target_mode: "meses_custos", target_value: 3, priority: 1, movements: [] })}><Plus className="h-4 w-4" /> Nova reserva</Button>} />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Kpi label="Impostos e obrigações tributárias (automática)" value={formatBRL(taxes.amount)} hint="Não é lucro nem capital livre" steps={[taxes.detail, "Calculada a partir dos recebimentos e das regras tributárias; não precisa de aporte manual (evita contar duas vezes)."]} />
        <Kpi label="Capital de giro (automática)" value={formatBRL(a.projections.conservador.minCash)} provisional={a.projections.conservador.minCashProvisional} hint="= saldo mínimo de segurança" steps={["Definido em Configurações › Saldo mínimo. Enquanto não definido: 1 mês de custos operacionais projetados."]} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Contas gerenciais" subtitle={`Base das metas: receita média ${formatBRL(base.avgMonthlyRevenue)}/mês · custos fixos médios ${formatBRL(base.avgMonthlyFixedCosts)}/mês`} />
        {statuses.length === 0 ? (
          <EmptyState title="Nenhuma reserva criada" text="Sugestões: emergência (3 a 6 meses de custos fixos — defina o seu número), despesas anuais previsíveis, férias/meses fracos e equipamentos."
            action={<div className="flex flex-wrap justify-center gap-2">{(["emergencia", "anuais", "ferias", "equipamentos"] as ReserveKind[]).map((k, i) => <Button key={k} variant="secondary" size="sm" onClick={() => setModal({ kind: k, name: RESERVE_KIND_LABEL[k], target_mode: k === "emergencia" ? "meses_custos" : "valor", target_value: k === "emergencia" ? 3 : 0, priority: i + 1, movements: [] })}>{RESERVE_KIND_LABEL[k]}</Button>)}</div>} />
        ) : (
          <NumTable minWidth={900} head={["Reserva", "Saldo", "Meta", "Falta", "Progresso", "Aporte necessário/mês", ""]}
            rows={statuses.map((st) => [
              <div key="n"><p className="font-medium">{st.reserve.name}</p><p className="text-xs text-ink-faint">{RESERVE_KIND_LABEL[st.reserve.kind]} · prioridade {st.reserve.priority}{st.reserve.monthly_contribution ? ` · aporte planejado ${formatBRL(st.reserve.monthly_contribution)}` : ""}</p></div>,
              formatBRL(st.balance),
              <span key="t">{formatBRL(st.target)}<span className="block text-[11px] text-ink-faint">{st.reserve.target_mode === "meses_custos" ? `${st.reserve.target_value} meses de custos` : st.reserve.target_mode === "percentual_receita" ? `${st.reserve.target_value}% da receita` : "valor fixo"}</span></span>,
              formatBRL(st.gap),
              <div key="p" className="ml-auto w-24"><div className="h-1.5 rounded-full bg-canvas"><div className="h-1.5 rounded-full bg-sage-600" style={{ width: `${st.progress * 100}%` }} /></div><span className="text-[11px] text-ink-faint">{pctLabel(st.progress, 0)}</span></div>,
              <span key="m">{formatBRL(st.neededMonthly)}<span className="block text-[11px] text-ink-faint">{st.monthsLeft ? `${st.monthsLeft} meses até o prazo` : "meta em 12 meses"}</span></span>,
              <div key="a" className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" title="Aportar" onClick={() => setMove({ reserve: st.reserve, sign: 1, amount: st.neededMonthly || null, note: "" })}><ArrowUpCircle className="h-4 w-4 text-emerald-600" /></Button>
                <Button variant="ghost" size="sm" title="Usar" onClick={() => setMove({ reserve: st.reserve, sign: -1, amount: null, note: "" })}><ArrowDownCircle className="h-4 w-4 text-amber-600" /></Button>
                <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setModal(st.reserve)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir esta reserva? O dinheiro volta a contar como disponível.")) await f.remove("fin_reserves", st.reserve.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>,
            ])} />
        )}
      </Card>

      {statuses.length > 0 && (
        <Card>
          <CardHeader title="Sugestão de aportes" subtitle="Por prioridade, cada reserva recebe até o aporte necessário do mês — sem percentual fixo universal" />
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <div className="space-y-2">
              <Field label="Valor disponível para reservas" hint={`Sugerido: menor entre o caixa livre (${formatBRL(a.budget.freeCash)}) e a sobra média projetada após o pró-labore (${formatBRL(surplus)}).`}>
                <MoneyInput value={avail} onChange={(v) => setAvailable(v)} />
              </Field>
              <Explain steps={["A sobra média considera os próximos 6 meses do cenário realista: lucro líquido − pró-labore.", "Prioridade 1 é atendida primeiro. Uma reserva sem prazo tem meta em 12 meses.", "Você pode simular outros valores: nada é gravado até clicar em “Registrar aportes”."]} />
            </div>
            <div className="lg:col-span-2">
              {alloc.allocations.length === 0 ? <p className="text-sm text-ink-faint">Nada a aportar com esse valor (ou todas as metas atingidas).</p> : (
                <>
                  <NumTable minWidth={400} head={["Reserva", "Aporte", "Motivo"]} rows={alloc.allocations.map((x) => [x.name, formatBRL(x.amount), <span key="r" className="text-xs text-ink-soft">{x.reason}</span>])} foot={["Sobra", formatBRL(alloc.leftover), ""]} />
                  <Button className="mt-3" onClick={async () => {
                    if (!confirm(`Registrar ${alloc.allocations.length} aporte(s) hoje?`)) return;
                    for (const x of alloc.allocations) {
                      const r = f.data.reserves.find((y) => y.id === x.reserveId)!;
                      await f.save("fin_reserves", { id: r.id, movements: [...(r.movements ?? []), { id: uid(), date: f.today, amount: x.amount, note: "Aporte sugerido" }] });
                    }
                    toast("Aportes registrados");
                  }}>Registrar aportes</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <ReserveForm open={Boolean(modal)} initial={modal} onClose={() => setModal(null)} onSave={async (r) => { await f.save("fin_reserves", r as Partial<FinReserve> & { id?: string }); toast("Reserva salva"); }} />
      <Modal open={Boolean(move)} onClose={() => setMove(null)} title={move ? `${move.sign > 0 ? "Aportar em" : "Usar de"} ${move.reserve.name}` : ""}
        footer={<><Button variant="secondary" onClick={() => setMove(null)}>Cancelar</Button><Button onClick={async () => {
          if (!move || !move.amount || move.amount <= 0) return;
          await f.save("fin_reserves", { id: move.reserve.id, movements: [...(move.reserve.movements ?? []), { id: uid(), date: f.today, amount: move.sign * move.amount, note: move.note }] });
          setMove(null);
          toast("Movimento registrado");
        }}>Confirmar</Button></>}>
        {move && (
          <div className="space-y-3">
            <Field label="Valor"><MoneyInput value={move.amount} onChange={(v) => setMove({ ...move, amount: v })} /></Field>
            <Field label="Observação"><Input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} /></Field>
            <p className="text-xs text-ink-faint">É uma separação gerencial: não movimenta o banco. Se você usar uma conta separada para a reserva, registre também a transferência no extrato.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
