export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number | null | undefined) => brl.format(Number(v ?? 0));

/** Converte "YYYY-MM-DD" em Date local (evita deslocamento de fuso). */
export function parseDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const today = () => toISODate(new Date());

export function formatDate(d?: string | null, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  const date = d.length <= 10 ? parseDate(d) : new Date(d);
  return date.toLocaleDateString("pt-BR", opts);
}

export function formatTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ageFrom(birth?: string | null, ref = new Date()) {
  if (!birth) return null;
  const b = parseDate(birth);
  let years = ref.getFullYear() - b.getFullYear();
  let months = ref.getMonth() - b.getMonth();
  if (ref.getDate() < b.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months };
}

export function ageLabel(birth?: string | null) {
  const a = ageFrom(birth);
  if (!a) return "—";
  if (a.years < 1) return `${a.months} ${a.months === 1 ? "mês" : "meses"}`;
  return `${a.years} ${a.years === 1 ? "ano" : "anos"}${a.months ? ` e ${a.months} ${a.months === 1 ? "mês" : "meses"}` : ""}`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function monthKey(d: string | Date) {
  const date = typeof d === "string" ? parseDate(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Substitui {{chave}} em modelos de documentos. */
export function fillTemplate(tpl: string, vars: Record<string, string | number | undefined | null>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}
