import { describe, expect, it, vi, afterEach } from "vitest";
import { canAccessApp, getSubscriptionAccessStatus, resolveAccess } from "@/lib/billing/access";
import type { SubscriptionRow } from "@/types/database";

function subscription(overrides: Partial<SubscriptionRow>): Pick<
  SubscriptionRow,
  "status" | "current_period_end" | "past_due_since"
> {
  return {
    status: "inactive",
    current_period_end: null,
    past_due_since: null,
    ...overrides,
  };
}

describe("getSubscriptionAccessStatus", () => {
  it("nega acesso quando não existe assinatura", () => {
    expect(getSubscriptionAccessStatus(null)).toEqual({ granted: false, reason: "no_subscription" });
  });

  it("libera acesso para assinatura active", () => {
    expect(getSubscriptionAccessStatus(subscription({ status: "active" }))).toEqual({
      granted: true,
      reason: "active",
    });
  });

  it("nega acesso para assinatura inactive", () => {
    expect(getSubscriptionAccessStatus(subscription({ status: "inactive" })).granted).toBe(false);
  });

  it("nega acesso para uma assinatura antiga do plano Free migrada para inactive (migration 0006)", () => {
    // A migration converte qualquer linha antiga com plan='free' para
    // status='inactive' antes de remover a coluna `plan` — depois da
    // migration, 'active' passa a significar assinatura paga real, então uma
    // Free legada NUNCA pode continuar concedendo acesso.
    const legacyFreeMigrated = subscription({ status: "inactive" });
    expect(getSubscriptionAccessStatus(legacyFreeMigrated)).toEqual({ granted: false, reason: "inactive" });
  });

  it("trata status desconhecido/null (dado corrompido) como sem acesso, nunca como liberado", () => {
    const corrupted = subscription({ status: null as unknown as SubscriptionRow["status"] });
    expect(getSubscriptionAccessStatus(corrupted)).toEqual({ granted: false, reason: "inactive" });
  });

  describe("past_due", () => {
    it("libera acesso dentro do período de graça configurado (padrão 3 dias)", () => {
      const now = new Date("2026-01-10T00:00:00Z");
      const pastDueSince = new Date("2026-01-09T00:00:00Z").toISOString(); // 1 dia atrás
      const result = getSubscriptionAccessStatus(subscription({ status: "past_due", past_due_since: pastDueSince }), now);
      expect(result).toEqual({ granted: true, reason: "past_due_within_grace" });
    });

    it("nega acesso após o período de graça expirar", () => {
      const now = new Date("2026-01-10T00:00:00Z");
      const pastDueSince = new Date("2026-01-01T00:00:00Z").toISOString(); // 9 dias atrás
      const result = getSubscriptionAccessStatus(subscription({ status: "past_due", past_due_since: pastDueSince }), now);
      expect(result).toEqual({ granted: false, reason: "past_due_grace_expired" });
    });

    it("respeita KIWIFY_PAST_DUE_GRACE_DAYS customizado", () => {
      vi.stubEnv("KIWIFY_PAST_DUE_GRACE_DAYS", "1");
      const now = new Date("2026-01-10T00:00:00Z");
      const pastDueSince = new Date("2026-01-09T06:00:00Z").toISOString(); // ~18h atrás
      const result = getSubscriptionAccessStatus(subscription({ status: "past_due", past_due_since: pastDueSince }), now);
      expect(result.granted).toBe(true);
      vi.unstubAllEnvs();
    });
  });

  describe("canceled", () => {
    it("mantém acesso se ainda há período pago restante", () => {
      const now = new Date("2026-01-10T00:00:00Z");
      const periodEnd = new Date("2026-01-20T00:00:00Z").toISOString();
      const result = getSubscriptionAccessStatus(subscription({ status: "canceled", current_period_end: periodEnd }), now);
      expect(result).toEqual({ granted: true, reason: "canceled_within_paid_period" });
    });

    it("corta acesso após o fim do período pago", () => {
      const now = new Date("2026-01-25T00:00:00Z");
      const periodEnd = new Date("2026-01-20T00:00:00Z").toISOString();
      const result = getSubscriptionAccessStatus(subscription({ status: "canceled", current_period_end: periodEnd }), now);
      expect(result).toEqual({ granted: false, reason: "canceled_period_ended" });
    });

    it("nega acesso (padrão seguro) quando não há informação de período", () => {
      const result = getSubscriptionAccessStatus(subscription({ status: "canceled", current_period_end: null }));
      expect(result).toEqual({ granted: false, reason: "canceled_no_period_info" });
    });
  });

  it("nega acesso para refunded", () => {
    expect(getSubscriptionAccessStatus(subscription({ status: "refunded" }))).toEqual({
      granted: false,
      reason: "refunded",
    });
  });

  it("nega acesso para chargeback", () => {
    expect(getSubscriptionAccessStatus(subscription({ status: "chargeback" }))).toEqual({
      granted: false,
      reason: "chargeback",
    });
  });
});

