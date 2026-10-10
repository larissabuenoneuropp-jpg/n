"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui";

/**
 * Gráficos leves em SVG. Paleta categórica derivada da identidade visual (terracota, azul-água,
 * mostarda, ameixa), validada para daltonismo e visão normal — ordem fixa.
 * A mostarda tem contraste < 3:1, por isso todo gráfico tem legenda e visão em tabela.
 */
export const SERIES_COLORS = ["#b5663f", "#00909a", "#c9961a", "#8d5aa0"];

export interface Series {
  key: string;
  label: string;
}

interface ChartProps {
  data: Array<Record<string, number | string>>;
  xKey: string;
  series: Series[];
  format?: (v: number) => string;
  height?: number;
  yMax?: number;
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function DataTable({ data, xKey, series, format }: ChartProps) {
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-faint">
          <tr>
            <th className="py-1.5 pr-3 font-medium" />
            {series.map((s) => <th key={s.key} className="py-1.5 pr-3 text-right font-medium">{s.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((d, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-3 text-ink-soft">{d[xKey]}</td>
              {series.map((s) => <td key={s.key} className="py-1.5 pr-3 text-right tabular-nums">{d[s.key] === undefined ? "—" : fmt(Number(d[s.key]))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function ChartFrame({ children, props, title }: { children: React.ReactNode; props: ChartProps; title?: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {title ? <p className="text-xs text-ink-faint">{title}</p> : <Legend series={props.series} />}
        <Segmented value={view} onChange={setView} options={[{ value: "chart", label: "Gráfico" }, { value: "table", label: "Tabela" }]} />
      </div>
      {title && <Legend series={props.series} />}
      {view === "chart" ? children : <DataTable {...props} />}
    </div>
  );
}

const PAD = { l: 48, r: 28, t: 12, b: 24 };
const W = 640;

export function BarChart(props: ChartProps) {
  const { data, xKey, series, format = String, height = 220 } = props;
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(props.yMax ?? Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0)))));
  const iw = W - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const group = iw / Math.max(1, data.length);
  const gap = 2;
  const barW = Math.min(28, (group * 0.64 - gap * (series.length - 1)) / series.length);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <ChartFrame props={props}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(" e ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#f1ebe3" />
              <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="#8f847b">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = PAD.l + i * group + (group - (barW * series.length + gap * (series.length - 1))) / 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={PAD.l + i * group} y={PAD.t} width={group} height={ih} fill={hover === i ? "#f8f2ec" : "transparent"} />
                {series.map((s, j) => {
                  const v = Number(d[s.key] ?? 0);
                  const h = Math.max(0, PAD.t + ih - y(v));
                  const x = gx + j * (barW + gap);
                  const r = Math.min(4, h, barW / 2);
                  // Barra com cantos superiores arredondados, base reta no eixo
                  const path = `M${x},${PAD.t + ih} V${PAD.t + ih - h + r} Q${x},${PAD.t + ih - h} ${x + r},${PAD.t + ih - h} H${x + barW - r} Q${x + barW},${PAD.t + ih - h} ${x + barW},${PAD.t + ih - h + r} V${PAD.t + ih} Z`;
                  return h > 0 ? <path key={s.key} d={path} fill={SERIES_COLORS[j]} /> : null;
                })}
                <text x={PAD.l + i * group + group / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#8f847b">{d[xKey]}</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="#ddd2c4" />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop"
            style={{ left: `${((PAD.l + (hover + 0.5) * group) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="mb-1 font-medium text-ink">{data[hover][xKey]}</p>
            {series.map((s, j) => (
              <p key={s.key} className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[j] }} />
                {s.label}: <span className="tabular-nums text-ink">{format(Number(data[hover][s.key] ?? 0))}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

export function LineChart(props: ChartProps) {
  const { data, xKey, series, format = String, height = 220 } = props;
  const [hover, setHover] = useState<number | null>(null);
  const max = props.yMax ?? niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0)))));
  const iw = W - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = max <= 10 && Number.isInteger(max) ? Array.from({ length: max + 1 }, (_, i) => i) : Array.from({ length: 5 }, (_, i) => (i / 4) * max);

  return (
    <ChartFrame props={props}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="w-full"
          role="img"
          aria-label={series.map((s) => s.label).join(", ")}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = data.length <= 1 ? 0 : Math.round(((px - PAD.l) / iw) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#f1ebe3" />
              <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="#8f847b">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#8f847b">
              {data.length > 10 && i % Math.ceil(data.length / 8) !== 0 ? "" : d[xKey]}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#cdbfae" strokeDasharray="3 3" />}
          {series.map((s, j) => {
            const pts = data.map((d, i) => (d[s.key] === undefined ? null : [x(i), y(Number(d[s.key]))] as const)).filter(Boolean) as Array<readonly [number, number]>;
            return (
              <g key={s.key}>
                <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={SERIES_COLORS[j]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r={hover === i ? 5 : 4} fill={SERIES_COLORS[j]} stroke="white" strokeWidth="2" />
                ))}
              </g>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="#ddd2c4" />
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})` }}
          >
            <p className="mb-1 font-medium text-ink">{data[hover][xKey]}</p>
            {series.map((s, j) => (
              <p key={s.key} className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[j] }} />
                {s.label}: <span className="tabular-nums text-ink">{data[hover][s.key] === undefined ? "—" : format(Number(data[hover][s.key]))}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
