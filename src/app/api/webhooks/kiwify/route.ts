import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildIdempotencyKey,
  buildInspectionRecord,
  extractEventType,
  extractSignatureAnywhere,
  isInspectionMode,
  mapKiwifyEventToSubscriptionStatus,
  matchUserIdByEmail,
  normalizeKiwifyPayload,
  parseKiwifyWebhook,
  validateSaleForEvent,
  type ParsedKiwifyWebhook,
} from "@/lib/billing/kiwify";
import { fetchKiwifySale } from "@/lib/billing/kiwifyApi";
import type { SubscriptionRow, WebhookEventRow } from "@/types/database";

/**
 * Webhook de pagamento da Kiwify (seção "Fluxo comercial"). Único lugar que
 * pode conceder/revogar acesso pago — o app NUNCA libera acesso só porque o
 * navegador voltou do checkout, e o webhook SOZINHO nunca concede nem revoga
 * acesso (ver hardening abaixo).
 *
 * Os eventos confirmados por inspeção de payloads de teste reais (não
 * suposição) e sua estrutura completa estão documentados em
 * src/lib/billing/kiwify.ts. `subscription_canceled` está registrado em
 * `webhook_events` para auditoria mas NUNCA altera `subscriptions` no MVP —
 * ver comentário em EVENT_TO_STATUS.
 *
 * Autenticação/hardening: decisão CONSCIENTE de MVP — o mecanismo de
 * `?signature=`/`body.signature` continua NÃO CONFIRMADO (sem documentação
 * oficial do algoritmo), então NÃO bloqueamos o processamento por causa dela
 * nem implementamos nenhuma comparação criptográfica inventada
 * (HMAC/SHA/Ed25519). A signature é só capturada para auditoria (mascarada
 * em logs, guardada em webhook_events.raw_payload) — ver `extractSignatureAnywhere`.
 *
 * A segurança real é a VERIFICAÇÃO SERVER-TO-SERVER: antes de alterar
 * qualquer `subscriptions`, consultamos GET /v1/sales/{order_id} com nossas
 * próprias credenciais OAuth (src/lib/billing/kiwifyApi.ts) e exigimos que
 * MÚLTIPLOS campos retornados pela API (nunca os do corpo do webhook)
 * concordem: sale.id, produto, e-mail do cliente e status oficial da venda
 * (ver `validateSaleForEvent`). order_id sozinho NÃO é tratado como segredo —
 * ele só destrava o processamento se todos os outros campos também
 * confirmarem. Qualquer falha (order_id ausente, credenciais da API Kiwify
 * ausentes, OAuth falhar, venda não existir, sale.id/produto/e-mail/status
 * divergentes, API indisponível) resulta em FAIL CLOSED: `subscriptions`
 * nunca é alterada.
 */
