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
  isAuthentic,
  isInspectionMode,
  isKiwifyEvent,
  matchUserIdByEmail,
} from "@/lib/billing/kiwify";

/**
 * Fixture FICTÍCIA equivalente, em estrutura, ao payload real de teste de
 * "Compra aprovada" enviado pela própria Kiwify (confirmado por inspeção) —
 * nenhum valor aqui é real, só o formato dos campos.
 */
const ORDER_APPROVED_FIXTURE = {
  webhook_event_type: "order_approved",
  order_id: "order-fake-123",
  order_ref: "REF-FAKE-123",
  order_status: "paid",
  Product: {
    product_id: "prod-fake-1",
    product_name: "Example product",
  },
  Customer: {
    email: "Test.User@Example.com",
    full_name: "Test User",
    first_name: "Test",
    mobile: "+5511999999999",
  },
  Subscription: {
    id: "sub-fake-1",
    status: "active",
    start_date: "2026-01-01T00:00:00.000Z",
    next_payment: "2026-02-01T00:00:00.000Z",
    plan: {
      id: "plan-fake-1",
      name: "Example plan",
      frequency: "weekly",
      qty_charges: 1,
    },
  },
  subscription_id: "sub-fake-1",
  payment_method: "credit_card",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  approved_date: "2026-01-01T00:00:00.000Z",
};

describe("KIWIFY_WEBHOOK_TRIGGERS / isKiwifyEvent", () => {
  it("aceita os 10 triggers de cadastro documentados pela Kiwify", () => {
    for (const trigger of KIWIFY_WEBHOOK_TRIGGERS) expect(isKiwifyEvent(trigger)).toBe(true);
  });

  it("rejeita triggers inventados", () => {
    expect(isKiwifyEvent("evento_que_nao_existe")).toBe(false);
    expect(isKiwifyEvent(123)).toBe(false);
  });

  it("NÃO é o mesmo vocabulário do campo webhook_event_type do payload real", () => {
    // Confirmado por inspeção: o trigger "compra_aprovada" entrega
    // webhook_event_type "order_approved" — vocabulários diferentes.
    expect(isKiwifyEvent("order_approved")).toBe(false);
  });
});

describe("extractEventType", () => {
  it("prioriza webhook_event_type — campo REAL confirmado por inspeção (order_approved)", () => {
    expect(extractEventType(ORDER_APPROVED_FIXTURE)).toBe("order_approved");
  });

  it("cai para outros nomes de campo só como fallback de compatibilidade (nunca observados)", () => {
    expect(extractEventType({ event: "algum_evento" })).toBe("algum_evento");
    expect(extractEventType({ trigger: "outro_evento" })).toBe("outro_evento");
  });

  it("retorna null quando nenhum campo conhecido existe", () => {
    expect(extractEventType({ foo: "bar" })).toBeNull();
  });
});

describe("extractOrderInfo (order_approved — estrutura real confirmada)", () => {
  it("extrai todos os campos confirmados do fixture real de order_approved", () => {
    const info = extractOrderInfo(ORDER_APPROVED_FIXTURE);
    expect(info).toEqual({
      orderId: "order-fake-123",
      subscriptionId: "sub-fake-1",
      productId: "prod-fake-1",
      customerId: null, // sem campo de id de cliente na estrutura observada — nunca inventado
      customerEmail: "test.user@example.com", // normalizado: trim + lowercase
      subscriptionStatus: "active",
      startedAt: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-02-01T00:00:00.000Z", // Subscription.next_payment
    });
  });

  it("usa subscription_id solto como fallback quando Subscription.id está ausente", () => {
    const body = { ...ORDER_APPROVED_FIXTURE, Subscription: { ...ORDER_APPROVED_FIXTURE.Subscription, id: undefined } };
    const info = extractOrderInfo(body);
    expect(info.subscriptionId).toBe("sub-fake-1"); // veio do subscription_id solto
  });

  it("normaliza e-mail com espaços e caixa alta", () => {
    const body = { ...ORDER_APPROVED_FIXTURE, Customer: { ...ORDER_APPROVED_FIXTURE.Customer, email: "  Outro.Email@EXEMPLO.com  " } };
    expect(extractOrderInfo(body).customerEmail).toBe("outro.email@exemplo.com");
  });

  it("nunca inventa provider_customer_id a partir do e-mail", () => {
    // A estrutura real não tem nenhum campo de id de cliente — customerId deve ficar null,
    // mesmo havendo e-mail disponível.
    const info = extractOrderInfo(ORDER_APPROVED_FIXTURE);
    expect(info.customerId).toBeNull();
  });

  it("usa Product.product_id (não Product.id) para productId", () => {
    const body = { ...ORDER_APPROVED_FIXTURE, Product: { product_id: "prod-real", id: "nao-deveria-usar-este" } };
    expect(extractOrderInfo(body).productId).toBe("prod-real");
  });
});

