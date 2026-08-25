/**
 * Configuração comercial centralizada (seção "Preparar futuro billing"). Nenhum
 * preço é fixado no código — decisão de negócio ainda em aberto. Provider
 * inicial é a Kiwify, mas o restante do código não assume isso: troque aqui.
 */
export const BILLING_PROVIDER = "kiwify" as const;

/** URL do checkout já configurado na Kiwify. Nula até existir — nunca inventar uma. */
export const KIWIFY_CHECKOUT_URL = process.env.KIWIFY_CHECKOUT_URL || null;

/**
 * Portal oficial da Kiwify para o assinante gerenciar/cancelar a própria
 * assinatura (seção "usuário que cancela"). Sem sistema financeiro próprio.
 */
export const KIWIFY_CUSTOMER_PORTAL_URL = process.env.KIWIFY_CUSTOMER_PORTAL_URL || null;

export const BILLING_CONFIGURED = Boolean(KIWIFY_CHECKOUT_URL);
