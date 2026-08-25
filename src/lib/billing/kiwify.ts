import type { SubscriptionStatus } from "@/types/database";

/**
 * Nomes de TRIGGER usados ao CADASTRAR o webhook no painel/API da Kiwify
 * (documentação oficial: https://docs.kiwify.com.br/api-reference/webhooks/create).
 * IMPORTANTE — confirmado via inspeção real (payload de teste da própria
 * Kiwify): este vocabulário em português (compra_aprovada, chargeback, ...)
 * NÃO é o mesmo que o campo `webhook_event_type` que chega no corpo de cada
 * evento entregue. Ex.: o trigger "compra_aprovada" entrega um payload com
 * `webhook_event_type: "order_approved"`, e "boleto_gerado" entrega
 * `webhook_event_type: "billet_created"`. Esta lista serve só para saber quais
 * caixinhas marcar ao criar o webhook — NÃO usar para decidir o que fazer com
 * um evento recebido (ver CONFIRMED_WEBHOOK_EVENT_TYPES/EVENT_TO_STATUS abaixo).
 */
export const KIWIFY_WEBHOOK_TRIGGERS = [
  "boleto_gerado",
  "pix_gerado",
  "carrinho_abandonado",
  "compra_recusada",
  "compra_aprovada",
  "compra_reembolsada",
  "chargeback",
  "subscription_canceled",
  "subscription_late",
  "subscription_renewed",
] as const;

export type KiwifyWebhookTrigger = (typeof KIWIFY_WEBHOOK_TRIGGERS)[number];

/** @deprecated use KIWIFY_WEBHOOK_TRIGGERS — mantido só para não quebrar código antigo. */
export const KIWIFY_EVENTS = KIWIFY_WEBHOOK_TRIGGERS;
/** @deprecated use KiwifyWebhookTrigger. */
export type KiwifyEvent = KiwifyWebhookTrigger;

export function isKiwifyEvent(value: unknown): value is KiwifyWebhookTrigger {
  return typeof value === "string" && (KIWIFY_WEBHOOK_TRIGGERS as readonly string[]).includes(value);
}

/**
 * Valores REAIS de `webhook_event_type` — todos os 6 relevantes para
 * assinatura já foram confirmados via inspeção de payloads de teste enviados
 * pela própria Kiwify (não documentação, não suposição):
 *
 * - "order_approved"        -> compra aprovada (trigger "compra_aprovada")
 * - "subscription_renewed"  -> assinatura renovada (trigger "subscription_renewed")
 * - "subscription_late"     -> assinatura atrasada (trigger "subscription_late")
 * - "subscription_canceled" -> assinatura cancelada (trigger "subscription_canceled")
 * - "order_refunded"        -> reembolso (trigger "compra_reembolsada")
 * - "chargeback"            -> chargeback (trigger "chargeback")
 * - "billet_created"        -> boleto gerado (trigger "boleto_gerado") — informativo, não processamos
 */
export const CONFIRMED_WEBHOOK_EVENT_TYPES = [
  "order_approved",
  "subscription_renewed",
  "subscription_late",
  "subscription_canceled",
  "order_refunded",
  "chargeback",
  "billet_created",
] as const;

/**
 * Eventos que alteram o status de uma assinatura, chaveados pelo valor REAL
 * de `webhook_event_type` — não pelos nomes de trigger em português, e NUNCA
 * por `Subscription.status` (ver ressalva importante abaixo). Todos
 * confirmados via inspeção real; nenhum é suposição.
 *
 * IMPORTANTE — `Subscription.status` NÃO É CONFIÁVEL para decidir a transição
 * comercial. Payloads de teste reais mostraram:
 *   - `chargeback` chegou com `Subscription.status: "active"` (mesmo assim o
 *     resultado tem que ser "chargeback", nunca "active");
 *   - `order_refunded` chegou com `Subscription.status: "canceled"` (mesmo
 *     assim o resultado tem que ser "refunded", nunca "canceled").
 * Por isso `applySubscriptionEvent` usa SOMENTE `webhook_event_type` +
 * validação server-to-server (ver `validateSaleForEvent` abaixo) —
 * `Subscription.status` do corpo do webhook é guardado só como dado
 * informativo (`subscriptionStatus` no retorno de `parseKiwifyWebhook`).
 *
 * `subscription_canceled` NÃO está aqui de propósito (hardening de MVP): a
 * API de Vendas não tem um jeito confirmado de atestar "esta assinatura foi
 * cancelada" (o `status` de uma venda é do PEDIDO, não da assinatura — um
 * pedido de uma assinatura cancelada pode continuar mostrando "paid"). Sem
 * uma forma confiável de confirmar esse evento fora do próprio webhook (que
 * ainda não tem autenticação confirmada), um POST não autenticado de
 * `subscription_canceled` NUNCA deve conseguir revogar acesso sozinho. O
 * usuário perde acesso naturalmente quando `current_period_end` expirar sem
 * uma renovação confirmada (ver `getSubscriptionAccessStatus` em access.ts —
 * "active" já nega acesso automaticamente após o período expirar).
 */
