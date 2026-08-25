import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KIWIFY_WEBHOOK_TRIGGERS,
  buildIdempotencyKey,
  buildInspectionRecord,
  captureHeaders,
  extractEventType,
  extractOrderInfo,
  extractSignature,
  extractToken,
  getConfiguredKiwifyProductId,
  isAllowedKiwifyProduct,
  isAuthentic,
  isInspectionMode,
  isKiwifyEvent,
  mapKiwifyEventToSubscriptionStatus,
  matchUserIdByEmail,
  parseKiwifyWebhook,
  validateSaleForEvent,
  type VerifiedKiwifySale,
} from "@/lib/billing/kiwify";

/**
 * Fixtures FICTÍCIAS equivalentes, em estrutura, aos 6 payloads reais de
 * teste enviados pela própria Kiwify e inspecionados em `webhook_events`
 * (nenhum valor aqui é real — inclusive a Kiwify já usa dados fictícios
 * "John Doe"/"johndoe@example.com"/"Example product" nos próprios testes).
 * Todos compartilham a mesma estrutura de Product/Customer/Subscription
 * confirmada nos 6 eventos reais.
 */
function baseFixture(overrides: Record<string, unknown>) {
  return {
    Product: { product_id: "prod-fake-1", product_name: "Example product" },
    Customer: {
      email: "johndoe@example.com",
      full_name: "John Doe",
      first_name: "John",
      mobile: "+5511999999999",
    },
    order_ref: "REF-FAKE",
    sale_type: "producer",
    created_at: "2026-08-25 19:40",
    updated_at: "2026-08-25 19:40",
    payment_method: "credit_card",
    product_type: "membership",
    installments: 1,
    approved_date: null,
    refunded_at: null,
    ...overrides,
  };
}

const ORDER_APPROVED = baseFixture({
  webhook_event_type: "order_approved",
  order_id: "order-approved-1",
  order_status: "paid",
  approved_date: "2026-08-26 19:40",
  Subscription: {
    id: "sub-fake-1",
    status: "active",
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T19:40:56.040Z",
    next_payment: "2026-08-29T19:40:56.040Z",
  },
  subscription_id: "sub-fake-1",
});

const SUBSCRIPTION_RENEWED = baseFixture({
  webhook_event_type: "subscription_renewed",
  order_id: "order-renewed-1", // cobrança recorrente NOVA — order_id diferente do order_approved
  order_status: "paid",
  Subscription: {
    id: "sub-fake-1", // mesma assinatura
    status: "active",
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T19:40:56.040Z",
    next_payment: "2026-09-05T19:40:56.040Z", // ciclo avançou
  },
  subscription_id: "sub-fake-1",
});

const SUBSCRIPTION_LATE = baseFixture({
  webhook_event_type: "subscription_late",
  order_id: "order-late-1",
  order_status: "paid",
  Subscription: {
    id: "sub-fake-2",
    status: "waiting_payment", // confirmado: Kiwify usa "waiting_payment", não "past_due"
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T19:59:03.421Z",
    next_payment: "2026-08-29T19:59:03.421Z",
  },
  subscription_id: "sub-fake-2",
});

const SUBSCRIPTION_CANCELED = baseFixture({
  webhook_event_type: "subscription_canceled",
  order_id: "order-canceled-1",
  order_status: "refunded",
  refunded_at: "2026-08-26 19:58",
  Subscription: {
    id: "sub-fake-3",
    status: "canceled",
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T19:58:57.835Z",
    next_payment: "2026-08-29T19:58:57.835Z",
  },
  subscription_id: "sub-fake-3",
});

const ORDER_REFUNDED = baseFixture({
  webhook_event_type: "order_refunded",
  order_id: "order-refunded-1",
  order_status: "refunded",
  refunded_at: "2026-08-26 20:00",
  Subscription: {
    // CONFIRMADO no payload real: Subscription.status vem "canceled" mesmo
    // sendo um reembolso — o evento comercial é REFUND, não cancelamento.
    id: "sub-fake-4",
    status: "canceled",
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T20:00:25.502Z",
    next_payment: "2026-08-29T20:00:25.502Z",
  },
  subscription_id: "sub-fake-4",
});

