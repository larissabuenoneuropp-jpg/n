import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPersonalMode, isSetupRequired, isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { UNLOCK_COOKIE, unlockToken } from "@/lib/personal-auth";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  const path0 = request.nextUrl.pathname;
  // Produção sem Supabase: nada fica acessível até configurar o login (exceto a tela que explica isso).
  if (isSetupRequired) {
    if (path0.startsWith("/login")) return NextResponse.next();
    if (path0.startsWith("/api")) return NextResponse.json({ error: "Login não configurado" }, { status: 503 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Modo pessoal: sem conta. Se APP_PASSWORD estiver definida, pede só essa senha.
  if (isPersonalMode) {
    const pwd = process.env.APP_PASSWORD;
    const isLogin = path0.startsWith("/login");
    if (!pwd) {
      if (isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
      return NextResponse.next();
    }
    if (path0.startsWith("/api/unlock")) return NextResponse.next();
    const ok = request.cookies.get(UNLOCK_COOKIE)?.value === (await unlockToken(pwd));
    if (ok && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
    if (ok || isLogin) return NextResponse.next();
    if (path0.startsWith("/api")) return NextResponse.json({ error: "Bloqueado" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Modo demonstração explícito: sem autenticação.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
