import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, unlockToken } from "@/lib/personal-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const pwd = process.env.APP_PASSWORD;
  if (!pwd) return NextResponse.json({ error: "Senha não configurada" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  // pequena espera para dificultar tentativas em sequência
  await new Promise((r) => setTimeout(r, 700));
  if (typeof body.password !== "string" || body.password !== pwd) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, await unlockToken(pwd), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
