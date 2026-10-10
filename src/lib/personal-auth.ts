// Senha única do modo pessoal (sem conta). O cookie guarda só um hash, nunca a senha.
export const UNLOCK_COOKIE = "np_unlock";

export async function unlockToken(password: string) {
  const data = new TextEncoder().encode(`neuroplanner:${password}:v1`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lê o cookie de um cabeçalho "Cookie" (rotas de API). */
export function cookieFrom(header: string | null, name = UNLOCK_COOKIE) {
  return header?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

/** Rotas de API do modo pessoal: liberadas se não houver senha configurada ou se o cookie for válido. */
export async function personalUnlocked(req: Request) {
  const pwd = process.env.APP_PASSWORD;
  if (!pwd) return false;
  return cookieFrom(req.headers.get("cookie")) === (await unlockToken(pwd));
}
