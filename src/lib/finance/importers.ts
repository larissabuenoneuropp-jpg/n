// Importadores: planilha mensal de "Sessões e Financeiro", extratos/planilhas genéricas (CSV, Excel, OFX)
// e criação de contratos a partir do histórico. Tudo puro (sem tela), para poder ser testado.
// Nenhuma linha é gravada duas vezes: cada uma recebe uma chave de importação estável.
import type { FinContract, PayerKind, Transaction } from "@/lib/types";
import { addMonths, lastDayOf, monthOf, weeksInMonth, type Month } from "./calendar";
import { competenceOf } from "./ledger";
import { fromCents, parseBRNumber, toCents } from "./money";
import { workCalendar } from "./projection";
import type { FinanceSettings } from "./settings";

/* ------------------------------ Grade de células ----------------------------- */
export interface Cell { v: unknown; f?: string }
export interface Grid { name: string; rows: Cell[][] }

const cellAt = (g: Grid, r: number, c: number): Cell | undefined => g.rows[r]?.[c];
const val = (g: Grid, r: number, c: number) => cellAt(g, r, c)?.v ?? null;
const str = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v)).trim();
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? parseBRNumber(v) : null);

export function normalizeName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Datas: Date, número serial do Excel, "dd/mm/aaaa" ou "aaaa-mm-dd". */
export function toISODateLoose(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = str(v);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX: 20261005
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/* ---------------------- Planilha "Sessões e Financeiro" ---------------------- */
const MONTHS: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };

export interface SheetPatient {
  name: string;
  billedCount: number | null;
  presences: number;
  absences: number;
  unmarked: number;
  unit: number | null;
  unitFormula?: string;
  total: number | null;
  insurance: string;
  paid: boolean;
  receipt: string;
  /** Total digitado ≠ atendimentos × valor (o valor por sessão é descartado). */
  totalMismatch?: boolean;
}
export interface SheetExpense { date: string | null; value: number; description: string; rawCategory: string; formula?: string }
export interface SheetMonth {
  sheet: string;
  competence: Month;
  patients: SheetPatient[];
  expenses: SheetExpense[];
  issues: string[];
}

export function sheetCompetence(name: string): Month | null {
  const m = name.trim().toUpperCase().match(/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\.?\s*(\d{2})/);
  return m ? `20${m[2]}-${String(MONTHS[m[1]]).padStart(2, "0")}` : null;
}

function findCells(g: Grid, text: string) {
  const out: Array<[number, number]> = [];
  g.rows.forEach((row, r) => row?.forEach((c, k) => { if (c && typeof c.v === "string" && c.v.trim().toLowerCase() === text.toLowerCase()) out.push([r, k]); }));
  return out;
}

