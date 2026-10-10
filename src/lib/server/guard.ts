import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isPersonalMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Proteção comum das rotas /api (executa no servidor):
 *  - só aceita chamadas do próprio site (Origin / Sec-Fetch-Site) — barra robôs e outros sites;
 *  - Supabase: exige sessão válida e e-mail confirmado (validados no servidor do Supabase);
 *  - uso pessoal: exige a chave de acesso APP_ACCESS_KEY, quando configurada no Netlify;
 *  - limite de requisições por usuária/chave e por IP;
 *  - bloqueio temporário do IP após várias chaves de acesso erradas (força bruta).
 *
 * Limite compartilhado entre todas as instâncias do servidor: Redis da Upstash (opcional) via
 * UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN. Sem elas (ou se a Upstash falhar), o limite
 * é contado na memória de cada instância.
 */

const hits = new Map<string, number[]>();
function memoryCount(key: string, windowMs: number, register = true) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (register) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length;
}

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

/** Executa comandos no Redis da Upstash (endpoint /pipeline). Devolve null se não configurado ou indisponível. */
async function redis(commands: string[][]): Promise<unknown[] | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(out) || out.some((o) => o?.error)) return null;
    return out.map((o) => o.result);
  } catch {
    return null;
  }
}

/** Contador de janela fixa: soma 1 (register) ou só lê. */
async function count(key: string, windowMs: number, register = true) {
  const k = `np:rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  const ttl = String(Math.ceil(windowMs / 1000) + 5);
  const out = await redis(register ? [["INCR", k], ["EXPIRE", k, ttl]] : [["GET", k]]);
  const n = out ? Number(out[0] ?? 0) : NaN;
  return Number.isFinite(n) ? n : memoryCount(key, windowMs, register);
}

async function rateLimited(key: string, limit: number, windowMs: number) {
  return (await count(key, windowMs)) > limit;
}

/** Chave de acesso errada: depois de 8 tentativas em 15 min, o IP fica bloqueado até a janela virar. */
const FAIL_WINDOW = 15 * 60_000;
const MAX_FAILS = 8;
async function tooManyFailures(ip: string, register: boolean) {
  return (await count(`fail:${ip}`, FAIL_WINDOW, register)) >= MAX_FAILS + (register ? 1 : 0);
}

/** Limite de chamadas simultâneas por rota nesta instância (controla o custo da IA). */
const inflight = new Map<string, number>();
export async function withConcurrency<T>(bucket: string, max: number, fn: () => Promise<T>, busy: () => T): Promise<T> {
  const n = inflight.get(bucket) ?? 0;
  if (n >= max) return busy();
  inflight.set(bucket, n + 1);
  try {
    return await fn();
  } finally {
    inflight.set(bucket, Math.max(0, (inflight.get(bucket) ?? 1) - 1));
  }
}

/** Recusa corpos grandes antes de lê-los. */
export function tooLarge(req: Request, maxBytes: number) {
  const len = Number(req.headers.get("content-length") ?? 0);
  return Number.isFinite(len) && len > maxBytes;
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
  if (await rateLimited(`${opts.bucket}:ip:${ip}`, opts.limit * 2, windowMs)) return { ok: false, response: deny(429, "Muitas solicitações. Aguarde um minuto.") };
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
    if (await tooManyFailures(ip, false)) return { ok: false, response: deny(429, "Muitas tentativas com chave errada. Tente de novo em 15 minutos.") };
    const sent = req.headers.get(ACCESS_HEADER) ?? "";
    if (!sent || !safeEqual(sent, accessKey())) {
      await tooManyFailures(ip, true);
      return { ok: false, response: deny(401, "Chave de acesso do servidor ausente ou incorreta. Informe-a em Configurações → Segurança.", { code: "access_key" }) };
    }
    userKey = "owner";
  }
  if (await rateLimited(`${opts.bucket}:${userKey}`, opts.limit, windowMs)) return { ok: false, response: deny(429, "Muitas solicitações. Aguarde um minuto.") };
  return { ok: true, userKey, email };
}

/** Texto curto e sem quebras para mensagens de erro vindas de serviços externos. */
export const trimMsg = (s: unknown, n = 200) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);
