"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen, CalendarDays, ClipboardCheck, ListChecks, Megaphone, FileText, FolderOpen, LayoutDashboard, LogOut, Menu, Settings, Sparkles, Users, Wallet, X,
} from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data/provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export const NAV = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/testes", label: "Testes e protocolos", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: BookOpen },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/instagram", label: "Instagram", icon: Megaphone },
  { href: "/assistente", label: "Assistente IA", icon: Sparkles },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
const MOBILE_NAV = ["/dashboard", "/agenda", "/pacientes", "/financeiro"];

const IDLE_LIMIT_MS = 30 * 60 * 1000; // encerra a sessão após 30 min sem atividade

async function signOut() {
  if (isSupabaseConfigured) await getSupabaseBrowser().auth.signOut();
}

function useIdleLogout() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await signOut();
        router.replace("/login?reason=idle");
      }, IDLE_LIMIT_MS);
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, store } = useData();
  const [open, setOpen] = useState(false);
  useIdleLogout();
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
            active(href) ? "bg-white font-medium text-ink shadow-card" : "text-ink-soft hover:bg-white/60 hover:text-ink",
          )}
        >
          <Icon className={cn("h-4 w-4", active(href) ? "text-brand-600" : "")} />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="mt-auto space-y-3 pt-4">
      {store.mode === "demo" && (
        <div className="rounded-lg border border-sage-200 bg-sage-50 p-3 text-[11px] leading-relaxed text-sage-600">
          <b>Modo demonstração.</b> Dados fictícios salvos só neste navegador. Configure o Supabase para usar com pacientes reais.
        </div>
      )}
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <Avatar name={profile?.professional_name || "Profissional"} src={profile?.logo_url} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.professional_name || "Profissional"}</p>
          <p className="truncate text-xs text-ink-faint">{profile?.clinic_name || profile?.profession}</p>
        </div>
        {isSupabaseConfigured && (
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="rounded-md p-1.5 text-ink-faint hover:bg-white hover:text-ink"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-canvas px-3 py-5 lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        {navList}
        {footer}
      </aside>

      {/* Topbar mobile/tablet */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-ink-soft hover:bg-canvas" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-canvas px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-ink-faint" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
            {footer}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8 print:p-0">
        <div className="mx-auto max-w-7xl print:max-w-none">{children}</div>
      </main>

      {/* Navegação inferior mobile */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 backdrop-blur sm:hidden">
        {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active(href) ? "text-brand-600" : "text-ink-faint")}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
