import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { MediaInsight } from "@/lib/social";
import { isPersonalMode } from "@/lib/supabase/config";

export const runtime = "nodejs";

/*
 * Métricas do Instagram via API oficial da Meta (conta Profissional: Empresa ou Criador de conteúdo).
 * O token fica SOMENTE no servidor (variáveis de ambiente). Veja o README para obter:
 *   INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID
 * Opcionais (a Meta muda versões e nomes de métricas com frequência — confira a documentação atual):
 *   INSTAGRAM_GRAPH_BASE    padrão https://graph.facebook.com/v21.0  (ou https://graph.instagram.com/v21.0 para "Instagram Login")
 *   INSTAGRAM_INSIGHT_METRICS padrão "reach,saved,shares,views"
 */

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; data: unknown } | null = null;

type GraphMedia = {
  id: string; caption?: string; media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string;
  like_count?: number; comments_count?: number;
};

const DEMO: MediaInsight[] = [
  { id: "demo1", caption: "5 sinais de dificuldade na leitura — não é preguiça!", format: "carrossel", metrics: { reach: 1840, likes: 132, comments: 14, saves: 61, shares: 38 } },
  { id: "demo2", caption: "Rotina visual para crianças com TDAH: 3 minutos que mudam a manhã", format: "reels", metrics: { views: 5200, reach: 3900, likes: 210, comments: 22, saves: 140, shares: 95 } },
  { id: "demo3", caption: "Bastidores do consultório: cada material tem um porquê", format: "post", metrics: { reach: 900, likes: 70, comments: 5, saves: 6, shares: 2 } },
  { id: "demo4", caption: "Mito ou verdade: toda criança que troca letras tem dislexia?", format: "carrossel", metrics: { reach: 2300, likes: 160, comments: 31, saves: 88, shares: 52 } },
  { id: "demo5", caption: "Brincadeiras que estimulam a atenção em casa", format: "reels", metrics: { views: 3100, reach: 2500, likes: 120, comments: 9, saves: 75, shares: 40 } },
];

function formatOf(m: GraphMedia) {
  if (m.media_product_type === "REELS") return "reels";
  if (m.media_product_type === "STORY") return "stories";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrossel";
  return "post";
}

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Erro ${res.status}`);
  return json as T;
}

export async function GET(req: Request) {
  if (isSupabaseConfigured) {
    const sb = await getSupabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  // Sem login (modo demonstração publicado), não expor as métricas reais da conta.
  const publicDemo = !isSupabaseConfigured && !isPersonalMode && process.env.NODE_ENV === "production";
  if (!token || !userId || publicDemo) {
    return NextResponse.json({ configured: false, demo: true, media: DEMO });
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.data);

  const base = (process.env.INSTAGRAM_GRAPH_BASE || "https://graph.facebook.com/v21.0").replace(/\/$/, "");
  const metrics = (process.env.INSTAGRAM_INSIGHT_METRICS || "reach,saved,shares,views").split(",").map((m) => m.trim()).filter(Boolean);
  const warnings = new Set<string>();

  try {
    const list = await graph<{ data: GraphMedia[] }>(
      `${base}/${userId}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count&limit=15&access_token=${encodeURIComponent(token)}`,
    );

    const media: MediaInsight[] = [];
    for (const m of list.data ?? []) {
      const values: Record<string, number> = {};
      const read = (data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }>) =>
        data.forEach((d) => { values[d.name] = d.total_value?.value ?? d.values?.[0]?.value ?? 0; });
      try {
        const ins = await graph<{ data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
          `${base}/${m.id}/insights?metric=${metrics.join(",")}&access_token=${encodeURIComponent(token)}`,
        );
        read(ins.data ?? []);
      } catch {
        // Alguma métrica não vale para este tipo de mídia: tenta uma a uma
        for (const metric of metrics) {
          try {
            const ins = await graph<{ data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
              `${base}/${m.id}/insights?metric=${metric}&access_token=${encodeURIComponent(token)}`,
            );
            read(ins.data ?? []);
          } catch (e) {
            warnings.add(`Métrica "${metric}" indisponível para algumas publicações: ${(e as Error).message}`);
          }
        }
      }
      media.push({
        id: m.id, caption: m.caption ?? "", format: formatOf(m), timestamp: m.timestamp, permalink: m.permalink,
        metrics: {
          likes: m.like_count, comments: m.comments_count, reach: values.reach, views: values.views ?? values.plays,
          saves: values.saved, shares: values.shares,
        },
      });
    }
    const data = { configured: true, demo: false, media, warnings: Array.from(warnings).slice(0, 5) };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ configured: true, demo: false, media: [], error: `Não foi possível ler o Instagram: ${(e as Error).message}` }, { status: 502 });
  }
}