export function parseSessionsSheet(g: Grid): SheetMonth | null {
  const competence = sheetCompetence(g.name);
  if (!competence) return null;
  const issues: string[] = [];
  const hp = findCells(g, "Pacientes")[0];
  const hd = findCells(g, "DATA").find(([, c]) => c === 0);
  if (!hp || !hd) return { sheet: g.name, competence, patients: [], expenses: [], issues: ["Layout não reconhecido (cabeçalhos “Pacientes” e “DATA” não encontrados)."] };

  // Atendimentos diários
  const sessions: Array<{ name: string; status: string }> = [];
  for (let r = hd[0] + 1; r < g.rows.length; r++) {
    const d = toISODateLoose(val(g, r, 0));
    const name = str(val(g, r, 1));
    if (!d || !name || /^feriado$/i.test(name)) continue;
    sessions.push({ name, status: str(val(g, r, 2)).toUpperCase() });
  }

  const patients: SheetPatient[] = [];
  for (let r = hp[0] + 1; r < hd[0]; r++) {
    const name = str(val(g, r, 1));
    if (!name || /total de atendimentos/i.test(name)) continue;
    const unit = num(val(g, r, 3));
    const total = num(val(g, r, 4));
    const countCell = num(val(g, r, 2));
    if (unit === null && total === null && !countCell) continue;
    const norm = normalizeName(name);
    const mine = sessions.filter((s) => normalizeName(s.name) === norm);
    const p: SheetPatient = {
      name, billedCount: countCell, unit, unitFormula: cellAt(g, r, 3)?.f, total,
      presences: mine.filter((s) => s.status.startsWith("PRESEN")).length,
      absences: mine.filter((s) => s.status.startsWith("FALTA")).length,
      unmarked: mine.filter((s) => !s.status).length,
      insurance: str(val(g, r, 6)), paid: val(g, r, 8) === true, receipt: str(val(g, r, 9)),
    };
    if (total !== null && unit !== null && countCell && toCents(total) !== Math.round(toCents(unit) * countCell)) {
      issues.push(`“${name}”: total digitado (${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) diferente de ${countCell} × ${unit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Importado o total digitado.`);
      p.unit = null;
      p.totalMismatch = true;
    }
    if (total === null && countCell) issues.push(`“${name}”: ${countCell} atendimento(s) sem valor por sessão — informe o valor para importar.`);
    if (countCell && p.absences && p.presences + p.absences === countCell) issues.push(`“${name}”: a contagem (${countCell}) inclui ${p.absences} falta(s). Confirme se a falta é cobrada.`);
    patients.push(p);
  }

  // Saídas: coluna "Categoria" e, na mesma faixa de linhas, "Valor", "Descrição" e "Data"
  const hc = findCells(g, "Categoria")[0];
  const expenses: SheetExpense[] = [];
  if (hc) {
    const near = (t: string) => findCells(g, t).filter(([r, c]) => Math.abs(r - hc[0]) <= 1 && c < hc[1]).map(([, c]) => c);
    const vc = near("Valor").at(-1);
    const dc = near("Descrição")[0];
    const datec = near("Data")[0];
    if (vc !== undefined) {
      for (let r = hc[0] + 1; r < g.rows.length; r++) {
        const value = num(val(g, r, vc));
        const rawCategory = str(val(g, r, hc[1]));
        if (value === null || value <= 0) continue;
        if (!rawCategory) { if (/total/i.test(str(val(g, r, datec ?? 0)))) continue; }
        expenses.push({ date: datec !== undefined ? toISODateLoose(val(g, r, datec)) : null, value, description: dc !== undefined ? str(val(g, r, dc)) : "", rawCategory, formula: cellAt(g, r, vc)?.f });
      }
    }
  }
  // Conferência das fórmulas da própria planilha
  for (const [r, c] of findCells(g, "Totais")) {
    for (let k = c + 1; k <= c + 3; k++) {
      const cell = cellAt(g, r, k);
      if (cell?.f && /TRUE\s*\)/i.test(cell.f)) issues.push(`Fórmula de “Totais” (${cell.f}) soma TRUE (= R$ 1,00 a mais).`);
    }
  }
  const sumExp = expenses.reduce((s, e) => s + toCents(e.value), 0);
  // O resumo de despesas fica na coluna do título "Despesas" (linha "Totais" dessa coluna)
  const dcol = findCells(g, "Despesas")[0]?.[1];
  const resumo = dcol === undefined ? undefined : findCells(g, "Totais").filter(([, c]) => c === dcol).map(([r, c]) => num(val(g, r, c + 2)) ?? num(val(g, r, c + 1)))[0];
  if (resumo !== undefined && resumo !== null && toCents(resumo) !== sumExp) issues.push(`Resumo de despesas da planilha: ${fromCents(toCents(resumo)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; soma das saídas lançadas: ${fromCents(sumExp).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (fórmula de SOMASE com intervalos desalinhados).`);
  return { sheet: g.name, competence, patients, expenses, issues };
}

