import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testa o endpoint de heartbeat diário fim-a-fim (autenticação via
 * CRON_SECRET + upsert em system_heartbeat), com um Supabase fake — mesmo
 * padrão de tests/kiwifyWebhookRoute.test.ts.
 */

let heartbeatRows: { id: number; last_seen: string }[] = [];
let upsertCallCount = 0;
let forceUpsertError = false;

function createFakeSupabase() {
  return {
    from(table: string) {
      if (table !== "system_heartbeat") throw new Error(`unexpected table ${table}`);
      return {
        upsert(payload: { id: number; last_seen: string }) {
          upsertCallCount += 1;
          if (forceUpsertError) {
            return Promise.resolve({ error: { message: "simulated Supabase failure" } });
          }
          const existing = heartbeatRows.find((r) => r.id === payload.id);
          if (existing) {
            existing.last_seen = payload.last_seen;
          } else {
            heartbeatRows.push({ ...payload });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createFakeSupabase(),
}));

function getRequest(authHeader?: string) {
  return new Request("https://app.example.com/api/cron/supabase-heartbeat", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/supabase-heartbeat", () => {
  beforeEach(() => {
    heartbeatRows = [];
    upsertCallCount = 0;
    forceUpsertError = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sem CRON_SECRET configurado no servidor -> 503, não executa upsert", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    const response = await GET(getRequest("Bearer qualquer-coisa"));
    expect(response.status).toBe(503);
    expect(upsertCallCount).toBe(0);
  });

  it("CRON_SECRET configurado mas header ausente/errado -> 401, não executa upsert", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-real");
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    const semHeader = await GET(getRequest());
    expect(semHeader.status).toBe(401);

    const headerErrado = await GET(getRequest("Bearer segredo-errado"));
    expect(headerErrado.status).toBe(401);

    expect(upsertCallCount).toBe(0);
  });

  it("CRON_SECRET correto -> executa o heartbeat e retorna { ok: true }", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-real");
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    const response = await GET(getRequest("Bearer segredo-real"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  it("Supabase funcionando -> atualiza last_seen da linha id=1", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-real");
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    await GET(getRequest("Bearer segredo-real"));
    expect(heartbeatRows).toHaveLength(1);
    expect(heartbeatRows[0]?.id).toBe(1);
    expect(heartbeatRows[0]?.last_seen).toEqual(expect.any(String));
  });

  it("segunda execução -> continua existindo somente a linha id=1 (upsert, não insert)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-real");
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    const first = await GET(getRequest("Bearer segredo-real"));
    const firstSeen = heartbeatRows[0]?.last_seen;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await GET(getRequest("Bearer segredo-real"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(heartbeatRows).toHaveLength(1); // nunca vira 2 linhas
    expect(heartbeatRows[0]?.id).toBe(1);
    expect(heartbeatRows[0]?.last_seen).not.toBe(firstSeen); // valor foi atualizado
  });

  it("Supabase com erro -> NÃO retorna falso sucesso (erro real, status != 200/ok)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-real");
    forceUpsertError = true;
    const { GET } = await import("@/app/api/cron/supabase-heartbeat/route");

    const response = await GET(getRequest("Bearer segredo-real"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok?: boolean; error?: string };
    expect(body.ok).not.toBe(true);
    expect(body.error).toBeTruthy();
  });
});