export async function POST(request: Request) {
  const rawText = await request.text();

  // Modo de inspeção (KIWIFY_WEBHOOK_INSPECT=true): registra a entrega
  // completa (headers + query + body) sem tocar em `subscriptions` — usado só
  // para auditoria/descoberta de estrutura. Com INSPECT=false (padrão de
  // produção), o processamento real roda: a segurança não depende de token
  // nenhum aqui, e sim da verificação server-to-server abaixo.
  if (isInspectionMode()) {
    return handleInspection(request, rawText);
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido (JSON esperado)." }, { status: 400 });
  }

  // Só para auditoria — nunca usada para autenticar (ver comentário acima).
  // Não loga o valor, só onde foi encontrada.
  const signature = extractSignatureAnywhere(request, rawBody);
  if (signature) {
    console.log(`[kiwify webhook] signature presente (${new URL(request.url).searchParams.has("signature") ? "query" : "body"}) — capturada só para auditoria, não usada para autenticar.`);
  }

  // CONFIRMADO no primeiro webhook real: o corpo pode vir envolvido em
  // { url, signature, order: {...} } — normalizamos antes de qualquer parsing
  // comercial (ver normalizeKiwifyPayload). O `rawBody` original (com o
  // wrapper, se houver) é o que fica gravado em webhook_events.raw_payload,
  // para nunca perder informação de auditoria.
  const parsed = parseKiwifyWebhook(rawBody);
  const idempotencyKey = buildIdempotencyKey(parsed) ?? `sem-id:${crypto.randomUUID()}`;

  const supabase = createAdminClient();

  const webhookEventRow = await resolveWebhookEventRow(supabase, idempotencyKey, parsed.eventType, rawBody);
  if (webhookEventRow === "already_processed") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (webhookEventRow === "log_failed") {
    return NextResponse.json({ error: "Falha ao registrar o evento." }, { status: 500 });
  }

  try {
    const targetStatus = mapKiwifyEventToSubscriptionStatus(parsed.eventType);
    if (targetStatus) {
      await verifyAndApplySubscriptionEvent(supabase, targetStatus, parsed);
    }
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("id", webhookEventRow.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kiwify webhook] falha ao aplicar evento na assinatura", message);
    await supabase.from("webhook_events").update({ processing_error: message }).eq("id", webhookEventRow.id);
    // 500 de propósito (não 200): o evento já está registrado de forma
    // idempotente, então um reenvio da Kiwify é seguro (ver
    // resolveWebhookEventRow) e agora tem chance real de ser reprocessado
    // com sucesso se a falha foi transitória (ex.: API da Kiwify fora do ar).
    return NextResponse.json({ error: "Erro interno ao processar o evento." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Garante idempotência SEM bloquear retry de eventos que falharam.
 *
 * - Se não existe linha com essa (provider, idempotency_key): insere uma
 *   nova e retorna ela.
 * - Se já existe E já foi processada com sucesso (`processed_at` preenchido
 *   e sem `processing_error`): é um reenvio de um evento que já concluímos —
 *   retorna "already_processed" (no-op, nunca duplica).
 * - Se já existe mas NÃO foi concluída com sucesso (ainda pendente, ou
 *   terminou em erro): é seguro tentar de novo — retorna a linha existente
 *   para o chamador reprocessar usando o MESMO id (não cria uma segunda
 *   linha, não duplica subscriptions).
 *
 * Corrida verdadeiramente concorrente (duas entregas simultâneas antes de
 * qualquer uma terminar) não está 100% resolvida aqui — decisão consciente
 * para o estágio atual do MVP; a Kiwify reenvia após falha, não em paralelo.
 */
async function resolveWebhookEventRow(
  supabase: ReturnType<typeof createAdminClient>,
  idempotencyKey: string,
  eventType: string,
  rawPayload: Record<string, unknown>
): Promise<WebhookEventRow | "already_processed" | "log_failed"> {
  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({ provider: "kiwify", event_type: eventType, idempotency_key: idempotencyKey, raw_payload: rawPayload })
    .select("*")
    .maybeSingle();

  if (!insertError && inserted) return inserted as unknown as WebhookEventRow;

  // unique(provider, idempotency_key) violada = já existe uma linha para este evento.
  if ((insertError as { code?: string } | null)?.code === "23505") {
    const { data: existing, error: fetchError } = await supabase
      .from("webhook_events")
      .select("*")
      .eq("provider", "kiwify")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (fetchError || !existing) {
      console.error("[kiwify webhook] conflito de idempotência mas não achou a linha existente", fetchError?.message);
      return "log_failed";
    }

    const row = existing as unknown as WebhookEventRow;
    const alreadySucceeded = Boolean(row.processed_at) && !row.processing_error;
    return alreadySucceeded ? "already_processed" : row;
  }

  console.error("[kiwify webhook] falha ao registrar evento", insertError?.message);
  return "log_failed";
}

/**
 * Registra a entrega crua do webhook (headers, query, body) para descobrir o
 * mecanismo real de autenticação da Kiwify e a estrutura de cada evento.
 * Nunca chama applySubscriptionEvent — nenhuma assinatura é criada/alterada
 * aqui, mesmo que o payload pareça um evento real. Sempre responde 200 (a
 * Kiwify só precisa ver sucesso para marcar o teste como concluído).
 */
async function handleInspection(request: Request, rawText: string) {
  const record = buildInspectionRecord(request, rawText);
  const bodyParsed =
    typeof record.bodyParsed === "object" && record.bodyParsed !== null
      ? (record.bodyParsed as Record<string, unknown>)
      : null;
  // Normaliza o wrapper { order: {...} } antes de adivinhar o evento — sem
  // isso, um payload real (envolvido) sempre seria tagueado como "unknown".
  const eventTypeGuess = bodyParsed ? extractEventType(normalizeKiwifyPayload(bodyParsed)) : null;
  const signaturePresent = Boolean(extractSignatureAnywhere(request, bodyParsed));

  // Nunca logar o valor da signature/query completa (pode conter o próprio
  // valor de assinatura) — só metadados. O payload completo (com a
  // signature) ainda fica gravado em webhook_events.raw_payload, que só o
  // service role acessa.
  console.log(
    `[kiwify webhook][INSPEÇÃO] recebido — method=${record.method} eventTypeGuess=${eventTypeGuess ?? "?"} signaturePresent=${signaturePresent} wrapped=${Boolean(bodyParsed?.order)}`
  );

  try {
    const supabase = createAdminClient();
    await supabase.from("webhook_events").insert({
      provider: "kiwify",
      event_type: `_inspect:${eventTypeGuess ?? "unknown"}`,
      idempotency_key: `inspect:${crypto.randomUUID()}`,
      raw_payload: record as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[kiwify webhook][INSPEÇÃO] falha ao gravar registro de inspeção", err);
  }

  return NextResponse.json({ ok: true, inspection: true });
}

/**
 * Busca o usuário pelo e-mail via Admin API (não há coluna de e-mail em
 * `profiles`) — NUNCA cria um usuário novo, só localiza um já existente
 * (ver seção "vincular compra ao usuário"). O matching em si é puro e fica
 * em src/lib/billing/kiwify.ts (matchUserIdByEmail) para ser testável.
 */
async function findUserIdByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null
): Promise<string | null> {
  if (!email) return null;

  // Base de usuários pequena nesta fase do produto — uma página de 200 cobre o caso real.
  // Se o catálogo de usuários crescer muito, paginar aqui.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  return matchUserIdByEmail(data.users, email);
}

/**
 * Verifica a venda via API oficial da Kiwify (server-to-server, credenciais
 * nossas) ANTES de tocar em `subscriptions` — nunca confia só no corpo do
 * webhook nem no fato de o order_id "existir" (order_id NÃO é segredo; um
 * atacante que conheça um order_id real de outra pessoa não pode ser
 * bloqueado só por isso). Só aplica o evento se:
 *   1. o evento trouxer um order_id;
 *   2. GET /v1/sales/{order_id} confirmar que essa venda existe (null = API
 *      indisponível, credenciais ausentes ou venda não encontrada — em
 *      QUALQUER desses casos, FAIL CLOSED: não altera `subscriptions`);
 *   3. `validateSaleForEvent` confirmar produto + e-mail + status oficial da
 *      venda — todos vindos da resposta da API, nunca do corpo do webhook.
 * Qualquer falha aqui só loga e não altera `subscriptions` — o evento já
 * ficou registrado em webhook_events para auditoria.
 */
async function verifyAndApplySubscriptionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  targetStatus: NonNullable<ReturnType<typeof mapKiwifyEventToSubscriptionStatus>>,
  parsed: ParsedKiwifyWebhook
) {
  if (!parsed.orderId) {
    console.warn(
      `[kiwify webhook] evento "${parsed.eventType}" sem order_id — não é possível verificar server-to-server, ignorado.`
    );
    return;
  }

  // Erros de rede/API propagam para o catch em POST (fail closed: nada abaixo
  // executa, e o erro fica registrado em webhook_events.processing_error).
  const verifiedSale = await fetchKiwifySale(parsed.orderId);
  if (!verifiedSale) {
    console.warn(
      `[kiwify webhook] order_id="${parsed.orderId}" não confirmado pela API oficial da Kiwify (venda inexistente, API indisponível ou credenciais ausentes) — evento "${parsed.eventType}" ignorado.`
    );
    return;
  }

  const validation = validateSaleForEvent(parsed.eventType, parsed, verifiedSale);
  if (!validation.valid) {
    console.warn(
      `[kiwify webhook] venda encontrada mas validação falhou (order_id="${parsed.orderId}", evento="${parsed.eventType}"): ${validation.reason} — subscriptions não alteradas.`
    );
    return;
  }

  await applySubscriptionEvent(supabase, targetStatus, parsed);
}

/**
 * Aplica um evento de assinatura já mapeado para `targetStatus` (ver
 * mapKiwifyEventToSubscriptionStatus) a uma linha de `subscriptions`.
 * `webhook_event_type` decide o status sozinho — `Subscription.status` do
 * payload NUNCA é consultado aqui para essa decisão (ver ressalva em
 * EVENT_TO_STATUS: chargeback pode chegar com Subscription.status="active" e
 * mesmo assim o resultado tem que ser "chargeback").
 *
 * Localiza a assinatura por `provider_subscription_id` — uma renovação
 * (subscription_renewed) da MESMA assinatura atualiza a mesma linha, nunca
 * cria uma nova. Se o comprador ainda não tiver conta no Supabase, a linha é
 * criada/atualizada mesmo assim com `user_id = null` e `customer_email`
 * preenchido — o webhook nunca é descartado por falta de conta.
 */
async function applySubscriptionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  targetStatus: NonNullable<ReturnType<typeof mapKiwifyEventToSubscriptionStatus>>,
  parsed: ParsedKiwifyWebhook
) {
  const now = new Date().toISOString();

  let existing: SubscriptionRow | null = null;
  if (parsed.subscriptionId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("provider", "kiwify")
      .eq("provider_subscription_id", parsed.subscriptionId)
      .maybeSingle();
    existing = (data as unknown as SubscriptionRow) ?? null;
  }

  const userId = existing?.user_id ?? (await findUserIdByEmail(supabase, parsed.customerEmail));

  const update: Partial<SubscriptionRow> & Record<string, unknown> = {
    provider: "kiwify",
    status: targetStatus,
  };
  if (userId) update.user_id = userId;
  if (parsed.customerEmail) update.customer_email = parsed.customerEmail;
  if (parsed.subscriptionId) update.provider_subscription_id = parsed.subscriptionId;
  if (parsed.customerId) update.provider_customer_id = parsed.customerId;
  if (parsed.productId) update.provider_product_id = parsed.productId;
  // Subscription.next_payment representa o fim do ciclo atual mesmo em
  // eventos não-"active" (ex.: subscription_canceled ainda traz esse campo,
  // representando até quando o período já pago vale) — access.ts usa isso
  // para "canceled_within_paid_period". Só gravamos o que o payload realmente
  // trouxer; nunca inventamos uma data.
  if (parsed.currentPeriodEnd) update.current_period_end = parsed.currentPeriodEnd;

  if (targetStatus === "active") {
    update.past_due_since = null;
    update.canceled_at = null;
    if (!existing?.started_at) update.started_at = parsed.startedAt ?? now;
    // Subscription.start_date só representa o início do ciclo na 1ª compra
    // (sem linha existente ainda). Numa renovação (existing != null) não há,
    // nos payloads reais observados, nenhum campo que represente
    // especificamente "início do novo ciclo" — por isso não mexemos em
    // current_period_start numa renovação, só em current_period_end (acima).
    if (!existing) update.current_period_start = parsed.startedAt ?? now;
  } else if (targetStatus === "past_due") {
    if (!existing?.past_due_since) update.past_due_since = parsed.eventOccurredAt ?? now;
  } else if (targetStatus === "canceled") {
    update.canceled_at = now;
  }

  if (existing) {
    await supabase.from("subscriptions").update(update).eq("id", existing.id);
    return;
  }

  await supabase.from("subscriptions").insert(update);
}
