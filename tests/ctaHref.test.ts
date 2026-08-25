import { describe, expect, it } from "vitest";
import { primaryCtaHref } from "@/lib/landing/cta-href";

describe("primaryCtaHref", () => {
  it("visitante anônimo -> /signup", () => {
    expect(primaryCtaHref({ loggedIn: false, granted: false })).toBe("/signup");
    expect(primaryCtaHref({ loggedIn: false, granted: true })).toBe("/signup");
  });

  it("logado sem assinatura ativa -> /assinar", () => {
    expect(primaryCtaHref({ loggedIn: true, granted: false })).toBe("/assinar");
  });

  it("logado com assinatura ativa -> /buscar", () => {
    expect(primaryCtaHref({ loggedIn: true, granted: true })).toBe("/buscar");
  });
});
