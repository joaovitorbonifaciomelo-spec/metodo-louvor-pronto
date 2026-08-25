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
 * Valores REAIS de `webhook_event_type` confirmados via inspeção de payload
 * de teste enviado pela própria Kiwify (não documentação, não suposição):
 *
 * - "order_approved"  -> compra aprovada (trigger "compra_aprovada")
 * - "billet_created"  -> boleto gerado (trigger "boleto_gerado") — informativo, não processamos
 *
 * Os outros 5 (reembolso, chargeback, assinatura cancelada/atrasada/renovada)
 * ainda NÃO foram observados — não adivinhar os nomes. Adicionar aqui só
 * depois de confirmar via um teste real na Kiwify (ver modo de inspeção).
 */
export const CONFIRMED_WEBHOOK_EVENT_TYPES = ["order_approved", "billet_created"] as const;

/**
 * Eventos que alteram o status de uma assinatura, chaveados pelo valor REAL
 * de `webhook_event_type` (confirmado acima) — não pelos nomes de trigger em
 * português. Só contém o que já foi observado; os demais ficam de fora de
 * propósito até serem confirmados (ver seção "outros 5 eventos").
 */
export const EVENT_TO_STATUS: Partial<Record<string, SubscriptionStatus>> = {
  order_approved: "active",
};

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
 * webhook de pedidos/assinaturas que estamos usando. O payload de teste real
 * que recebemos não teve esses headers relatados. Por isso NÃO implementamos
 * Ed25519 aqui — seria assumir que os dois produtos compartilham mecanismo,
 * o que não está confirmado. Antes de confiar nisso, confira no
 * `webhook_events` já gravado se os headers `x-kiwify-digital-signature` e
 * `x-kiwify-timestamp` realmente vieram na mesma entrega que teve
 * `?signature=` — se sim, o mecanismo Ed25519 pode se aplicar de verdade e
 * dá pra implementar; se não, o mecanismo da `signature` da query string
 * continua 100% NÃO CONFIRMADO.
 *
 * Enquanto isso não for resolvido, `isAuthentic` abaixo permanece incapaz de
 * validar de verdade (sempre nega) — o endpoint só aceita entregas reais hoje
 * através do modo de inspeção (`isInspectionMode`), que nunca concede acesso.
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
 * `webhook_event_type` é o campo REAL confirmado por inspeção (payload de
 * teste de "Compra aprovada" trouxe `webhook_event_type: "order_approved"`).
 * Priorizamos exatamente esse campo; os demais candidatos são só fallback de
 * compatibilidade (nunca observados na prática, mantidos por segurança caso
 * algum evento futuro venha num formato diferente). O corpo bruto é sempre
 * gravado em webhook_events.raw_payload, então nada se perde de qualquer forma.
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
}

function readString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/**
 * Extração dos campos do payload de `order_approved`, baseada na estrutura
 * REAL observada por inspeção (não mais suposição):
 *
 *   Product.product_id, Product.product_name
 *   Customer.email, Customer.full_name, Customer.first_name, Customer.mobile
 *   order_id, order_ref, order_status
 *   Subscription.id, Subscription.status, Subscription.start_date, Subscription.next_payment
 *   Subscription.plan.{id,name,frequency,qty_charges}
 *   subscription_id (fallback solto, fora de Subscription)
 *
 * `customerId`/`provider_customer_id`: a estrutura observada NÃO tem nenhum
 * campo de id de cliente (só email/nome/telefone) — por isso NUNCA inventamos
 * um a partir do e-mail; os candidatos abaixo (customer.id/customer_id) ficam
 * só para o caso de outro tipo de evento vir a trazer um id real, e resolvem
 * para null quando ausentes (nunca fabricam um valor).
 *
 * Os outros 5 eventos (reembolso, chargeback, cancelamento, atraso, renovação)
 * ainda não foram observados — esta função pode precisar de ajuste quando
 * confirmarmos a estrutura deles.
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
  };
}

function normalizeEmail(email: string | null): string | null {
  return email ? email.trim().toLowerCase() : null;
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
 * Chave de idempotência: preferimos o id do pedido (estável e único por
 * cobrança/evento na prática da Kiwify); sem ele, caímos para subscriptionId;
 * na ausência de qualquer id conhecido, não há como garantir idempotência
 * (retorna null e o chamador deve tratar como não-idempotente/registrar só o log).
 */
export function buildIdempotencyKey(eventType: string, info: ExtractedOrderInfo): string | null {
  const id = info.orderId ?? info.subscriptionId;
  return id ? `${eventType}:${id}` : null;
}
