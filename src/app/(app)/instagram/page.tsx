"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, CalendarDays, Check, Copy, Download, Film, Image as ImageIcon, Megaphone as Instagram, Layers, Lock, MessageCircle,
  Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, TrendingUp,
} from "lucide-react";
import { AiNotice, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Spinner, Tabs, Textarea, useToast } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { useCollection, useData } from "@/lib/data/provider";
import { askAI } from "@/lib/ai/client";
import { engagement, metricsBrief, privacyScan, socialText, summarizeDemands, type MediaInsight } from "@/lib/social";
import { slideBlob, renderSlide } from "@/lib/social-art";
import type { SocialContent, SocialFormat, SocialMetrics, SocialPost, SocialStatus } from "@/lib/types";
import { cn, downloadBlob, formatDate, today } from "@/lib/utils";

const FORMATS: Array<{ value: SocialFormat; label: string; icon: React.ReactNode }> = [
  { value: "carrossel", label: "Carrossel", icon: <Layers className="h-4 w-4" /> },
  { value: "post", label: "Post único", icon: <ImageIcon className="h-4 w-4" /> },
  { value: "reels", label: "Reels", icon: <Film className="h-4 w-4" /> },
  { value: "stories", label: "Stories", icon: <MessageCircle className="h-4 w-4" /> },
];
const STATUS: Record<SocialStatus, { label: string; tone: "gray" | "amber" | "blue" | "green" }> = {
  ideia: { label: "Ideia", tone: "gray" }, rascunho: { label: "Rascunho", tone: "amber" }, agendado: { label: "Agendado", tone: "blue" }, publicado: { label: "Publicado", tone: "green" },
};
const GOALS = ["Captar pacientes", "Educar o público", "Gerar autoridade", "Engajamento / comunidade", "Quebrar mitos"];
const AUDIENCES = ["Pais e mães", "Professores e escolas", "Pais e professores"];
const TONES = ["Acolhedor", "Técnico e acessível", "Leve e próximo"];

interface AiPost extends SocialContent { title: string }
type Draft = { title: string; format: SocialFormat; theme: string; audience: string; goal: string; content: SocialContent };

function emptyContent(): SocialContent {
  return { hook: "", slides: [], caption: "", hashtags: [], cta: "", reels: null, stories: [] };
}