export const EVENT_TO_STATUS: Partial<Record<string, SubscriptionStatus>> = {
  order_approved: "active",
  subscription_renewed: "active",
  subscription_late: "past_due",
  order_refunded: "refunded",
  chargeback: "chargeback",
};

/** Único ponto de tradução evento -> status — nunca repetir EVENT_TO_STATUS[x] em outro lugar. */
export function mapKiwifyEventToSubscriptionStatus(eventType: string): SubscriptionStatus | null {
  return EVENT_TO_STATUS[eventType] ?? null;
}

/**
 * Extrai o token de autenticação da requisição recebida.
 *
 * ATUALIZADO após inspeção real: a Kiwify chama o endpoint com
 * `?signature=<hex>` na query string — NÃO `?token=...` como assumíamos antes.
 * PORÉM ainda NÃO SABEMOS como essa signature é calculada nem se ela tem
 * qualquer relação com o "Token" mostrado no painel da Kiwify — são
 * claramente coisas diferentes (formatos diferentes) e não presumimos
 * `signature === token`.
 *
 * A Kiwify documenta publicamente um mecanismo de assinatura Ed25519 via
 * headers `x-kiwify-digital-signature` + `x-kiwify-timestamp`
 * (https://docs.kiwify.com.br/api-reference/banking/webhook-headers), mas
 * essa página está sob "Banking" (produto de PIX/boleto — o exemplo de URL
 * usado lá é literalmente "/webhooks/kiwibank"), um produto diferente do
 * webhook de pedidos/assinaturas que estamos usando.
 *
 * CONFIRMADO (não mais suspeita) inspecionando os headers reais dos 6 eventos
 * de teste recebidos: `x-kiwify-digital-signature` e `x-kiwify-timestamp`
 * NUNCA vieram em nenhuma entrega — só existe o `?signature=` na query
 * string. Ou seja, o mecanismo Ed25519 do produto Banking NÃO se aplica aqui.
 *
 * Também pesquisamos uma referência de terceiro (documentação de um produto
 * de automação, não da própria Kiwify) citando "SHA-1" para esse parâmetro —
 * mas sem especificar o que é hasheado, em que ordem, nem qual segredo é
 * usado. Isso NÃO é uma confirmação oficial da Kiwify, então NÃO
 * implementamos SHA-1/HMAC algum a partir disso (seria inventar o algoritmo
 * exato, o que foi explicitamente pedido para não fazer).
 *
 * RESULTADO: o mecanismo de cálculo de `signature` permanece 100% NÃO
 * CONFIRMADO. `isAuthentic` abaixo permanece incapaz de validar de verdade
 * (sempre nega) — o endpoint só aceita entregas reais hoje através do modo de
 * inspeção (`isInspectionMode`), que nunca concede acesso.
 */
export function extractToken(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("token") ?? request.headers.get("x-kiwify-token");
}

/** Valor cru do parâmetro `signature` observado na query string real da Kiwify. */
export function extractSignature(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("signature");
}

export function isAuthentic(request: Request): boolean {
  const expected = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!expected) return false;
  const received = extractToken(request);
  return Boolean(received) && received === expected;
}

/**
 * Modo de inspeção temporário: ativado manualmente via env var só durante o
 * teste real do webhook na Kiwify. Existe porque a documentação pública da
 * Kiwify não especifica como o token chega na requisição (query string?
 * header? outro?) — em vez de adivinhar, este modo registra a entrega
 * completa (headers + query + body) para descobrirmos o mecanismo real antes
 * de ativar a verificação. NUNCA concede acesso a assinatura nenhuma — ver
 * uso em src/app/api/webhooks/kiwify/route.ts.
 */
