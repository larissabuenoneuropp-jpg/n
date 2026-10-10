// Criador de conteúdo: demandas agregadas (sem identificar pacientes), checagem de sigilo e métricas.
import type { Patient, SocialMetrics, SocialPost } from "@/lib/types";
import { ageFrom } from "@/lib/utils";

/** Temas reconhecidos nos diagnósticos, hipóteses, queixas e dificuldades (só a contagem sai daqui). */
const THEMES: Array<{ theme: string; match: RegExp }> = [
  { theme: "TEA (autismo)", match: /\b(tea|autis)/i },
  { theme: "TDAH / atenção", match: /\b(tdah|aten[cç][aã]o|desaten|hiperativ|impulsiv)/i },
  { theme: "Dislexia / leitura", match: /\b(dislex|leitura|l[eê] |decodifica|flu[eê]ncia)/i },
  { theme: "Escrita e ortografia", match: /\b(escrita|ortogra|disortogra|trocas? (de )?letras|disgraf)/i },
  { theme: "Alfabetização", match: /\b(alfabetiza|consci[eê]ncia fonol)/i },
  { theme: "Matemática / discalculia", match: /\b(discalc|matem[aá]tic|c[aá]lculo|quantidade|n[uú]mero)/i },
  { theme: "Funções executivas / organização", match: /\b(fun[cç][oõ]es executivas|organiza|planejamento|rotina|esquec)/i },
  { theme: "Comportamento e regulação emocional", match: /\b(comportament|regula[cç][aã]o|birra|oposi|tod\b|frustra|ansiedad)/i },
  { theme: "Linguagem e fala", match: /\b(linguagem|fala\b|tdl|vocabul)/i },
  { theme: "Memória", match: /\bmem[oó]ria/i },
  { theme: "Coordenação motora", match: /\b(motor|coordena|psicomot)/i },
  { theme: "Deficiência intelectual", match: /\b(defici[eê]ncia intelectual|\bdi\b)/i },
];

export interface DemandSummary {
  theme: string;
  count: number;
}

/**
 * Resume as demandas atendidas em temas e faixas etárias.
 * Nada identificável (nome, escola, cidade, texto livre) é retornado — apenas contagens.
 */
export function summarizeDemands(patients: Patient[]) {
  const active = patients.filter((p) => p.status === "ativo");
  const counts = new Map<string, number>();
  active.forEach((p) => {
    const text = [p.diagnosis, p.hypotheses, p.difficulties, p.anamnesis?.complaints, p.general_goals].filter(Boolean).join(" ");
    const hit = new Set(THEMES.filter((t) => t.match.test(text)).map((t) => t.theme));
    hit.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  });
  const ages = { "3 a 5 anos": 0, "6 a 8 anos": 0, "9 a 12 anos": 0, "13 anos ou mais": 0 };
  active.forEach((p) => {
    const y = ageFrom(p.birth_date)?.years;
    if (y === undefined) return;
    if (y <= 5) ages["3 a 5 anos"]++;
    else if (y <= 8) ages["6 a 8 anos"]++;
    else if (y <= 12) ages["9 a 12 anos"]++;
    else ages["13 anos ou mais"]++;
  });
  const themes: DemandSummary[] = Array.from(counts, ([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count);
  return { total: active.length, themes, ages };
}

export interface PrivacyHit { term: string; kind: string }

/** Procura no texto gerado nomes de pacientes/responsáveis e escolas cadastradas. */
export function privacyScan(text: string, patients: Patient[]): PrivacyHit[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const body = ` ${norm(text)} `;
  const hits = new Map<string, PrivacyHit>();
  const check = (term: string | undefined, kind: string) => {
    const t = term?.trim();
    if (!t || t.length < 3) return;
    const re = new RegExp(`[^a-z0-9]${norm(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`);
    if (re.test(body)) hits.set(`${kind}:${t}`, { term: t, kind });
  };
  patients.forEach((p) => {
    const parts = p.name.split(/\s+/);
    check(p.name, "nome de paciente");
    check(parts[0], "primeiro nome de paciente");
    if (parts.length > 1) check(parts[parts.length - 1], "sobrenome de paciente");
    check(p.school, "escola de paciente");
    check(p.teacher, "professor(a) de paciente");
    p.guardians?.forEach((g) => { check(g.name, "nome de responsável"); check(g.name?.split(/\s+/)[0], "nome de responsável"); });
  });
  return Array.from(hits.values());
}

export function socialText(post: Pick<SocialPost, "content" | "title">) {
  const c = post.content;
  return [post.title, c.hook, ...c.slides.flatMap((s) => [s.title, s.text]), c.caption, c.cta, ...(c.stories ?? []),
    ...(c.reels?.scenes ?? []).flatMap((s) => [s.on_screen_text, s.voiceover, s.visual])].filter(Boolean).join("\n");
}

/** Taxa de engajamento sobre o alcance (curtidas + comentários + salvamentos + compartilhamentos). */
export function engagement(m?: SocialMetrics) {
  if (!m) return null;
  const inter = (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0);
  const base = m.reach || m.views;
  return base ? inter / base : null;
}

export interface MediaInsight {
  id: string;
  caption: string;
  format: string;
  timestamp?: string;
  permalink?: string;
  metrics: SocialMetrics;
}

/** Resumo das métricas para orientar a IA (sem dados pessoais de seguidores). */
export function metricsBrief(items: MediaInsight[]) {
  const withEng = items.map((i) => ({ ...i, eng: engagement(i.metrics) ?? 0 })).sort((a, b) => b.eng - a.eng);
  const byFormat = new Map<string, { n: number; eng: number; reach: number }>();
  withEng.forEach((i) => {
    const f = byFormat.get(i.format) ?? { n: 0, eng: 0, reach: 0 };
    byFormat.set(i.format, { n: f.n + 1, eng: f.eng + i.eng, reach: f.reach + (i.metrics.reach ?? i.metrics.views ?? 0) });
  });
  return {
    melhores_posts: withEng.slice(0, 5).map((i) => ({
      formato: i.format, inicio_da_legenda: i.caption.slice(0, 160), engajamento_pct: Math.round(i.eng * 1000) / 10,
      salvamentos: i.metrics.saves, compartilhamentos: i.metrics.shares, alcance: i.metrics.reach ?? i.metrics.views,
    })),
    piores_posts: withEng.slice(-3).map((i) => ({ formato: i.format, inicio_da_legenda: i.caption.slice(0, 120), engajamento_pct: Math.round(i.eng * 1000) / 10 })),
    media_por_formato: Array.from(byFormat, ([formato, v]) => ({ formato, posts: v.n, engajamento_medio_pct: Math.round((v.eng / v.n) * 1000) / 10, alcance_medio: Math.round(v.reach / v.n) })),
  };
}
