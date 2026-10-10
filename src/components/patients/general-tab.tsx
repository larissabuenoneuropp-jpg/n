"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button, Card, CardHeader, Field, Textarea, useToast } from "@/components/ui";
import type { Anamnesis, Patient } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";

const ANAMNESIS_FIELDS: Array<{ key: keyof Anamnesis; label: string }> = [
  { key: "complaints", label: "Queixas principais" },
  { key: "personality", label: "Jeito de ser da criança, segundo a família" },
  { key: "history", label: "Histórico do paciente (gestação, parto, desenvolvimento)" },
  { key: "development", label: "Desenvolvimento neuropsicomotor e linguagem" },
  { key: "school_history", label: "Histórico escolar" },
  { key: "family_history", label: "Histórico familiar" },
  { key: "health", label: "Saúde, sono e alimentação" },
  { key: "medications", label: "Medicamentos" },
  { key: "professionals", label: "Profissionais envolvidos" },
];

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

export function GeneralTab({ patient, onUpdate }: { patient: Patient; onUpdate: (p: Partial<Patient>) => Promise<unknown> }) {
  const toast = useToast();
  const [an, setAn] = useState<Anamnesis>(patient.anamnesis ?? {});
  const [profile, setProfile] = useState({
    hypotheses: patient.hypotheses ?? "",
    skills: patient.skills ?? "",
    difficulties: patient.difficulties ?? "",
    cognitive_profile: patient.cognitive_profile ?? "",
    behavioral_profile: patient.behavioral_profile ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAn(patient.anamnesis ?? {});
  }, [patient.anamnesis]);

  async function save() {
    setSaving(true);
    try {
      await onUpdate({ anamnesis: an, ...profile });
      toast("Prontuário salvo");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Dados do paciente" />
          <dl className="grid grid-cols-2 gap-4 p-5">
            <Info label="Nascimento" value={formatDate(patient.birth_date)} />
            <Info label="Início" value={formatDate(patient.start_date)} />
            <Info label="Escola" value={patient.school} />
            <Info label="Professor(a)" value={patient.teacher} />
            <Info label="Encaminhado por" value={patient.referred_by} />
            <Info label="Atendimento" value={patient.payment_type === "convenio" ? `Convênio${patient.insurance_name ? ` — ${patient.insurance_name}` : ""}` : "Particular"} />
            <Info label="Valor da sessão" value={money(patient.session_value)} />
            <Info label="Frequência" value={`${patient.weekly_frequency ?? 0}x/semana`} />
            <Info label="Telefones" value={patient.phones} />
            <Info label="E-mail" value={patient.email} />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Responsáveis" />
          <ul className="divide-y divide-line">
            {(patient.guardians ?? []).filter((g) => g.name).map((g, i) => (
              <li key={i} className="px-5 py-3 text-sm">
                <p className="font-medium">{g.name} <span className="font-normal text-ink-faint">· {g.relation}</span></p>
                <p className="text-xs text-ink-soft">{[g.phone, g.email].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Objetivos gerais e observações" />
          <div className="space-y-3 p-5 text-sm text-ink-soft">
            <p className="whitespace-pre-wrap">{patient.general_goals || "—"}</p>
            {patient.notes && <p className="whitespace-pre-wrap border-t border-line pt-3">{patient.notes}</p>}
          </div>
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Anamnese e perfil clínico"
          subtitle="Essas informações alimentam as sugestões da IA (sem dados identificáveis)"
          action={<Button size="sm" onClick={save} loading={saving}><Save className="h-3.5 w-3.5" /> Salvar</Button>}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {ANAMNESIS_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <Textarea value={an[key] ?? ""} onChange={(e) => setAn({ ...an, [key]: e.target.value })} />
            </Field>
          ))}
          <Field label="Hipóteses diagnósticas">
            <Textarea value={profile.hypotheses} onChange={(e) => setProfile({ ...profile, hypotheses: e.target.value })} />
          </Field>
          <Field label="Habilidades / potencialidades">
            <Textarea value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} />
          </Field>
          <Field label="Dificuldades">
            <Textarea value={profile.difficulties} onChange={(e) => setProfile({ ...profile, difficulties: e.target.value })} />
          </Field>
          <Field label="Perfil cognitivo">
            <Textarea value={profile.cognitive_profile} onChange={(e) => setProfile({ ...profile, cognitive_profile: e.target.value })} />
          </Field>
          <Field label="Perfil comportamental" className="sm:col-span-2">
            <Textarea value={profile.behavioral_profile} onChange={(e) => setProfile({ ...profile, behavioral_profile: e.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
