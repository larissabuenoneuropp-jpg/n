import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  // Força HTTPS em produção (o Netlify informa o protocolo original em x-forwarded-proto)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  if (process.env.NODE_ENV === "production" && !local && request.headers.get("x-forwarded-proto") === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // Sem Supabase: sem login — o site abre direto (dados ficam no navegador da profissional).
  if (!isSupabaseConfigured) {
    if (request.nextUrl.pathname.startsWith("/login")) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // Cookies de sessão: só por HTTPS, sem envio a outros sites. (Não podem ser httpOnly porque o
        // cliente do Supabase no navegador precisa lê-los; a CSP reduz o risco de leitura por scripts de terceiros.)
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" }),
        );
      },
    },
  });

  // getUser() valida o token junto ao Supabase (não confia apenas no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isApi = path.startsWith("/api");

  // Só entra quem confirmou o e-mail (garante que o e-mail é válido e pertence à pessoa)
  if (user && !user.email_confirmed_at && !isPublic) {
    await supabase.auth.signOut();
    if (isApi) return NextResponse.json({ error: "Confirme seu e-mail" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?reason=confirm";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic) {
    if (isApi) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && user.email_confirmed_at && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