export function isInspectionMode(): boolean {
  return process.env.KIWIFY_WEBHOOK_INSPECT === "true";
}

/** Nomes de header que nunca devem ser gravados, mesmo em modo de inspeção. */
const REDACTED_HEADER_NAMES = new Set(["cookie"]);

export function captureHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    const name = key.toLowerCase();
    headers[name] = REDACTED_HEADER_NAMES.has(name) ? "[redacted]" : value;
  }
  return headers;
}

export interface InspectionRecord {
  inspection: true;
  method: string;
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  bodyRaw: string;
  bodyParsed: unknown;
}

/**
 * Monta o registro de inspeção a partir da requisição crua — não assume JSON
 * (a Kiwify também pode enviar outro content-type; se o parse falhar,
 * `bodyParsed` fica null mas `bodyRaw` preserva tudo).
 */
export function buildInspectionRecord(request: Request, rawText: string): InspectionRecord {
  const url = new URL(request.url);
  let bodyParsed: unknown = null;
  try {
    bodyParsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    bodyParsed = null;
  }

  return {
    inspection: true,
    method: request.method,
    url: request.url,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: captureHeaders(request),
    bodyRaw: rawText,
    bodyParsed,
  };
}

/**
 * `webhook_event_type` é o campo REAL confirmado por inspeção — presente e
 * confiável em todos os 6 eventos de assinatura observados (order_approved,
 * subscription_renewed, subscription_late, subscription_canceled,
 * order_refunded, chargeback). Priorizamos exatamente esse campo; os demais
 * candidatos são só fallback de compatibilidade (nunca observados na
 * prática). O corpo bruto é sempre gravado em webhook_events.raw_payload,
 * então nada se perde de qualquer forma.
 */
export function extractEventType(body: Record<string, unknown>): string | null {
  const candidate =
    body.webhook_event_type ?? body.event ?? body.trigger ?? body.event_type ?? body.order_status ?? null;
  return typeof candidate === "string" ? candidate : null;
}

interface ExtractedOrderInfo {
  orderId: string | null;
  subscriptionId: string | null;
  productId: string | null;
  customerId: string | null;
  customerEmail: string | null;
  subscriptionStatus: string | null;
  startedAt: string | null;
  periodEnd: string | null;
  eventOccurredAt: string | null;
}

function readString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/**
 * Extração dos campos de payload, baseada na estrutura REAL confirmada por
 * inspeção — idêntica nos 6 eventos de assinatura observados:
 *
 *   Product.product_id, Product.product_name
 *   Customer.email, Customer.full_name, Customer.first_name, Customer.mobile
 *   order_id, order_ref, order_status
 *   Subscription.id, Subscription.status, Subscription.start_date, Subscription.next_payment
 *   Subscription.plan.{id,name,frequency,qty_charges}
 *   subscription_id (fallback solto, fora de Subscription — sempre igual a Subscription.id)
 *   created_at, updated_at (nível raiz, formato "YYYY-MM-DD HH:mm", sem timezone)
 *
 * `subscriptionStatus` (Subscription.status) é só INFORMATIVO — nunca usado
 * para decidir a transição comercial (ver EVENT_TO_STATUS acima).
 *
 * `customerId`/`provider_customer_id`: a estrutura observada NÃO tem nenhum
 * campo de id de cliente em NENHUM dos 6 eventos (só email/nome/telefone) —
 * por isso NUNCA inventamos um a partir do e-mail; os candidatos abaixo
 * (customer.id/customer_id) resolvem para null quando ausentes, nunca
 * fabricam um valor.
 */
export function extractOrderInfo(body: Record<string, unknown>): ExtractedOrderInfo {
  const customer = (body.Customer ?? body.customer ?? {}) as Record<string, unknown>;
  const subscription = (body.Subscription ?? body.subscription ?? {}) as Record<string, unknown>;
  const product = (body.Product ?? body.product ?? {}) as Record<string, unknown>;

  return {
    orderId: readString(body.order_id, body.id),
    subscriptionId: readString(subscription.id, body.subscription_id),
    productId: readString(product.product_id, product.id, body.product_id),
    customerId: readString(customer.id, customer.customer_id, body.customer_id),
    customerEmail: normalizeEmail(readString(customer.email, body.customer_email, body.email)),
    subscriptionStatus: readString(subscription.status),
    startedAt: readString(subscription.start_date, body.approved_date, body.created_at),
    periodEnd: readString(
      subscription.next_payment,
      subscription.current_period_end,
      body.current_period_end,
      body.next_payment
    ),
    // Quando a Kiwify gerou/atualizou este evento — real (created_at/updated_at
    // de nível raiz), usado como carimbo de tempo do evento (ex.: past_due_since)
    // quando não há um campo mais específico para isso.
    eventOccurredAt: readString(body.updated_at, body.created_at),
  };
}

