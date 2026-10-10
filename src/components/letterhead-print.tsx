/* eslint-disable @next/next/no-img-element */
import type { Profile } from "@/lib/types";

const LEGACY_HEADING = /^(CONTRATO DE|CONTRATANTE:|CONTRATADO:|CLÁUSULA|RELATÓRIO|ENCAMINHAMENTO$|DECLARAÇÃO$|ATESTADO|PLANO DE|RESUMO DE|\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+$|OBJETIVO|METAS$)/;
const LEGACY_TITLE = /^(CONTRATO DE|RELATÓRIO|ENCAMINHAMENTO$|DECLARAÇÃO$|ATESTADO|PLANO DE|RESUMO DE)/;

type Block =
  | { kind: "title" | "right" | "h2" | "h3" | "h4" | "caption" | "p" | "space"; text: string; legacyBold?: boolean; center?: boolean }
  | { kind: "table"; rows: string[][] };

/**
 * Converte o texto do documento em blocos. Marcação suportada (modelo RAN):
 * "# título", ">> à direita", "## seção", "### subseção", "#### tópico", "[[legenda]]", "| a | b |" (quadro).
 * Documentos antigos sem marcação continuam formatados pelas regras anteriores.
 */
export function parseDocument(content: string): Block[] {
  const lines = content.split("\n");
  const signatureStart = lines.findIndex((l) => /^_{10,}/.test(l.trim()));
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { blocks.push({ kind: "space", text: "" }); continue; }
    if (t.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      blocks.push({ kind: "table", rows });
      continue;
    }
    if (t.startsWith("#### ")) blocks.push({ kind: "h4", text: t.slice(5) });
    else if (t.startsWith("### ")) blocks.push({ kind: "h3", text: t.slice(4) });
    else if (t.startsWith("## ")) blocks.push({ kind: "h2", text: t.slice(3) });
    else if (t.startsWith("# ")) blocks.push({ kind: "title", text: t.slice(2) });
    else if (t.startsWith(">> ")) blocks.push({ kind: "right", text: t.slice(3) });
    else if (/^\[\[.*\]\]$/.test(t)) blocks.push({ kind: "caption", text: t.slice(2, -2) });
    else {
      const center = LEGACY_TITLE.test(t) || (signatureStart >= 0 && i >= signatureStart && !/^\d/.test(t));
      blocks.push({ kind: "p", text: t, legacyBold: LEGACY_HEADING.test(t), center });
    }
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  const m = text.match(/^(\d+\.\d+\.?)(\s.*)$/);
  return m ? <><b>{m[1]}</b>{m[2]}</> : <>{text}</>;
}

/** Corpo do documento formatado (usado na pré-visualização e na impressão). */
export function DocBody({ content }: { content: string }) {
  const blocks = parseDocument(content);
  return (
    <div className="text-[11pt] leading-[1.55] text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {blocks.map((b, i) => {
        if (b.kind === "table") {
          const [head, ...body] = b.rows;
          return (
            <table key={i} className="my-2 w-full border-collapse text-[10pt]" style={{ breakInside: "avoid" }}>
              <thead><tr>{head?.map((c, j) => <th key={j} className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-center font-bold">{c}</th>)}</tr></thead>
              <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border border-neutral-400 px-2 py-1 text-center">{c}</td>)}</tr>)}</tbody>
            </table>
          );
        }
        switch (b.kind) {
          case "space": return <div key={i} style={{ height: "0.6em" }} />;
          case "title": return <p key={i} className="mb-2 text-center font-bold">{b.text}</p>;
          case "right": return <p key={i} className="text-right">{b.text}</p>;
          case "h2": return <p key={i} className="mt-3 font-bold" style={{ breakAfter: "avoid" }}>{b.text}</p>;
          case "h3": return <p key={i} className="mt-2 font-bold" style={{ breakAfter: "avoid" }}>{b.text}</p>;
          case "h4": return <p key={i} className="mt-2 font-bold italic" style={{ breakAfter: "avoid" }}>{b.text}</p>;
          case "caption": return <p key={i} className="mt-2 text-center font-bold" style={{ breakAfter: "avoid" }}>{b.text}</p>;
          default:
            return (
              <p key={i} style={{ textAlign: b.center ? "center" : "justify", fontWeight: b.legacyBold ? 700 : 400, margin: LEGACY_TITLE.test(b.text) ? "0 0 0.8em" : 0, breakInside: "avoid" }}>
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

/**
 * Impressão em papel timbrado (modelo do contrato da profissional): cabeçalho com a marca e
 * rodapé com contatos repetidos em todas as páginas (técnica thead/tfoot + position: fixed).
 */
export function LetterheadPrint({ content, profile, headerSrc }: { content: string; profile: Profile | null; headerSrc?: string }) {
  return (
    <div className="letterhead hidden print:block">
      <style>{`@media print { @page { size: A4; margin: 0; } }`}</style>
      <div className="fixed inset-x-0 top-0">
        <img src={headerSrc || "/brand/cabecalho-contrato.png"} alt="" style={{ width: "210mm", height: "40mm", objectFit: "cover", objectPosition: "center top" }} />
      </div>
      <div className="fixed inset-x-0 bottom-0 pb-[6mm] text-center text-[9pt] leading-snug text-ink-soft">
        <p>{[profile?.clinic_name || profile?.professional_name, profile?.signature_title || profile?.profession].filter(Boolean).join(" - ")}</p>
        <p>{profile?.address}</p>
        <p>{[profile?.phone && `Telefone: ${profile.phone}`, profile?.email && `E-mail: ${profile.email}`].filter(Boolean).join(" | ")}</p>
      </div>
      <table className="w-full">
        <thead><tr><td><div style={{ height: "44mm" }} /></td></tr></thead>
        <tbody><tr><td style={{ padding: "0 22mm" }}><DocBody content={content} /></td></tr></tbody>
        <tfoot><tr><td><div style={{ height: "24mm" }} /></td></tr></tfoot>
      </table>
    </div>
  );
}
