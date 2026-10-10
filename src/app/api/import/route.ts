import { NextResponse } from "next/server";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { deny, guard } from "@/lib/server/guard";

export const runtime = "nodejs";
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_TEXT = 300_000;
const MAX_ROWS = 5_000;

const json = (body: Record<string, unknown>) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
const startsWith = (buf: ArrayBuffer, sig: number[]) => sig.every((b, i) => new Uint8Array(buf, 0, Math.min(sig.length, buf.byteLength))[i] === b);
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // .docx/.xlsx são pacotes zip
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** Extrai o texto de um .docx (parágrafos, quebras e tabelas com " | " entre células). */
async function docxText(buf: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Arquivo .docx inválido");
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function pdfText(buf: ArrayBuffer) {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
  return text;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const d = v;
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v) return String((v as { hyperlink: string }).hyperlink);
  }
  return String(v);
}

async function sheetRows(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
    if (values.some((x) => x.trim())) rows.push(values);
  });
  return rows;
}

function csvRows(text: string) {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x.trim())) rows.push(cur);
  return rows;
}

export async function POST(req: Request) {
  const g = await guard(req, { bucket: "import", limit: 40 });
  if (!g.ok) return g.response;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) return deny(413, "Arquivo maior que 15 MB");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return deny(400, "Envie um arquivo");
  if (file.size > MAX_BYTES) return deny(413, "Arquivo maior que 15 MB");

  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const text = (t: string) => json({ kind: "document", text: t.slice(0, MAX_TEXT) });
  const rows = (r: string[][]) => json({ kind: "sheet", rows: r.slice(0, MAX_ROWS).map((row) => row.slice(0, 80).map((c) => c.slice(0, 2000))) });
  try {
    if (name.endsWith(".docx")) {
      if (!startsWith(buf, ZIP)) return deny(415, "O arquivo não é um .docx válido.");
      return text(await docxText(buf));
    }
    if (name.endsWith(".pdf")) {
      if (!startsWith(buf, PDF)) return deny(415, "O arquivo não é um PDF válido.");
      const t = await pdfText(buf);
      if (!t.trim()) return deny(422, "Este PDF parece ser uma imagem digitalizada (sem texto). Exporte o documento original em .docx ou PDF com texto.");
      return text(t);
    }
    if (name.endsWith(".xlsx")) {
      if (!startsWith(buf, ZIP)) return deny(415, "O arquivo não é um .xlsx válido.");
      return rows(await sheetRows(buf));
    }
    if (name.endsWith(".csv")) return rows(csvRows(new TextDecoder().decode(buf)));
    if (name.endsWith(".txt") || name.endsWith(".md")) return text(new TextDecoder().decode(buf));
    if (name.endsWith(".doc")) return deny(415, "Formato .doc antigo não suportado: salve como .docx (no Google Docs: Arquivo → Fazer download → .docx).");
    return deny(415, "Formato não suportado. Use .docx, .pdf, .txt, .xlsx ou .csv.");
  } catch (e) {
    console.error("import", (e as Error).message);
    return deny(422, "Não foi possível ler o arquivo. Confira se ele não está corrompido ou protegido por senha.");
  }
}
