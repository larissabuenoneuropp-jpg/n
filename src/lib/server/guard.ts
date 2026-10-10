import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isPersonalMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Proteção comum das rotas /api (executa no servidor):
 *  - só aceita chamadas do próprio site (Origin / Sec-Fetch-Site) — barra robôs e outros sites;
 *  - Supabase: exige sessão válida e e-mail confirmado (validados no servidor do Supabase);
 *  - uso pessoal: exige a chave de acesso APP_ACCESS_KEY, quando configurada no Netlify;
 *  - limite de requisições por usuário/chave e por IP.
 */

const hits = new Map<string, number[]>();
// Limite em memória (por instância do servidor). Reduz abuso, mas não substitui um WAF/limite compartilhado.
function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > limit;
}

function clientIp(req: Request) {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

function sameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // GET do mesmo site pode vir sem Origin; Sec-Fetch-Site já foi conferido
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const ACCESS_HEADER = "x-access-key";
const accessKey = () => (process.env.APP_ACCESS_KEY ?? "").trim();

/** Uso pessoal publicado: as chaves de serviços pagos/privados (OpenAI, Instagram) só são usadas com APP_ACCESS_KEY. */
export function personalServerLocked() {
  return isPersonalMode && process.env.NODE_ENV === "production" && accessKey().length < 24;
}

export const deny = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

type GuardResult = { ok: true; userKey: string; email?: string } | { ok: false; response: NextResponse };

export async function guard(req: Request, opts: { bucket: string; limit: number; windowMs?: number }): Promise<GuardResult> {
  const windowMs = opts.windowMs ?? 60_000;
  const ip = clientIp(req);
  if (rateLimited(`${opts.bucket}:ip:${ip}`, opts.limit * 2, windowMs)) return { ok: false, response: deny(429, "Muitas solicitações. Aguarde um minuto.") };
  if (!sameOrigin(req)) return { ok: false, response: deny(403, "Origem não permitida.") };

  let userKey = `ip:${ip}`;
  let email: string | undefined;
  if (isSupabaseConfigured) {
    const sb = await getSupabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user || !data.user.email_confirmed_at) return { ok: false, response: deny(401, "Não autenticado") };
    userKey = data.user.id;
    email = data.user.email ?? undefined;
  } else if (isPersonalMode && accessKey()) {
    const sent = req.headers.get(ACCESS_HEADER) ?? "";
    if (!sent || !safeEqual(sent, accessKey())) {
      return { ok: false, response: deny(401, "Chave de acesso do servidor ausente ou incorreta. Informe-a em Configurações → Segurança.", { code: "access_key" }) };
    }
    userKey = "owner";
  }
  if (rateLimited(`${opts.bucket}:${userKey}`, opts.limit, windowMs)) return { ok: false, response: deny(429, "Muitas solicitações. Aguarde um minuto.") };
  return { ok: true, userKey, email };
}

/** Texto curto e sem quebras para mensagens de erro vindas de serviços externos. */
export const trimMsg = (s: unknown, n = 200) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
