import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Testa os helpers do Meta Pixel (src/lib/analytics/metaPixel.ts) — mesmo
 * padrão de tests/supabaseHeartbeat.test.ts: stub da env ANTES do import
 * dinâmico + reset de módulos entre casos, já que a config lê
 * process.env.NEXT_PUBLIC_META_PIXEL_ID no top-level do módulo.
 *
 * `globalThis` é tratado como Record<string, unknown> nos testes (em vez do
 * `Window` real do lib "dom") só para poder simular/limpar `window`/`document`
 * livremente em ambiente Node, sem afetar a tipagem do código de produção.
 */
const globalRecord = globalThis as unknown as Record<string, unknown>;

function clearBrowserGlobals() {
  delete globalRecord.window;
  delete globalRecord.document;
}

describe("metaPixel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    clearBrowserGlobals();
  });

  it("sem NEXT_PUBLIC_META_PIXEL_ID -> todas as funções são no-op, nunca lançam erro", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    const { initMetaPixel, trackMetaPageView, trackMetaEvent, trackMetaCustomEvent } = await import(
      "@/lib/analytics/metaPixel"
    );

    expect(() => initMetaPixel()).not.toThrow();
    expect(() => trackMetaPageView()).not.toThrow();
    expect(() => trackMetaEvent("Lead")).not.toThrow();
    expect(() => trackMetaCustomEvent("LandingCTA")).not.toThrow();
  });

  it("com pixel configurado mas sem `window` (SSR) -> não lança erro e não faz nada", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
    clearBrowserGlobals();
    const { initMetaPixel, trackMetaPageView, trackMetaEvent } = await import("@/lib/analytics/metaPixel");

    expect(() => initMetaPixel()).not.toThrow();
    expect(() => trackMetaPageView()).not.toThrow();
    expect(() => trackMetaEvent("CompleteRegistration")).not.toThrow();
  });

  it("com pixel configurado e browser simulado -> injeta o script uma única vez e enfileira init + PageView", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");

    const appendedScripts: unknown[] = [];
    globalRecord.document = {
      createElement: () => ({}),
      head: { appendChild: (el: unknown) => appendedScripts.push(el) },
    };
    globalRecord.window = {};

    const { initMetaPixel } = await import("@/lib/analytics/metaPixel");

    initMetaPixel();
    initMetaPixel(); // segunda chamada não deve reinjetar o script nem duplicar o PageView

    expect(appendedScripts).toHaveLength(1);
    const win = globalRecord.window as { fbq?: { queue?: unknown[][] } };
    expect(win.fbq).toBeDefined();
    expect(win.fbq?.queue).toEqual([
      ["init", "123456789"],
      ["track", "PageView"],
    ]);
  });
});
