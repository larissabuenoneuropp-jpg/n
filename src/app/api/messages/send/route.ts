import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";

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

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    // Demonstração: nunca envia de verdade
    return NextResponse.json({ error: "Envio automático indisponível no modo demonstração" }, { status: 501 });
  }
  const sb = await getSupabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.to) return NextResponse.json({ error: "Destinatário ausente" }, { status: 400 });

  try {
    if (body.channel === "email") {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key || !from) return NextResponse.json({ error: "E-mail automático não configurado" }, { status: 501 });
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(body.to)) return NextResponse.json({ error: "E-mail do responsável inválido" }, { status: 400 });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [body.to], subject: body.subject, text: body.text, reply_to: data.user.email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return NextResponse.json({ error: json?.message ?? `Falha no envio (${res.status})` }, { status: 502 });
      return NextResponse.json({ ok: true, id: json.id });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const template = process.env.WHATSAPP_TEMPLATE;
    if (!token || !phoneId || !template) return NextResponse.json({ error: "WhatsApp automático não configurado" }, { status: 501 });
    const digits = body.to.replace(/\D/g, "").replace(/^55/, "");
    if (digits.length < 10) return NextResponse.json({ error: "Telefone do responsável inválido" }, { status: 400 });
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
    if (!res.ok) return NextResponse.json({ error: json?.error?.message ?? `Falha no envio (${res.status})` }, { status: 502 });
    return NextResponse.json({ ok: true, id: json?.messages?.[0]?.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** Informa quais canais têm envio automático configurado (sem expor as chaves). */
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ email: false, whatsapp: false });
  const sb = await getSupabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE),
  });
}
