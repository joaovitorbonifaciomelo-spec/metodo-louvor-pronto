/**
 * Configuração conceitual de planos. Nenhum preço é fixado no código —
 * isso é decisão de negócio (ver README, seção Billing). O billing NUNCA
 * bloqueia o funcionamento do produto no MVP: se não houver assinatura
 * ativa, o usuário simplesmente cai nos limites do plano FREE abaixo.
 */
export type PlanId = "free" | "pro";

export interface PlanLimits {
  id: PlanId;
  label: string;
  maxSearchesPerDay: number | null;
  maxSetlists: number | null;
  history: boolean;
  sharing: boolean;
  churchPersonalization: boolean;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    maxSearchesPerDay: 10,
    maxSetlists: 2,
    history: true,
    sharing: true,
    churchPersonalization: false,
  },
  pro: {
    id: "pro",
    label: "Pro",
    maxSearchesPerDay: null,
    maxSetlists: null,
    history: true,
    sharing: true,
    churchPersonalization: true,
  },
};

export function getPlanLimits(plan: PlanId | null | undefined): PlanLimits {
  return PLANS[plan ?? "free"] ?? PLANS.free;
}

export function canCreateSetlist(plan: PlanId | null | undefined, currentCount: number): boolean {
  const limits = getPlanLimits(plan);
  return limits.maxSetlists === null || currentCount < limits.maxSetlists;
}

export function canSearchToday(plan: PlanId | null | undefined, searchesToday: number): boolean {
  const limits = getPlanLimits(plan);
  return limits.maxSearchesPerDay === null || searchesToday < limits.maxSearchesPerDay;
}

/** Billing está desacoplado no MVP — ver README "Billing" para como plugar um provider depois. */
export const BILLING_PROVIDER_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY);
