"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, ChevronLeft, ChevronRight, Lock, MessageCircle, Plus, Repeat, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Segmented, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { APPT_KIND, APPT_STATUS } from "@/lib/labels";
import type { Appointment, AppointmentKind, AppointmentStatus, Patient } from "@/lib/types";
import { WEEKDAYS, addDays, cn, formatTime, sameDay, startOfWeek, toISODate, uid } from "@/lib/utils";

type View = "dia" | "semana" | "mes";
const HOUR_PX = 56;

function minutesOf(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

/** Mensagem de confirmação para enviar ao responsável (WhatsApp). */
function confirmationLink(a: Appointment, p?: Patient, clinic?: string) {
  const phone = (p?.guardians?.[0]?.phone || p?.phones || "").replace(/\D/g, "");
  if (!phone) return null;
  const d = new Date(a.starts_at);
  const msg = `Olá! Confirmando o atendimento de ${p?.name.split(" ")[0]} em ${d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} às ${formatTime(d)}${clinic ? ` — ${clinic}` : ""}. Por favor, responda para confirmar.`;
  return `https://wa.me/55${phone.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`;
}

interface FormState {
  id?: string;
  patient_id: string;
  kind: AppointmentKind;
  title: string;
  date: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  notes: string;
  repeat: "none" | "weekly" | "biweekly";
  repeatCount: number;
  reminder: number; // horas antes; 0 = sem lembrete
  recurrence_id?: string | null;
}

function AppointmentModal({ open, onClose, initial, patients }: { open: boolean; onClose: () => void; initial: FormState | null; patients: Patient[] }) {
  const { store, bump, profile } = useData();
  const toast = useToast();
  const [f, setF] = useState<FormState | null>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setF(initial), [initial]);
  if (!f) return null;

  const toISO = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

  async function save() {
    if (!f) return;
    if (f.end <= f.start) return toast("O término deve ser após o início.", "error");
    if (f.kind !== "bloqueio" && !f.patient_id && !f.title) return toast("Selecione um paciente ou informe um título.", "error");
    setSaving(true);
    try {
      const base = {
        patient_id: f.kind === "bloqueio" ? null : f.patient_id || null,
        kind: f.kind, title: f.title, status: f.status, notes: f.notes,
      };
      const reminder = (startISO: string) => (f.reminder ? new Date(new Date(startISO).getTime() - f.reminder * 3600_000).toISOString() : null);
      if (f.id) {
        const starts_at = toISO(f.date, f.start);
        await store.update("appointments", f.id, { ...base, starts_at, ends_at: toISO(f.date, f.end), reminder_at: reminder(starts_at) });
      } else {
        const n = f.repeat === "none" ? 1 : Math.max(1, Math.min(52, f.repeatCount));
        const step = f.repeat === "biweekly" ? 14 : 7;
        const recurrence_id = n > 1 ? uid() : null;
        const rows = Array.from({ length: n }, (_, i) => {
          const date = toISODate(addDays(new Date(`${f.date}T00:00:00`), i * step));
          const starts_at = toISO(date, f.start);
          return { ...base, starts_at, ends_at: toISO(date, f.end), recurrence_id, reminder_at: reminder(starts_at) };
        });
        await store.insertMany("appointments", rows);
      }
      bump("appointments");
      toast("Agenda atualizada");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function del(all: boolean) {
    if (!f?.id) return;
    if (!confirm(all ? "Excluir todos os próximos eventos desta recorrência?" : "Excluir este evento?")) return;
    if (all && f.recurrence_id) {
      const rows = await store.list("appointments", { filter: { recurrence_id: f.recurrence_id } });
      const from = toISO(f.date, "00:00");
      for (const r of rows.filter((r) => r.starts_at >= from)) await store.remove("appointments", r.id);
    } else {
      await store.remove("appointments", f.id);
    }
    bump("appointments");
    onClose();
  }

  const patient = patients.find((p) => p.id === f.patient_id);
  const link = f.id && patient ? confirmationLink({ starts_at: toISO(f.date, f.start) } as Appointment, patient, profile?.clinic_name) : null;

  return (
    <Modal open={open} onClose={onClose} title={f.id ? "Editar evento" : "Novo evento"}
      footer={
        <>
          {f.id && <Button variant="danger" className="mr-auto" onClick={() => del(false)}><Trash2 className="h-4 w-4" /></Button>}
          {f.id && f.recurrence_id && <Button variant="danger" onClick={() => del(true)}>Excluir série</Button>}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Salvar</Button>
        </>
      }>
      <div className="space-y-3">
        <Field label="Tipo">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as AppointmentKind })} options={Object.entries(APPT_KIND).map(([value, v]) => ({ value, label: v.label }))} />
        </Field>
        {f.kind !== "bloqueio" && (
          <Field label="Paciente">
            <Select value={f.patient_id} onChange={(e) => setF({ ...f, patient_id: e.target.value })} placeholder="Selecione" options={patients.filter((p) => p.status === "ativo").map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
        )}
        <Field label={f.kind === "bloqueio" ? "Motivo do bloqueio" : "Título (opcional)"}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Data"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Início"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Término"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        </div>
        {f.kind !== "bloqueio" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AppointmentStatus })} options={Object.entries(APPT_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
            </Field>
            <Field label="Lembrete">
              <Select value={String(f.reminder)} onChange={(e) => setF({ ...f, reminder: Number(e.target.value) })} options={[{ value: "0", label: "Sem lembrete" }, { value: "2", label: "2 horas antes" }, { value: "24", label: "1 dia antes" }, { value: "48", label: "2 dias antes" }]} />
            </Field>
          </div>
        )}
        {!f.id && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Recorrência">
              <Select value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value as FormState["repeat"] })} options={[{ value: "none", label: "Não repetir" }, { value: "weekly", label: "Semanal" }, { value: "biweekly", label: "Quinzenal" }]} />
            </Field>
            {f.repeat !== "none" && (
              <Field label="Nº de ocorrências"><Input type="number" min={2} max={52} value={f.repeatCount} onChange={(e) => setF({ ...f, repeatCount: Number(e.target.value) })} /></Field>
            )}
          </div>
        )}
        <Field label="Observações"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline">
            <MessageCircle className="h-3.5 w-3.5" /> Enviar confirmação por WhatsApp
          </a>
        )}
      </div>
    </Modal>
  );
}

