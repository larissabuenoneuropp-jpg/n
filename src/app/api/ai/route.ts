import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, TASK_INSTRUCTIONS, type AiTask } from "@/lib/ai/prompts";
import { mockResponse } from "@/lib/ai/mock";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isPersonalMode } from "@/lib/supabase/config";
import { personalUnlocked } from "@/lib/personal-auth";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 24_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
// Limite simples em memória (por instância). Em produção com várias instâncias, use um store compartilhado.
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  let userKey = "demo";
  if (isSupabaseConfigured) {
    const sb = await getSupabaseServer();
    const { data } = await sb.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    userKey = data.user.id;
  }
  if (rateLimited(userKey)) {
    return NextResponse.json({ error: "Muitas solicitações. Aguarde um minuto." }, { status: 429 });
  }

  let body: { task?: AiTask; input?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const task = body.task;
  if (!task || !(task in TASK_INSTRUCTIONS)) {
    return NextResponse.json({ error: "Tarefa de IA desconhecida" }, { status: 400 });
  }
  const inputText = JSON.stringify(body.input ?? {});
  if (inputText.length > (task === "import_extract" ? 60_000 : MAX_INPUT_CHARS)) {
    return NextResponse.json({ error: "Conteúdo muito longo para análise." }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  // Em produção sem Supabase (sem login), não expor a chave da OpenAI a qualquer visitante.
  const personalOk = isPersonalMode && (await personalUnlocked(req));
  const publicDemo = !isSupabaseConfigured && process.env.NODE_ENV === "production" && !personalOk && process.env.ALLOW_PUBLIC_AI !== "1";
  if (!apiKey || publicDemo) {
    return NextResponse.json({ demo: true, result: mockResponse(task, body.input ?? {}) });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: TASK_INSTRUCTIONS[task] },
          { role: "user", content: `${task === "import_extract" ? "Documento enviado pela profissional (com consentimento para extração)" : "Dados (pseudonimizados)"}:\n${inputText}` },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("OpenAI error", res.status, detail.slice(0, 500));
      return NextResponse.json({ error: `Falha na IA (${res.status}).` }, { status: 502 });
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    return NextResponse.json({ demo: false, result: JSON.parse(content) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível obter a sugestão da IA." }, { status: 502 });
  }
}
