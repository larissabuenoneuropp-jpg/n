/* eslint-disable @next/next/no-img-element */
import { Livvic } from "next/font/google";
import type { Profile, Receipt } from "@/lib/types";
import { UF_NOME } from "@/lib/extenso";
import { formatDate, money } from "@/lib/utils";
import { receiptNumber } from "@/lib/documents";

const livvic = Livvic({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

const INK = "#545454";
const TERRA = "#cd926d";
const SAND = "#d2bda0";

/** Recibo no layout do modelo da profissional (A4: 210 × 297 mm). */
export function ReceiptDocument({ r, profile, logoSrc }: { r: Receipt; profile: Profile | null; logoSrc?: string | null }) {
  const label = { fontSize: "10pt", fontWeight: 700, color: INK } as const;
  const tile = (src: string, bg: string, left: number, top: number) => (
    <div style={{ position: "absolute", left: `${left}mm`, top: `${top}mm`, width: "19.5mm", height: "19.5mm", background: bg, overflow: "hidden" }}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.42)" }} />
    </div>
  );
  const stateName = (uf?: string) => (uf ? UF_NOME[uf.toUpperCase()] ?? uf : "");
  const footerLine2 = [profile?.phone && `Telefone: ${profile.phone}`, profile?.email && `E-mail: ${profile.email}`, profile?.instagram].filter(Boolean).join(" | ");

  return (
    <div className={`receipt-page ${livvic.className}`} style={{ position: "relative", width: "210mm", height: "297mm", background: "#fff", color: INK, overflow: "hidden" }}>
      {/* Ícones da identidade visual */}
      {tile("/brand/icon-cerebro.png", TERRA, 170.5, 0)}
      {tile("/brand/icon-lapis.png", "#979d84", 190.5, 0)}
      {tile("/brand/icon-coracao.png", "#a7cbcb", 190.5, 20)}
      {tile("/brand/icon-sol.png", "#e6c983", 170.5, 40)}

      <img src={logoSrc || "/brand/logo.png"} alt="" style={{ position: "absolute", left: "19mm", top: "15mm", width: "76mm", height: "22mm", objectFit: "contain", objectPosition: "left center" }} />

      <div style={{ position: "absolute", left: "54mm", top: "52mm", width: "101mm", height: "10.5mm", background: TERRA, borderRadius: "2.5mm", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "13pt" }}>
        RECIBO DE PAGAMENTO
      </div>
      <div style={{ position: "absolute", right: "21mm", top: "64mm", fontSize: "8.5pt", color: "#8a8a8a" }}>Nº {receiptNumber(r.number)}</div>

      {/* Contratante */}
      <div style={{ position: "absolute", left: "19mm", top: "74mm", width: "110mm" }}>
        <p style={label}>DADOS DO CONTRATANTE:</p>
        <p style={{ fontSize: "17pt", fontWeight: 700, margin: "3mm 0 2mm", lineHeight: 1.1 }}>{r.payer_name || "—"}</p>
        <div style={{ ...label, lineHeight: 1.45 }}>
          <p>Número do CPF: <span style={{ fontWeight: 400 }}>{r.payer_cpf}</span></p>
          <p>Cidade: <span style={{ fontWeight: 400 }}>{r.payer_city}</span></p>
          <p>Estado: <span style={{ fontWeight: 400 }}>{stateName(r.payer_state)}</span></p>
          <p>E-mail: <span style={{ fontWeight: 400 }}>{r.payer_email}</span></p>
        </div>
      </div>

      {/* Data e valor */}
      <div style={{ position: "absolute", left: "136mm", top: "74mm", width: "53mm" }}>
        <p style={label}>Data:</p>
        <div style={{ marginTop: "2mm", height: "10mm", border: `0.4mm solid ${TERRA}`, borderRadius: "3mm", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12pt" }}>
          {formatDate(r.issue_date)}
        </div>
        <p style={{ ...label, marginTop: "5mm" }}>Valor do Serviço</p>
        <div style={{ marginTop: "1.5mm", height: "10mm", background: TERRA, borderRadius: "3mm", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "13pt" }}>
          {money(r.amount)}
        </div>
      </div>

      {/* Descrição */}
      <div style={{ position: "absolute", left: "19mm", top: "120mm", width: "170mm", height: "7mm", background: TERRA, borderRadius: "1mm", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11pt", letterSpacing: "0.35em" }}>
        DESCRIÇÃO DO SERVIÇOS PRESTADOS
      </div>
      <div style={{ position: "absolute", left: "19mm", top: "132mm", width: "170mm", height: "86mm", border: `0.4mm solid ${TERRA}`, borderRadius: "3mm", padding: "8mm 8mm", fontSize: "10pt", fontWeight: 700, lineHeight: 1.5, overflow: "hidden" }}>
        <p style={{ whiteSpace: "pre-wrap" }}>{r.description}</p>
        {r.service_dates.length > 0 && (
          <p style={{ marginTop: "4mm", fontWeight: 600 }}>{r.service_dates.map((d) => formatDate(d)).join("  •  ")}</p>
        )}
      </div>

      {/* Prestador */}
      <div style={{ position: "absolute", left: "19mm", top: "231mm", width: "150mm" }}>
        <p style={label}>DADOS DO PRESTADOR DE SERVIÇOS:</p>
        <p style={{ fontSize: "17pt", fontWeight: 700, margin: "3mm 0 2mm", lineHeight: 1.1 }}>{profile?.professional_name}</p>
        <div style={{ ...label, lineHeight: 1.45 }}>
          <p>{profile?.profession}{profile?.cbo ? ` - CBO ${profile.cbo}` : ""}</p>
          {profile?.document && <p>CPF/CNPJ: {profile.document}</p>}
          <p>{stateName(profile?.state)}</p>
          <p>{profile?.email}</p>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: "210mm", height: "17mm", background: SAND, color: "#fff", fontWeight: 700, fontSize: "10pt", letterSpacing: "0.04em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.45, textAlign: "center" }}>
        <p>{profile?.address}</p>
        <p>{footerLine2}</p>
      </div>
    </div>
  );
}