describe("buildIdempotencyKey", () => {
  const baseInfo = {
    orderId: null as string | null,
    subscriptionId: null as string | null,
    productId: null,
    customerId: null,
    customerEmail: null,
    subscriptionStatus: null,
    startedAt: null,
    periodEnd: null,
  };

  it("usa provider + event type + order_id (order_id preferido)", () => {
    const key = buildIdempotencyKey("order_approved", { ...baseInfo, orderId: "order-1", subscriptionId: "sub-1" });
    expect(key).toBe("order_approved:order-1");
  });

  it("retorna null quando não há nenhum id conhecido", () => {
    const key = buildIdempotencyKey("order_approved", baseInfo);
    expect(key).toBeNull();
  });

  it("webhook duplicado: o mesmo evento sempre gera a MESMA chave (garante o unique(provider, idempotency_key) do banco)", () => {
    const info = extractOrderInfo(ORDER_APPROVED_FIXTURE);
    const key1 = buildIdempotencyKey("order_approved", info);
    const key2 = buildIdempotencyKey("order_approved", info);
    expect(key1).toBe(key2);
    expect(key1).toBe("order_approved:order-fake-123");
  });
});

describe("matchUserIdByEmail (vincular compra ao usuário)", () => {
  const users = [
    { id: "user-1", email: "achada@example.com" },
    { id: "user-2", email: "outra@example.com" },
  ];

  it("usuário encontrado: retorna o id quando o e-mail bate", () => {
    expect(matchUserIdByEmail(users, "achada@example.com")).toBe("user-1");
  });

  it("usuário encontrado com e-mail em caixa/espaço diferentes", () => {
    expect(matchUserIdByEmail(users, "  Achada@Example.com ")).toBe("user-1");
  });

  it("usuário não encontrado: retorna null sem inventar/criar nada", () => {
    expect(matchUserIdByEmail(users, "ninguem@example.com")).toBeNull();
  });

  it("retorna null quando o e-mail é null", () => {
    expect(matchUserIdByEmail(users, null)).toBeNull();
  });
});

describe("token/signature de autenticidade (mecanismo real ainda não confirmado)", () => {
  it("extractToken ainda existe mas o parâmetro real observado é `signature`, não `token`", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?signature=abc123def456");
    expect(extractToken(req)).toBeNull(); // não tem ?token= nessa requisição real
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

  it("isInspectionMode é false para qualquer valor que não seja a string 'true'", () => {
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "1");
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
    const rawText = JSON.stringify(ORDER_APPROVED_FIXTURE);
    const record = buildInspectionRecord(req, rawText);

    expect(record.inspection).toBe(true);
    expect(record.method).toBe("POST");
    expect(record.query).toEqual({ signature: "abc123def456" });
    expect(record.bodyRaw).toBe(rawText);
    expect((record.bodyParsed as typeof ORDER_APPROVED_FIXTURE).webhook_event_type).toBe("order_approved");
  });

  it("buildInspectionRecord não quebra com body que não é JSON — preserva o texto cru", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify", { method: "POST" });
    const rawText = "isto-nao-e-json&talvez=form-urlencoded";
    const record = buildInspectionRecord(req, rawText);

    expect(record.bodyRaw).toBe(rawText);
    expect(record.bodyParsed).toBeNull();
  });
});
