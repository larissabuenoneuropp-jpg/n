// Converte uma planilha do ExcelJS na grade simples usada pelos importadores.
import type { Cell, Grid } from "./importers";

interface XCell { value: unknown; formula?: string }
interface XSheet { name: string; eachRow: (opts: { includeEmpty: boolean }, cb: (row: { eachCell: (o: { includeEmpty: boolean }, cb2: (cell: XCell, col: number) => void) => void }, rowNumber: number) => void) => void }

function cellValue(v: unknown): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((t) => t.text).join("");
    if ("text" in o) return o.text;
    if ("error" in o) return null;
    if ("formula" in o || "sharedFormula" in o) return null;
  }
  return v;
}

export function gridFromWorksheet(ws: XSheet): Grid {
  const rows: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    const out: Cell[] = [];
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const raw = cell.value as Record<string, unknown> | null;
      const f = raw && typeof raw === "object" && !(raw instanceof Date) && typeof raw.formula === "string" ? `=${raw.formula}` : undefined;
      out[c - 1] = { v: cellValue(cell.value), f };
    });
    rows[r - 1] = out;
  });
  return { name: ws.name, rows };
}
