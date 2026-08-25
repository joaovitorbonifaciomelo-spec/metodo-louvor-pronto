import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KIWIFY_EVENTS,
  buildIdempotencyKey,
  buildInspectionRecord,
  captureHeaders,
  extractEventType,
  extractOrderInfo,
  extractToken,
  isAuthentic,
  isInspectionMode,
  isKiwifyEvent,
} from "@/lib/billing/kiwify";

describe("isKiwifyEvent", () => {
  it("aceita todos os 10 eventos reais documentados pela Kiwify", () => {
    for (const event of KIWIFY_EVENTS) expect(isKiwifyEvent(event)).toBe(true);
  });

  it("rejeita eventos inventados", () => {
    expect(isKiwifyEvent("evento_que_nao_existe")).toBe(false);
    expect(isKiwifyEvent(123)).toBe(false);
  });
});

describe("extractEventType", () => {
  it("lê o campo webhook_event_type quando presente", () => {
    expect(extractEventType({ webhook_event_type: "compra_aprovada" })).toBe("compra_aprovada");
  });

  it("cai para outros nomes de campo candidatos", () => {
    expect(extractEventType({ event: "chargeback" })).toBe("chargeback");
    expect(extractEventType({ trigger: "subscription_late" })).toBe("subscription_late");
  });

  it("retorna null quando nenhum campo conhecido existe", () => {
    expect(extractEventType({ foo: "bar" })).toBeNull();
  });
});

describe("extractOrderInfo", () => {
  it("extrai campos de um payload com estrutura aninhada (Customer/Subscription)", () => {
    const info = extractOrderInfo({
      order_id: "order-123",
      Customer: { email: "user@example.com", id: "cust-1" },
      Subscription: { id: "sub-1", current_period_end: "2026-02-01T00:00:00Z" },
    });
    expect(info).toEqual({
      orderId: "order-123",
      subscriptionId: "sub-1",
      productId: null,
      customerId: "cust-1",
      customerEmail: "user@example.com",
      periodEnd: "2026-02-01T00:00:00Z",
    });
  });

  it("cai para campos soltos quando não há objetos aninhados", () => {
    const info = extractOrderInfo({ id: "order-999", customer_email: "flat@example.com" });
    expect(info.orderId).toBe("order-999");
    expect(info.customerEmail).toBe("flat@example.com");
  });
});

describe("buildIdempotencyKey", () => {
  it("usa orderId quando disponível", () => {
    const key = buildIdempotencyKey("compra_aprovada", {
      orderId: "order-1",
      subscriptionId: "sub-1",
      productId: null,
      customerId: null,
      customerEmail: null,
      periodEnd: null,
    });
    expect(key).toBe("compra_aprovada:order-1");
  });

  it("retorna null quando não há nenhum id conhecido", () => {
    const key = buildIdempotencyKey("compra_aprovada", {
      orderId: null,
      subscriptionId: null,
      productId: null,
      customerId: null,
      customerEmail: null,
      periodEnd: null,
    });
    expect(key).toBeNull();
  });
});

describe("token de autenticidade", () => {
  it("extrai o token da query string", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?token=abc123");
    expect(extractToken(req)).toBe("abc123");
  });

  it("isAuthentic é falso sem KIWIFY_WEBHOOK_TOKEN configurado", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?token=abc123");
    expect(isAuthentic(req)).toBe(false);
  });
});

describe("modo de inspeção (mecanismo de token ainda não confirmado)", () => {
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

  it("buildInspectionRecord captura query, headers e body (JSON válido)", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify?token=abc123", {
      method: "POST",
      headers: { "x-kiwify-signature": "xyz", "content-type": "application/json" },
    });
    const rawText = JSON.stringify({ webhook_event_type: "compra_aprovada", order_id: "order-1" });
    const record = buildInspectionRecord(req, rawText);

    expect(record.inspection).toBe(true);
    expect(record.method).toBe("POST");
    expect(record.query).toEqual({ token: "abc123" });
    expect(record.headers["x-kiwify-signature"]).toBe("xyz");
    expect(record.bodyRaw).toBe(rawText);
    expect(record.bodyParsed).toEqual({ webhook_event_type: "compra_aprovada", order_id: "order-1" });
  });

  it("buildInspectionRecord não quebra com body que não é JSON — preserva o texto cru", () => {
    const req = new Request("https://app.example.com/api/webhooks/kiwify", { method: "POST" });
    const rawText = "isto-nao-e-json&talvez=form-urlencoded";
    const record = buildInspectionRecord(req, rawText);

    expect(record.bodyRaw).toBe(rawText);
    expect(record.bodyParsed).toBeNull();
  });
});