const CHARGEBACK = baseFixture({
  webhook_event_type: "chargeback",
  order_id: "order-chargeback-1",
  order_status: "chargedback",
  Subscription: {
    // CONFIRMADO no payload real: Subscription.status vem "active" mesmo
    // sendo um chargeback — o evento comercial é CHARGEBACK, não "active".
    id: "sub-fake-5",
    status: "active",
    plan: { id: "plan-fake-1", name: "Example plan", frequency: "weekly", qty_charges: 0 },
    start_date: "2026-08-22T19:58:52.342Z",
    next_payment: "2026-08-29T19:58:52.342Z",
  },
  subscription_id: "sub-fake-5",
});

describe("KIWIFY_WEBHOOK_TRIGGERS / isKiwifyEvent", () => {
  it("aceita os 10 triggers de cadastro documentados pela Kiwify", () => {
    for (const trigger of KIWIFY_WEBHOOK_TRIGGERS) expect(isKiwifyEvent(trigger)).toBe(true);
  });

  it("NÃO é o mesmo vocabulário do campo webhook_event_type do payload real", () => {
    expect(isKiwifyEvent("order_approved")).toBe(false);
  });
});

describe("extractEventType", () => {
  it.each([
    ["order_approved", ORDER_APPROVED],
    ["subscription_renewed", SUBSCRIPTION_RENEWED],
    ["subscription_late", SUBSCRIPTION_LATE],
    ["subscription_canceled", SUBSCRIPTION_CANCELED],
    ["order_refunded", ORDER_REFUNDED],
    ["chargeback", CHARGEBACK],
  ])("lê webhook_event_type = %s do payload real confirmado", (expected, fixture) => {
    expect(extractEventType(fixture)).toBe(expected);
  });

  it("retorna null quando nenhum campo conhecido existe", () => {
    expect(extractEventType({ foo: "bar" })).toBeNull();
  });
});

describe("parseKiwifyWebhook — mapeamento evento -> status (autoritativo = webhook_event_type)", () => {
  it.each([
    ["order_approved", ORDER_APPROVED, "active"],
    ["subscription_renewed", SUBSCRIPTION_RENEWED, "active"],
    ["subscription_late", SUBSCRIPTION_LATE, "past_due"],
    ["order_refunded", ORDER_REFUNDED, "refunded"],
    ["chargeback", CHARGEBACK, "chargeback"],
  ] as const)("%s -> %s", (_label, fixture, expectedStatus) => {
    const parsed = parseKiwifyWebhook(fixture);
    expect(mapKiwifyEventToSubscriptionStatus(parsed.eventType)).toBe(expectedStatus);
  });

  it("subscription_canceled NÃO mapeia para nenhum status (hardening de MVP — ver comentário em EVENT_TO_STATUS)", () => {
    const parsed = parseKiwifyWebhook(SUBSCRIPTION_CANCELED);
    expect(parsed.eventType).toBe("subscription_canceled");
    expect(mapKiwifyEventToSubscriptionStatus(parsed.eventType)).toBeNull();
  });

  it("chargeback com Subscription.status='active' (real) resulta em status=chargeback, NUNCA active", () => {
    const parsed = parseKiwifyWebhook(CHARGEBACK);
    expect(parsed.subscriptionStatus).toBe("active"); // confirma o dado informativo do payload
    expect(mapKiwifyEventToSubscriptionStatus(parsed.eventType)).toBe("chargeback"); // decisão real ignora isso
  });

  it("order_refunded com Subscription.status='canceled' (real) resulta em status=refunded, NUNCA canceled", () => {
    const parsed = parseKiwifyWebhook(ORDER_REFUNDED);
    expect(parsed.subscriptionStatus).toBe("canceled");
    expect(mapKiwifyEventToSubscriptionStatus(parsed.eventType)).toBe("refunded");
  });

  it("evento não confirmado (ex.: billet_created) não mapeia para nenhum status", () => {
    expect(mapKiwifyEventToSubscriptionStatus("billet_created")).toBeNull();
    expect(mapKiwifyEventToSubscriptionStatus("evento_desconhecido")).toBeNull();
  });

  it("extrai todos os campos confirmados do fixture real de order_approved", () => {
    const parsed = parseKiwifyWebhook(ORDER_APPROVED);
    expect(parsed).toEqual({
      eventType: "order_approved",
      orderId: "order-approved-1",
      subscriptionId: "sub-fake-1",
      productId: "prod-fake-1",
      customerId: null, // nenhum dos 6 eventos reais trouxe id de cliente — nunca inventado
      customerEmail: "johndoe@example.com",
      subscriptionStatus: "active",
      startedAt: "2026-08-22T19:40:56.040Z",
      currentPeriodEnd: "2026-08-29T19:40:56.040Z",
      eventOccurredAt: "2026-08-25 19:40",
    });
  });
});