/** Mapeia as categorias da planilha para as categorias do app (editável na prévia). */
export function mapSheetCategory(raw: string, description: string, formula?: string): string {
  const r = normalizeName(raw);
  const d = normalizeName(description);
  if (/supervis/.test(d)) return "Supervisão profissional";
  if (/uber|99|taxi|gasolina|estacionamento|domicilio/.test(d)) return "Deslocamentos";
  if (/wordwall|software|assinatura|app/.test(d)) return "Sistemas, aplicativos e assinaturas";
  if (/brinquedo/.test(d)) return "Brinquedos e jogos terapêuticos";
  if (r.startsWith("condominio")) return "Condomínio e estrutura";
  if (r.startsWith("aluguel")) return formula && /\*\s*30|30\s*\*/.test(formula) ? "Espaço por atendimento" : /hub/.test(d) ? "Espaço por atendimento" : "Aluguel";
  if (r.startsWith("materiais")) return "Materiais e instrumentos de avaliação";
  if (r.startsWith("estudos")) return /escala|avalia|teste/.test(d) ? "Materiais e instrumentos de avaliação" : "Cursos e especializações";
  if (r.startsWith("impostos")) return "Impostos e taxas";
  if (r.startsWith("contabilidade")) return "Contabilidade";
  if (r.startsWith("manutencao")) return "Outras despesas operacionais";
  return "Outras despesas operacionais";
}

export interface ImportOptions {
  today: string;
  /** Usa códigos (iniciais) em vez de nomes. */
  anonymize: boolean;
  /** Importa meses futuros (agenda já montada) como "previsto". */
  includeFuture: boolean;
  /** Pacientes já cadastrados no app (para vincular pelo nome). */
  patients: Array<{ id: string; name: string }>;
  /** Valor por sessão informado na prévia para pacientes sem valor (chave = nome normalizado). */
  unitOverrides?: Record<string, number>;
  /** Categoria escolhida na prévia (chave = import_key). */
  categoryOverrides?: Record<string, string>;
  /** Política de faltas por paciente: true = cobra (padrão: o que a planilha somou). */
  existingKeys: Set<string>;
}

export interface ImportPlan {
  revenues: Partial<Transaction>[];
  expenses: Partial<Transaction>[];
  skipped: Array<{ key: string; reason: string }>;
  /** Mapa nome normalizado → identificador usado. */
  labels: Record<string, string>;
  possibleDuplicates: string[];
  issues: string[];
}

/** Agrupa variações do mesmo nome (ex.: erro de digitação "Corrrea" × "Correa"). */
function canonicalNames(names: string[]) {
  const canon: string[] = [];
  const map: Record<string, string> = {};
  for (const n of names.map(normalizeName)) {
    if (map[n]) continue;
    const hit = canon.find((c) => c.length > 8 && n.length > 8 && levenshtein(c, n) <= 2);
    if (hit) map[n] = hit; else { canon.push(n); map[n] = n; }
  }
  return map;
}

function initialsOf(name: string) {
  return normalizeName(name).split(" ").filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 3) || "P";
}

