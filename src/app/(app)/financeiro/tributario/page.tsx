"use client";
import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { Explain, FinLoading, Kpi, MoneyInput, NumTable, RuleBadge, RuleSource } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import type { TaxClass } from "@/lib/types";
import { EXPENSE_CATEGORIES_FIN, TAX_CLASS_LABEL } from "@/lib/finance/categories";
import { monthLabel } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import { RULE_STATUS_LABEL, type RuleMeta, type RuleStatus, type TaxSettings } from "@/lib/finance/settings";
import { progressiveTax } from "@/lib/finance/tax";
import { uid } from "@/lib/utils";

function MetaEditor({ meta, onChange }: { meta: RuleMeta; onChange: (m: RuleMeta) => void }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-ink-faint hover:text-ink">Editar fonte, situação e validade</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Situação"><Select value={meta.status} onChange={(e) => onChange({ ...meta, status: e.target.value as RuleStatus })} options={Object.entries(RULE_STATUS_LABEL).map(([value, s]) => ({ value, label: s.label }))} /></Field>
        <Field label="Fonte"><Input value={meta.source} onChange={(e) => onChange({ ...meta, source: e.target.value })} /></Field>
        <Field label="Válida a partir de"><Input type="date" value={meta.valid_from ?? ""} onChange={(e) => onChange({ ...meta, valid_from: e.target.value || null })} /></Field>
        <Field label="Válida até"><Input type="date" value={meta.valid_to ?? ""} onChange={(e) => onChange({ ...meta, valid_to: e.target.value || null })} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea rows={2} value={meta.notes ?? ""} onChange={(e) => onChange({ ...meta, notes: e.target.value })} /></Field>
      </div>
    </details>
  );
}

function Rule({ title, meta, onMeta, children }: { title: string; meta: RuleMeta; onMeta: (m: RuleMeta) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <RuleBadge meta={meta} />
      </div>
      {children}
      <RuleSource meta={meta} />
      <MetaEditor meta={meta} onChange={onMeta} />
    </div>
  );
}

