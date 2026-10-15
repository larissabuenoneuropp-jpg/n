// Aritmética monetária em centavos inteiros: evita erros de ponto flutuante (0,1 + 0,2 ≠ 0,3).
// Todo cálculo do módulo financeiro converte para centavos na entrada e volta para reais só na saída.

export type Cents = number;

/** Reais → centavos, arredondando meio centavo para longe do zero (padrão comercial). */
export function toCents(v: number | null | undefined): Cents {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-7);
}

export const fromCents = (c: Cents) => c / 100;

/** Arredonda um valor em reais para 2 casas (via centavos). */
export const round2 = (v: number) => fromCents(toCents(v));

export function sumCents(values: Array<number | null | undefined>): Cents {
  let s = 0;
  for (const v of values) s += toCents(v);
  return s;
}

/** Soma valores em reais com precisão de centavos; devolve reais. */
export const sumMoney = (values: Array<number | null | undefined>) => fromCents(sumCents(values));

/** Multiplica um valor em reais por uma quantidade/fator e arredonda ao centavo. */
export const mulMoney = (v: number, factor: number) => round2(v * factor);

/** Percentual (0–100) com 1 casa; null quando o denominador é zero ou ausente. */
export function pct(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator)) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : brl.format(round2(v)));
export const formatPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

/** Formato curto para eixos de gráfico: R$ 8,4 mil. */
export function compactBRL(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1000) return `${sign}R$ ${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: a >= 10000 ? 0 : 1 })} mil`;
  return `${sign}R$ ${Math.round(a)}`;
}

/** Lê número digitado no formato brasileiro ("1.234,56") ou internacional ("1234.56"). */
export function parseBRNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, "");
  else if (lastComma < 0 && (s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  // "4.500" no padrão brasileiro é quatro mil e quinhentos (ponto como separador de milhar)
  else if (lastComma < 0 && /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