function useInstagram() {
  const [state, setState] = useState<{ loading: boolean; configured: boolean; demo: boolean; media: MediaInsight[]; error?: string; warnings?: string[] }>({ loading: true, configured: false, demo: true, media: [] });
  const load = async (refresh = false) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/instagram${refresh ? "?refresh=1" : ""}`);
      const json = await res.json();
      setState({ loading: false, configured: json.configured, demo: json.demo, media: json.media ?? [], error: json.error, warnings: json.warnings });
    } catch {
      setState({ loading: false, configured: false, demo: true, media: [], error: "Falha ao consultar métricas" });
    }
  };
  useEffect(() => { load(); }, []);
  return { ...state, reload: () => load(true) };
}

/* -------------------------------- Editor --------------------------------- */

function PostEditor({ draft, setDraft, privacyHits }: { draft: Draft; setDraft: (d: Draft) => void; privacyHits: ReturnType<typeof privacyScan> }) {
  const { profile } = useData();
  const toast = useToast();
  const c = draft.content;
  const set = (patch: Partial<SocialContent>) => setDraft({ ...draft, content: { ...c, ...patch } });
  const [previews, setPreviews] = useState<string[]>([]);
  const handle = profile?.instagram || "";

  useEffect(() => {
    let alive = true;
    const slides = c.slides.length ? c.slides : draft.format === "reels" || draft.format === "stories" ? [{ title: c.hook || draft.title, text: c.cta }] : [];
    (async () => {
      const urls: string[] = [];
      for (let i = 0; i < Math.min(slides.length, 10); i++) {
        const canvas = await renderSlide({ ...slides[i], index: i, total: slides.length, handle, cover: !c.slides.length });
        urls.push(canvas.toDataURL("image/jpeg", 0.7));
      }
      if (alive) setPreviews(urls);
    })();
    return () => { alive = false; };
  }, [c.slides, c.hook, c.cta, draft.title, draft.format, handle]);

  async function downloadArt() {
    const slides = c.slides.length ? c.slides : [{ title: c.hook || draft.title, text: c.cta }];
    for (let i = 0; i < slides.length; i++) {
      const blob = await slideBlob({ ...slides[i], index: i, total: slides.length, handle, cover: !c.slides.length });
      downloadBlob(blob, `${draft.title.slice(0, 40).replace(/[^\wÀ-ú]+/g, "-")}-${i + 1}.png`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  const fullCaption = `${c.caption}\n\n${c.cta ? `👉 ${c.cta}\n\n` : ""}${c.hashtags.join(" ")}`;

  return (
    <div className="space-y-4">
      {privacyHits.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <b>Atenção ao sigilo:</b> o texto contém termos que coincidem com dados de pacientes cadastrados —{" "}
            {privacyHits.map((h) => `"${h.term}" (${h.kind})`).join(", ")}. Revise antes de salvar ou publicar.
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título interno"><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Gancho (primeira frase)"><Input value={c.hook} onChange={(e) => set({ hook: e.target.value })} /></Field>
      </div>

      {(draft.format === "carrossel" || draft.format === "post") && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink-soft">{draft.format === "post" ? "Arte" : `Slides (${c.slides.length})`}</p>
            {draft.format === "carrossel" && <Button variant="ghost" size="sm" onClick={() => set({ slides: [...c.slides, { title: "", text: "" }] })}><Plus className="h-3.5 w-3.5" /> Slide</Button>}
          </div>
          <div className="space-y-2">
            {c.slides.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[28px_1fr_2fr_auto]">
                <span className="pt-2 text-center text-xs font-medium text-ink-faint">{i + 1}</span>
                <Input placeholder="Título do slide" value={s.title} onChange={(e) => set({ slides: c.slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <Textarea rows={2} placeholder="Texto" value={s.text} onChange={(e) => set({ slides: c.slides.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                <Button variant="ghost" size="sm" className="h-9" onClick={() => set({ slides: c.slides.filter((_, j) => j !== i) })} aria-label="Remover slide"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.format === "reels" && (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duração (s)"><Input type="number" value={c.reels?.duration_s ?? 30} onChange={(e) => set({ reels: { duration_s: Number(e.target.value), audio_suggestion: c.reels?.audio_suggestion ?? "", scenes: c.reels?.scenes ?? [] } })} /></Field>
            <Field label="Sugestão de áudio"><Input value={c.reels?.audio_suggestion ?? ""} onChange={(e) => set({ reels: { duration_s: c.reels?.duration_s ?? 30, audio_suggestion: e.target.value, scenes: c.reels?.scenes ?? [] } })} /></Field>
          </div>
          <p className="text-xs font-medium text-ink-soft">Roteiro por cena</p>
          {(c.reels?.scenes ?? []).map((s, i) => {
            const upd = (patch: Partial<typeof s>) => set({ reels: { ...c.reels!, scenes: c.reels!.scenes.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
            return (
              <div key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-[90px_1fr_1fr_1.4fr_auto]">
                <Input value={s.time} onChange={(e) => upd({ time: e.target.value })} aria-label="Tempo" />
                <Input placeholder="O que aparece" value={s.visual} onChange={(e) => upd({ visual: e.target.value })} />
                <Input placeholder="Texto na tela" value={s.on_screen_text} onChange={(e) => upd({ on_screen_text: e.target.value })} />
                <Input placeholder="Fala" value={s.voiceover} onChange={(e) => upd({ voiceover: e.target.value })} />
                <Button variant="ghost" size="sm" className="h-9" onClick={() => set({ reels: { ...c.reels!, scenes: c.reels!.scenes.filter((_, j) => j !== i) } })} aria-label="Remover cena"><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => set({ reels: { duration_s: c.reels?.duration_s ?? 30, audio_suggestion: c.reels?.audio_suggestion ?? "", scenes: [...(c.reels?.scenes ?? []), { time: "", visual: "", on_screen_text: "", voiceover: "" }] } })}><Plus className="h-3.5 w-3.5" /> Cena</Button>
        </div>
      )}

      {(draft.format === "stories" || (c.stories?.length ?? 0) > 0) && (
        <Field label={draft.format === "stories" ? "Sequência de stories (um por linha)" : "Ideias de stories para divulgar (um por linha)"}>
          <Textarea rows={4} value={(c.stories ?? []).join("\n")} onChange={(e) => set({ stories: e.target.value.split("\n") })} />
        </Field>
      )}

      <Field label="Legenda"><Textarea rows={6} value={c.caption} onChange={(e) => set({ caption: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chamada para ação (CTA)"><Input value={c.cta} onChange={(e) => set({ cta: e.target.value })} /></Field>
        <Field label="Hashtags (separe por espaço)"><Input value={c.hashtags.join(" ")} onChange={(e) => set({ hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)) })} /></Field>
      </div>
      {(c.best_time || c.design_tips) && (
        <p className="rounded-lg bg-sand-100 p-3 text-xs text-ink-soft">{c.best_time && <><b>Melhor horário:</b> {c.best_time}. </>}{c.design_tips && <><b>Dica de design:</b> {c.design_tips}</>}</p>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-soft">Pré-visualização das artes (1080×1350)</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(fullCaption); toast("Legenda copiada"); }}><Copy className="h-3.5 w-3.5" /> Copiar legenda</Button>
            <Button variant="secondary" size="sm" onClick={downloadArt}><Download className="h-3.5 w-3.5" /> Baixar artes (PNG)</Button>
          </div>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Slide ${i + 1}`} className="h-64 w-auto shrink-0 rounded-lg border border-line shadow-card" />
          ))}
          {previews.length === 0 && <p className="text-xs text-ink-faint">Adicione slides para ver as artes.</p>}
        </div>
        {draft.format === "reels" && <p className="text-[11px] text-ink-faint">Para Reels, a arte gerada serve como capa. Grave o vídeo seguindo o roteiro.</p>}
      </div>
    </div>
  );
}

