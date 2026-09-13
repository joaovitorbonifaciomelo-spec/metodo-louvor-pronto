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

describe("POST /api/webhooks/kiwify — atribuição de vendas por UTM (first-touch)", () => {
  beforeEach(() => {
    webhookEvents = [];
    subscriptions = [];
    listUsersResult = { users: [] };
    idCounter = 0;
    vi.stubEnv("KIWIFY_WEBHOOK_INSPECT", "false");
    vi.stubEnv("KIWIFY_WEBHOOK_TOKEN", "");
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

  function oauthResponse() {
    return jsonResponse({ access_token: "tok-123", expires_in: 86400 });
  }

  function saleResponse(orderId: string) {
    return jsonResponse({
      id: orderId,
      status: "paid",
      product: { id: "prod-fake-1" },
      customer: { email: "utm-tester@example.com" },
      refunded_at: null,
    });
  }

  function wrappedOrder(overrides: Record<string, unknown>) {
    return {
      url: "https://example.com/api/webhooks/kiwify",
      signature: "fake-signature-value-not-real",
      order: {
        order_status: "paid",
        Product: { product_id: "prod-fake-1", product_name: "Example product" },
        Customer: { email: "utm-tester@example.com", full_name: "UTM Tester" },
        created_at: "2026-08-25 12:00",
        updated_at: "2026-08-25 12:00",
        ...overrides,
      },
    };
  }

  it("order_approved com UTMs -> subscription criada com as UTMs corretas", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(oauthResponse()).mockResolvedValueOnce(saleResponse("order-utm-1"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-utm-1",
          Subscription: { id: "sub-utm-1", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-utm-1",
          TrackingParameters: {
            utm_source: "meta",
            utm_medium: "paid_social",
            utm_campaign: "LP | Dor | Teste 02",
            utm_content: "Dor V1",
            utm_term: "Amplo",
            src: "src-1",
            sck: "sck-1",
          },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "LP | Dor | Teste 02",
      utm_content: "Dor V1",
      utm_term: "Amplo",
      kiwify_src: "src-1",
      kiwify_sck: "sck-1",
    });
  });

  it("order_approved sem UTMs -> subscription criada normalmente, campos de atribuição null", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(oauthResponse()).mockResolvedValueOnce(saleResponse("order-sem-utm"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-sem-utm",
          Subscription: { id: "sub-sem-utm", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-sem-utm",
          TrackingParameters: {
            s1: null,
            s2: null,
            s3: null,
            sck: null,
            src: null,
            utm_term: null,
            utm_medium: null,
            utm_source: null,
            utm_content: null,
            utm_campaign: null,
          },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.utm_source ?? null).toBeNull();
    expect(subscriptions[0]?.utm_campaign ?? null).toBeNull();
    expect(subscriptions[0]?.kiwify_src ?? null).toBeNull();
  });

  it("payload sem TrackingParameters nenhum -> webhook não quebra, subscription criada normalmente", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(oauthResponse()).mockResolvedValueOnce(saleResponse("order-no-tracking"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    const response = await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-no-tracking",
          Subscription: { id: "sub-no-tracking", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-no-tracking",
          // TrackingParameters ausente de propósito
        })
      )
    );

    expect(response.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.utm_source ?? null).toBeNull();
  });

  it("renovação com TrackingParameters null NÃO apaga a atribuição first-touch original", async () => {
    const fetchMock = vi
      .fn()
      // Só 3 respostas, não 4: o token OAuth é cacheado em memória entre
      // chamadas (ver src/lib/billing/kiwifyApi.ts, cachedToken) — a 2ª
      // chamada a fetchKiwifySale dentro do mesmo teste não repete o OAuth.
      .mockResolvedValueOnce(oauthResponse())
      .mockResolvedValueOnce(saleResponse("order-approved-original"))
      .mockResolvedValueOnce(saleResponse("order-renewed-1"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");

    // 1) compra original, com UTM real.
    const first = await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-approved-original",
          Subscription: { id: "sub-renew-1", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-renew-1",
          TrackingParameters: { utm_source: "meta", utm_campaign: "LP | Dor | Teste 02", utm_content: "Dor V1" },
        })
      )
    );
    expect(first.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.utm_campaign).toBe("LP | Dor | Teste 02");

    // 2) renovação da MESMA assinatura, order_id novo, TrackingParameters
    // 100% null — igual ao que a Kiwify realmente devolveu nas vendas reais.
    const second = await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "subscription_renewed",
          order_id: "order-renewed-1",
          Subscription: { id: "sub-renew-1", status: "active", next_payment: "2026-10-22T00:00:00.000Z" },
          subscription_id: "sub-renew-1",
          TrackingParameters: {
            s1: null,
            s2: null,
            s3: null,
            sck: null,
            src: null,
            utm_term: null,
            utm_medium: null,
            utm_source: null,
            utm_content: null,
            utm_campaign: null,
          },
        })
      )
    );
    expect(second.status).toBe(200);
    expect(subscriptions).toHaveLength(1); // mesma linha, não duplicou
    expect(subscriptions[0]?.utm_campaign).toBe("LP | Dor | Teste 02"); // atribuição original intacta
    expect(subscriptions[0]?.utm_source).toBe("meta");
    expect(subscriptions[0]?.current_period_end).toBe("2026-10-22T00:00:00.000Z"); // ciclo avançou normalmente
  });

  it("evento posterior com UTMs DIFERENTES não sobrescreve o first-touch", async () => {
    const fetchMock = vi
      .fn()
      // Idem: token OAuth cacheado entre as duas chamadas neste teste.
      .mockResolvedValueOnce(oauthResponse())
      .mockResolvedValueOnce(saleResponse("order-first-touch"))
      .mockResolvedValueOnce(saleResponse("order-second-touch"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");

    await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-first-touch",
          Subscription: { id: "sub-first-touch", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-first-touch",
          TrackingParameters: { utm_source: "meta", utm_campaign: "Campanha Original" },
        })
      )
    );

    await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "subscription_renewed",
          order_id: "order-second-touch",
          Subscription: { id: "sub-first-touch", status: "active", next_payment: "2026-10-22T00:00:00.000Z" },
          subscription_id: "sub-first-touch",
          TrackingParameters: { utm_source: "google", utm_campaign: "Campanha Nova (deveria ser ignorada)" },
        })
      )
    );

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.utm_source).toBe("meta");
    expect(subscriptions[0]?.utm_campaign).toBe("Campanha Original");
  });

  it("caracteres especiais em campaign/content são preservados na subscription", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(oauthResponse()).mockResolvedValueOnce(saleResponse("order-utm-especial"));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/webhooks/kiwify/route");
    await POST(
      postRequest(
        wrappedOrder({
          webhook_event_type: "order_approved",
          order_id: "order-utm-especial",
          Subscription: { id: "sub-utm-especial", status: "active", next_payment: "2026-09-22T00:00:00.000Z" },
          subscription_id: "sub-utm-especial",
          TrackingParameters: {
            utm_campaign: "LP | Dor | Teste 02 (Ação!) ç/ã & 100%",
            utm_content: "Dor V1 — variação B",
          },
        })
      )
    );

    expect(subscriptions[0]?.utm_campaign).toBe("LP | Dor | Teste 02 (Ação!) ç/ã & 100%");
    expect(subscriptions[0]?.utm_content).toBe("Dor V1 — variação B");
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
