"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardList, FileSignature, FolderOpen, NotebookPen, Pencil, RefreshCw, Target, Trash2, UserRound, Wallet } from "lucide-react";
import { Avatar, Badge, Button, Card, Spinner, Tabs, useToast } from "@/components/ui";
import { PatientForm } from "@/components/patients/patient-form";
import { GeneralTab } from "@/components/patients/general-tab";
import { AssessmentsTab } from "@/components/patients/assessments-tab";
import { InterventionTab } from "@/components/patients/intervention-tab";
import { SessionsTab } from "@/components/patients/sessions-tab";
import { DocumentsList } from "@/components/documents-list";
import { FinanceTab } from "@/components/patients/finance-tab";
import { useCollection, useData, useRecord } from "@/lib/data/provider";
import { contractContent, createContract, missingContractFields } from "@/lib/documents";
import { ageLabel } from "@/lib/utils";

type Tab = "geral" | "avaliacoes" | "intervencao" | "sessoes" | "financeiro" | "documentos";

function PatientInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { store, bump, profile } = useData();
  const { data: patient, loading, update } = useRecord("patients", id);
  const contracts = useCollection("reports", { filter: { patient_id: id, type: "contrato" } });
  const contract = contracts.data[0];
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "geral");
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  // Mantém a aba sincronizada quando outra tela navega para ?tab=...
  const urlTab = params.get("tab") as Tab | null;
  useEffect(() => {
    if (urlTab) setTab(urlTab);
  }, [urlTab]);

  useEffect(() => {
    if (patient?.photo_url) store.fileUrl(patient.photo_url).then(setPhoto).catch(() => {});
    else setPhoto(null);
  }, [patient?.photo_url, store]);

  if (loading) return <Spinner />;
  if (!patient) return <p className="text-sm text-ink-soft">Paciente não encontrado.</p>;

  async function openContract() {
    const c = contract ?? (await createContract(store, patient!, profile));
    bump("reports");
    router.push(`/relatorios?id=${c.id}`);
  }

  async function refreshContract() {
    if (!contract) return;
    await contracts.update(contract.id, { content: contractContent(patient!, profile) });
    toast("Contrato atualizado com os dados do cadastro");
  }

  const missing = missingContractFields(patient, profile);
  const contractOutdated = Boolean(contract && contract.status === "rascunho" && patient.updated_at && contract.updated_at && patient.updated_at > contract.updated_at);

  async function remove() {
    if (!confirm(`Excluir definitivamente o prontuário de ${patient!.name}? Esta ação remove avaliações, planos, sessões e documentos vinculados.`)) return;
    await store.remove("patients", patient!.id);
    bump("patients");
    toast("Prontuário excluído");
    router.replace("/pacientes");
  }

  return (
    <>
      <Link href="/pacientes" className="mb-4 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Pacientes
      </Link>
      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={patient.name} src={photo} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{patient.name}</h1>
              <Badge tone={patient.status === "ativo" ? "green" : "gray"}>{patient.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {ageLabel(patient.birth_date)}
              {patient.school ? ` · ${patient.school}` : ""}
              {patient.grade ? ` · ${patient.grade}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.diagnosis && <Badge tone="blue">{patient.diagnosis}</Badge>}
              {patient.hypotheses && <Badge tone="sage">Hipótese: {patient.hypotheses}</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={openContract}><FileSignature className="h-3.5 w-3.5" /> Contrato</Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
            <Button variant="danger" size="sm" onClick={remove} aria-label="Excluir paciente"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </Card>

      {(params.get("contrato") || contractOutdated) && contract && (
        <Card className="mb-5 flex flex-col gap-3 border-brand-200 bg-brand-50/50 p-4 sm:flex-row sm:items-center">
          <FileSignature className="h-5 w-5 shrink-0 text-brand-600" />
          <div className="flex-1 text-sm">
            {contractOutdated ? (
              <p>O cadastro foi alterado depois do contrato. Deseja atualizar o contrato (rascunho) com os novos dados?</p>
            ) : (
              <p><b>Contrato gerado automaticamente</b> com os dados do cadastro.</p>
            )}
            {missing.length > 0 && <p className="mt-0.5 text-xs text-ink-soft">Ainda faltam: {missing.join(", ")}.</p>}
          </div>
          <div className="flex gap-2">
            {contractOutdated && <Button variant="secondary" size="sm" onClick={refreshContract}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>}
            <Button size="sm" onClick={() => router.push(`/relatorios?id=${contract.id}`)}>Abrir contrato</Button>
          </div>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          router.replace(`/pacientes/${id}?tab=${t}`, { scroll: false });
        }}
        tabs={[
          { value: "geral", label: "Informações gerais", icon: <UserRound className="h-4 w-4" /> },
          { value: "avaliacoes", label: "Avaliações", icon: <ClipboardList className="h-4 w-4" /> },
          { value: "intervencao", label: "Plano de intervenção", icon: <Target className="h-4 w-4" /> },
          { value: "sessoes", label: "Sessões e evolução", icon: <NotebookPen className="h-4 w-4" /> },
          { value: "financeiro", label: "Financeiro", icon: <Wallet className="h-4 w-4" /> },
          { value: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
        ]}
      />
      <div className="pt-5">
        {tab === "geral" && <GeneralTab patient={patient} onUpdate={update} />}
        {tab === "avaliacoes" && <AssessmentsTab patient={patient} />}
        {tab === "intervencao" && <InterventionTab patient={patient} />}
        {tab === "sessoes" && <SessionsTab patient={patient} autoNew={params.get("novo") === "1"} appointmentId={params.get("appt")} />}
        {tab === "financeiro" && <FinanceTab patient={patient} />}
        {tab === "documentos" && <DocumentsList patientId={patient.id} />}
      </div>

      <PatientForm open={editing} onClose={() => setEditing(false)} initial={patient} onSave={(v) => update(v) as Promise<unknown>} />
    </>
  );
}

export default function PatientPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PatientInner />
    </Suspense>
  );
}
