export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sem Supabase configurado o app funciona em modo demonstração (dados locais). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Sem Supabase o NeuroPlanner abre direto, SEM LOGIN, e guarda os dados apenas no navegador.
 * - Padrão: uso pessoal (começa vazio, para a profissional colocar os próprios dados).
 * - NEXT_PUBLIC_DEMO_MODE=1: demonstração com pacientes fictícios.
 * Com Supabase configurado, o acesso passa a exigir conta com e-mail confirmado.
 */
export const isPersonalMode = !isSupabaseConfigured && process.env.NEXT_PUBLIC_DEMO_MODE !== "1";
export const isDemoAllowed = !isSupabaseConfigured;
export const isSetupRequired = false;