function normalizeEmail(email: string | null): string | null {
  return email ? email.trim().toLowerCase() : null;
}

export interface ParsedKiwifyWebhook {
  eventType: string;
  orderId: string | null;
  subscriptionId: string | null;
  productId: string | null;
  customerId: string | null;
  customerEmail: string | null;
  /** Subscription.status — informativo; NUNCA usar para decidir status (ver EVENT_TO_STATUS). */
  subscriptionStatus: string | null;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  eventOccurredAt: string | null;
}

/**
 * Parser central único do webhook da Kiwify — todo o resto do código (rota,
 * testes) deve passar por aqui em vez de chamar extractEventType/
 * extractOrderInfo separadamente ou espalhar nomes de campo/evento pelo
 * projeto. Combina `webhook_event_type` (autoritativo para a transição
 * comercial) com os demais campos confirmados por inspeção real.
 */
export function parseKiwifyWebhook(body: Record<string, unknown>): ParsedKiwifyWebhook {
  const eventType = extractEventType(body) ?? "unknown";
  const info = extractOrderInfo(body);
  return {
    eventType,
    orderId: info.orderId,
    subscriptionId: info.subscriptionId,
    productId: info.productId,
    customerId: info.customerId,
    customerEmail: info.customerEmail,
    subscriptionStatus: info.subscriptionStatus,
    startedAt: info.startedAt,
    currentPeriodEnd: info.periodEnd,
    eventOccurredAt: info.eventOccurredAt,
  };
}

/**
 * Validação de produto (seção "Product validation"): não queremos que
 * qualquer produto da conta Kiwify libere este SaaS — só o produto
 * configurado em KIWIFY_PRODUCT_ID. Falha FECHADO: sem a env var configurada,
 * nenhum produto é considerado válido (nunca libera acesso "por omissão").
 * NUNCA usar o product_id de um payload de teste como valor de configuração.
 */
export function getConfiguredKiwifyProductId(): string | null {
  return process.env.KIWIFY_PRODUCT_ID || null;
}

export function isAllowedKiwifyProduct(productId: string | null): boolean {
  const configured = getConfiguredKiwifyProductId();
  if (!configured) return false;
  return productId === configured;
}

/**
 * Encontra, numa lista de usuários (ex.: retorno de supabase.auth.admin.listUsers),
 * o id daquele cujo e-mail bate com o e-mail do comprador — nunca cria usuário,
 * só localiza um já existente. Função pura para ser testável sem tocar no
 * Supabase de verdade (a chamada real fica em route.ts).
 */
export function matchUserIdByEmail(
  users: { id: string; email?: string | null }[],
  email: string | null
): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const match = users.find((u) => u.email?.toLowerCase() === normalized);
  return match?.id ?? null;
}

/**
 * Chave de idempotência: eventType + order_id (cada cobrança/evento real
 * confirmado por inspeção sempre trouxe um order_id próprio — inclusive
 * `subscription_renewed`, que gera um order_id NOVO a cada renovação). Por
 * isso order_id, não subscriptionId, é o identificador preferido: usar só
 * `eventType + subscriptionId` faria duas renovações distintas da MESMA
 * assinatura colidirem na mesma chave (subscriptionId não muda entre
 * renovações), tratando incorretamente a segunda como duplicata da primeira.
 * Sem order_id, caímos para subscriptionId (idempotência mais fraca, mas
 * ainda evita duplicar um mesmo evento reenviado); sem nenhum id conhecido,
 * retorna null e o chamador trata como não-idempotente (só loga).
 */
export function buildIdempotencyKey(parsed: Pick<ParsedKiwifyWebhook, "eventType" | "orderId" | "subscriptionId">): string | null {
  const id = parsed.orderId ?? parsed.subscriptionId;
  return id ? `${parsed.eventType}:${id}` : null;
}

/**
 * Dados de uma venda vindos diretamente da API oficial da Kiwify (fonte de
 * verdade) — mesmo shape de `KiwifySale` em kiwifyApi.ts, redeclarado aqui só
 * como tipo para não criar dependência de runtime entre os dois módulos.
 */
