/**
 * Identidade do produto centralizada — trocar nome/tagline aqui, não espalhado pelo código.
 * Pode ser sobrescrito por env vars (NEXT_PUBLIC_PRODUCT_NAME / NEXT_PUBLIC_PRODUCT_TAGLINE).
 */
export const product = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || "Louvor Pronto",
  tagline: process.env.NEXT_PUBLIC_PRODUCT_TAGLINE || "Copiloto de Repertório",
} as const;