export default function TaxPage() {
  const f = useFinance();
  const toast = useToast();
  const [tab, setTab] = useState<"config" | "mensal" | "comparar">("config");
  const [draft, setDraft] = useState<TaxSettings | null>(null);
  const a = f.analysis;
  const t = draft ?? f.settings.tax;
  const dirty = draft !== null;
  const set = (patch: Partial<TaxSettings>) => setDraft({ ...t, ...patch });

  const compare = useMemo(() => {
    if (!a) return null;
    const ms = a.projections.realista.months.slice(1, 13);
    const revenue = ms.reduce((x, m) => x + m.grossRevenue, 0);
    const costs = ms.reduce((x, m) => x + m.variableCosts + m.fixedCosts + m.operatingTaxes + m.extraordinary, 0);
    const accountingPF = (t.accounting_fee.monthly_amount ?? 0) * 12;
    const irPF = ms.reduce((x, m) => x + m.incomeTax.totalProvision, 0);
    const inssPF = (t.inss.monthly_amount ?? 0) * 12;
    const pfTax = irPF + inssPF;
    const pfNet = revenue - costs - pfTax;
    const pj = t.pj;
    const pjReady = pj.das_rate !== null && pj.pro_labore !== null && pj.inss_rate_on_pro_labore !== null && pj.accounting_fee_monthly !== null;
    const das = revenue * (pj.das_rate ?? 0);
    const inssPJ = (pj.pro_labore ?? 0) * (pj.inss_rate_on_pro_labore ?? 0) * 12;
    const irPL = progressiveTax((pj.pro_labore ?? 0) - (pj.pro_labore ?? 0) * (pj.inss_rate_on_pro_labore ?? 0), t.irpf_brackets).tax * 12;
    // Custos do consultório sem a contabilidade da PF (na PJ, entra a da PJ)
    const pjCosts = costs - accountingPF + (pj.accounting_fee_monthly ?? 0) * 12 + (pj.other_monthly_costs ?? 0) * 12;
    const pjTax = das + inssPJ + irPL;
    const pjNet = revenue - pjCosts - pjTax - (pj.opening_costs ?? 0);
    return { months: ms.length, revenue, costs, pfTax, irPF, inssPF, pfNet, pjReady, das, inssPJ, irPL, pjCosts, pjTax, pjNet };
  }, [a, t]);

  if (f.loading || !a || !compare) return <FinLoading />;

  async function save() {
    await f.saveSettings({ tax: t }, "Alterou a configuração contábil e tributária");
    setDraft(null);
    toast("Configuração tributária salva — todos os cálculos foram atualizados");
  }

  const months = a.dre.slice(-12);
  return (
    <>
      <PageHeader title="Planejamento tributário" subtitle="Ferramenta gerencial: não substitui o contador nem a apuração oficial (Carnê-Leão Web)"
        actions={dirty ? <><Button variant="secondary" onClick={() => setDraft(null)}>Descartar</Button><Button onClick={save}><Save className="h-4 w-4" /> Salvar alterações</Button></> : undefined} />

      {a.missingTax.length > 0 && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800"><b>Dados faltantes:</b> {a.missingTax.map((m) => `${m.label} (${m.impact})`).join(" · ")}</div>}

      <Tabs value={tab} onChange={setTab} tabs={[{ value: "config", label: "Configuração contábil e tributária" }, { value: "mensal", label: "Imposto mês a mês" }, { value: "comparar", label: "Comparar regimes" }]} />
      <div className="mt-4" />

      {tab === "config" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Rule title="Regime de tributação" meta={t.regime_meta} onMeta={(m) => set({ regime_meta: m })}>
            <p className="text-sm">Pessoa física — profissional autônoma, Imposto de Renda mensal pelo <b>Carnê-Leão</b> (regime de caixa).</p>
          </Rule>
          <Rule title="Tabela progressiva mensal do IRPF" meta={t.irpf_meta} onMeta={(m) => set({ irpf_meta: m })}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint"><tr><th className="py-1">Até (R$)</th><th>Alíquota (%)</th><th>Parcela a deduzir</th></tr></thead>
              <tbody>
                {t.irpf_brackets.map((b, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2"><MoneyInput className="h-8" value={b.up_to} placeholder="sem limite" onChange={(v) => set({ irpf_brackets: t.irpf_brackets.map((x, j) => j === i ? { ...x, up_to: v } : x) })} /></td>
                    <td className="pr-2"><Input className="h-8" type="number" step="0.1" value={Math.round(b.rate * 1000) / 10} onChange={(e) => set({ irpf_brackets: t.irpf_brackets.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) / 100 } : x) })} /></td>
                    <td><MoneyInput className="h-8" value={b.deduction} onChange={(v) => set({ irpf_brackets: t.irpf_brackets.map((x, j) => j === i ? { ...x, deduction: v ?? 0 } : x) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-soft">Conferência: base de R$ 4.000,00 → {formatBRL(progressiveTax(4000, t.irpf_brackets).tax)} (o simulador do contador dá R$ 224,51).</p>
          </Rule>
          <Rule title="Redutor do IR mensal (Lei 15.270/2025)" meta={t.reducer.meta} onMeta={(m) => set({ reducer: { ...t.reducer, meta: m } })}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.reducer.enabled} onChange={(e) => set({ reducer: { ...t.reducer, enabled: e.target.checked } })} /> Aplicar o redutor no Carnê-Leão mensal</label>
            <p className="mt-1 text-xs text-ink-soft">Até {formatBRL(t.reducer.full_until)}: redução de até {formatBRL(t.reducer.max_reduction)}; de {formatBRL(t.reducer.full_until)} a {formatBRL(t.reducer.until)}: {t.reducer.a.toLocaleString("pt-BR")} − {t.reducer.b.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} × rendimentos; limitado ao imposto calculado. Sem o desconto simplificado (caso do Carnê-Leão), a redução máxima pode não zerar o imposto.</p>
          </Rule>
          <Rule title="Livro-caixa (despesas dedutíveis)" meta={t.livro_caixa.meta} onMeta={(m) => set({ livro_caixa: { ...t.livro_caixa, meta: m } })}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.livro_caixa.enabled} onChange={(e) => set({ livro_caixa: { ...t.livro_caixa, enabled: e.target.checked } })} /> Deduzir despesas classificadas como dedutíveis, pagas no mês</label>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={t.carry_over_excess.enabled} onChange={(e) => set({ carry_over_excess: { ...t.carry_over_excess, enabled: e.target.checked } })} /> Compensar excesso de despesas nos meses seguintes (mesmo ano) — <span className="text-ink-faint">a confirmar</span></label>
          </Rule>
          <div className="rounded-xl border border-line p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Pagamentos de quem? (Carnê-Leão × pessoa jurídica)</p><RuleBadge meta={{ source: "", status: "a_confirmar" }} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={t.unknown_payer_as_pf} onChange={(e) => set({ unknown_payer_as_pf: e.target.checked })} /> Recebimentos com pagador “a confirmar” entram no Carnê-Leão (conservador)</label>
            <p className="mt-1 text-[11px] text-ink-faint">Regra geral: o Carnê-Leão vale para rendimentos recebidos de pessoas físicas. Confirme quem paga cada paciente de plano de saúde e marque a fonte pagadora em cada contrato/receita.</p>
          </div>
          <Rule title="INSS — contribuinte individual" meta={t.inss.meta} onMeta={(m) => set({ inss: { ...t.inss, meta: m } })}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor mensal (0 se não contribui)"><MoneyInput value={t.inss.monthly_amount} onChange={(v) => set({ inss: { ...t.inss, monthly_amount: v, meta: { ...t.inss.meta, status: v === null ? "faltante" : t.inss.meta.status === "faltante" ? "premissa" : t.inss.meta.status, source: v === null ? t.inss.meta.source : t.inss.meta.status === "faltante" ? "Informado por você" : t.inss.meta.source } } })} /></Field>
              <Field label="Dia do vencimento"><Input type="number" min={1} max={31} value={t.inss.due_day} onChange={(e) => set({ inss: { ...t.inss, due_day: Number(e.target.value) || 15 } })} /></Field>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={t.deduct_inss.enabled} onChange={(e) => set({ deduct_inss: { ...t.deduct_inss, enabled: e.target.checked } })} /> Deduzir o INSS pago da base do Carnê-Leão — <span className="text-ink-faint">a confirmar</span></label>
          </Rule>
          <Rule title="ISS fixo anual" meta={t.iss.meta} onMeta={(m) => set({ iss: { ...t.iss, meta: m } })}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor anual"><MoneyInput value={t.iss.annual_amount} onChange={(v) => set({ iss: { ...t.iss, annual_amount: v, meta: { ...t.iss.meta, status: v === null ? "faltante" : t.iss.meta.status === "faltante" ? "premissa" : t.iss.meta.status } } })} /></Field>
              <Field label="Mês de pagamento"><Input type="number" min={1} max={12} value={t.iss.month} onChange={(e) => set({ iss: { ...t.iss, month: Number(e.target.value) || 1 } })} /></Field>
            </div>
          </Rule>
          <Rule title="Honorários contábeis" meta={t.accounting_fee.meta} onMeta={(m) => set({ accounting_fee: { ...t.accounting_fee, meta: m } })}>
            <Field label="Valor mensal (0 se não houver)"><MoneyInput value={t.accounting_fee.monthly_amount} onChange={(v) => set({ accounting_fee: { ...t.accounting_fee, monthly_amount: v, meta: { ...t.accounting_fee.meta, status: v === null ? "faltante" : t.accounting_fee.meta.status === "faltante" ? "premissa" : t.accounting_fee.meta.status } } })} /></Field>
          </Rule>
          <Rule title="Dependentes" meta={t.dependents.meta} onMeta={(m) => set({ dependents: { ...t.dependents, meta: m } })}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de dependentes"><Input type="number" min={0} value={t.dependents.count} onChange={(e) => set({ dependents: { ...t.dependents, count: Number(e.target.value) || 0 } })} /></Field>
              <Field label="Dedução mensal por dependente" hint="Não consta no arquivo — confirme o valor vigente"><MoneyInput value={t.dependents.amount_each} onChange={(v) => set({ dependents: { ...t.dependents, amount_each: v } })} /></Field>
            </div>
          </Rule>
          <div className="rounded-xl border border-line p-4 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Taxas anuais (alvará, vigilância sanitária, conselho/associação)</p>
              <Button size="sm" variant="secondary" onClick={() => set({ annual_fees: [...t.annual_fees, { id: uid(), label: "Nova taxa", amount: null, month: 3, meta: { source: "Informado por você", status: "faltante" } }] })}><Plus className="h-3.5 w-3.5" /> Taxa</Button>
            </div>
            <div className="space-y-2">
              {t.annual_fees.map((fee, i) => (
                <div key={fee.id} className="grid items-end gap-2 sm:grid-cols-[1fr_160px_100px_auto_auto]">
                  <Field label="Descrição"><Input value={fee.label} onChange={(e) => set({ annual_fees: t.annual_fees.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /></Field>
                  <Field label="Valor anual"><MoneyInput value={fee.amount} onChange={(v) => set({ annual_fees: t.annual_fees.map((x, j) => j === i ? { ...x, amount: v, meta: { ...x.meta, status: v === null ? "faltante" : x.meta.status === "faltante" ? "premissa" : x.meta.status } } : x) })} /></Field>
                  <Field label="Mês"><Input type="number" min={1} max={12} value={fee.month} onChange={(e) => set({ annual_fees: t.annual_fees.map((x, j) => j === i ? { ...x, month: Number(e.target.value) || 1 } : x) })} /></Field>
                  <div className="pb-2"><RuleBadge meta={fee.meta} /></div>
                  <Button variant="ghost" size="sm" className="mb-1" aria-label="Remover taxa" onClick={() => set({ annual_fees: t.annual_fees.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-line lg:col-span-2">
            <div className="px-4 pt-4"><p className="text-sm font-medium">Classificação fiscal por categoria de despesa</p><p className="text-xs text-ink-faint">“A confirmar” não é deduzido. Mude para “Dedutível” só com a confirmação do contador e marque a situação como confirmada.</p></div>
            <NumTable minWidth={760} head={["Categoria", "Classificação", "Situação", "Fonte"]}
              rows={EXPENSE_CATEGORIES_FIN.filter((c) => !c.incomeTax).map((c) => {
                const d = t.deductibility[c.name] ?? { tax_class: c.taxClass, meta: { source: c.taxSource, status: "a_confirmar" as RuleStatus } };
                const upd = (patch: Partial<typeof d>) => set({ deductibility: { ...t.deductibility, [c.name]: { ...d, ...patch } } });
                return [
                  c.name,
                  <Select key="c" className="h-8 w-56 text-xs" value={d.tax_class} onChange={(e) => upd({ tax_class: e.target.value as TaxClass })} options={Object.entries(TAX_CLASS_LABEL).map(([value, label]) => ({ value, label }))} />,
                  <Select key="s" className="h-8 w-48 text-xs" value={d.meta.status} onChange={(e) => upd({ meta: { ...d.meta, status: e.target.value as RuleStatus } })} options={Object.entries(RULE_STATUS_LABEL).map(([value, s]) => ({ value, label: s.label }))} />,
                  <span key="f" className="block max-w-72 text-left text-[11px] text-ink-faint">{d.meta.source}</span>,
                ];
              })} />
          </div>
        </div>
      )}

      {tab === "mensal" && (
        <Card>
          <CardHeader title="Imposto de renda estimado por mês (regime de caixa)" subtitle="Calculado sobre o que foi efetivamente recebido e as despesas dedutíveis pagas" />
          <NumTable minWidth={1000} head={["Mês", "Rendimentos PF", "Livro-caixa", "Base", "Carnê-Leão (DARF)", "Vencimento", "Provisão ajuste anual", "Economia se “a confirmar” for dedutível"]}
            rows={months.map((r) => [monthLabel(r.month), formatBRL(r.tax.carneBaseIncome), formatBRL(r.tax.deductions.livroCaixa), formatBRL(r.tax.carneBase), <b key="d">{formatBRL(r.tax.carneLeao)}</b>, r.tax.dueDate.split("-").reverse().join("/"), formatBRL(r.tax.annualAdjustmentProvision), formatBRL(r.tax.potentialSavingIfConfirmed)])}
            foot={["Total", formatBRL(months.reduce((x, r) => x + r.tax.carneBaseIncome, 0)), formatBRL(months.reduce((x, r) => x + r.tax.deductions.livroCaixa, 0)), "", formatBRL(months.reduce((x, r) => x + r.tax.carneLeao, 0)), "", formatBRL(months.reduce((x, r) => x + r.tax.annualAdjustmentProvision, 0)), formatBRL(months.reduce((x, r) => x + r.tax.potentialSavingIfConfirmed, 0))]} />
          <div className="border-t border-line px-5 py-3"><Explain title="Cálculo do último mês" steps={months.at(-1)?.tax.steps ?? []} /></div>
        </Card>
      )}

      {tab === "comparar" && (
        <>
          <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-xs text-ink-soft">
            Mesmas premissas para os dois lados: faturamento e custos dos próximos {compare.months} meses do cenário realista. Uma alíquota menor não significa automaticamente melhor: compare o custo total (tributos + contabilidade + obrigações) e a renda líquida.
            {!compare.pjReady && <b className="mt-1 block text-red-700">O arquivo do contador não traz dados de pessoa jurídica. Preencha abaixo com valores informados pelo contador para a sua atividade antes de tirar conclusões.</b>}
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Premissas da pessoa jurídica" subtitle="Todas a confirmar com o contador" />
              <div className="space-y-3 p-5">
                <Field label="Alíquota efetiva do DAS/impostos sobre a receita (%)"><Input type="number" step="0.01" value={t.pj.das_rate === null ? "" : Math.round(t.pj.das_rate * 10000) / 100} onChange={(e) => set({ pj: { ...t.pj, das_rate: e.target.value === "" ? null : Number(e.target.value) / 100 } })} /></Field>
                <Field label="Pró-labore mensal"><MoneyInput value={t.pj.pro_labore} onChange={(v) => set({ pj: { ...t.pj, pro_labore: v } })} /></Field>
                <Field label="INSS sobre o pró-labore (%)"><Input type="number" step="0.1" value={t.pj.inss_rate_on_pro_labore === null ? "" : Math.round(t.pj.inss_rate_on_pro_labore * 1000) / 10} onChange={(e) => set({ pj: { ...t.pj, inss_rate_on_pro_labore: e.target.value === "" ? null : Number(e.target.value) / 100 } })} /></Field>
                <Field label="Contabilidade PJ (mensal)"><MoneyInput value={t.pj.accounting_fee_monthly} onChange={(v) => set({ pj: { ...t.pj, accounting_fee_monthly: v } })} /></Field>
                <Field label="Outros custos mensais da PJ"><MoneyInput value={t.pj.other_monthly_costs} onChange={(v) => set({ pj: { ...t.pj, other_monthly_costs: v } })} /></Field>
                <Field label="Custos de abertura (uma vez)"><MoneyInput value={t.pj.opening_costs} onChange={(v) => set({ pj: { ...t.pj, opening_costs: v } })} /></Field>
                {dirty && <Button className="w-full" onClick={save}><Save className="h-4 w-4" /> Salvar premissas</Button>}
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title={`Comparação para ${compare.months} meses`} />
              <NumTable minWidth={520} head={["", "Pessoa física (atual)", "Pessoa jurídica (cenário)"]}
                rows={[
                  ["Faturamento", formatBRL(compare.revenue), formatBRL(compare.revenue)],
                  ["Custos do consultório (com contabilidade)", formatBRL(compare.costs), formatBRL(compare.pjCosts)],
                  ["Tributos sobre receita (DAS)", "—", compare.pjReady ? formatBRL(compare.das) : "preencher"],
                  ["IR", formatBRL(compare.irPF), compare.pjReady ? `${formatBRL(compare.irPL)} (sobre pró-labore)` : "preencher"],
                  ["INSS", t.inss.monthly_amount === null ? "não informado" : formatBRL(compare.inssPF), compare.pjReady ? formatBRL(compare.inssPJ) : "preencher"],
                  ["Custo tributário total", formatBRL(compare.pfTax), compare.pjReady ? formatBRL(compare.pjTax) : "preencher"],
                  ["Custos de abertura", "—", formatBRL(t.pj.opening_costs ?? 0)],
                  [<b key="r">Renda pessoal líquida estimada</b>, <b key="a">{formatBRL(compare.pfNet)}</b>, compare.pjReady ? <b key="b">{formatBRL(compare.pjNet)}</b> : "preencher"],
                ]} />
              <div className="border-t border-line px-5 py-3"><Explain steps={[
                "PF: renda líquida = faturamento − custos − IR (Carnê-Leão + provisão de ajuste) − INSS.",
                "PJ: renda líquida = faturamento − custos (com a contabilidade da PJ no lugar da PF) − DAS − INSS e IR sobre o pró-labore − abertura. O lucro que sobra na PJ é considerado distribuído a você; a tributação de lucros/dividendos depende das regras vigentes — confirme com o contador.",
                "Não considera obrigações acessórias específicas (ex.: emissão de notas, declarações da PJ) além dos custos que você informar.",
                "Impacto no caixa: na PF o IR é pago todo mês no Carnê-Leão; na PJ, o DAS é mensal sobre a receita, mesmo em meses de resultado baixo.",
              ]} /></div>
            </Card>
          </div>
          <Kpi label="Diferença estimada (PJ − PF) no período" value={compare.pjReady ? formatBRL(compare.pjNet - compare.pfNet) : "—"} hint={compare.pjReady ? "Positivo = PJ deixaria mais renda líquida, segundo as premissas informadas" : "Preencha as premissas da PJ"} />
        </>
      )}
    </>
  );
}