export interface VerifiedKiwifySale {
  id: string;
  status: string | null;
  productId: string | null;
  customerEmail: string | null;
  refundedAt: string | null;
}

export interface SaleValidationResult {
  valid: boolean;
  /** Motivo legível para log — nunca exposto ao chamador do webhook. */
  reason: string;
}

/**
 * Validação cruzada final antes de tocar em `subscriptions` — o núcleo do
 * hardening: order_id NÃO é segredo (alguém pode conhecer um order_id real
 * sem ter feito a compra), então "a venda existe" sozinho não é suficiente.
 * Exige que MÚLTIPLOS campos retornados PELA API (nunca os que vieram no
 * corpo do webhook) concordem entre si:
 *
 *   1. sale.id bate exatamente com o order_id do webhook (defesa extra —
 *      já é a chave de busca, mas confirmamos mesmo assim);
 *   2. sale.productId corresponde a KIWIFY_PRODUCT_ID;
 *   3. sale.customerEmail (normalizado) bate com o Customer.email do webhook
 *      (normalizado) — impede que alguém que conhece um order_id real de
 *      OUTRA pessoa direcione o acesso para a própria conta;
 *   4. o status oficial da venda é consistente com o evento alegado.
 *
 * Qualquer divergência = inválido. `subscription_canceled` nunca chega aqui
 * porque nem está em EVENT_TO_STATUS (ver comentário lá).
 */
export function validateSaleForEvent(
  eventType: string,
  parsed: Pick<ParsedKiwifyWebhook, "orderId" | "customerEmail">,
  sale: VerifiedKiwifySale
): SaleValidationResult {
  if (sale.id !== parsed.orderId) {
    return { valid: false, reason: `sale.id retornado ("${sale.id}") não bate com o order_id do webhook ("${parsed.orderId}")` };
  }

  if (!isAllowedKiwifyProduct(sale.productId)) {
    return { valid: false, reason: `product_id da venda ("${sale.productId}") não corresponde a KIWIFY_PRODUCT_ID` };
  }

  if (!sale.customerEmail || !parsed.customerEmail || sale.customerEmail !== parsed.customerEmail) {
    return {
      valid: false,
      reason: `e-mail retornado pela API ("${sale.customerEmail}") não bate com o e-mail do webhook ("${parsed.customerEmail}")`,
    };
  }

  switch (eventType) {
    case "order_approved":
    case "subscription_renewed":
      // "paid" é o único valor confirmado (documentação oficial + payloads
      // reais) para uma venda aprovada/paga.
      return sale.status === "paid"
        ? { valid: true, reason: "status da venda confirma pagamento (paid)" }
        : { valid: false, reason: `status da venda ("${sale.status}") não é "paid"` };

    case "order_refunded":
      // Confirmado nos payloads reais: order_status "refunded" para reembolso.
      // refunded_at preenchido é corroboração adicional (também no schema oficial).
      return sale.status === "refunded" || Boolean(sale.refundedAt)
        ? { valid: true, reason: "status/refunded_at da venda confirmam reembolso" }
        : { valid: false, reason: `venda não confirma reembolso (status="${sale.status}", refunded_at="${sale.refundedAt}")` };

    case "chargeback":
      // Confirmado no payload real: order_status "chargedback" para chargeback.
      return sale.status === "chargedback"
        ? { valid: true, reason: "status da venda confirma chargeback (chargedback)" }
        : { valid: false, reason: `status da venda ("${sale.status}") não confirma chargeback` };

    case "subscription_late":
      // A API de Vendas não expõe "waiting_payment" (esse é um status de
      // ASSINATURA, não de venda/pedido, e não há endpoint oficial de
      // assinatura). Melhor esforço documentado: só aceitamos se o status da
      // venda associada NÃO for "paid" — isto é, algo saiu diferente do
      // fluxo normal de pagamento aprovado. Se vier "paid" mesmo assim
      // (evento inconsistente), falha fechado.
      return sale.status && sale.status !== "paid"
        ? { valid: true, reason: `status da venda ("${sale.status}") indica cobrança não concluída — compatível com atraso` }
        : { valid: false, reason: `status da venda ("${sale.status}") não confirma cobrança em atraso` };

    default:
      return { valid: false, reason: `evento "${eventType}" não tem regra de validação server-to-server definida` };
  }
}
