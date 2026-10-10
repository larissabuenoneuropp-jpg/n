"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";
import { isSetupRequired, isSupabaseConfigured } from "@/lib/supabase/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
function passwordProblem(p: string) {
  if (p.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return "Use letras e números na senha.";
  return null;
}
import { getSupabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    params.get("reason") === "idle" ? "Sessão encerrada por inatividade." :
    params.get("reason") === "confirm" ? "Confirme seu e-mail pelo link que enviamos antes de acessar o NeuroPlanner." : null,
  );
  const [err, setErr] = useState<string | null>(null);

  if (isSetupRequired) {
    return (
      <div className="space-y-3 text-center text-sm text-ink-soft">
        <p><b>Acesso protegido.</b> Para usar o NeuroPlanner é preciso criar login e senha com e-mail confirmado.</p>
        <p className="text-xs">O login ainda não foi configurado neste site. Cadastre as variáveis do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) no Netlify e publique novamente — veja o README.</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-soft">
          O Supabase ainda não foi configurado, então o NeuroPlanner está em <b>modo demonstração</b> com dados fictícios salvos neste navegador.
        </p>
        <Link href="/dashboard">
          <Button className="w-full">Entrar na demonstração</Button>
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    try {
      if (!EMAIL_RE.test(email.trim())) throw new Error("Informe um e-mail válido.");
      if (mode === "login") {
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/confirm/i.test(error.message)) { setNeedsConfirm(true); throw new Error("Seu e-mail ainda não foi confirmado. Abra o link enviado ou reenvie abaixo."); }
          throw new Error(/invalid/i.test(error.message) ? "E-mail ou senha incorretos." : error.message);
        }
        if (!data.user?.email_confirmed_at) {
          await sb.auth.signOut();
          setNeedsConfirm(true);
          throw new Error("Seu e-mail ainda não foi confirmado.");
        }
        router.replace(params.get("next") || "/dashboard");
        router.refresh();
      } else if (mode === "signup") {
        if (!consent) throw new Error("É necessário aceitar os termos de uso e a política de privacidade.");
        const problem = passwordProblem(password);
        if (problem) throw new Error(problem);
        if (password !== password2) throw new Error("As senhas não conferem.");
        const { error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMsg("Conta criada! Enviamos um link de confirmação para o seu e-mail. O acesso é liberado depois da confirmação.");
        setMode("login");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/configuracoes` });
        if (error) throw error;
        setMsg("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" && (
        <Field label="Nome completo">
          <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
      )}
      <Field label="E-mail">
        <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      {mode !== "reset" && (
        <Field label="Senha">
          <Input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </Field>
      )}
      {mode === "signup" && (
        <Field label="Repita a senha" hint="Mínimo de 10 caracteres, com letras e números.">
          <Input required type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
        </Field>
      )}
      {mode === "signup" && (
        <label className="flex items-start gap-2 text-xs text-ink-soft">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Li e aceito os termos de uso e a política de privacidade. Entendo que sou controladora dos dados dos meus pacientes e que o tratamento segue a LGPD.
          </span>
        </label>
      )}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {msg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{msg}</p>}
      {needsConfirm && (
        <button type="button" className="text-xs text-brand-700 underline" onClick={async () => {
          const { error } = await getSupabaseBrowser().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback` } });
          setErr(null);
          setMsg(error ? error.message : "Link de confirmação reenviado. Verifique sua caixa de entrada e o spam.");
        }}>Reenviar e-mail de confirmação</button>
      )}
      <Button type="submit" className="w-full" loading={loading}>
        {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
      </Button>
      <div className="flex justify-between text-xs text-ink-soft">
        {mode === "login" ? (
          <>
            <button type="button" onClick={() => setMode("signup")} className="hover:text-ink">Criar conta</button>
            <button type="button" onClick={() => setMode("reset")} className="hover:text-ink">Esqueci a senha</button>
          </>
        ) : (
          <button type="button" onClick={() => setMode("login")} className="hover:text-ink">Voltar ao login</button>
        )}
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-brand-50 via-white to-sage-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-ink-soft">Gestão clínica e planejamento terapêutico em um só lugar.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-pop">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
          <ShieldCheck className="h-3.5 w-3.5" /> Conexão criptografada · Dados isolados por profissional
        </p>
      </div>
    </div>
  );
}
