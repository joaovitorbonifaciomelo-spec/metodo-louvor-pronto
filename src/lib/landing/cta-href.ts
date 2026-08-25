export interface CtaAccessState {
  /** Há uma sessão logada (independente de ter assinatura ativa). */
  loggedIn: boolean;
  /** Assinatura ativa (ou bypass admin/dev) — mesmo valor de access.granted. */
  granted: boolean;
}

/**
 * Único lugar que decide para onde os CTAs de conversão da landing apontam.
 * Nunca linkar direto para KIWIFY_CHECKOUT_URL aqui — isso é responsabilidade
 * exclusiva de /assinar (ver src/lib/config/billing.ts).
 */
export function primaryCtaHref({ loggedIn, granted }: CtaAccessState): string {
  if (!loggedIn) return "/signup";
  return granted ? "/buscar" : "/assinar";
}