describe("extractOrderInfo (extração de baixo nível)", () => {
  it("usa subscription_id solto como fallback quando Subscription.id está ausente", () => {
    const body = { ...ORDER_APPROVED, Subscription: { ...(ORDER_APPROVED as any).Subscription, id: undefined } };
    expect(extractOrderInfo(body).subscriptionId).toBe("sub-fake-1");
  });

  it("normaliza e-mail com espaços e caixa alta", () => {
    const body = { ...ORDER_APPROVED, Customer: { ...(ORDER_APPROVED as any).Customer, email: "  Outro.Email@EXEMPLO.com  " } };
    expect(extractOrderInfo(body).customerEmail).toBe("outro.email@exemplo.com");
  });

  it("usa Product.product_id (não Product.id) para productId", () => {
    const body = { ...ORDER_APPROVED, Product: { product_id: "prod-real", id: "nao-deveria-usar-este" } };
    expect(extractOrderInfo(body).productId).toBe("prod-real");
  });

  it("nunca inventa customerId/provider_customer_id a partir do e-mail, em nenhum dos 6 eventos", () => {
    for (const fixture of [ORDER_APPROVED, SUBSCRIPTION_RENEWED, SUBSCRIPTION_LATE, SUBSCRIPTION_CANCELED, ORDER_REFUNDED, CHARGEBACK]) {
      expect(extractOrderInfo(fixture).customerId).toBeNull();
    }
  });
});

describe("buildIdempotencyKey (idempotência correta para renovações)", () => {
  it("usa eventType + order_id", () => {
    const parsed = parseKiwifyWebhook(ORDER_APPROVED);
    expect(buildIdempotencyKey(parsed)).toBe("order_approved:order-approved-1");
  });

  it("retorna null quando não há nenhum id conhecido", () => {
    expect(buildIdempotencyKey({ eventType: "order_approved", orderId: null, subscriptionId: null })).toBeNull();
  });

  it("webhook duplicado (mesmo order_id reenviado): gera a MESMA chave — banco rejeita como duplicata", () => {
    const parsed = parseKiwifyWebhook(ORDER_APPROVED);
    expect(buildIdempotencyKey(parsed)).toBe(buildIdempotencyKey(parseKiwifyWebhook({ ...ORDER_APPROVED })));
  });

  it("duas renovações de ciclos diferentes (mesma assinatura, order_id diferente): geram chaves DIFERENTES — ambas processadas", () => {
    const primeiraCompra = parseKiwifyWebhook(ORDER_APPROVED);
    const renovacao = parseKiwifyWebhook(SUBSCRIPTION_RENEWED);
    expect(primeiraCompra.subscriptionId).toBe(renovacao.subscriptionId); // mesma assinatura
    expect(buildIdempotencyKey(primeiraCompra)).not.toBe(buildIdempotencyKey(renovacao)); // eventos distintos
  });

  it("NÃO usa apenas eventType+subscriptionId — duas renovações da mesma assinatura não podem colidir", () => {
    const renovacao1 = parseKiwifyWebhook(SUBSCRIPTION_RENEWED);
    const renovacao2 = parseKiwifyWebhook({ ...SUBSCRIPTION_RENEWED, order_id: "order-renewed-2" });
    expect(renovacao1.subscriptionId).toBe(renovacao2.subscriptionId);
    expect(buildIdempotencyKey(renovacao1)).not.toBe(buildIdempotencyKey(renovacao2));
  });
});