export function buildSheetImport(months: SheetMonth[], existing: Transaction[], o: ImportOptions): ImportPlan {
  const current = monthOf(o.today)!;
  const all = months.flatMap((m) => m.patients.map((p) => p.name));
  const canon = canonicalNames(all);
  const labels: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const labelFor = (name: string) => {
    const c = canon[normalizeName(name)] ?? normalizeName(name);
    if (!labels[c]) {
      if (o.anonymize) {
        const ini = initialsOf(name);
        counters[ini] = (counters[ini] ?? 0) + 1;
        labels[c] = `${ini}-${counters[ini]}`;
      } else labels[c] = name.replace(/\(.*?\)/g, "").trim();
    }
    return { canon: c, label: labels[c] };
  };
  const patientId = (name: string) => {
    const n = canon[normalizeName(name)] ?? normalizeName(name);
    return o.patients.find((p) => (canon[normalizeName(p.name)] ?? normalizeName(p.name)) === n || levenshtein(normalizeName(p.name), n) <= 2)?.id ?? null;
  };

  const revenues: Partial<Transaction>[] = [];
  const expenses: Partial<Transaction>[] = [];
  const skipped: ImportPlan["skipped"] = [];
  const issues: string[] = [];
  const existingKeys = o.existingKeys;
  const possibleDuplicates: string[] = [];

  for (const m of months.sort((a, b) => a.competence.localeCompare(b.competence))) {
    const future = m.competence > current;
    if (future && !o.includeFuture) { skipped.push({ key: m.sheet, reason: "Mês futuro (previsão) — não importado" }); continue; }
    issues.push(...m.issues.map((i) => `${m.sheet}: ${i}`));
    const last = lastDayOf(m.competence);
    const paidDate = last > o.today ? o.today : last;
    for (const p of m.patients) {
      const { canon: cn, label } = labelFor(p.name);
      const key = `sheet:${m.competence}:rec:${cn}`;
      if (existingKeys.has(key)) { skipped.push({ key, reason: "Já importado" }); continue; }
      const unit = p.unit ?? o.unitOverrides?.[cn] ?? null;
      const count = p.billedCount ?? p.presences + p.absences + p.unmarked;
      const amount = p.total ?? (unit !== null && count ? fromCents(toCents(unit) * count) : null);
      if (amount === null || amount <= 0) { skipped.push({ key, reason: `${label}: sem valor` }); continue; }
      const ins = normalizeName(p.insurance);
      const payer: PayerKind = /plano|convenio|unimed/.test(ins) ? "a_confirmar" : /particular|pix/.test(ins) || /pf/i.test(p.receipt) ? "pf" : "a_confirmar";
      const service = p.unit === null && p.total !== null && !p.totalMismatch ? "Pacote mensal" : payer === "a_confirmar" && /plano/.test(ins) ? "Sessão (convênio)" : /reposi/i.test(p.name) ? "Reposição" : /anamnese/i.test(p.name) ? "Avaliação" : "Sessão avulsa";
      const marked = p.presences + p.absences > 0;
      const dup = existing.find((t) => t.type === "receita" && !t.import_key && competenceOf(t) === m.competence && Math.abs(t.amount - amount) < 0.01);
      if (dup) possibleDuplicates.push(`${m.sheet} · ${label} · ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — já existe um lançamento manual com o mesmo valor no mês`);
      revenues.push({
        type: "receita", category: service, service_type: service, competence: m.competence, payer_label: label, patient_id: patientId(p.name), payer_kind: payer,
        sessions: count || null, sessions_done: marked ? p.presences : null, absences: marked ? p.absences : null, unit_amount: unit, amount,
        status: future ? "previsto" : "faturado", due_date: last, paid_at: !future && p.paid ? paidDate : null, dates_estimated: true,
        method: /pix/i.test(p.receipt) || /pix/.test(ins) ? "PIX" : undefined, import_key: key,
        notes: `Importado da planilha (${m.sheet}). Data de recebimento não registrada na planilha: usada a do fim do mês.${p.unitFormula ? ` Valor: ${p.unitFormula}.` : ""}${payer === "a_confirmar" ? " Fonte pagadora a confirmar (plano de saúde)." : ""}`,
      });
    }
    const seen: Record<string, number> = {};
    for (const e of m.expenses) {
      const base = `sheet:${m.competence}:exp:${normalizeName(e.rawCategory)}:${toCents(e.value)}:${normalizeName(e.description)}`;
      seen[base] = (seen[base] ?? 0) + 1;
      const key = `${base}:${seen[base]}`;
      if (existingKeys.has(key)) { skipped.push({ key, reason: "Já importado" }); continue; }
      const category = o.categoryOverrides?.[key] ?? mapSheetCategory(e.rawCategory, e.description, e.formula);
      const dup = existing.find((t) => t.type === "despesa" && !t.import_key && competenceOf(t) === m.competence && t.category === category && Math.abs(t.amount - e.value) < 0.01);
      if (dup) possibleDuplicates.push(`${m.sheet} · ${category} · ${e.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — já existe um lançamento manual igual`);
      const date = e.date && monthOf(e.date) === m.competence ? e.date : null;
      const isCurrent = m.competence === current;
      // Mês fechado: considera paga (data estimada). Mês em andamento: só é paga se a planilha trouxer a data.
      const paid = future ? null : date && date <= o.today ? date : isCurrent ? null : paidDate;
      // Custo calculado por fórmula no mês em andamento (ex.: atendimentos × R$ 30) ainda é estimativa
      const estimatedNow = (isCurrent || future) && Boolean(e.formula);
      expenses.push({
        type: "despesa", category, description: e.description || e.rawCategory, amount: e.value, competence: m.competence,
        due_date: date ?? last, paid_at: paid, status: future || estimatedNow ? "previsto" : "faturado", estimated: estimatedNow || undefined,
        dates_estimated: !date, import_key: key, notes: `Importado da planilha (${m.sheet}, categoria original “${e.rawCategory}”)${e.formula ? `, fórmula ${e.formula}` : ""}.${isCurrent && !paid ? " Sem data de pagamento na planilha: lançada como a pagar — marque como paga quando pagar." : ""}`,
      });
    }
  }
  return { revenues, expenses, skipped, labels, possibleDuplicates, issues };
}

