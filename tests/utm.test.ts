import { describe, expect, it } from "vitest";
import {
  appendUtmToUrl,
  hasAnyUtm,
  parseUtmCookie,
  parseUtmFromSearchParams,
  serializeUtmCookie,
} from "@/lib/marketing/utm";

describe("parseUtmFromSearchParams", () => {
  it("extrai só os campos reconhecidos, ignorando outros parâmetros da URL", () => {
    const params = new URLSearchParams(
      "utm_source=google&utm_medium=cpc&utm_campaign=lancamento&fbclid=abc123&outro=lixo&email=teste@x.com"
    );
    expect(parseUtmFromSearchParams(params)).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "lancamento",
      fbclid: "abc123",
    });
  });

  it("descarta valores vazios e faz trim", () => {
    const params = new URLSearchParams("utm_source=  &utm_medium=%20cpc%20");
    expect(parseUtmFromSearchParams(params)).toEqual({ utm_medium: "cpc" });
  });

  it("URL sem nenhum UTM/fbclid -> objeto vazio", () => {
    expect(parseUtmFromSearchParams(new URLSearchParams("foo=bar"))).toEqual({});
  });

  it("trunca valores absurdamente longos", () => {
    const long = "a".repeat(500);
    const result = parseUtmFromSearchParams(new URLSearchParams(`utm_source=${long}`));
    expect(result.utm_source?.length).toBe(200);
  });
});

describe("hasAnyUtm", () => {
  it("true quando há pelo menos um campo", () => {
    expect(hasAnyUtm({ utm_source: "google" })).toBe(true);
    expect(hasAnyUtm({ fbclid: "abc" })).toBe(true);
  });

  it("false para objeto vazio", () => {
    expect(hasAnyUtm({})).toBe(false);
  });
});

describe("serializeUtmCookie / parseUtmCookie", () => {
  it("round-trip preserva os dados", () => {
    const data = { utm_source: "google", utm_medium: "cpc", fbclid: "abc123" };
    expect(parseUtmCookie(serializeUtmCookie(data))).toEqual(data);
  });

  it("valor ausente/corrompido -> objeto vazio, nunca lança erro", () => {
    expect(parseUtmCookie(undefined)).toEqual({});
    expect(parseUtmCookie(null)).toEqual({});
    expect(parseUtmCookie("")).toEqual({});
    expect(() => parseUtmCookie("{isso não é json")).not.toThrow();
    expect(parseUtmCookie("{isso não é json")).toEqual({});
    expect(parseUtmCookie('"uma string qualquer"')).toEqual({});
    expect(parseUtmCookie("[1,2,3]")).toEqual({});
  });

  it("ignora chaves desconhecidas/campos não-string dentro do JSON", () => {
    expect(parseUtmCookie('{"utm_source":"google","lixo":"x","utm_medium":123}')).toEqual({
      utm_source: "google",
    });
  });
});

describe("appendUtmToUrl", () => {
  it("acrescenta só os parâmetros presentes, preservando os já existentes na URL", () => {
    const url = new URL("https://pay.kiwify.com.br/abc123?email=ja%40existe.com");
    appendUtmToUrl(url, { utm_source: "google", utm_medium: "cpc" });
    expect(url.searchParams.get("email")).toBe("ja@existe.com");
    expect(url.searchParams.get("utm_source")).toBe("google");
    expect(url.searchParams.get("utm_medium")).toBe("cpc");
    expect(url.searchParams.get("utm_campaign")).toBeNull();
  });

  it("não altera a URL quando não há UTMs", () => {
    const url = new URL("https://pay.kiwify.com.br/abc123");
    appendUtmToUrl(url, {});
    expect(url.toString()).toBe("https://pay.kiwify.com.br/abc123");
  });

  it("faz URL-encoding correto de caracteres especiais", () => {
    const url = new URL("https://pay.kiwify.com.br/abc123");
    appendUtmToUrl(url, { utm_campaign: "Ação Julho/2026 100% off & grátis" });
    expect(url.searchParams.get("utm_campaign")).toBe("Ação Julho/2026 100% off & grátis");
    expect(url.toString()).toContain("utm_campaign=");
    expect(url.toString()).not.toContain(" ");
  });
});
