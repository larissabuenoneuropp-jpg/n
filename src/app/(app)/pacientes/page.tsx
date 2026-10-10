"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Spinner } from "@/components/ui";
import { PatientForm } from "@/components/patients/patient-form";
import { useCollection, useData } from "@/lib/data/provider";
import type { Patient } from "@/lib/types";
import { ageLabel } from "@/lib/utils";

function PatientPhoto({ p }: { p: Patient }) {
  const { store } = useData();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (p.photo_url) store.fileUrl(p.photo_url).then(setSrc).catch(() => {});
  }, [p.photo_url, store]);
  return <Avatar name={p.name} src={src} size={40} />;
}

function PatientsInner() {
  const params = useSearchParams();
  const { data, loading, insert } = useCollection("patients", { orderBy: "name", ascending: true });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ativo" | "todos" | "inativo" | "alta">("ativo");
  const [open, setOpen] = useState(params.get("novo") === "1");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter(
      (p) =>
        (status === "todos" || p.status === status) &&
        (!term || [p.name, p.school, p.diagnosis, p.hypotheses].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [data, q, status]);

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Prontuários digitais organizados"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo paciente</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input className="pl-9" placeholder="Buscar por nome, escola, diagnóstico…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[{ value: "ativo", label: "Ativos" }, { value: "inativo", label: "Inativos" }, { value: "alta", label: "Alta" }, { value: "todos", label: "Todos" }]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum paciente encontrado" text="Cadastre seu primeiro paciente para começar." action={<Button onClick={() => setOpen(true)}>Novo paciente</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/pacientes/${p.id}`}>
              <Card className="flex h-full items-start gap-3 p-4 transition hover:border-brand-200 hover:shadow-pop">
                <PatientPhoto p={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{p.name}</p>
                    <Badge tone={p.payment_type === "convenio" ? "sage" : "blue"}>{p.payment_type === "convenio" ? p.insurance_name || "Convênio" : "Particular"}</Badge>
                  </div>
                  <p className="text-xs text-ink-faint">{ageLabel(p.birth_date)}{p.grade ? ` · ${p.grade}` : ""}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-ink-soft">{p.diagnosis || p.hypotheses || "Sem diagnóstico/hipótese registrada"}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <PatientForm open={open} onClose={() => setOpen(false)} onSave={(v) => insert(v)} />
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PatientsInner />
    </Suspense>
  );
}