function EventChip({ a, p, onClick, compact }: { a: Appointment; p?: Patient; onClick: () => void; compact?: boolean }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "cursor-grab overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight active:cursor-grabbing",
        APPT_KIND[a.kind].color,
        a.status === "cancelado" && "line-through opacity-50",
        a.status === "falta" && "opacity-60",
      )}
      title={`${p?.name ?? a.title ?? APPT_KIND[a.kind].label} — ${formatTime(a.starts_at)}`}
    >
      <div className="flex items-center gap-1 font-medium">
        {a.kind === "bloqueio" && <Lock className="h-3 w-3" />}
        {a.recurrence_id && <Repeat className="h-2.5 w-2.5 shrink-0" />}
        {a.reminder_at && <Bell className="h-2.5 w-2.5 shrink-0" />}
        <span className="truncate">{p?.name ?? a.title ?? APPT_KIND[a.kind].label}</span>
      </div>
      {!compact && <div className="opacity-75">{formatTime(a.starts_at)}–{formatTime(a.ends_at)}</div>}
    </div>
  );
}

function AgendaInner() {
  const params = useSearchParams();
  const { profile, store, bump } = useData();
  const toast = useToast();
  const appts = useCollection("appointments", { orderBy: "starts_at", ascending: true });
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState(new Date());
  const [modal, setModal] = useState<FormState | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) setView("dia");
  }, []);

  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p])), [patients.data]);
  const startHour = Number((profile?.work_start ?? "07:00").split(":")[0]);
  const endHour = Math.max(startHour + 1, Number((profile?.work_end ?? "20:00").split(":")[0]) + 1);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const sessionMin = profile?.session_minutes ?? 50;

  const days = useMemo(() => {
    if (view === "dia") return [new Date(cursor)];
    if (view === "semana") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const newAt = (date: Date, hour = 9, minute = 0) => {
    const end = new Date(date);
    end.setHours(hour, minute + sessionMin);
    setModal({
      patient_id: "", kind: "atendimento", title: "", date: toISODate(date),
      start: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      end: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      status: "agendado", notes: "", repeat: "none", repeatCount: 12, reminder: 24,
    });
  };

  useEffect(() => {
    if (params.get("novo") === "1") newAt(new Date());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (a: Appointment) => {
    const s = new Date(a.starts_at);
    const e = new Date(a.ends_at);
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const reminder = a.reminder_at ? Math.round((s.getTime() - new Date(a.reminder_at).getTime()) / 3600_000) : 0;
    setModal({
      id: a.id, patient_id: a.patient_id ?? "", kind: a.kind, title: a.title ?? "", date: toISODate(s), start: hhmm(s), end: hhmm(e),
      status: a.status, notes: a.notes ?? "", repeat: "none", repeatCount: 1, reminder, recurrence_id: a.recurrence_id,
    });
  };

  /** Reagendamento por arrastar e soltar (mantém a duração). */
  async function moveTo(id: string, day: Date, hour?: number, minute = 0) {
    const a = appts.data.find((x) => x.id === id);
    if (!a) return;
    const s = new Date(a.starts_at);
    const dur = new Date(a.ends_at).getTime() - s.getTime();
    const ns = new Date(day);
    ns.setHours(hour ?? s.getHours(), hour === undefined ? s.getMinutes() : minute, 0, 0);
    const conflict = appts.data.some((o) => o.id !== id && o.status !== "cancelado" && new Date(o.starts_at) < new Date(ns.getTime() + dur) && new Date(o.ends_at) > ns);
    if (conflict && !confirm("Já existe um evento neste horário. Mover mesmo assim?")) return;
    const reminder_at = a.reminder_at ? new Date(ns.getTime() - (s.getTime() - new Date(a.reminder_at).getTime())).toISOString() : a.reminder_at;
    await store.update("appointments", id, { starts_at: ns.toISOString(), ends_at: new Date(ns.getTime() + dur).toISOString(), reminder_at });
    bump("appointments");
    toast("Atendimento reagendado");
  }

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "dia") d.setDate(d.getDate() + dir);
    else if (view === "semana") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const title =
    view === "mes"
      ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : view === "dia"
        ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
        : `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  const eventsOn = (d: Date) => appts.data.filter((a) => sameDay(new Date(a.starts_at), d));
  const now = new Date();

  // Lembretes pendentes nas próximas 48h (para envio manual pela profissional)
  const reminders = appts.data.filter((a) => a.reminder_at && new Date(a.reminder_at) <= now && new Date(a.starts_at) > now && a.status === "agendado");

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          <>
            <Button variant="secondary" onClick={() => setModal({ patient_id: "", kind: "bloqueio", title: "", date: toISODate(cursor), start: "12:00", end: "13:00", status: "agendado", notes: "", repeat: "none", repeatCount: 4, reminder: 0 })}>
              <Lock className="h-4 w-4" /> Bloquear horário
            </Button>
            <Button onClick={() => newAt(cursor)}><Plus className="h-4 w-4" /> Agendar</Button>
          </>
        }
      />

      {reminders.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800"><Bell className="h-4 w-4" /> Lembretes para enviar ({reminders.length})</p>
          <ul className="space-y-1 text-sm">
            {reminders.map((a) => {
              const p = a.patient_id ? pmap.get(a.patient_id) : undefined;
              const link = confirmationLink(a, p, profile?.clinic_name);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span>{p?.name ?? a.title} — {new Date(a.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })} {formatTime(a.starts_at)}</span>
                  {link && <a className="text-xs text-emerald-700 hover:underline" href={link} target="_blank" rel="noopener noreferrer" onClick={() => store.update("appointments", a.id, { reminder_at: null }).then(() => bump("appointments"))}>Enviar WhatsApp</a>}
                  <button className="text-xs text-ink-faint hover:text-ink" onClick={async () => { await store.update("appointments", a.id, { status: "confirmado", reminder_at: null }); bump("appointments"); }}>Marcar confirmado</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          <h2 className={cn("text-sm font-semibold sm:text-base", view !== "semana" && "first-letter:uppercase")}>{title}</h2>
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }]} />
      </div>

      {appts.loading ? (
        <Spinner />
      ) : view === "mes" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-[11px] font-medium text-ink-faint">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const evs = eventsOn(d);
              const out = d.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={d.toISOString()}
                  onClick={() => { setCursor(d); setView("dia"); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); moveTo(e.dataTransfer.getData("text/plain"), d); }}
                  className={cn("min-h-[92px] cursor-pointer border-b border-r border-line p-1.5 hover:bg-canvas/60", out && "bg-canvas/40 text-ink-faint")}
                >
                  <div className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", sameDay(d, now) && "bg-brand-600 font-semibold text-white")}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((a) => <EventChip key={a.id} a={a} p={a.patient_id ? pmap.get(a.patient_id) : undefined} onClick={() => edit(a)} compact />)}
                    {evs.length > 3 && <p className="px-1 text-[10px] text-ink-faint">+{evs.length - 3} mais</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div style={{ minWidth: view === "semana" ? 760 : undefined }}>
            <div className="sticky top-0 z-10 grid border-b border-line bg-white" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div />
              {days.map((d) => (
                <div key={d.toISOString()} className="py-2 text-center">
                  <p className="text-[11px] text-ink-faint">{WEEKDAYS[d.getDay()]}</p>
                  <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm", sameDay(d, now) ? "bg-brand-600 font-semibold text-white" : "")}>{d.getDate()}</p>
                </div>
              ))}
            </div>
            <div className="relative grid pt-2" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-line text-right" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2 text-[10px] text-ink-faint">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div key={d.toISOString()} className="relative border-l border-line">
                  {hours.map((h) =>
                    [0, 30].map((m) => (
                      <div
                        key={`${h}-${m}`}
                        className={cn("hover:bg-brand-50/50", m === 30 ? "border-b border-line" : "border-b border-dashed border-line/60")}
                        style={{ height: HOUR_PX / 2 }}
                        onClick={() => newAt(d, h, m)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); moveTo(e.dataTransfer.getData("text/plain"), d, h, m); }}
                      />
                    )),
                  )}
                  {sameDay(d, now) && minutesOf(now) >= startHour * 60 && minutesOf(now) <= endHour * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-400" style={{ top: ((minutesOf(now) - startHour * 60) / 60) * HOUR_PX }} />
                  )}
                  {eventsOn(d).map((a) => {
                    const s = new Date(a.starts_at);
                    const e = new Date(a.ends_at);
                    const top = ((minutesOf(s) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(22, ((e.getTime() - s.getTime()) / 3600_000) * HOUR_PX - 2);
                    if (top < 0) return null;
                    return (
                      <div key={a.id} className="absolute inset-x-1 z-10" style={{ top, height }}>
                        <div className="h-full">
                          <EventChip a={a} p={a.patient_id ? pmap.get(a.patient_id) : undefined} onClick={() => edit(a)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(APPT_KIND).map(([k, v]) => <span key={k} className={cn("rounded-md border px-2 py-0.5 text-[11px]", v.color)}>{v.label}</span>)}
        <Badge tone="gray">Arraste os eventos para reagendar</Badge>
      </div>

      <AppointmentModal open={Boolean(modal)} onClose={() => setModal(null)} initial={modal} patients={patients.data} />
    </>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AgendaInner />
    </Suspense>
  );
}
