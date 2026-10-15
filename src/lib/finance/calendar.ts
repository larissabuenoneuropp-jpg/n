// Meses e dias úteis. A capacidade semanal vira mensal pelos dias úteis reais de cada mês
// (descontando feriados e períodos sem atendimento) — nunca "4 semanas por mês".

export type Month = string; // "AAAA-MM"

export function monthOf(date: string | null | undefined): Month | null {
  if (!date || date.length < 7) return null;
  return date.slice(0, 7);
}

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthDiff(a: Month, b: Month) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function monthRange(from: Month, to: Month): Month[] {
  const out: Month[] = [];
  for (let m = from; monthDiff(m, to) >= 0; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function daysInMonth(m: Month) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export const lastDayOf = (m: Month) => `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
export const firstDayOf = (m: Month) => `${m}-01`;

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (m: Month) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
export const monthLongLabel = (m: Month) => `${MONTH_LONG[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/**
 * Feriados nacionais e datas sem expediente usuais (Carnaval, Sexta-feira Santa, Corpus Christi).
 * Carnaval e Corpus Christi são pontos facultativos em muitas cidades — editáveis nas Configurações.
 * Feriados municipais/estaduais não estão aqui: cadastre-os nas Configurações.
 */
export function nationalHolidays(year: number): Array<{ date: string; label: string }> {
  const e = easter(year);
  return [
    { date: `${year}-01-01`, label: "Confraternização Universal" },
    { date: shift(e, -48), label: "Carnaval (segunda)" },
    { date: shift(e, -47), label: "Carnaval (terça)" },
    { date: shift(e, -2), label: "Sexta-feira Santa" },
    { date: `${year}-04-21`, label: "Tiradentes" },
    { date: `${year}-05-01`, label: "Dia do Trabalho" },
    { date: shift(e, 60), label: "Corpus Christi" },
    { date: `${year}-09-07`, label: "Independência" },
    { date: `${year}-10-12`, label: "Nossa Senhora Aparecida" },
    { date: `${year}-11-02`, label: "Finados" },
    { date: `${year}-11-15`, label: "Proclamação da República" },
    { date: `${year}-11-20`, label: "Dia Nacional de Zumbi e da Consciência Negra" },
    { date: `${year}-12-25`, label: "Natal" },
  ];
}

export interface WorkCalendar {
  /** Dias da semana de atendimento (0 = domingo … 6 = sábado). */
  weekdays: number[];
  /** Datas sem atendimento além dos feriados nacionais (municipais, recessos). */
  extraHolidays?: string[];
  /** Períodos sem atendimento (férias), datas inclusivas. */
  closedPeriods?: Array<{ start: string; end: string }>;
  /** Ignora feriados nacionais (raro; ex.: atende em feriados). */
  ignoreNationalHolidays?: boolean;
}

/** Dias de atendimento no mês, já sem feriados e férias. */
export function workingDays(m: Month, cal: WorkCalendar): number {
  const year = Number(m.slice(0, 4));
  const off = new Set<string>(cal.extraHolidays ?? []);
  if (!cal.ignoreNationalHolidays) nationalHolidays(year).forEach((h) => off.add(h.date));
  let n = 0;
  const days = daysInMonth(m);
  for (let d = 1; d <= days; d++) {
    const date = `${m}-${String(d).padStart(2, "0")}`;
    const [y, mo] = m.split("-").map(Number);
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    if (!cal.weekdays.includes(wd)) continue;
    if (off.has(date)) continue;
    if ((cal.closedPeriods ?? []).some((p) => date >= p.start && date <= p.end)) continue;
    n++;
  }
  return n;
}

/**
 * Semanas equivalentes de atendimento no mês = dias de atendimento ÷ dias de atendimento por semana.
 * Ex.: outubro/2026, segunda a sexta, com o feriado de 12/10 → 21 ÷ 5 = 4,2 semanas.
 */
export function weeksInMonth(m: Month, cal: WorkCalendar): number {
  const perWeek = cal.weekdays.length || 5;
  return workingDays(m, cal) / perWeek;
}

/** Último dia útil (seg–sex, sem feriado nacional) do mês — vencimento usual do DARF do Carnê-Leão. */
export function lastBusinessDay(m: Month): string {
  const year = Number(m.slice(0, 4));
  const off = new Set(nationalHolidays(year).map((h) => h.date));
  for (let d = daysInMonth(m); d >= 1; d--) {
    const date = `${m}-${String(d).padStart(2, "0")}`;
    const [y, mo] = m.split("-").map(Number);
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    if (wd !== 0 && wd !== 6 && !off.has(date)) return date;
  }
  return lastDayOf(m);
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
