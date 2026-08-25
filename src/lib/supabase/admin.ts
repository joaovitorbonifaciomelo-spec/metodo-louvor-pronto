import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key — ignora RLS. Uso restrito a contextos
 * server-only sem sessão de usuário (ex.: webhook de pagamento), onde não faz
 * sentido depender de RLS por usuário porque não há usuário autenticado na
 * requisição. NUNCA importar isto de um Client Component nem expor a chave
 * como NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para o cliente admin do Supabase.");
  }
  return createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
