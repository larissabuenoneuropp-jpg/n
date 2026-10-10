import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { deny, guard, tooLarge, trimMsg } from "@/lib/server/guard";

export const runtime = "nodejs";

/*
 * Envio de mensagens de cobrança JÁ APROVADAS pela profissional.
 * E-mail: Resend (RESEND_API_KEY, EMAIL_FROM — domínio verificado no Resend).
 * WhatsApp: API oficial WhatsApp Cloud (Meta) — WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE
 *   (modelo aprovado pela Meta com 4 variáveis, nesta ordem: responsável, paciente, valor, vencimento).
 * Sem essas variáveis o servidor responde 501 e o app usa o envio assistido (abre o WhatsApp/e-mail com o texto pronto).
 * Confira na documentação atual do Resend e da Meta — versões e requisitos mudam.
 */

type Body =
  | { channel: "email"; to: string; subject: string; text: string }
  | { channel: "whatsapp"; to: string; text: string; params?: string[] };

const isStr = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/** Valida e copia só os campos esperados (nada além disso chega aos provedores). */
function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (!isStr(b.to, 200) || !isStr(b.text, 4000)) return null;
  if (b.channel === "email") {
    if (!isStr(b.subject, 200)) return null;
    return { channel: "email", to: (b.to as string).trim(), subject: (b.subject as string).replace(/[\r\n]+/g, " "), text: b.text as string };
  }
  if (b.channel === "whatsapp") {
    const params = Array.isArray(b.params) ? b.params.slice(0, 10).map((p) => String(p).slice(0, 200)) : [];
    return { channel: "whatsapp", to: b.to as string, text: b.text as string, params };
  }
  return null;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    // Demonstração: nunca envia de verdade
    return deny(501, "Envio automático indisponível sem o Supabase");
  }
  const g = await guard(req, { bucket: "messages", limit: 30 });
  if (!g.ok) return g.response;
  if (tooLarge(req, 20_000)) return deny(413, "Mensagem grande demais");

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return deny(400, "Dados da mensagem inválidos");

  try {
    if (body.channel === "email") {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key || !from) return deny(501, "E-mail automático não configurado");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(body.to)) return deny(400, "E-mail do responsável inválido");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [body.to], subject: body.subject, text: body.text, reply_to: g.email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return deny(502, `Falha no envio do e-mail (${res.status}): ${trimMsg(json?.message)}`);
      return NextResponse.json({ ok: true, id: trimMsg(json.id, 80) });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const template = process.env.WHATSAPP_TEMPLATE;
    if (!token || !phoneId || !template) return deny(501, "WhatsApp automático não configurado");
    const digits = body.to.replace(/\D/g, "").replace(/^55/, "");
    if (digits.length < 10 || digits.length > 11) return deny(400, "Telefone do responsável inválido");
    const base = (process.env.WHATSAPP_GRAPH_BASE || "https://graph.facebook.com/v21.0").replace(/\/$/, "");
    const res = await fetch(`${base}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `55${digits}`,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR" },
          components: [{ type: "body", parameters: (body.params ?? []).map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return deny(502, `Falha no envio do WhatsApp (${res.status}): ${trimMsg(json?.error?.message)}`);
    return NextResponse.json({ ok: true, id: trimMsg(json?.messages?.[0]?.id, 80) });
  } catch (e) {
    console.error("messages", (e as Error).message);
    return deny(502, "Não foi possível enviar a mensagem agora.");
  }
}

/** Informa quais canais têm envio automático configurado (sem expor as chaves). */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ email: false, whatsapp: false });
  const g = await guard(req, { bucket: "messages-status", limit: 30 });
  if (!g.ok) return g.response;
  return NextResponse.json({
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE),
  });
}