/** Contratos sugeridos a partir de um mês importado: sessões/semana = sessões cobradas ÷ semanas do mês. */
export function contractsFromMonth(txs: Transaction[], month: Month, s: FinanceSettings, existing: FinContract[]): Partial<FinContract>[] {
  const weeks = weeksInMonth(month, workCalendar(s));
  const rows = txs.filter((t) => t.type === "receita" && t.status !== "cancelado" && competenceOf(t) === month && (t.payer_label || t.patient_id));
  const out: Partial<FinContract>[] = [];
  const has = (label: string, pid?: string | null) => existing.some((k) => (pid && k.patient_id === pid) || k.label.toLowerCase() === label.toLowerCase());
  const byPayer = new Map<string, Transaction[]>();
  for (const t of rows) {
    const k = t.payer_label || t.patient_id!;
    byPayer.set(k, [...(byPayer.get(k) ?? []), t]);
  }
  for (const [label, list] of byPayer) {
    if (has(label, list[0].patient_id)) continue;
    const sessions = list.reduce((a, t) => a + Number(t.sessions ?? 0), 0);
    const amount = list.reduce((a, t) => a + t.amount, 0);
    const pkg = list.some((t) => t.service_type === "Pacote mensal");
    const spw = sessions ? Math.max(0.5, Math.round((sessions / weeks) * 2) / 2) : 1;
    out.push({
      label, patient_id: list[0].patient_id ?? null, service_type: list[0].service_type ?? "Sessão avulsa",
      billing: pkg ? "pacote_mensal" : "por_sessao", sessions_per_week: spw,
      unit_amount: pkg ? 0 : sessions ? fromCents(Math.round(toCents(amount) / sessions)) : amount,
      monthly_amount: pkg ? amount : null, payer_kind: list[0].payer_kind ?? "a_confirmar", payment_timing: "mesmo_mes",
      // Falta cobrada: as sessões cobradas incluem as faltas registradas
      start_date: `${addMonths(month, 1)}-01`, charges_absences: list.some((t) => (t.absences ?? 0) > 0 && (t.sessions ?? 0) >= (t.sessions_done ?? 0) + (t.absences ?? 0)),
      active: true, notes: `Criado a partir de ${month}: ${sessions || "?"} sessão(ões) cobradas em ${weeks.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} semanas. Confira.`,
    });
  }
  return out;
}

/* ------------------------- Extrato / planilha genérica ------------------------ */
/** CSV com ; ou , e aspas. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/)[0] ?? "";
  const delim = (first.match(/;/g) ?? []).length >= (first.match(/,/g) ?? []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export interface StatementRow { date: string; amount: number; description: string; id?: string; category?: string }

/** OFX (extrato bancário): lê os blocos STMTTRN. */
export function parseOFX(text: string): StatementRow[] {
  const out: StatementRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  for (const b of blocks) {
    const date = toISODateLoose(tag(b, "DTPOSTED"));
    // OFX usa ponto decimal (padrão do formato), sem separador de milhar
    const raw = Number(tag(b, "TRNAMT").replace(",", "."));
    const amount = Number.isFinite(raw) && tag(b, "TRNAMT") !== "" ? raw : null;
    if (!date || amount === null) continue;
    out.push({ date, amount, description: tag(b, "MEMO") || tag(b, "NAME"), id: tag(b, "FITID") || undefined });
  }
  return out;
}

export interface ColumnMap { date: number; description: number; amount: number; type?: number; category?: number; debit?: number }

