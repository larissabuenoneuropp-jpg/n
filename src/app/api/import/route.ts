import { NextResponse } from "next/server";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_BYTES = 15 * 1024 * 1024;

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
  if (isSupabaseConfigured) {
    const sb = await getSupabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 15 MB" }, { status: 413 });

  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  try {
    if (name.endsWith(".docx")) return NextResponse.json({ kind: "document", text: await docxText(buf) });
    if (name.endsWith(".pdf")) {
      const text = await pdfText(buf);
      if (!text.trim()) return NextResponse.json({ error: "Este PDF parece ser uma imagem digitalizada (sem texto). Exporte o documento original em .docx ou PDF com texto." }, { status: 422 });
      return NextResponse.json({ kind: "document", text });
    }
    if (name.endsWith(".xlsx")) return NextResponse.json({ kind: "sheet", rows: await sheetRows(buf) });
    if (name.endsWith(".csv")) return NextResponse.json({ kind: "sheet", rows: csvRows(new TextDecoder().decode(buf)) });
    if (name.endsWith(".txt") || name.endsWith(".md")) return NextResponse.json({ kind: "document", text: new TextDecoder().decode(buf) });
    if (name.endsWith(".doc")) return NextResponse.json({ error: "Formato .doc antigo não suportado: salve como .docx (no Google Docs: Arquivo → Fazer download → .docx)." }, { status: 415 });
    return NextResponse.json({ error: "Formato não suportado. Use .docx, .pdf, .txt, .xlsx ou .csv." }, { status: 415 });
  } catch (e) {
    return NextResponse.json({ error: `Não foi possível ler o arquivo: ${(e as Error).message}` }, { status: 422 });
  }
}
