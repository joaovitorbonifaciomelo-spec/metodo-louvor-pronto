import { afterEach, describe, expect, it } from "vitest";
import { captureUtmOnLanding } from "@/lib/marketing/utmClient";

/**
 * Simula document.cookie em ambiente Node (vitest environment: "node", sem
 * DOM) com um getter/setter que reproduz o comportamento real do browser:
 * atribuir "nome=valor" insere/atualiza só aquele cookie, sem apagar os
 * outros, e o getter devolve todos concatenados com "; ".
 */
function installFakeCookieJar() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return Array.from(store.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");
      },
      set cookie(nameValueAndAttrs: string) {
        const pair = nameValueAndAttrs.split(";")[0] ?? "";
        const eq = pair.indexOf("=");
        store.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      },
    },
  });
  return store;
}

function clearDocumentGlobal() {
  delete (globalThis as unknown as { document?: unknown }).document;
}

describe("captureUtmOnLanding", () => {
  afterEach(() => {
    clearDocumentGlobal();
  });

  it("primeira visita com UTMs válidos -> grava o cookie de atribuição", () => {
    installFakeCookieJar();
    captureUtmOnLanding(new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=lancamento"));

    expect(document.cookie).toContain("lp_utm=");
    const raw = decodeURIComponent(document.cookie.split("lp_utm=")[1] ?? "");
    expect(JSON.parse(raw)).toEqual({ utm_source: "google", utm_medium: "cpc", utm_campaign: "lancamento" });
  });

  it("first-touch: uma segunda origem paga não sobrescreve a primeira já capturada", () => {
    installFakeCookieJar();
    captureUtmOnLanding(new URLSearchParams("utm_source=google&utm_medium=cpc"));
    captureUtmOnLanding(new URLSearchParams("utm_source=facebook&utm_medium=paid-social&fbclid=xyz"));

    const raw = decodeURIComponent(document.cookie.split("lp_utm=")[1] ?? "");
    expect(JSON.parse(raw)).toEqual({ utm_source: "google", utm_medium: "cpc" });
  });

  it("landing sem UTMs -> não grava cookie nenhum", () => {
    installFakeCookieJar();
    captureUtmOnLanding(new URLSearchParams(""));
    expect(document.cookie).toBe("");
  });

  it("preserva caracteres especiais nos valores capturados", () => {
    installFakeCookieJar();
    captureUtmOnLanding(new URLSearchParams({ utm_campaign: "Ação Julho/2026 100% off & grátis" }));

    const raw = decodeURIComponent(document.cookie.split("lp_utm=")[1] ?? "");
    expect(JSON.parse(raw)).toEqual({ utm_campaign: "Ação Julho/2026 100% off & grátis" });
  });

  it("sem `document` (SSR) -> não lança erro e não faz nada", () => {
    clearDocumentGlobal();
    expect(() => captureUtmOnLanding(new URLSearchParams("utm_source=google"))).not.toThrow();
  });
});