/** Adivinha as colunas pelo cabeçalho. */
export function guessColumns(header: string[]): Partial<ColumnMap> {
  const h = header.map((x) => normalizeName(x));
  const find = (re: RegExp) => { const i = h.findIndex((x) => re.test(x)); return i >= 0 ? i : undefined; };
  return {
    date: find(/^data|date|dt /),
    description: find(/descri|historico|hist|memo|lancamento/),
    amount: find(/^valor|amount|quantia|credito/),
    debit: find(/debito/),
    type: find(/^tipo|natureza/),
    category: find(/categoria/),
  };
}

export function rowsToStatement(table: string[][], map: ColumnMap, hasHeader = true): StatementRow[] {
  const out: StatementRow[] = [];
  for (const r of table.slice(hasHeader ? 1 : 0)) {
    const date = toISODateLoose(r[map.date]);
    let amount = parseBRNumber(r[map.amount] ?? "");
    if (map.debit !== undefined) {
      const d = parseBRNumber(r[map.debit] ?? "");
      if (d) amount = -(Math.abs(d)) + (amount ?? 0);
    }
    if (map.type !== undefined && amount !== null) {
      const t = normalizeName(r[map.type] ?? "");
      if (/despesa|debito|saida|^d$|pagamento/.test(t)) amount = -Math.abs(amount);
      if (/receita|credito|entrada|^c$/.test(t)) amount = Math.abs(amount);
    }
    if (!date || amount === null || amount === 0) continue;
    out.push({ date, amount, description: (r[map.description] ?? "").trim(), category: map.category !== undefined ? r[map.category] : undefined });
  }
  return out;
}

export interface ReconcileResult {
  row: StatementRow;
  key: string;
  action: "conciliar" | "ja_registrado" | "novo";
  match?: Transaction;
  draft?: Partial<Transaction>;
}

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/**
 * Concilia o extrato com os lançamentos: (1) já pago com mesmo valor ±3 dias → já registrado;
 * (2) em aberto com mesmo valor e vencimento ±10 dias → conciliar (marca como pago);
 * (3) senão → lançamento novo. Chave estável evita importar a mesma linha duas vezes.
 */
export function reconcile(rows: StatementRow[], txs: Transaction[], existingKeys: Set<string>): ReconcileResult[] {
  const used = new Set<string>();
  const seen: Record<string, number> = {};
  return rows.map((row) => {
    const base = row.id ? `bank:${row.id}` : `bank:${row.date}:${toCents(row.amount)}:${normalizeName(row.description).slice(0, 40)}`;
    seen[base] = (seen[base] ?? 0) + 1;
    const key = row.id ? base : `${base}:${seen[base]}`;
    if (existingKeys.has(key)) return { row, key, action: "ja_registrado" as const };
    const inflow = row.amount > 0;
    const abs = Math.abs(row.amount);
    const sameKind = (t: Transaction) => (inflow ? t.type === "receita" : t.type !== "receita") && t.status !== "cancelado" && !used.has(t.id) && Math.abs(t.amount - abs) < 0.01;
    const paid = txs.find((t) => sameKind(t) && t.paid_at && daysBetween(t.paid_at, row.date) <= 3);
    if (paid) { used.add(paid.id); return { row, key, action: "ja_registrado" as const, match: paid }; }
    const open = txs.filter((t) => sameKind(t) && !t.paid_at && daysBetween(t.due_date, row.date) <= 10).sort((a, b) => daysBetween(a.due_date, row.date) - daysBetween(b.due_date, row.date))[0];
    if (open) { used.add(open.id); return { row, key, action: "conciliar" as const, match: open }; }
    return {
      row, key, action: "novo" as const,
      draft: {
        type: inflow ? "receita" : "despesa", amount: abs, description: row.description, due_date: row.date, paid_at: row.date, competence: row.date.slice(0, 7),
        category: inflow ? "Outros" : row.category && row.category.trim() ? row.category.trim() : "Outras despesas operacionais", status: "faturado",
        payer_kind: inflow ? "a_confirmar" : undefined, import_key: key, notes: "Importado do extrato — revise a categoria.",
      },
    };
  });
}

export const existingImportKeys = (txs: Transaction[]) => new Set(txs.map((t) => t.import_key).filter(Boolean) as string[]);
