/* eslint-disable @next/next/no-img-element */
import type { Profile } from "@/lib/types";

const HEADING = /^(CONTRATO DE|CONTRATANTE:|CONTRATADO:|CLÁUSULA|RELATÓRIO|ENCAMINHAMENTO$|DECLARAÇÃO$|ATESTADO|PLANO DE|RESUMO DE|\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+$|OBJETIVO|METAS$)/;
const TITLE = /^(CONTRATO DE|RELATÓRIO|ENCAMINHAMENTO$|DECLARAÇÃO$|ATESTADO|PLANO DE|RESUMO DE)/;

/**
 * Impressão em papel timbrado (modelo do contrato da profissional): cabeçalho com a marca e
 * rodapé com contatos repetidos em todas as páginas (técnica thead/tfoot + position: fixed).
 */
export function LetterheadPrint({ content, profile, headerSrc }: { content: string; profile: Profile | null; headerSrc?: string }) {
  const lines = content.split("\n");
  // Bloco final de assinaturas fica centralizado
  const signatureStart = lines.findIndex((l) => /^_{10,}/.test(l.trim()));
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
        <tbody>
          <tr>
            <td style={{ padding: "0 22mm" }}>
              <div className="font-serif text-[11pt] leading-[1.55] text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                {lines.map((line, i) => {
                  const t = line.trim();
                  if (!t) return <div key={i} style={{ height: "0.7em" }} />;
                  const centered = TITLE.test(t) || (signatureStart >= 0 && i >= signatureStart && !/^\d/.test(t));
                  const bold = HEADING.test(t);
                  // destaca a numeração das subcláusulas (1.1, 2.3…)
                  const m = t.match(/^(\d+\.\d+\.?)(\s.*)$/);
                  return (
                    <p key={i} style={{ textAlign: centered ? "center" : "justify", fontWeight: bold ? 700 : 400, margin: TITLE.test(t) ? "0 0 0.8em" : 0, breakInside: "avoid" }}>
                      {m ? <><b>{m[1]}</b>{m[2]}</> : t}
                    </p>
                  );
                })}
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot><tr><td><div style={{ height: "24mm" }} /></td></tr></tfoot>
      </table>
    </div>
  );
}