describe("validação de produto (KIWIFY_PRODUCT_ID)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falha fechado quando KIWIFY_PRODUCT_ID não está configurado", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "");
    expect(getConfiguredKiwifyProductId()).toBeNull();
    expect(isAllowedKiwifyProduct("qualquer-produto")).toBe(false);
    expect(isAllowedKiwifyProduct(null)).toBe(false);
  });

  it("permite quando product_id bate com KIWIFY_PRODUCT_ID configurado", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    expect(isAllowedKiwifyProduct("prod-fake-1")).toBe(true);
  });

  it("produto errado: nega mesmo com KIWIFY_PRODUCT_ID configurado (para outro produto)", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-correto");
    expect(isAllowedKiwifyProduct("prod-fake-1")).toBe(false);
    expect(isAllowedKiwifyProduct(null)).toBe(false);
  });
});

describe("validateSaleForEvent (hardening — venda tem que confirmar produto + e-mail + status, order_id NÃO é segredo)", () => {
  const parsedOrderApproved = parseKiwifyWebhook(ORDER_APPROVED); // orderId="order-approved-1", productId="prod-fake-1", email="johndoe@example.com"

  function verifiedSale(overrides: Partial<VerifiedKiwifySale> = {}): VerifiedKiwifySale {
    return {
      id: parsedOrderApproved.orderId!,
      status: "paid",
      productId: "prod-fake-1",
      customerEmail: "johndoe@example.com",
      refundedAt: null,
      ...overrides,
    };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("order real + produto correto + tudo correto → libera", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, verifiedSale());
    expect(result.valid).toBe(true);
  });

  it("order real + produto correto + e-mail DIFERENTE do webhook → não libera", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const sale = verifiedSale({ customerEmail: "outra-pessoa@example.com" });
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, sale);
    expect(result.valid).toBe(false);
  });

  it("order real + e-mail correto + status NÃO pago → não libera", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const sale = verifiedSale({ status: "pending" });
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, sale);
    expect(result.valid).toBe(false);
  });

  it("order_approved usando uma venda que a API já mostra como refunded → não libera", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const sale = verifiedSale({ status: "refunded", refundedAt: "2026-01-01T00:00:00Z" });
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, sale);
    expect(result.valid).toBe(false);
  });

  it("produto da venda não bate com KIWIFY_PRODUCT_ID → não libera mesmo com e-mail/status corretos", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-correto");
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, verifiedSale({ productId: "prod-fake-1" }));
    expect(result.valid).toBe(false);
  });

  it("order_refunded: exige status refunded (ou refunded_at) confirmado pela API", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const parsed = parseKiwifyWebhook(ORDER_REFUNDED);
    expect(validateSaleForEvent("order_refunded", parsed, verifiedSale({ id: parsed.orderId!, status: "refunded" })).valid).toBe(
      true
    );
    expect(validateSaleForEvent("order_refunded", parsed, verifiedSale({ id: parsed.orderId!, status: "paid" })).valid).toBe(
      false
    );
  });

  it("chargeback: exige status chargedback confirmado pela API", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const parsed = parseKiwifyWebhook(CHARGEBACK);
    expect(validateSaleForEvent("chargeback", parsed, verifiedSale({ id: parsed.orderId!, status: "chargedback" })).valid).toBe(
      true
    );
    expect(validateSaleForEvent("chargeback", parsed, verifiedSale({ id: parsed.orderId!, status: "paid" })).valid).toBe(false);
  });

  it("webhook falso de subscription_canceled: nunca é considerado válido (evento nem tem regra de validação)", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const parsed = parseKiwifyWebhook(SUBSCRIPTION_CANCELED);
    const result = validateSaleForEvent("subscription_canceled", parsed, verifiedSale({ id: parsed.orderId! }));
    expect(result.valid).toBe(false);
  });

  it("sale.id divergente do order_id do webhook → não libera (defesa extra)", () => {
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    const sale = verifiedSale({ id: "order-diferente" });
    const result = validateSaleForEvent("order_approved", parsedOrderApproved, sale);
    expect(result.valid).toBe(false);
  });
});

