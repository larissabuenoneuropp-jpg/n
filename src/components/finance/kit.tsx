"use client";
// Componentes visuais do módulo financeiro: navegação, indicadores com "de onde vem", gráficos com
// valores negativos (um eixo só, legenda, visão em tabela e dica ao passar o mouse) e campos de valor.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Info, Lightbulb, OctagonAlert } from "lucide-react";
import { Badge, Card, Input, Segmented, Spinner } from "@/components/ui";
import { SERIES_COLORS } from "@/components/charts";
import { cn } from "@/lib/utils";
import type { FinAlert } from "@/lib/finance/alerts";
import { RULE_STATUS_LABEL, type RuleMeta } from "@/lib/finance/settings";
import { compactBRL, formatBRL, parseBRNumber } from "@/lib/finance/money";

export const FIN_NAV = [
  { href: "/financeiro", label: "Visão geral" },
  { href: "/financeiro/receitas", label: "Receitas" },
  { href: "/financeiro/despesas", label: "Despesas" },
  { href: "/financeiro/fluxo", label: "Fluxo de caixa" },
  { href: "/financeiro/pro-labore", label: "Pró-labore e retiradas" },
  { href: "/financeiro/orcamento", label: "Orçamento disponível" },
  { href: "/financeiro/reservas", label: "Reservas" },
  { href: "/financeiro/projecoes", label: "Projeções e cenários" },
  { href: "/financeiro/tributario", label: "Planejamento tributário" },
  { href: "/financeiro/relatorios", label: "Relatórios" },
  { href: "/financeiro/configuracoes", label: "Configurações" },
];

