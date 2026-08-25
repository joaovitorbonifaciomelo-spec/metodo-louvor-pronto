import type { ProfileRow, SubscriptionRow, SubscriptionStatus } from "@/types/database";

/**
 * Camada única de autorização do SaaS (substitui o antigo modelo Free/Pro).
 * Regra de negócio: NÃO ASSINANTE -> sem acesso às funcionalidades privadas;
 * ASSINANTE com assinatura `active` (ou dentro de uma janela de tolerância
 * bem definida) -> acesso liberado. Nenhuma outra checagem de acesso deve
 * ser inventada em outro lugar do código — sempre passar por aqui.
 */

/** Dias de tolerância após `past_due` antes de cortar o acesso (cobrança atrasada
 * pode ser reprocessada pela Kiwify). Configurável — não hardcoded no meio da lógica. */
function getPastDueGraceDays(): number {
  const raw = process.env.KIWIFY_PAST_DUE_GRACE_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
}

export type AccessReason =
  | "no_subscription"
  | "active"
  | "past_due_within_grace"
  | "past_due_grace_expired"
  | "canceled_within_paid_period"
  | "canceled_period_ended"
  | "canceled_no_period_info"
  | "refunded"
  | "chargeback"
  | "inactive"
  | "owner_bypass"
  | "development_bypass";

export interface AccessDecision {
  granted: boolean;
  reason: AccessReason;
}

type SubscriptionForAccess = Pick<
  SubscriptionRow,
  "status" | "current_period_end" | "past_due_since"
> | null;

/**
 * Decide se uma assinatura (por si só, sem considerar admin/dev) dá acesso
 * agora. Função pura — testável sem banco (ver tests/subscriptionAccess.test.ts).
 */
export function getSubscriptionAccessStatus(
  subscription: SubscriptionForAccess,
  now: Date = new Date()
): AccessDecision {
  if (!subscription) return { granted: false, reason: "no_subscription" };

  const status: SubscriptionStatus = subscription.status;

  switch (status) {
    case "active":
      return { granted: true, reason: "active" };

    case "past_due": {
      const since = subscription.past_due_since ? new Date(subscription.past_due_since) : now;
      const graceMs = getPastDueGraceDays() * 24 * 60 * 60 * 1000;
      const withinGrace = now.getTime() - since.getTime() <= graceMs;
      return withinGrace
        ? { granted: true, reason: "past_due_within_grace" }
        : { granted: false, reason: "past_due_grace_expired" };
    }

    case "canceled": {
      // Se ainda há período pago em aberto, mantém acesso até o fim dele.
      // Sem essa informação, o padrão é seguro (nega acesso) em vez de arbitrário.
      if (!subscription.current_period_end) return { granted: false, reason: "canceled_no_period_info" };
      const periodEnd = new Date(subscription.current_period_end);
      return now < periodEnd
        ? { granted: true, reason: "canceled_within_paid_period" }
        : { granted: false, reason: "canceled_period_ended" };
    }

    case "refunded":
      return { granted: false, reason: "refunded" };

    case "chargeback":
      return { granted: false, reason: "chargeback" };

    case "inactive":
    default:
      return { granted: false, reason: "inactive" };
  }
}

/** true fora de produção (dev local/preview) — nunca em produção para usuários comuns. */
export function isDevelopmentBypass(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Decisão final de acesso ao app: owner/admin (role no banco, nunca e-mail
 * hardcoded) e ambiente de desenvolvimento sempre passam; caso contrário,
 * depende exclusivamente do status real da assinatura.
 */
export function canAccessApp(
  role: ProfileRow["role"] | null | undefined,
  subscription: SubscriptionForAccess
): AccessDecision {
  if (role === "admin") return { granted: true, reason: "owner_bypass" };
  if (isDevelopmentBypass()) return { granted: true, reason: "development_bypass" };
  return getSubscriptionAccessStatus(subscription);
}

/**
 * Um usuário pode ter mais de uma assinatura ao longo do tempo (cancelou e
 * assinou de novo, ou trocou de provider — ver migration 0006, `user_id` não
 * é mais unique em `subscriptions`). O acesso é concedido se QUALQUER
 * assinatura do usuário, agora, satisfizer getSubscriptionAccessStatus —
 * nunca só a mais recente por updated_at, senão uma assinatura antiga ainda
 * `active` seria mascarada por um registro mais novo que já foi cancelado (ou
 * vice-versa, um `canceled` antigo escondendo uma `active` mais nova).
 *
 * `subscriptions` deve vir ordenado (mais recente primeiro) só para decidir
 * qual usar como referência de exibição quando NENHUMA dá acesso — a ordem
 * não afeta se o acesso é concedido ou não.
 */
export function resolveAccess<T extends NonNullable<SubscriptionForAccess>>(
  role: ProfileRow["role"] | null | undefined,
  subscriptions: T[]
): { subscription: T | null; access: AccessDecision } {
  const bypass = canAccessApp(role, null);
  if (bypass.granted) return { subscription: subscriptions[0] ?? null, access: bypass };

  for (const subscription of subscriptions) {
    const access = getSubscriptionAccessStatus(subscription);
    if (access.granted) return { subscription, access };
  }

  const latest = subscriptions[0] ?? null;
  return { subscription: latest, access: getSubscriptionAccessStatus(latest) };
}