/* --------------------------------- Página -------------------------------- */

export default function InstagramPage() {
  const toast = useToast();
  const { profile } = useData();
  const patients = useCollection("patients");
  const posts = useCollection("social_posts", { orderBy: "updated_at" });
  const ig = useInstagram();
  const [tab, setTab] = useState<"criar" | "calendario" | "metricas">("criar");

  const demands = useMemo(() => summarizeDemands(patients.data), [patients.data]);
  const [format, setFormat] = useState<SocialFormat>("carrossel");
  const [theme, setTheme] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [useMetrics, setUseMetrics] = useState(true);
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [metricsFor, setMetricsFor] = useState<SocialPost | null>(null);

  useEffect(() => {
    if (!theme && demands.themes.length) setTheme(demands.themes[0].theme);
  }, [demands.themes, theme]);

  // Métricas combinadas: Instagram (quando conectado) + métricas digitadas nos posts publicados
  const allMetrics: MediaInsight[] = useMemo(() => {
    const own = posts.data.filter((p) => p.status === "publicado" && p.metrics && Object.keys(p.metrics).length)
      .map((p) => ({ id: p.id, caption: `${p.content.hook} ${p.content.caption}`.trim(), format: p.format, metrics: p.metrics!, timestamp: p.published_at ?? undefined }));
    return ig.configured ? ig.media : [...own, ...(own.length ? [] : ig.media)];
  }, [posts.data, ig.configured, ig.media]);

  const privacyHits = useMemo(() => (draft ? privacyScan(socialText({ title: draft.title, content: draft.content }), patients.data) : []), [draft, patients.data]);

  async function generate() {
    const chosen = theme === "__outro" ? customTheme : theme;
    if (!chosen.trim()) return toast("Escolha ou escreva um tema.", "error");
    setLoading(true);
    try {
      const r = await askAI<AiPost>("social_post", {
        formato: format, tema: chosen, publico: audience, objetivo: goal, tom: tone,
        observacoes: extra || undefined,
        // Apenas contagens agregadas — nenhum dado identificável de paciente
        demandas_atendidas: { pacientes_ativos: demands.total, temas: demands.themes, faixas_etarias: demands.ages },
        profissional: { profissao: profile?.profession, cidade: profile?.city, instagram: profile?.instagram, contato: "WhatsApp do perfil" },
        metricas: useMetrics && allMetrics.length ? metricsBrief(allMetrics) : undefined,
      });
      const res = r.result;
      setDraft({
        title: res.title || chosen, format, theme: chosen, audience, goal,
        content: {
          ...emptyContent(), ...res,
          slides: Array.isArray(res.slides) ? res.slides : [],
          hashtags: Array.isArray(res.hashtags) ? res.hashtags : [],
          stories: Array.isArray(res.stories) ? res.stories : [],
        },
      });
      setEditingId(null);
      setDemo(r.demo);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(false);
    }
  }

  async function save(status: SocialStatus) {
    if (!draft) return;
    if (privacyHits.length && !confirm("O texto contém termos que coincidem com dados de pacientes. Salvar mesmo assim?")) return;
    const payload: Partial<SocialPost> = { title: draft.title, format: draft.format, theme: draft.theme, audience: draft.audience, goal: draft.goal, content: draft.content, status };
    if (editingId) await posts.update(editingId, payload);
    else {
      const p = await posts.insert(payload);
      setEditingId(p.id);
    }
    toast(status === "agendado" ? "Salvo no calendário" : "Conteúdo salvo");
  }

  const chartData = allMetrics.slice(0, 8).reverse().map((m, i) => ({
    x: `${m.format.slice(0, 4)} ${i + 1}`,
    salvos: m.metrics.saves ?? 0,
    compart: m.metrics.shares ?? 0,
  }));

  return (
    <>
      <PageHeader title="Instagram" subtitle="Posts, carrosséis, reels e stories para atrair famílias — sem expor pacientes" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "criar", label: "Criar conteúdo", icon: <Sparkles className="h-4 w-4" /> },
        { value: "calendario", label: `Calendário (${posts.data.length})`, icon: <CalendarDays className="h-4 w-4" /> },
        { value: "metricas", label: "Métricas", icon: <BarChart3 className="h-4 w-4" /> },
      ]} />

      <div className="pt-5">
        {tab === "criar" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader title="Demandas que você atende" icon={<ShieldCheck className="h-4 w-4" />} subtitle="Somente contagens — nenhum nome ou detalhe sai daqui" />
                <div className="space-y-3 p-5">
                  {demands.themes.length === 0 ? <p className="text-xs text-ink-faint">Cadastre diagnósticos/hipóteses para ver os temas.</p> : (
                    <div className="flex flex-wrap gap-1.5">
                      {demands.themes.map((t) => (
                        <button key={t.theme} onClick={() => setTheme(t.theme)} className={cn("rounded-full border px-2.5 py-1 text-xs", theme === t.theme ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-ink-soft")}>
                          {t.theme} · {t.count}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-ink-faint">Faixas etárias: {Object.entries(demands.ages).filter(([, n]) => n).map(([k, n]) => `${k} (${n})`).join(", ") || "—"}</p>
                </div>
              </Card>
              <Card className="space-y-3 p-5">
                <div className="grid grid-cols-2 gap-2">
                  {FORMATS.map((f) => (
                    <button key={f.value} onClick={() => setFormat(f.value)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", format === f.value ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-ink-soft")}>
                      {f.icon}{f.label}
                    </button>
                  ))}
                </div>
                <Field label="Tema">
                  <Select value={theme} onChange={(e) => setTheme(e.target.value)} options={[...demands.themes.map((t) => t.theme), "Institucional / bastidores", "O que é neuropsicopedagogia", { value: "__outro", label: "Outro tema…" }]} />
                </Field>
                {theme === "__outro" && <Input placeholder="Escreva o tema" value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} />}
                <Field label="Público"><Select value={audience} onChange={(e) => setAudience(e.target.value)} options={AUDIENCES} /></Field>
                <Field label="Objetivo"><Select value={goal} onChange={(e) => setGoal(e.target.value)} options={GOALS} /></Field>
                <Field label="Tom"><Select value={tone} onChange={(e) => setTone(e.target.value)} options={TONES} /></Field>
                <Field label="Observações (opcional)" hint="Ex.: falar da volta às aulas. Não escreva nomes ou casos reais."><Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" checked={useMetrics} onChange={(e) => setUseMetrics(e.target.checked)} />
                  Basear nas métricas {ig.configured ? "do Instagram" : allMetrics.length ? "dos posts publicados" : "(sem dados ainda)"}
                </label>
                <Button variant="ai" className="w-full" loading={loading} onClick={generate}><Sparkles className="h-4 w-4" /> Gerar conteúdo</Button>
                <p className="flex gap-1.5 text-[11px] leading-relaxed text-ink-faint"><Lock className="mt-0.5 h-3 w-3 shrink-0" /> A IA recebe só temas e contagens. Exemplos são fictícios e o texto final é checado contra nomes e escolas cadastrados.</p>
              </Card>
            </div>

            <Card>
              <CardHeader title={draft ? draft.title || "Novo conteúdo" : "Seu conteúdo aparece aqui"} icon={<Instagram className="h-4 w-4" />}
                action={draft && <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => save("rascunho")}><Save className="h-3.5 w-3.5" /> Salvar rascunho</Button>
                  <Button size="sm" onClick={() => save("agendado")}><CalendarDays className="h-3.5 w-3.5" /> Para o calendário</Button>
                </div>} />
              <div className="p-5">
                {!draft ? (
                  <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Escolha formato e tema e clique em Gerar"
                    text="Você recebe gancho, slides ou roteiro de reels, legenda, CTA, hashtags, ideias de stories e as artes nas cores da sua marca — tudo editável." />
                ) : (
                  <div className="space-y-4">
                    {demo !== null && <AiNotice demo={demo} />}
                    <PostEditor draft={draft} setDraft={setDraft} privacyHits={privacyHits} />
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "calendario" && (
          <Card>
            <CardHeader title="Calendário editorial" subtitle="Organize, agende e registre as métricas de cada publicação" />
            {posts.loading ? <Spinner /> : posts.data.length === 0 ? <EmptyState title="Nenhum conteúdo salvo ainda" /> : (
              <ul className="divide-y divide-line">
                {[...posts.data].sort((a, b) => (a.scheduled_for ?? a.published_at ?? "9").localeCompare(b.scheduled_for ?? b.published_at ?? "9")).map((p) => {
                  const eng = engagement(p.metrics);
                  return (
                    <li key={p.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                          <Badge>{FORMATS.find((f) => f.value === p.format)?.label}</Badge>
                          {p.theme && <Badge tone="sage">{p.theme}</Badge>}
                          {eng !== null && <span className="text-[11px] text-ink-faint">Engajamento {Math.round(eng * 1000) / 10}%</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" className="h-8 w-36 text-xs" value={(p.status === "publicado" ? p.published_at : p.scheduled_for) ?? ""}
                          onChange={(e) => posts.update(p.id, p.status === "publicado" ? { published_at: e.target.value } : { scheduled_for: e.target.value, status: "agendado" })} aria-label="Data" />
                        <Select className="h-8 w-32 text-xs" value={p.status} onChange={(e) => {
                          const st = e.target.value as SocialStatus;
                          posts.update(p.id, { status: st, ...(st === "publicado" && !p.published_at ? { published_at: p.scheduled_for ?? today() } : {}) });
                        }} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} />
                        <Button variant="ghost" size="sm" onClick={() => { setDraft({ title: p.title, format: p.format, theme: p.theme ?? "", audience: p.audience ?? "", goal: p.goal ?? "", content: p.content }); setEditingId(p.id); setDemo(null); setTab("criar"); }}>Editar</Button>
                        {p.status === "publicado" && <Button variant="ghost" size="sm" onClick={() => setMetricsFor(p)}><TrendingUp className="h-3.5 w-3.5" /> Métricas</Button>}
                        <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Excluir conteúdo?")) await posts.remove(p.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {tab === "metricas" && (
          <div className="space-y-4">
            <Card className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", ig.configured ? "border-emerald-200 bg-emerald-50/40" : "border-mustard-300 bg-mustard-100/40")}>
              <Instagram className="h-5 w-5 shrink-0" />
              <div className="flex-1 text-sm">
                {ig.configured ? (
                  <p><b>Instagram conectado.</b> As métricas das últimas publicações são usadas para orientar a IA.</p>
                ) : (
                  <p><b>Instagram ainda não conectado.</b> {ig.demo ? "Exibindo métricas de exemplo." : ""} Para conectar, configure o token da API da Meta no servidor (passo a passo no README). Enquanto isso, você pode digitar as métricas de cada post publicado no Calendário.</p>
                )}
                {ig.error && <p className="mt-1 text-xs text-red-600">{ig.error}</p>}
                {ig.warnings?.map((w) => <p key={w} className="mt-1 text-xs text-amber-700">{w}</p>)}
              </div>
              {ig.configured && <Button variant="secondary" size="sm" onClick={ig.reload} loading={ig.loading}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>}
            </Card>

            {ig.loading ? <Spinner /> : allMetrics.length === 0 ? <Card><EmptyState title="Sem métricas ainda" /></Card> : (
              <>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader title="Salvamentos e compartilhamentos" subtitle="Os sinais mais fortes de conteúdo útil" />
                    <div className="p-5"><BarChart data={chartData} xKey="x" series={[{ key: "salvos", label: "Salvamentos" }, { key: "compart", label: "Compartilhamentos" }]} /></div>
                  </Card>
                  <Card>
                    <CardHeader title="Média por formato" />
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-ink-faint"><tr><th className="px-5 py-2 font-medium">Formato</th><th className="px-2 py-2 text-right font-medium">Posts</th><th className="px-2 py-2 text-right font-medium">Alcance médio</th><th className="px-5 py-2 text-right font-medium">Engajamento</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {metricsBrief(allMetrics).media_por_formato.map((f) => (
                          <tr key={f.formato}><td className="px-5 py-2 capitalize">{f.formato}</td><td className="px-2 py-2 text-right tabular-nums">{f.posts}</td><td className="px-2 py-2 text-right tabular-nums">{f.alcance_medio.toLocaleString("pt-BR")}</td><td className="px-5 py-2 text-right tabular-nums">{f.engajamento_medio_pct}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-5 pb-4 text-[11px] text-ink-faint">Engajamento = (curtidas + comentários + salvamentos + compartilhamentos) ÷ alcance.</p>
                  </Card>
                </div>
                <Card>
                  <CardHeader title="Publicações por desempenho" />
                  <ul className="divide-y divide-line">
                    {[...allMetrics].sort((a, b) => (engagement(b.metrics) ?? 0) - (engagement(a.metrics) ?? 0)).map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                        <Badge>{m.format}</Badge>
                        <span className="min-w-0 flex-1 truncate text-sm">{m.caption || "(sem legenda)"}</span>
                        <span className="hidden text-xs text-ink-faint sm:inline">alcance {(m.metrics.reach ?? m.metrics.views ?? 0).toLocaleString("pt-BR")} · salvos {m.metrics.saves ?? 0}</span>
                        <span className="w-14 text-right text-sm font-medium tabular-nums">{Math.round((engagement(m.metrics) ?? 0) * 1000) / 10}%</span>
                        {m.permalink && <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">abrir</a>}
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      <MetricsModal post={metricsFor} onClose={() => setMetricsFor(null)} onSave={async (m) => { if (metricsFor) { await posts.update(metricsFor.id, { metrics: m }); toast("Métricas salvas"); } }} />
    </>
  );
}

function MetricsModal({ post, onClose, onSave }: { post: SocialPost | null; onClose: () => void; onSave: (m: SocialMetrics) => Promise<void> }) {
  const [m, setM] = useState<SocialMetrics>({});
  useEffect(() => setM(post?.metrics ?? {}), [post]);
  const fields: Array<[keyof SocialMetrics, string]> = [["reach", "Alcance (contas)"], ["views", "Visualizações"], ["likes", "Curtidas"], ["comments", "Comentários"], ["saves", "Salvamentos"], ["shares", "Compartilhamentos"]];
  return (
    <Modal open={Boolean(post)} onClose={onClose} title={`Métricas — ${post?.title ?? ""}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={async () => { await onSave(m); onClose(); }}><Check className="h-4 w-4" /> Salvar</Button></>}>
      <p className="mb-3 text-xs text-ink-soft">Copie os números dos "Insights" da publicação no app do Instagram.</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}><Input type="number" min={0} value={m[k] ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
        ))}
      </div>
    </Modal>
  );
}
