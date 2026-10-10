"use client";
import Link from "next/link";
import { useMemo } from "react";
import {
  AlertCircle, CalendarClock, CalendarPlus, Cake, ClipboardList, FilePlus2, NotebookPen, Sparkles, Target, TrendingUp, UserPlus, Users, Wallet,
} from "lucide-react";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { APPT_KIND, APPT_STATUS, txStatus } from "@/lib/labels";
import { formatDate, formatTime, money, monthKey, parseDate, sameDay, startOfWeek, addDays } from "@/lib/utils";

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-soft">{label}</span>
        <span className="rounded-md bg-brand-50 p-1.5 text-brand-500">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const { profile } = useData();
  const patients = useCollection("patients");
  const appts = useCollection("appointments", { orderBy: "starts_at", ascending: true });
  const txs = useCollection("transactions");
  const assessments = useCollection("assessments");
  const plans = useCollection("intervention_plans");

  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p])), [patients.data]);
  const now = new Date();

  const todayAppts = appts.data.filter((a) => sameDay(new Date(a.starts_at), now) && a.status !== "cancelado");
  const upcoming = appts.data
    .filter((a) => new Date(a.starts_at) > now && !sameDay(new Date(a.starts_at), now) && a.kind !== "bloqueio" && a.status !== "cancelado")
    .slice(0, 5);

  const activePatients = patients.data.filter((p) => p.status === "ativo");
  const birthdays = activePatients
    .filter((p) => p.birth_date && parseDate(p.birth_date).getMonth() === now.getMonth())
    .sort((a, b) => parseDate(a.birth_date!).getDate() - parseDate(b.birth_date!).getDate());

  const thisMonth = monthKey(now);
  const revenue = txs.data.filter((t) => t.type === "receita" && t.paid_at && monthKey(t.paid_at) === thisMonth).reduce((s, t) => s + Number(t.amount), 0);
  const pending = txs.data.filter((t) => t.type === "receita" && !t.paid_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingTotal = pending.reduce((s, t) => s + Number(t.amount), 0);

  // Ocupação da semana: horas agendadas / horas disponíveis (expediente × dias úteis)
  const occupancy = useMemo(() => {
    const ws = startOfWeek(now);
    const we = addDays(ws, 7);
    const [sh, sm] = (profile?.work_start ?? "08:00").split(":").map(Number);
    const [eh, em] = (profile?.work_end ?? "19:00").split(":").map(Number);
    const dailyMin = eh * 60 + em - (sh * 60 + sm);
    const available = dailyMin * 5;
    const booked = appts.data
      .filter((a) => {
        const d = new Date(a.starts_at);
        return d >= ws && d < we && a.kind !== "bloqueio" && a.status !== "cancelado";
      })
      .reduce((s, a) => s + (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000, 0);
    return available > 0 ? Math.min(100, Math.round((booked / available) * 100)) : 0;
  }, [appts.data, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAssessments = assessments.data.filter((a) => a.status === "em_andamento");
  const activePlans = plans.data.filter((p) => p.status === "ativo");

  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const firstName = (profile?.professional_name ?? "").replace(/^(Dra?\.)\s*/i, "").split(" ")[0];

  if (patients.loading || appts.loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ""}`}
        subtitle={now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      />

      {/* Atalhos rápidos */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { href: "/pacientes?novo=1", label: "Novo paciente", icon: UserPlus },
          { href: "/agenda?novo=1", label: "Agendar", icon: CalendarPlus },
          { href: "/pacientes", label: "Registrar sessão", icon: NotebookPen },
          { href: "/financeiro?novo=1", label: "Lançamento", icon: Wallet },
          { href: "/relatorios?novo=1", label: "Novo documento", icon: FilePlus2 },
          { href: "/assistente", label: "Assistente IA", icon: Sparkles },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-soft shadow-card transition hover:border-brand-200 hover:text-ink">
            <Icon className="h-4 w-4 text-brand-500" />
            {label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pacientes ativos" value={String(activePatients.length)} hint={`${patients.data.length} cadastrados`} icon={<Users className="h-4 w-4" />} />
        <Stat label="Faturamento do mês" value={money(revenue)} hint="Recebido no mês" icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Ocupação da agenda" value={`${occupancy}%`} hint="Semana atual (dias úteis)" icon={<CalendarClock className="h-4 w-4" />} />
        <Stat label="A receber" value={money(pendingTotal)} hint={`${pending.length} lançamento(s)`} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Agenda de hoje" icon={<CalendarClock className="h-4 w-4" />} action={<Link href="/agenda" className="text-xs text-brand-600 hover:underline">Ver agenda</Link>} />
          {todayAppts.length === 0 ? (
            <EmptyState title="Nenhum compromisso hoje" text="Aproveite para planejar sessões ou atualizar relatórios." />
          ) : (
            <ul className="divide-y divide-line">
              {todayAppts.map((a) => {
                const p = a.patient_id ? pmap.get(a.patient_id) : undefined;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-14 shrink-0 text-sm font-medium tabular-nums">{formatTime(a.starts_at)}</div>
                    <div className={`h-9 w-1 rounded-full ${a.kind === "bloqueio" ? "bg-slate-200" : a.kind === "avaliacao" ? "bg-lilac-400" : "bg-brand-400"}`} />
                    <div className="min-w-0 flex-1">
                      {p ? (
                        <Link href={`/pacientes/${p.id}`} className="truncate text-sm font-medium hover:underline">{p.name}</Link>
                      ) : (
                        <p className="truncate text-sm font-medium">{a.title || APPT_KIND[a.kind].label}</p>
                      )}
                      <p className="text-xs text-ink-faint">{APPT_KIND[a.kind].label} · até {formatTime(a.ends_at)}</p>
                    </div>
                    {a.kind !== "bloqueio" && <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>}
                    {p && a.kind !== "bloqueio" && (
                      <Link href={`/pacientes/${p.id}?tab=sessoes&novo=1&appt=${a.id}`} className="hidden text-xs text-brand-600 hover:underline sm:inline">Registrar</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximos atendimentos" icon={<CalendarPlus className="h-4 w-4" />} />
          {upcoming.length === 0 ? (
            <EmptyState title="Sem próximos atendimentos" />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => {
                const p = a.patient_id ? pmap.get(a.patient_id) : undefined;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={p?.name ?? a.title ?? "?"} src={p?.photo_url} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{p?.name ?? a.title}</p>
                      <p className="text-xs text-ink-faint">
                        {new Date(a.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} · {formatTime(a.starts_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Avaliações em andamento" icon={<ClipboardList className="h-4 w-4" />} />
          {openAssessments.length === 0 ? (
            <EmptyState title="Nenhuma avaliação em andamento" />
          ) : (
            <ul className="divide-y divide-line">
              {openAssessments.map((a) => {
                const done = a.instruments.filter((i) => i.status !== "planejado").length;
                const pct = a.instruments.length ? Math.round((done / a.instruments.length) * 100) : 0;
                return (
                  <li key={a.id} className="px-5 py-3">
                    <Link href={`/pacientes/${a.patient_id}?tab=avaliacoes`} className="text-sm font-medium hover:underline">{pmap.get(a.patient_id)?.name}</Link>
                    <p className="truncate text-xs text-ink-faint">{a.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-lilac-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-ink-faint">{done}/{a.instruments.length}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Planos de intervenção ativos" icon={<Target className="h-4 w-4" />} />
          {activePlans.length === 0 ? (
            <EmptyState title="Nenhum plano ativo" />
          ) : (
            <ul className="divide-y divide-line">
              {activePlans.map((pl) => {
                const done = pl.schedule.filter((s) => s.done).length;
                return (
                  <li key={pl.id} className="px-5 py-3">
                    <Link href={`/pacientes/${pl.patient_id}?tab=intervencao`} className="text-sm font-medium hover:underline">{pmap.get(pl.patient_id)?.name}</Link>
                    <p className="truncate text-xs text-ink-faint">{pl.title}</p>
                    <p className="mt-1 text-[11px] text-ink-faint">{done} de {pl.schedule.length} sessões planejadas concluídas</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Aniversariantes do mês" icon={<Cake className="h-4 w-4" />} />
            {birthdays.length === 0 ? (
              <EmptyState title="Nenhum aniversariante este mês" />
            ) : (
              <ul className="divide-y divide-line">
                {birthdays.map((p) => {
                  const isToday = parseDate(p.birth_date!).getDate() === now.getDate();
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar name={p.name} src={p.photo_url} size={28} />
                      <Link href={`/pacientes/${p.id}`} className="flex-1 truncate text-sm hover:underline">{p.name}</Link>
                      <span className="text-xs text-ink-faint">
                        {formatDate(p.birth_date, { day: "2-digit", month: "2-digit" })} · faz {now.getFullYear() - parseDate(p.birth_date!).getFullYear()} anos
                      </span>
                      {isToday && <Badge tone="lilac">Hoje!</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Pendências financeiras" icon={<AlertCircle className="h-4 w-4" />} action={<Link href="/financeiro" className="text-xs text-brand-600 hover:underline">Financeiro</Link>} />
            {pending.length === 0 ? (
              <EmptyState title="Tudo em dia" />
            ) : (
              <ul className="divide-y divide-line">
                {pending.slice(0, 5).map((t) => {
                  const st = txStatus(t);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{t.description || (t.patient_id && pmap.get(t.patient_id)?.name)}</p>
                        <p className="text-xs text-ink-faint">Venc. {formatDate(t.due_date)}</p>
                      </div>
                      <span className="text-sm tabular-nums">{money(t.amount)}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
