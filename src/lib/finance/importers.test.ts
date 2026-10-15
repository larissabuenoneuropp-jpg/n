import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/types";
import { buildSheetImport, contractsFromMonth, guessColumns, mapSheetCategory, parseCSV, parseOFX, parseSessionsSheet, reconcile, rowsToStatement, sheetCompetence, toISODateLoose, type Grid } from "./importers";
import { gridFromWorksheet } from "./excel-grid";
import { defaultFinanceSettings } from "./settings";

const c = (v: unknown, f?: string) => ({ v, f });

/** Grade no formato da planilha mensal (layout de outubro). */
function sampleGrid(): Grid {
  const rows: Grid["rows"] = [];
  rows[2] = [c(null), c("Pacientes"), c("Atend."), c("Valor"), c("Total"), c("NFs"), c("Convênio"), c("Enviar"), c("Pago")];
  rows[4] = [c(1), c("Ana Paula Souza"), c(3, "=COUNTIF(...)"), c(229.5, "=270*(1-15%)"), c(688.5), c(null), c("PLANO DE SAÚDE"), c(false), c(false)];
  rows[5] = [c(2), c("Bruno Lima"), c(2), c(230), c(460), c(null), c("PARTICULAR"), c(true), c(true)];
  rows[6] = [c(3), c("Carla"), c(2), c(null), c(null)];
  rows[9] = [c(null), c(null), c(null), c("Totais"), c(null), c(1149.5, "=SUM(E5:E14,H5:H14, TRUE)")];
  rows[11] = [c("DATA"), c("NOME"), c("PRESENÇA")];
  rows[12] = [c(new Date("2026-09-02")), c("Ana Paula Souza"), c("PRESENÇA")];
  rows[13] = [c(new Date("2026-09-09")), c("Ana Paula Souza"), c("FALTA")];
  rows[14] = [c(new Date("2026-09-16")), c("Ana Paula Souza"), c("PRESENÇA")];
  rows[15] = [c(new Date("2026-09-03")), c("Bruno Lima"), c("PRESENÇA"), c(null), c(27), c("Wordwall"), c(null), c("Materiais ")];
  rows[16] = [c(new Date("2026-09-10")), c("Bruno Lima"), c("PRESENÇA"), c(null), c(600), c("Supervisão"), c(null), c("Estudos / Atualizações")];
  rows[17] = [c(new Date("2026-09-11")), c("Carla"), c("PRESENÇA"), c(null), c(90, "=3*30"), c(null), c(null), c("Aluguel")];
  rows[18] = [c(new Date("2026-09-12")), c("Carla"), c("PRESENÇA")];
  rows[14][3] = c("Data"); rows[14][4] = c("Valor"); rows[14][5] = c("Descrição"); rows[14][7] = c("Categoria");
  return { name: "SET. 26", rows };
}

