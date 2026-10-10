export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sem Supabase configurado o app funciona em modo demonstração (dados locais). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Modo demonstração (sem login, dados no navegador) só é permitido em desenvolvimento
 * ou quando ativado explicitamente com NEXT_PUBLIC_DEMO_MODE=1.
 * Em produção sem Supabase e sem essa variável, o acesso fica bloqueado até configurar o login.
 */
export const isDemoAllowed = !isSupabaseConfigured && (process.env.NEXT_PUBLIC_DEMO_MODE === "1" || process.env.NODE_ENV !== "production");
export const isSetupRequired = !isSupabaseConfigured && !isDemoAllowed;
