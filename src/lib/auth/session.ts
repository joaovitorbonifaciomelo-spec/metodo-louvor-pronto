import { createClient } from "@/lib/supabase/server";
import { canAccessApp, resolveAccess, type AccessDecision } from "@/lib/billing/access";
import type { ProfileRow, SubscriptionRow } from "@/types/database";

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
}

export async function getSessionInfo(): Promise<SessionInfo> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, email: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return { userId: user.id, email: user.email ?? null, profile: (profile as unknown as ProfileRow) ?? null };
}

export async function isAdmin(): Promise<boolean> {
  const { profile } = await getSessionInfo();
  return profile?.role === "admin";
}

export interface AccessInfo extends SessionInfo {
  subscription: SubscriptionRow | null;
  access: AccessDecision;
}

/**
 * Sessão + decisão de acesso, num só lugar (ver src/lib/billing/access.ts).
 * Único ponto que outras rotas/páginas devem consultar para saber se o
 * usuário pode usar o SaaS — nunca reimplementar essa checagem localmente.
 *
 * Um usuário pode ter mais de uma assinatura (ver migration 0006 — `user_id`
 * não é unique em `subscriptions`), então buscamos todas e deixamos
 * `resolveAccess` decidir: o acesso é concedido se QUALQUER uma delas
 * satisfizer getSubscriptionAccessStatus agora, não só a mais recente.
 */
export async function getAccessInfo(): Promise<AccessInfo> {
  const session = await getSessionInfo();
  if (!session.userId) {
    return { ...session, subscription: null, access: canAccessApp(null, null) };
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false });

  const subscriptions = (data as unknown as SubscriptionRow[] | null) ?? [];
  const { subscription, access } = resolveAccess(session.profile?.role, subscriptions);
  return { ...session, subscription, access };
}

/**
 * Só o id do usuário (sem consultar `profiles`) — para caminhos quentes como
 * busca/recomendação, onde só precisamos atribuir o evento de analytics e uma
 * segunda query no banco só para isso adicionaria latência desnecessária.
 */
export async function getUserIdOnly(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