describe("planilha mensal de sessões", () => {
  it("reconhece o mês pelo nome da aba", () => {
    expect(sheetCompetence("OUT. 26")).toBe("2026-10");
    expect(sheetCompetence("AGO.26")).toBe("2026-08");
    expect(sheetCompetence("DADOS DOS PACIENTES")).toBeNull();
  });
  it("lê pacientes, presenças, faltas, saídas e aponta problemas", () => {
    const m = parseSessionsSheet(sampleGrid())!;
    expect(m.patients.map((p) => [p.name, p.billedCount, p.presences, p.absences, p.total])).toEqual([
      ["Ana Paula Souza", 3, 2, 1, 688.5], ["Bruno Lima", 2, 2, 0, 460], ["Carla", 2, 2, 0, null],
    ]);
    expect(m.expenses.map((e) => [e.value, e.rawCategory])).toEqual([[27, "Materiais"], [600, "Estudos / Atualizações"], [90, "Aluguel"]]);
    expect(m.issues.some((i) => i.includes("sem valor"))).toBe(true);
    expect(m.issues.some((i) => i.includes("inclui 1 falta"))).toBe(true);
    expect(m.issues.some((i) => i.includes("TRUE"))).toBe(true);
  });
  it("mapeia categorias da planilha", () => {
    expect(mapSheetCategory("Estudos / Atualizações", "Supervisão")).toBe("Supervisão profissional");
    expect(mapSheetCategory("Aluguel", "", "=32*30")).toBe("Espaço por atendimento");
    expect(mapSheetCategory("Materiais ", "Wordwall")).toBe("Sistemas, aplicativos e assinaturas");
    expect(mapSheetCategory("Manutenção/Infraestrutura", "Uber - Domicílio")).toBe("Deslocamentos");
  });
  it("monta a importação anonimizada, sem duplicar na segunda vez", () => {
    const m = parseSessionsSheet(sampleGrid())!;
    const opts = { today: "2026-10-15", anonymize: true, includeFuture: false, patients: [], existingKeys: new Set<string>() };
    const plan = buildSheetImport([m], [], opts);
    expect(plan.revenues).toHaveLength(2);
    expect(plan.revenues[0].payer_label).toBe("APS-1");
    expect(plan.revenues[0].payer_kind).toBe("a_confirmar");
    expect(plan.revenues[1].paid_at).toBe("2026-09-30");
    expect(plan.revenues[0].paid_at).toBeNull();
    expect(plan.skipped.some((s) => s.reason.includes("sem valor"))).toBe(true);
    expect(plan.expenses).toHaveLength(3);
    const keys = new Set([...plan.revenues, ...plan.expenses].map((t) => t.import_key!));
    const again = buildSheetImport([m], [], { ...opts, existingKeys: keys });
    expect(again.revenues).toHaveLength(0);
    expect(again.expenses).toHaveLength(0);
    const withValue = buildSheetImport([m], [], { ...opts, unitOverrides: { carla: 200 } });
    expect(withValue.revenues.find((r) => r.payer_label?.startsWith("C"))?.amount).toBe(400);
  });
  it("no mês em andamento, despesa sem data fica a pagar e custo por fórmula fica previsto", () => {
    const g = { ...sampleGrid(), name: "OUT. 26" };
    g.rows = g.rows.map((r) => r?.map((cell) => (cell?.v instanceof Date ? { v: new Date(cell.v.toISOString().replace("2026-09", "2026-10")) } : cell)));
    const plan = buildSheetImport([parseSessionsSheet(g)!], [], { today: "2026-10-15", anonymize: true, includeFuture: false, patients: [], existingKeys: new Set() });
    expect(plan.expenses.every((e) => e.paid_at === null)).toBe(true);
    expect(plan.expenses.find((e) => e.amount === 90)?.status).toBe("previsto");
    expect(plan.expenses.find((e) => e.amount === 600)?.status).toBe("faturado");
  });
  it("sugere contratos a partir de um mês", () => {
    const m = parseSessionsSheet(sampleGrid())!;
    const plan = buildSheetImport([m], [], { today: "2026-10-15", anonymize: true, includeFuture: false, patients: [], existingKeys: new Set() });
    const ks = contractsFromMonth(plan.revenues.map((r, i) => ({ id: String(i), ...r }) as Transaction), "2026-09", defaultFinanceSettings(), []);
    expect(ks).toHaveLength(2);
    expect(ks[0].unit_amount).toBe(229.5);
    expect(ks[0].charges_absences).toBe(true);
  });
});

