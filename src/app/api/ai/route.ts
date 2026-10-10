import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, TASK_INSTRUCTIONS, type AiTask } from "@/lib/ai/prompts";
import { mockResponse } from "@/lib/ai/mock";
import { isPersonalMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { deny, guard, personalServerLocked, serverLockReason, tooLarge, withConcurrency } from "@/lib/server/guard";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 24_000;

export async function POST(req: Request) {
  const g = await guard(req, { bucket: "ai", limit: 20 });
  if (!g.ok) return g.response;
  if (tooLarge(req, 200_000)) return deny(413, "Conteúdo muito longo para análise.");

  let body: { task?: AiTask; input?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return deny(400, "JSON inválido");
  }
  const task = body?.task;
  if (typeof task !== "string" || !Object.prototype.hasOwnProperty.call(TASK_INSTRUCTIONS, task)) {
    return deny(400, "Tarefa de IA desconhecida");
  }
  if (body.input !== undefined && (typeof body.input !== "object" || body.input === null || Array.isArray(body.input))) {
    return deny(400, "Entrada inválida");
  }
  const inputText = JSON.stringify(body.input ?? {});
  if (inputText.length > (task === "import_extract" ? 60_000 : MAX_INPUT_CHARS)) {
    return deny(413, "Conteúdo muito longo para análise.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  // Em produção sem Supabase (sem login), não expor a chave da OpenAI a qualquer visitante.
  // Demonstração pública (dados fictícios): não usa a chave real. Uso pessoal: IA liberada.
  const publicDemo = !isSupabaseConfigured && !isPersonalMode && process.env.NODE_ENV === "production" && process.env.ALLOW_PUBLIC_AI !== "1";
  if (apiKey && personalServerLocked()) {
    return deny(403, `IA bloqueada por segurança. ${serverLockReason()}`, { code: "server_locked" });
  }
  if (!apiKey || publicDemo) {
    return NextResponse.json({ demo: true, result: mockResponse(task, body.input ?? {}) });
  }

  return withConcurrency("openai", 4, () => callOpenAI(apiKey, task, inputText), () => deny(429, "A IA está ocupada com outras solicitações. Tente em alguns segundos."));
}

async function callOpenAI(apiKey: string, task: AiTask, inputText: string) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
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
      console.error("OpenAI error", res.status, detail.slice(0, 300));
      return deny(502, `Falha na IA (${res.status}).`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    return NextResponse.json({ demo: false, result: JSON.parse(content) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("AI route", (e as Error).message);
    return deny(502, "Não foi possível obter a sugestão da IA.");
  }
}
