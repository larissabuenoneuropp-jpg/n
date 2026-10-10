"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Pencil, Printer, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Spinner, Textarea, useToast } from "@/components/ui";
import { ReceiptDocument } from "@/components/finance/receipt-document";
import { useData, useRecord } from "@/lib/data/provider";
import { receiptNumber } from "@/lib/documents";
import type { Receipt } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { profile, store, bump } = useData();
  const { data: r, loading, update } = useRecord("receipts", id);
  const [logo, setLogo] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Receipt> | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (profile?.logo_url) store.fileUrl(profile.logo_url).then(setLogo).catch(() => {});
  }, [profile?.logo_url, store]);
  useEffect(() => {
    // Ajusta a pré-visualização A4 (≈794px) à largura da tela
    const fit = () => setScale(Math.min(1, (window.innerWidth - (window.innerWidth >= 1024 ? 340 : 32)) / 794));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  if (loading) return <Spinner />;
  if (!r) return <p className="text-sm text-ink-soft">Recibo não encontrado.</p>;

  const patientPhone = async () => {
    if (!r.patient_id) return null;
    const p = await store.get("patients", r.patient_id);
    return (p?.guardians?.[0]?.phone || p?.phones || "").replace(/\D/g, "");
  };

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 0; } .receipt-wrap { transform: none !important; height: auto !important; } }`}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={r.patient_id ? `/pacientes/${r.patient_id}?tab=financeiro` : "/financeiro"} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Recibo nº {receiptNumber(r.number)}</h1>
          <p className="text-sm text-ink-soft">{r.payer_name} · {money(r.amount)} · {formatDate(r.issue_date)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEdit({ ...r })}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button variant="secondary" onClick={async () => {
            const phone = await patientPhone();
            const msg = `Olá! Segue o recibo nº ${receiptNumber(r.number)} referente ao pagamento de ${money(r.amount)} em ${formatDate(r.issue_date)}. Obrigada!`;
            window.open(`https://wa.me/${phone ? `55${phone.replace(/^55/, "")}` : ""}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
          }}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          <Button variant="danger" aria-label="Excluir recibo" onClick={async () => {
            if (!confirm("Excluir este recibo? (o pagamento continua registrado)")) return;
            await store.remove("receipts", r.id);
            bump("receipts");
            router.back();
          }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <p className="no-print mb-3 text-xs text-ink-faint">Para salvar em PDF, escolha “Salvar como PDF” na janela de impressão, com margens “Nenhuma”.</p>

      <div className="receipt-wrap overflow-hidden" style={{ height: 1123 * scale }}>
        <div className="origin-top-left shadow-pop print:shadow-none" style={{ transform: `scale(${scale})`, width: 794 }}>
          <ReceiptDocument r={r} profile={profile} logoSrc={logo} />
        </div>
      </div>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Editar recibo" wide
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={async () => {
          if (!edit) return;
          await update({ ...edit, amount: Number(edit.amount), service_dates: (edit.service_dates ?? []).filter(Boolean) });
          bump("receipts");
          setEdit(null);
          toast("Recibo atualizado");
        }}>Salvar</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do responsável (contratante)" className="sm:col-span-2"><Input value={edit.payer_name ?? ""} onChange={(e) => setEdit({ ...edit, payer_name: e.target.value })} /></Field>
            <Field label="CPF"><Input value={edit.payer_cpf ?? ""} onChange={(e) => setEdit({ ...edit, payer_cpf: e.target.value })} /></Field>
            <Field label="E-mail"><Input value={edit.payer_email ?? ""} onChange={(e) => setEdit({ ...edit, payer_email: e.target.value })} /></Field>
            <Field label="Cidade"><Input value={edit.payer_city ?? ""} onChange={(e) => setEdit({ ...edit, payer_city: e.target.value })} /></Field>
            <Field label="UF"><Input maxLength={2} value={edit.payer_state ?? ""} onChange={(e) => setEdit({ ...edit, payer_state: e.target.value.toUpperCase() })} /></Field>
            <Field label="Data do pagamento"><Input type="date" value={edit.issue_date ?? ""} onChange={(e) => setEdit({ ...edit, issue_date: e.target.value })} /></Field>
            <Field label="Valor (R$)"><Input type="number" step="0.01" value={edit.amount ?? 0} onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} /></Field>
            <Field label="Descrição dos serviços" className="sm:col-span-2"><Textarea rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Datas dos atendimentos (uma por linha, AAAA-MM-DD)" className="sm:col-span-2">
              <Textarea rows={4} value={(edit.service_dates ?? []).join("\n")} onChange={(e) => setEdit({ ...edit, service_dates: e.target.value.split("\n").map((x) => x.trim()) })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