describe("extratos e planilhas genéricas", () => {
  it("lê CSV com ; e números brasileiros", () => {
    const t = parseCSV('Data;Descrição;Valor\n01/10/2026;"PIX recebido; família";1.234,56\n02/10/2026;Supervisão;-600,00\n');
    const map = guessColumns(t[0]);
    expect(map).toMatchObject({ date: 0, description: 1, amount: 2 });
    const rows = rowsToStatement(t, map as never);
    expect(rows).toEqual([{ date: "2026-10-01", amount: 1234.56, description: "PIX recebido; família", category: undefined }, { date: "2026-10-02", amount: -600, description: "Supervisão", category: undefined }]);
  });
  it("lê OFX", () => {
    const ofx = "<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000<TRNAMT>-27.00<FITID>abc1<MEMO>WORDWALL</STMTTRN><STMTTRN><DTPOSTED>20261006<TRNAMT>460.00<FITID>abc2<NAME>PIX</STMTTRN></OFX>";
    expect(parseOFX(ofx)).toEqual([{ date: "2026-10-05", amount: -27, description: "WORDWALL", id: "abc1" }, { date: "2026-10-06", amount: 460, description: "PIX", id: "abc2" }]);
  });
  it("concilia sem duplicar", () => {
    const txs = [
      { id: "a", type: "despesa", category: "Supervisão profissional", amount: 600, due_date: "2026-10-09" },
      { id: "b", type: "receita", category: "Sessão avulsa", amount: 460, due_date: "2026-10-06", paid_at: "2026-10-06" },
    ] as Transaction[];
    const r = reconcile([{ date: "2026-10-10", amount: -600, description: "PIX supervisão" }, { date: "2026-10-06", amount: 460, description: "PIX" }, { date: "2026-10-07", amount: -27, description: "WORDWALL" }], txs, new Set());
    expect(r.map((x) => x.action)).toEqual(["conciliar", "ja_registrado", "novo"]);
    expect(r[0].match?.id).toBe("a");
    const again = reconcile([{ date: "2026-10-07", amount: -27, description: "WORDWALL" }], txs, new Set([r[2].key]));
    expect(again[0].action).toBe("ja_registrado");
  });
  it("datas em vários formatos", () => {
    expect(toISODateLoose("05/10/2026")).toBe("2026-10-05");
    expect(toISODateLoose("2026-10-05")).toBe("2026-10-05");
    expect(toISODateLoose(46300)).toBe("2026-10-05"); // 46023 = 01/01/2026
  });
});

// Teste opcional com a planilha real (não versionada): NP_SHEET=/caminho/arquivo.xlsx npx vitest run
const real = process.env.NP_SHEET;
describe.skipIf(!real)("planilha real (local)", () => {
  it("importa todos os meses e reproduz os totais conferidos na análise", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(real!);
    const months = wb.worksheets.map((ws) => parseSessionsSheet(gridFromWorksheet(ws as never))).filter(Boolean) as NonNullable<ReturnType<typeof parseSessionsSheet>>[];
    const plan = buildSheetImport(months, [], { today: "2026-10-15", anonymize: true, includeFuture: false, patients: [], existingKeys: new Set() });
    const sumBy = (m: string, type: "receita" | "despesa") => [...plan.revenues, ...plan.expenses].filter((t) => t.type === type && t.competence === m).reduce((s, t) => s + (t.amount ?? 0), 0);
    const round = (v: number) => Math.round(v * 100) / 100;
    // Valores recalculados na análise (docs/financeiro/01-analise-das-planilhas.md)
    expect(round(sumBy("2026-02", "receita"))).toBe(3704.16);
    expect(round(sumBy("2026-05", "receita"))).toBe(10851.4);
    expect(round(sumBy("2026-02", "despesa"))).toBe(911.41);
    expect(round(sumBy("2026-05", "despesa"))).toBe(3365.93);
    expect(round(sumBy("2026-09", "despesa"))).toBe(2758.43);
    expect(round(sumBy("2026-10", "receita"))).toBe(8402.6);
    expect(plan.revenues.every((t) => !String(t.payer_label).match(/[a-z]{3,}/))).toBe(true); // anonimizado
    console.log(JSON.stringify({ labels: Object.values(plan.labels), issues: plan.issues.length, skipped: plan.skipped.map((s) => s.reason) }));
  });
});
