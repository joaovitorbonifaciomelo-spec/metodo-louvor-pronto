/**
 * Identidade do produto centralizada — trocar nome/tagline aqui, não espalhado pelo código.
 * Pode ser sobrescrito por env vars (NEXT_PUBLIC_PRODUCT_NAME / NEXT_PUBLIC_PRODUCT_TAGLINE).
 */
export const product = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || "Louvor Pronto",
  tagline: process.env.NEXT_PUBLIC_PRODUCT_TAGLINE || "Copiloto de Repertório",
} as const;

/**
 * Preço exibido na landing page (seção "Página de vendas"). Oferta única —
 * sem plano grátis, sem trial, sem anual ainda. Isto é só apresentação; a
 * cobrança real acontece via Kiwify (ver src/lib/config/billing.ts) e o
 * controle de acesso nunca depende deste valor.
 */
export const pricing = {
  displayPrice: "R$ 19,90",
  interval: "mês",
} as const;
