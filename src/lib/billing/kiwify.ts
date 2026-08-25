import type { SubscriptionStatus } from "@/types/database";

/**
 * Nomes de evento REAIS da Kiwify (documentação oficial:
 * https://docs.kiwify.com.br/api-reference/webhooks/create). Não inventar
 * outros — se a Kiwify mudar/adicionar eventos, atualizar esta lista.
 */
export const KIWIFY_EVENTS = [
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

export type KiwifyEvent = (typeof KIWIFY_EVENTS)[number];

export function isKiwifyEvent(value: unknown): value is KiwifyEvent {
  return typeof value === "string" && (KIWIFY_EVENTS as readonly string[]).includes(value);
}

/**
 * Eventos que alteram o status de uma assinatura. Os demais (boleto/pix
 * gerado, carrinho abandonado, compra recusada) são só informativos — ficam
 * registrados em webhook_events para auditoria, mas não mudam `subscriptions`.
 */
export const EVENT_TO_STATUS: Partial<Record<KiwifyEvent, SubscriptionStatus>> = {
  compra_aprovada: "active",
  subscription_renewed: "active",
  subscription_canceled: "canceled",
  subscription_late: "past_due",
  compra_reembolsada: "refunded",
  chargeback: "chargeback",
};

/**
 * Extrai o evento e o token de autenticação da requisição recebida.
 *
 * IMPORTANTE — o mecanismo exato de verificação da Kiwify não está 100%
 * documentado publicamente: a Kiwify gera um `token` por webhook cadastrado
 * (confirmado pela API oficial) e instrui a colar esse token "na sua
 * aplicação", mas a forma exata de transporte (query string vs. header) não
 * está descrita nas páginas de ajuda públicas. A convenção mais usada nas
 * integrações reais é o token embutido na própria URL cadastrada
 * (`.../api/webhooks/kiwify?token=...`), então é isso que verificamos aqui.
 * Ao configurar o webhook de verdade, confirme no primeiro evento de teste
 * (registrado em `webhook_events.raw_payload`) se bate com o esperado — se a
 * Kiwify usar outro mecanismo (ex.: header), ajustar `extractToken` abaixo.
 * Use `isInspectionMode()` para descobrir o mecanismo real ANTES de confiar
 * nesta função em produção — ver route.ts do webhook.
 */
export function extractToken(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("token") ?? request.headers.get("x-kiwify-token");
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
 * Nome do campo de evento dentro do corpo do webhook também não está 100%
 * confirmado publicamente — tentamos os candidatos mais prováveis. O corpo
 * bruto é sempre gravado em webhook_events.raw_payload, então nada se perde
 * mesmo se nenhum desses campos bater; ajuste aqui ao ver o payload real.
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
  periodEnd: string | null;
}

function readString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/**
 * Extração best-effort dos campos do payload — mesma ressalva do comentário
 * acima: o schema exato de order/subscription da Kiwify não pôde ser
 * confirmado via documentação pública no momento em que isto foi escrito.
 */
export function extractOrderInfo(body: Record<string, unknown>): ExtractedOrderInfo {
  const customer = (body.Customer ?? body.customer ?? {}) as Record<string, unknown>;
  const subscription = (body.Subscription ?? body.subscription ?? {}) as Record<string, unknown>;
  const product = (body.Product ?? body.product ?? {}) as Record<string, unknown>;

  return {
    orderId: readString(body.order_id, body.id),
    subscriptionId: readString(subscription.id, body.subscription_id),
    productId: readString(product.id, body.product_id),
    customerId: readString(customer.id, body.customer_id),
    customerEmail: readString(customer.email, body.customer_email, body.email),
    periodEnd: readString(
      subscription.current_period_end,
      subscription.next_payment,
      body.current_period_end,
      body.next_payment
    ),
  };
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
