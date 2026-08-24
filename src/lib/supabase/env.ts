/**
 * Centraliza a leitura das env vars do Supabase. Se não estiverem configuradas,
 * o build e o boot do app não quebram (seção 26/44) — as chamadas de rede é
 * que falham em runtime, e a UI trata isso como estado de erro de conexão.
 */
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && anonKey);

  if (!configured && typeof window === "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas. " +
        "Usando placeholders — chamadas ao Supabase vão falhar até você configurar o .env.local."
    );
  }

  return {
    url: url || PLACEHOLDER_URL,
    anonKey: anonKey || PLACEHOLDER_KEY,
    configured,
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
