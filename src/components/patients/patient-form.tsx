"use client";
import { useEffect, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Avatar, Button, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import type { Address, Guardian, Patient } from "@/lib/types";
import { useData } from "@/lib/data/provider";
import { ageLabel } from "@/lib/utils";

const empty: Partial<Patient> = {
  name: "", guardians: [{ name: "", relation: "Mãe", phone: "" }], payment_type: "particular", status: "ativo",
  weekly_frequency: 1, anamnesis: {}, address: {},
};

export function PatientForm({
  open, onClose, initial, onSave,
}: { open: boolean; onClose: () => void; initial?: Patient | null; onSave: (p: Partial<Patient>) => Promise<unknown> }) {
  const { store, profile } = useData();
  const toast = useToast();
  const [f, setF] = useState<Partial<Patient>>(empty);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(initial ? { ...initial, address: initial.address ?? {} } : { ...empty, session_value: profile?.default_session_value ?? 0 });
    setPhotoPreview(null);
    if (initial?.photo_url) store.fileUrl(initial.photo_url).then(setPhotoPreview).catch(() => {});
  }, [open, initial, profile, store]);

  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setF((s) => ({ ...s, [k]: v }));
  const setAddress = (patch: Partial<Address>) => set("address", { ...(f.address ?? {}), ...patch });
  const setGuardian = (i: number, patch: Partial<Guardian>) =>
    set("guardians", (f.guardians ?? []).map((g, j) => (j === i ? { ...g, ...patch } : g)));

  async function onPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Selecione uma imagem.", "error");
    try {
      const path = await store.upload(file, "fotos");
      set("photo_url", path);
      setPhotoPreview(await store.fileUrl(path));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha no upload", "error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name?.trim()) return toast("Informe o nome do paciente.", "error");
    setSaving(true);
    try {
      const payload = { ...f, birth_date: f.birth_date || null, start_date: f.start_date || null };
      await onSave(payload);
      toast(initial ? "Paciente atualizado" : "Paciente cadastrado");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? "Editar paciente" : "Novo paciente"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button form="patient-form" type="submit" loading={saving}>Salvar</Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={submit} className="space-y-6">
        <section className="flex items-center gap-4">
          <label className="group relative cursor-pointer">
            <Avatar name={f.name || "?"} src={photoPreview} size={64} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/40 text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="h-5 w-5" />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Field label="Nome completo *" className="sm:col-span-2">
              <Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Data de nascimento" hint={f.birth_date ? `Idade: ${ageLabel(f.birth_date)}` : undefined}>
              <Input type="date" value={f.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Responsáveis</h4>
            <Button type="button" variant="ghost" size="sm" onClick={() => set("guardians", [...(f.guardians ?? []), { name: "", relation: "", phone: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          <div className="space-y-3">
            {(f.guardians ?? []).map((g, i) => (
              <div key={i} className={i === 0 ? "rounded-xl border border-brand-100 bg-brand-50/40 p-3" : ""}>
                {i === 0 && <p className="mb-2 text-[11px] font-medium text-brand-700">Responsável contratante — dados usados no contrato e no recibo</p>}
                <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_1fr_1.2fr_auto]">
                  <Input placeholder="Nome" value={g.name} onChange={(e) => setGuardian(i, { name: e.target.value })} />
                  <Input placeholder="Parentesco" value={g.relation} onChange={(e) => setGuardian(i, { relation: e.target.value })} />
                  <Input placeholder="Telefone" value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} />
                  <Input placeholder="E-mail" type="email" value={g.email ?? ""} onChange={(e) => setGuardian(i, { email: e.target.value })} />
                  <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => set("guardians", (f.guardians ?? []).filter((_, j) => j !== i))} aria-label="Remover responsável">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {i === 0 && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input placeholder="CPF" inputMode="numeric" value={g.cpf ?? ""} onChange={(e) => setGuardian(i, { cpf: e.target.value })} />
                    <Input placeholder="RG" value={g.rg ?? ""} onChange={(e) => setGuardian(i, { rg: e.target.value })} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Endereço do responsável</h4>
          <div className="grid gap-2 sm:grid-cols-6">
            <Input className="sm:col-span-3" placeholder="Rua" value={f.address?.street ?? ""} onChange={(e) => setAddress({ street: e.target.value })} />
            <Input placeholder="Número" value={f.address?.number ?? ""} onChange={(e) => setAddress({ number: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Bairro" value={f.address?.district ?? ""} onChange={(e) => setAddress({ district: e.target.value })} />
            <Input className="sm:col-span-3" placeholder="Cidade" value={f.address?.city ?? ""} onChange={(e) => setAddress({ city: e.target.value })} />
            <Input placeholder="UF" maxLength={2} value={f.address?.state ?? ""} onChange={(e) => setAddress({ state: e.target.value.toUpperCase() })} />
            <Input className="sm:col-span-2" placeholder="CEP" inputMode="numeric" value={f.address?.zip ?? ""} onChange={(e) => setAddress({ zip: e.target.value })} />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Field label="Telefones"><Input value={f.phones ?? ""} onChange={(e) => set("phones", e.target.value)} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Encaminhado por"><Input value={f.referred_by ?? ""} onChange={(e) => set("referred_by", e.target.value)} /></Field>
          <Field label="Escola"><Input value={f.school ?? ""} onChange={(e) => set("school", e.target.value)} /></Field>
          <Field label="Ano/Série"><Input value={f.grade ?? ""} onChange={(e) => set("grade", e.target.value)} /></Field>
          <Field label="Professor(a)"><Input value={f.teacher ?? ""} onChange={(e) => set("teacher", e.target.value)} /></Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Diagnóstico (laudo)"><Input value={f.diagnosis ?? ""} onChange={(e) => set("diagnosis", e.target.value)} /></Field>
          <Field label="Hipóteses diagnósticas"><Input value={f.hypotheses ?? ""} onChange={(e) => set("hypotheses", e.target.value)} /></Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Atendimento">
            <Select value={f.payment_type} onChange={(e) => set("payment_type", e.target.value as Patient["payment_type"])} options={[{ value: "particular", label: "Particular" }, { value: "convenio", label: "Convênio" }]} />
          </Field>
          {f.payment_type === "convenio" && (
            <Field label="Convênio"><Input value={f.insurance_name ?? ""} onChange={(e) => set("insurance_name", e.target.value)} /></Field>
          )}
          <Field label="Sessão de avaliação (R$)"><Input type="number" min={0} step="0.01" value={f.assessment_value ?? 0} onChange={(e) => set("assessment_value", Number(e.target.value))} /></Field>
          <Field label="Sessão de intervenção (R$)"><Input type="number" min={0} step="0.01" value={f.session_value ?? 0} onChange={(e) => set("session_value", Number(e.target.value))} /></Field>
          <Field label="Sessões/semana"><Input type="number" min={0} max={7} value={f.weekly_frequency ?? 1} onChange={(e) => set("weekly_frequency", Number(e.target.value))} /></Field>
          <Field label="Data de início"><Input type="date" value={f.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as Patient["status"])} options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "alta", label: "Alta" }]} />
          </Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Objetivos gerais"><Textarea value={f.general_goals ?? ""} onChange={(e) => set("general_goals", e.target.value)} /></Field>
          <Field label="Observações"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </section>
      </form>
    </Modal>
  );
}
