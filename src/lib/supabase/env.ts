/**
 * Centraliza a leitura das env vars do Supabase. Se não estiverem configuradas,
 * o build e o boot do app não quebram (seção 26/44) — as chamadas de rede é
 * que falham em runtime, e registramos exatamente qual variável está faltando
 * (nunca o valor) para diagnóstico, em vez de deixar um "Failed to fetch" cego.
 *
 * Aceita tanto o nome novo (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, convenção
 * atual do Supabase) quanto o legado (NEXT_PUBLIC_SUPABASE_ANON_KEY) — não
 * presumimos qual foi configurado no ambiente de deploy.
 */
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

let warned = false;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(url && key);

  if (!configured && !warned) {
    warned = true;
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    ].filter(Boolean);
    // eslint-disable-next-line no-console
    console.error(
      `[supabase] Configuração ausente: ${missing.join(", ")}. ` +
        "Chamadas ao Supabase vão falhar (\"Failed to fetch\") até essas variáveis serem definidas " +
        "no ambiente (.env.local em dev, ou nas env vars do provedor de deploy em produção)."
    );
  }

  return {
    url: url || PLACEHOLDER_URL,
    anonKey: key || PLACEHOLDER_KEY,
    configured,
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
