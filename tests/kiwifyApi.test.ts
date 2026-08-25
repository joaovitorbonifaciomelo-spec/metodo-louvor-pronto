import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cada teste importa o módulo de novo (vi.resetModules) porque
 * src/lib/billing/kiwifyApi.ts guarda o token OAuth em cache num módulo-level
 * `let` — sem isolar, um teste vazaria o token cacheado para o próximo.
 */
async function loadModule() {
  vi.resetModules();
  return import("@/lib/billing/kiwifyApi");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("isKiwifyApiConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("false quando falta qualquer uma das 3 credenciais", async () => {
    vi.stubEnv("KIWIFY_API_CLIENT_ID", "client-id");
    vi.stubEnv("KIWIFY_API_CLIENT_SECRET", "");
    vi.stubEnv("KIWIFY_API_ACCOUNT_ID", "account-id");
    const { isKiwifyApiConfigured } = await loadModule();
    expect(isKiwifyApiConfigured()).toBe(false);
  });

  it("true quando as 3 credenciais estão presentes", async () => {
    vi.stubEnv("KIWIFY_API_CLIENT_ID", "client-id");
    vi.stubEnv("KIWIFY_API_CLIENT_SECRET", "client-secret");
    vi.stubEnv("KIWIFY_API_ACCOUNT_ID", "account-id");
    const { isKiwifyApiConfigured } = await loadModule();
    expect(isKiwifyApiConfigured()).toBe(true);
  });
});

describe("fetchKiwifySale (verificação server-to-server)", () => {
  beforeEach(() => {
    vi.stubEnv("KIWIFY_API_CLIENT_ID", "client-id");
    vi.stubEnv("KIWIFY_API_CLIENT_SECRET", "client-secret");
    vi.stubEnv("KIWIFY_API_ACCOUNT_ID", "account-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retorna null sem chamar a rede quando credenciais não estão configuradas", async () => {
    vi.unstubAllEnvs(); // remove as credenciais do beforeEach
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    const result = await fetchKiwifySale("order-1");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna a venda verificada em caso de sucesso (200)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", token_type: "Bearer", expires_in: 86400 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-1",
          status: "paid",
          product: { id: "prod-fake-1" },
          customer: { email: "Teste@Exemplo.com" },
          refunded_at: null,
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    const sale = await fetchKiwifySale("order-1");
    expect(sale).toEqual({
      id: "order-1",
      status: "paid",
      productId: "prod-fake-1",
      customerEmail: "teste@exemplo.com",
      refundedAt: null,
    });
  });

  it("retorna null (não confirmado) quando a API responde erro para o order_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    const sale = await fetchKiwifySale("order-inexistente");
    expect(sale).toBeNull();
  });

  it("API da Kiwify fora do ar (rede falha): propaga o erro, nunca retorna uma venda falsa", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    await expect(fetchKiwifySale("order-1")).rejects.toThrow("network down");
  });

  it("token OAuth indisponível (API fora do ar na etapa de auth): propaga o erro, nunca segue para consultar a venda", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("service unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    await expect(fetchKiwifySale("order-1")).rejects.toThrow(/Falha ao gerar token OAuth/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // nunca chegou a chamar /v1/sales
  });

  it("nunca inclui client_id/client_secret na URL ou nos headers da chamada de vendas", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-secreto-nao-pode-vazar", expires_in: 86400 }))
      .mockResolvedValueOnce(jsonResponse({ id: "order-1", status: "paid", product: { id: "prod-1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    await fetchKiwifySale("order-1");

    const salesCall = fetchMock.mock.calls[1];
    const [url, init] = salesCall as [string, RequestInit];
    expect(url).not.toContain("client-secret");
    expect(url).not.toContain("client_secret");
    expect(JSON.stringify(init.headers)).not.toContain("client-secret");
  });

  it("reaproveita o token OAuth em cache — não gera um novo token a cada consulta", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "tok-123", expires_in: 86400 }))
      .mockResolvedValueOnce(jsonResponse({ id: "order-1", status: "paid", product: { id: "prod-1" } }))
      .mockResolvedValueOnce(jsonResponse({ id: "order-2", status: "paid", product: { id: "prod-1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchKiwifySale } = await loadModule();

    await fetchKiwifySale("order-1");
    await fetchKiwifySale("order-2");

    // 1 chamada de token + 2 chamadas de vendas = 3, não 4 (token não foi gerado de novo).
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
