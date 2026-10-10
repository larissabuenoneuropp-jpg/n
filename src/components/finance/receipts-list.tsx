"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { useCollection } from "@/lib/data/provider";
import { receiptNumber } from "@/lib/documents";
import { formatDate, money } from "@/lib/utils";

/** Lista de recibos (todos ou de um paciente). Os recibos são gerados automaticamente ao registrar um pagamento. */
export function ReceiptsList({ patientId, limit }: { patientId?: string; limit?: number }) {
  const receipts = useCollection("receipts", patientId ? { filter: { patient_id: patientId }, orderBy: "number" } : { orderBy: "number" });
  const patients = useCollection("patients");
  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p.name])), [patients.data]);
  const rows = limit ? receipts.data.slice(0, limit) : receipts.data;
  return (
    <Card>
      <CardHeader title="Recibos" icon={<ReceiptIcon className="h-4 w-4" />} subtitle="Gerados automaticamente quando um pagamento é registrado" />
      {rows.length === 0 ? (
        <EmptyState title="Nenhum recibo ainda" text="Marque uma entrada como paga e o recibo é emitido no seu modelo." />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/recibos/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-canvas/60">
                <span className="w-14 shrink-0 font-display text-xs font-semibold text-brand-700">Nº {receiptNumber(r.number)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{r.payer_name}{!patientId && r.patient_id && pmap.get(r.patient_id) ? <span className="text-ink-faint"> · {pmap.get(r.patient_id)}</span> : null}</p>
                  <p className="text-xs text-ink-faint">{formatDate(r.issue_date)}</p>
                </div>
                <span className="text-sm tabular-nums">{money(r.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
