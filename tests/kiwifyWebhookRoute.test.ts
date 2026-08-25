import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionRow, WebhookEventRow } from "@/types/database";

/**
 * Teste de integração da rota do webhook (POST completo), não só funções
 * puras — precisamos provar o comportamento fim-a-fim pedido explicitamente:
 * "INSPECT=false + KIWIFY_WEBHOOK_TOKEN ausente" não pode mais bloquear o
 * processamento. Isso exige um Supabase e uma Sales API fakes; construídos
 * aqui só com os métodos que a rota realmente chama (não é um mock genérico
 * de supabase-js).
 */

let webhookEvents: WebhookEventRow[] = [];
let subscriptions: SubscriptionRow[] = [];
let listUsersResult: { users: { id: string; email?: string | null }[] } = { users: [] };
let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `row-${idCounter}`;
}

function matchesFilters(row: Record<string, unknown>, filters: [string, unknown][]): boolean {
  return filters.every(([col, val]) => row[col] === val);
}

/** Query builder mínimo, thenable a qualquer ponto da cadeia — só implementa
 * exatamente os métodos/chains que src/app/api/webhooks/kiwify/route.ts usa. */
class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" | null = null;
  private payload: Record<string, unknown> | null = null;

  constructor(private table: "webhook_events" | "subscriptions") {}

  select(_cols?: string) {
    if (!this.op) this.op = "select";
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    return this;
  }

  private store() {
    return this.table === "webhook_events" ? webhookEvents : (subscriptions as unknown as Record<string, unknown>[]);
  }

  private execute(): { data: unknown; error: unknown } {
    const store = this.store() as Record<string, unknown>[];

    if (this.op === "insert") {
      if (this.table === "webhook_events") {
        const conflict = webhookEvents.find(
          (r) => r.provider === this.payload!.provider && r.idempotency_key === this.payload!.idempotency_key
        );
        if (conflict) return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      const row = { id: nextId(), received_at: new Date().toISOString(), processed_at: null, processing_error: null, ...this.payload };
      store.push(row);
      return { data: row, error: null };
    }

    if (this.op === "update") {
      const target = store.find((r) => matchesFilters(r, this.filters));
      if (target) Object.assign(target, this.payload);
      return { data: target ?? null, error: null };
    }

    // select
    const rows = store.filter((r) => matchesFilters(r, this.filters));
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function createFakeSupabase() {
  return {
    auth: { admin: { listUsers: vi.fn(async () => ({ data: listUsersResult, error: null })) } },
    from(table: "webhook_events" | "subscriptions") {
      return new FakeQuery(table);
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createFakeSupabase(),
}));

const ORDER_APPROVED_WRAPPED = {
  url: "https://example.com/api/webhooks/kiwify",
  signature: "fake-signature-value-not-real",
  order: {
    webhook_event_type: "order_approved",
    order_id: "order-route-test-1",
    order_status: "paid",
    Product: { product_id: "prod-fake-1", product_name: "Example product" },
    Customer: { email: "johndoe@example.com", full_name: "John Doe" },
    Subscription: {
      id: "sub-route-test-1",
      status: "active",
      start_date: "2026-08-22T00:00:00.000Z",
      next_payment: "2026-09-22T00:00:00.000Z",
    },
    subscription_id: "sub-route-test-1",
    created_at: "2026-08-25 12:00",
    updated_at: "2026-08-25 12:00",
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function postRequest(body: unknown) {
  return new Request("https://app.example.com/api/webhooks/kiwify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/kiwify — INSPECT=false não pode mais depender de KIWIFY_WEBHOOK_TOKEN", () => {
  beforeEach(() => {
    webhookEvents = [];
    subscriptions = [];
    listUsersResult = { users: [] };
    idCounter = 0;
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "false");
    vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", ""); // ausente de propósito — não pode mais causar 503
    vi.stubEnv("KIWIFY_PRODUCT_ID", "prod-fake-1");
    vi.stubEnv("KIWIFY_API_CLIENT_ID", "client-id");
    vi.stubEnv("KIWIFY_API_CLIENT_SECRET", "client-secret");
    vi.stubEnv("KIWIFY_API_ACCOUNT_ID", "account-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("KIWIFY_WEBHOOK_TOKEN ausente + venda válida na Sales API → NÃO retorna 503, processa normalmente e cria a subscription", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 })) // OAuth
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-route-test-1",
          status: "paid",
          product: { id: "prod-fake-1" },
          customer: { email: "johndoe@example.com" },
          refunded_at: null,
        })
      ); // GET /v1/sales/{id}
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(postRequest(ORDER_APPROVED_WRAPPED));

    expect(response.status).not.toBe(503);
    expect(response.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.status).toBe("active");
    expect(subscriptions[0]?.provider_subscription_id).toBe("sub-route-test-1");
  });

  it("KIWIFY_WEBHOOK_TOKEN ausente + Sales API rejeita a venda (produto errado) → não altera subscriptions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 })) // OAuth
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-route-test-1",
          status: "paid",
          product: { id: "prod-de-outro-produto" }, // não bate com KIWIFY_PRODUCT_ID
          customer: { email: "johndoe@example.com" },
          refunded_at: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(postRequest(ORDER_APPROVED_WRAPPED));

    expect(response.status).not.toBe(503);
    expect(subscriptions).toHaveLength(0);
  });

  it("venda não encontrada na Sales API (404) → não altera subscriptions, mas o evento fica registrado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(postRequest(ORDER_APPROVED_WRAPPED));

    expect(response.status).toBe(200); // evento registrado e "processado" (decisão de não agir), não é erro interno
    expect(subscriptions).toHaveLength(0);
    expect(webhookEvents).toHaveLength(1);
  });

  it("mesmo webhook reenviado (mesmo order_id) depois de já ter processado com sucesso → duplicate, não cria segunda subscription", async () => {
    // Só 2 respostas: a 2ª chamada (reenvio) nem chega a chamar fetch, porque
    // resolveWebhookEventRow já corta como "already_processed" antes disso.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-route-test-1",
          status: "paid",
          product: { id: "prod-fake-1" },
          customer: { email: "johndoe@example.com" },
          refunded_at: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const first = await POST(postRequest(ORDER_APPROVED_WRAPPED));
    expect(first.status).toBe(200);
    expect(subscriptions).toHaveLength(1);

    const second = await POST(postRequest(ORDER_APPROVED_WRAPPED));
    const secondBody = (await second.json()) as { duplicate?: boolean };
    expect(secondBody.duplicate).toBe(true);
    expect(subscriptions).toHaveLength(1); // não duplicou
    expect(fetchMock).toHaveBeenCalledTimes(2); // reenvio não chamou a Sales API de novo
  });
});

describe("POST /api/webhooks/kiwify — INSPECT=true continua só auditando", () => {
  beforeEach(() => {
    webhookEvents = [];
    subscriptions = [];
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("não chama a Sales API nem altera subscriptions, mesmo com um payload de order_approved", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(postRequest(ORDER_APPROVED_WRAPPED));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(subscriptions).toHaveLength(0);
    expect(webhookEvents).toHaveLength(1);
    expect(webhookEvents[0]?.event_type).toBe("_inspect:order_approved");
  });
});