export function FinanceNav() {
  const path = usePathname();
  return (
    <nav aria-label="Gestão financeira" className="no-print no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {FIN_NAV.map((n, i) => {
        const active = n.href === "/financeiro" ? path === n.href : path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-sm transition", active ? "border-brand-500 font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink")}>
            <span className="mr-1 text-[10px] text-ink-faint tabular-nums">{i + 1}.</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function FinLoading() {
  return <Spinner className="py-20" />;
}

/** Bloco "de onde vem este número" — sempre fechado por padrão para não poluir. */
export function Explain({ title = "De onde vem este valor", steps, className }: { title?: string; steps: Array<string | false | null | undefined>; className?: string }) {
  const list = steps.filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <details className={cn("group text-xs text-ink-soft", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-ink-faint hover:text-ink">
        <Info className="h-3.5 w-3.5" />
        {title}
        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1 rounded-lg bg-canvas p-3 leading-relaxed">
        {list.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </details>
  );
}

export function Kpi({
  label, value, hint, tone = "default", provisional, steps, emphasis,
}: { label: string; value: string; hint?: React.ReactNode; tone?: "default" | "good" | "bad" | "muted"; provisional?: boolean; steps?: Array<string | false | null | undefined>; emphasis?: boolean }) {
  return (
    <Card className={cn("flex flex-col p-4", emphasis && "border-brand-200 bg-brand-50/40")}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">{label}</span>
        {provisional && <Badge tone="amber">provisório</Badge>}
      </div>
      <p className={cn("mt-1.5 text-xl font-semibold tracking-tight tabular-nums", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-600", tone === "muted" && "text-ink-faint")}>{value}</p>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
      {steps && <Explain steps={steps} className="mt-2" />}
    </Card>
  );
}

export function RuleBadge({ meta }: { meta: RuleMeta }) {
  const s = RULE_STATUS_LABEL[meta.status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RuleSource({ meta }: { meta: RuleMeta }) {
  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-ink-faint">
      <p><span className="font-medium text-ink-soft">Fonte:</span> {meta.source}</p>
      {(meta.valid_from || meta.valid_to) && <p><span className="font-medium text-ink-soft">Validade:</span> {meta.valid_from ? `a partir de ${meta.valid_from.split("-").reverse().join("/")}` : ""}{meta.valid_to ? ` até ${meta.valid_to.split("-").reverse().join("/")}` : ""}</p>}
      {meta.notes && <p>{meta.notes}</p>}
    </div>
  );
}

const ALERT_STYLE = {
  critico: { cls: "border-red-200 bg-red-50 text-red-800", icon: OctagonAlert, label: "Crítico" },
  atencao: { cls: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, label: "Atenção" },
  oportunidade: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: Lightbulb, label: "Oportunidade" },
  info: { cls: "border-line bg-canvas text-ink-soft", icon: Info, label: "Informação" },
};

export function AlertList({ alerts, limit }: { alerts: FinAlert[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const list = limit && !all ? alerts.slice(0, limit) : alerts;
  if (!alerts.length) return <p className="px-5 py-4 text-sm text-ink-faint">Nenhum alerta no momento.</p>;
  return (
    <div className="space-y-2 p-4">
      {list.map((a) => {
        const st = ALERT_STYLE[a.level];
        const Icon = st.icon;
        const body = (
          <div className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", st.cls)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-label={st.label} />
            <div className="min-w-0">
              <p className="font-medium">{a.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">{a.message}</p>
            </div>
          </div>
        );
        return a.href ? <Link key={a.id} href={a.href} className="block hover:opacity-90">{body}</Link> : <div key={a.id}>{body}</div>;
      })}
      {limit && alerts.length > limit && (
        <button className="text-xs text-brand-700 hover:underline" onClick={() => setAll(!all)}>{all ? "Mostrar menos" : `Ver todos os ${alerts.length} alertas`}</button>
      )}
    </div>
  );
}

/** Campo de valor em reais: aceita "1.234,56" ou "1234.56". */
export function MoneyInput({ value, onChange, placeholder, className, allowNegative, ...rest }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; className?: string; allowNegative?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null || value === undefined ? "" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const parsed = text === null ? value : parseBRNumber(text);
  const invalid = text !== null && text.trim() !== "" && (parsed === null || (!allowNegative && (parsed ?? 0) < 0));
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">R$</span>
        <Input
          inputMode="decimal"
          className={cn("pl-9 tabular-nums", invalid && "border-red-300", className)}
          value={shown}
          placeholder={placeholder ?? "0,00"}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseBRNumber(e.target.value);
            if (e.target.value.trim() === "") onChange(null);
            else if (n !== null && (allowNegative || n >= 0)) onChange(Math.round(n * 100) / 100);
          }}
          onBlur={() => setText(null)}
          aria-invalid={invalid || undefined}
          {...rest}
        />
      </div>
      {invalid && <p className="mt-1 text-[11px] text-red-600">Valor inválido{!allowNegative ? " (use um número positivo)" : ""}.</p>}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <h2 className="font-display text-base font-semibold text-ink">{children}</h2>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

/* ---------------------------------- Gráfico --------------------------------- */
export interface ChartSeries {
  key: string;
  label: string;
  kind?: "bar" | "line";
  /** Linha tracejada (referência, ex.: piso de caixa). */
  dashed?: boolean;
  /** Índice fixo na paleta (a cor segue a série, nunca a posição). */
  color?: number;
}

function niceStep(range: number) {
  const raw = range / 4;
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function FinChart({ data, xKey, series, format = compactBRL, tooltipFormat = formatBRL, height = 240, title }: {
  data: Array<Record<string, number | string | null>>;
  xKey: string;
  series: ChartSeries[];
  format?: (v: number) => string;
  tooltipFormat?: (v: number) => string;
  height?: number;
  title?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  // Largura real do gráfico: textos e marcas ficam no tamanho certo em qualquer cartão
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  const W = width;
  const PAD = { l: 64, r: 16, t: 12, b: 26 };
  const vals = data.flatMap((d) => series.map((s) => d[s.key])).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const rawMin = Math.min(0, ...vals);
  const rawMax = Math.max(1, ...vals);
  const step = niceStep(rawMax - rawMin || 1);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step || step;
  const iw = W - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min || 1)) * ih;
  const group = iw / Math.max(1, data.length);
  const bars = series.filter((s) => (s.kind ?? "bar") === "bar");
  const lines = series.filter((s) => s.kind === "line");
  const gap = 2;
  const barW = bars.length ? Math.max(3, Math.min(26, (group * 0.7 - gap * (bars.length - 1)) / bars.length)) : 0;
  const cx = (i: number) => PAD.l + i * group + group / 2;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  const color = (s: ChartSeries, i: number) => SERIES_COLORS[(s.color ?? i) % SERIES_COLORS.length];
  const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(W / 56)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {title && <span className="text-xs text-ink-faint">{title}</span>}
          {series.length > 1 && series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              {s.kind === "line" ? <span className="h-0.5 w-3.5" style={{ background: color(s, i), borderTop: s.dashed ? `2px dashed ${color(s, i)}` : undefined }} /> : <span className="h-2.5 w-2.5 rounded-xs" style={{ background: color(s, i) }} />}
              {s.label}
            </span>
          ))}
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: "chart", label: "Gráfico" }, { value: "table", label: "Tabela" }]} />
      </div>
      {!vals.some((v) => v !== 0) ? (
        <p className="flex items-center justify-center rounded-lg bg-canvas text-xs text-ink-faint" style={{ height: Math.min(height, 160) }}>Sem dados ainda — os lançamentos aparecem aqui.</p>
      ) : view === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-faint">
              <tr><th className="py-1.5 pr-3 font-medium" />{series.map((s) => <th key={s.key} className="py-1.5 pr-3 text-right font-medium">{s.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 text-ink-soft">{d[xKey]}</td>
                  {series.map((s) => <td key={s.key} className="py-1.5 pr-3 text-right tabular-nums">{typeof d[s.key] === "number" ? tooltipFormat(d[s.key] as number) : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={box}>
          <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${title ?? ""} ${series.map((s) => s.label).join(", ")}`} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#cdbfae" : "#f1ebe3"} />
                <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="#8f847b">{format(t)}</text>
              </g>
            ))}
            {data.map((d, i) => (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.l + i * group} y={PAD.t} width={group} height={ih} fill={hover === i ? "#f8f2ec" : "transparent"} />
                {bars.map((s, j) => {
                  const v = typeof d[s.key] === "number" ? (d[s.key] as number) : null;
                  if (v === null || v === 0) return null;
                  const x = PAD.l + i * group + (group - (barW * bars.length + gap * (bars.length - 1))) / 2 + j * (barW + gap);
                  const y0 = y(0);
                  const y1 = y(v);
                  const h = Math.abs(y0 - y1);
                  const r = Math.min(4, h, barW / 2);
                  const top = Math.min(y0, y1);
                  // Cantos arredondados só na ponta do dado; base reta no zero
                  const path = v >= 0
                    ? `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y0} Z`
                    : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 - r} V${y0} Z`;
                  return <path key={s.key} d={path} fill={color(s, series.indexOf(s))} />;
                })}
                {i % labelEvery === 0 && <text x={cx(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#8f847b">{d[xKey]}</text>}
              </g>
            ))}
            {lines.map((s) => {
              const idx = series.indexOf(s);
              const pts = data.map((d, i) => (typeof d[s.key] === "number" ? [cx(i), y(d[s.key] as number)] : null)).filter(Boolean) as number[][];
              return (
                <g key={s.key} pointerEvents="none">
                  <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color(s, idx)} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
                  {!s.dashed && pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={hover === i ? 4.5 : 3} fill={color(s, idx)} stroke="white" strokeWidth="2" />)}
                </g>
              );
            })}
          </svg>
          {hover !== null && data[hover] && (
            <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop"
              style={{ left: `${(cx(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})` }}>
              <p className="mb-1 font-medium text-ink">{data[hover][xKey]}</p>
              {series.map((s, i) => (
                <p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-ink-soft">
                  <span className="h-2 w-2 rounded-xs" style={{ background: color(s, i) }} />
                  {s.label}: <span className="tabular-nums text-ink">{typeof data[hover][s.key] === "number" ? tooltipFormat(data[hover][s.key] as number) : "—"}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tabela simples e responsiva para números financeiros. */
export function NumTable({ head, rows, foot, minWidth = 640 }: { head: React.ReactNode[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-canvas text-left text-xs text-ink-faint">
          <tr>{head.map((h, i) => <th key={i} className={cn("px-3 py-2 font-medium first:pl-5 last:pr-5", i > 0 && "whitespace-nowrap text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-3 py-2 first:pl-5 last:pr-5", j > 0 && "whitespace-nowrap text-right tabular-nums")}>{c}</td>)}</tr>)}
        </tbody>
        {foot && <tfoot className="border-t border-line bg-canvas font-medium"><tr>{foot.map((c, j) => <td key={j} className={cn("px-3 py-2 first:pl-5 last:pr-5", j > 0 && "text-right tabular-nums")}>{c}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

export const pctLabel = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`);