describe("canAccessApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("admin sempre tem acesso, mesmo sem assinatura", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(canAccessApp("admin", null)).toEqual({ granted: true, reason: "owner_bypass" });
  });

  it("fora de produção, qualquer usuário tem acesso mesmo sem assinatura", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(canAccessApp("user", null)).toEqual({ granted: true, reason: "development_bypass" });
  });

  it("em produção, usuário comum sem assinatura ativa é bloqueado", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(canAccessApp("user", null).granted).toBe(false);
  });

  it("em produção, usuário comum com assinatura active é liberado", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(canAccessApp("user", subscription({ status: "active" })).granted).toBe(true);
  });
});

describe("resolveAccess (múltiplas assinaturas por usuário)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("concede acesso se a assinatura MAIS ANTIGA ainda estiver active, mesmo com uma mais nova canceled", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Ordem = mais recente primeiro (como a query real: updated_at desc).
    const canceledNova = subscription({ status: "canceled", current_period_end: null });
    const activeAntiga = subscription({ status: "active" });
    const result = resolveAccess("user", [canceledNova, activeAntiga]);
    expect(result.access).toEqual({ granted: true, reason: "active" });
    expect(result.subscription).toBe(activeAntiga);
  });

  it("concede acesso quando a assinatura mais nova é active (caso comum: resubscribeu)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const activeNova = subscription({ status: "active" });
    const canceledAntiga = subscription({ status: "canceled", current_period_end: null });
    const result = resolveAccess("user", [activeNova, canceledAntiga]);
    expect(result.access).toEqual({ granted: true, reason: "active" });
    expect(result.subscription).toBe(activeNova);
  });

  it("nega acesso quando NENHUMA assinatura do usuário é válida agora", () => {
    vi.stubEnv("NODE_ENV", "production");
    const refunded = subscription({ status: "refunded" });
    const canceledSemPeriodo = subscription({ status: "canceled", current_period_end: null });
    const inactive = subscription({ status: "inactive" });
    const result = resolveAccess("user", [refunded, canceledSemPeriodo, inactive]);
    expect(result.access.granted).toBe(false);
    // Sem nenhuma válida, usa a mais recente (primeira do array) como referência de exibição.
    expect(result.subscription).toBe(refunded);
  });

  it("nega acesso quando o usuário não tem nenhuma assinatura", () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = resolveAccess("user", []);
    expect(result).toEqual({ subscription: null, access: { granted: false, reason: "no_subscription" } });
  });

  it("admin sempre tem acesso, mesmo com todas as assinaturas inválidas", () => {
    vi.stubEnv("NODE_ENV", "production");
    const refunded = subscription({ status: "refunded" });
    const result = resolveAccess("admin", [refunded]);
    expect(result.access).toEqual({ granted: true, reason: "owner_bypass" });
  });

  it("fora de produção, sempre concede acesso independente das assinaturas", () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = resolveAccess("user", [subscription({ status: "refunded" })]);
    expect(result.access.granted).toBe(true);
  });
});