describe("matchUserIdByEmail (vincular compra ao usuário)", () => {
  const users = [
    { id: "user-1", email: "achada@example.com" },
    { id: "user-2", email: "outra@example.com" },
  ];

  it("e-mail encontrado: retorna o id do usuário", () => {
    expect(matchUserIdByEmail(users, "achada@example.com")).toBe("user-1");
  });

  it("e-mail encontrado com caixa/espaço diferentes", () => {
    expect(matchUserIdByEmail(users, "  Achada@Example.com ")).toBe("user-1");
  });

  it("e-mail não encontrado: retorna null (compra fica pendente de vínculo, não é perdida)", () => {
    expect(matchUserIdByEmail(users, "ninguem@example.com")).toBeNull();
  });

  it("retorna null quando o e-mail é null", () => {
    expect(matchUserIdByEmail(users, null)).toBeNull();
  });
});

describe("token/signature de autenticidade (mecanismo real ainda não confirmado)", () => {
  it("o parâmetro real observado é `signature`, não `token`", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?signature=abc123def456");
    expect(extractToken(req)).toBeNull();
    expect(extractSignature(req)).toBe("abc123def456");
  });

  it("isAuthentic é falso sem KIWIFY_WEBHOOK_TOKEN configurado", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?signature=abc123");
    expect(isAuthentic(req)).toBe(false);
  });

  it("isAuthentic continua falso mesmo com KIWIFY_WEBHOOK_TOKEN configurado, porque a Kiwify não envia ?token= de verdade", () => {
    vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", "algum-token");
    const req = new Request("https://app.example.com/api/webhooks/kiwify?signature=algum-token");
    expect(isAuthentic(req)).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("modo de inspeção (mecanismo de autenticação ainda não confirmado)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isInspectionMode só é true com KIWIFY_WEBHOOK_INSPECT='true' exatamente", () => {
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "true");
    expect(isInspectionMode()).toBe(true);
  });

  it("isInspectionMode é false por padrão (sem a env var)", () => {
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "");
    expect(isInspectionMode()).toBe(false);
  });

  it("captureHeaders nunca inclui o header cookie", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify", {
      headers: { "x-kiwify-token": "abc123", cookie: "session=segredo", "content-type": "application/json" },
    });
    const headers = captureHeaders(req);
    expect(headers["x-kiwify-token"]).toBe("abc123");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["cookie"]).toBe("[redacted]");
  });

  it("buildInspectionRecord captura query (incluindo signature), headers e body (JSON válido)", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?signature=abc123def456", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const rawText = JSON.stringify(ORDER_APPROVED);
    const record = buildInspectionRecord(req, rawText);

    expect(record.inspection).toBe(true);
    expect(record.method).toBe("POST");
    expect(record.query).toEqual({ signature: "abc123def456" });
    expect(record.bodyRaw).toBe(rawText);
    expect((record.bodyParsed as Record<string, unknown>).webhook_event_type).toBe("order_approved");
  });

  it("buildInspectionRecord não quebra com body que não é JSON — preserva o texto cru", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify", { method: "POST" });
    const rawText = "isto-nao-e-json&talvez=form-urlencoded";
    const record = buildInspectionRecord(req, rawText);

    expect(record.bodyRaw).toBe(rawText);
    expect(record.bodyParsed).toBeNull();
  });
});
