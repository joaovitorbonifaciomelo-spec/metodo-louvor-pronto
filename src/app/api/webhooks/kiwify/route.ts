import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildIdempotencyKey,
  buildInspectionRecord,
  extractEventType,
  isAllowedKiwifyProduct,
  isAuthentic,
  isInspectionMode,
  mapKiwifyEventToSubscriptionStatus,
  matchUserIdByEmail,
  parseKiwifyWebhook,
  type ParsedKiwifyWebhook,
} from "@/lib/billing/kiwify";
import type { SubscriptionRow } from "@/types/database";

/**
 * Webhook de pagamento da Kiwify (seção "Fluxo comercial"). Único lugar que
 * pode conceder/revogar acesso pago — o app NUNCA libera acesso só porque o
 * navegador voltou do checkout.
 *
 * Os 6 eventos de assinatura relevantes (order_approved, subscription_renewed,
 * subscription_late, subscription_canceled, order_refunded, chargeback) e a
 * estrutura completa do payload já foram CONFIRMADOS por inspeção de
 * payloads de teste reais enviados pela própria Kiwify — ver
 * src/lib/billing/kiwify.ts para o mapeamento e as ressalvas sobre o que
 * ainda NÃO está confirmado (mecanismo de autenticação — `isAuthentic`
 * permanece incapaz de validar de verdade até isso ser resolvido).
 */
export async function POST(request: Request) {
  const rawText = await request.text();

  // Modo de inspeção (KIWIFY_WEBHOOK_INSPECT=true): registra a entrega
  // completa (headers + query + body) sem verificar token e sem tocar em
  // `subscriptions` — usado para descobrir o mecanismo real de autenticação
  // da Kiwify e a estrutura de cada evento antes de confiar em `isAuthentic`.
  // Nunca concede acesso. NÃO desligar até a autenticação estar confirmada.
  if (isInspectionMode()) {
    return handleInspection(request, rawText);
  }

  if (!process.env.KIWIFY_WEBHOOK_TOKEN) {
    console.error("[kiwify webhook] KIWIFY_WEBHOOK_TOKEN não configurado — rejeitando por segurança.");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  if (!isAuthentic(request)) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido (JSON esperado)." }, { status: 400 });
  }

  const parsed = parseKiwifyWebhook(body);
  const idempotencyKey = buildIdempotencyKey(parsed) ?? `sem-id:${crypto.randomUUID()}`;

  const supabase = createAdminClient();

  const { data: inserted, error: logError } = await supabase
    .from("webhook_events")
    .insert({ provider: "kiwify", event_type: parsed.eventType, idempotency_key: idempotencyKey, raw_payload: body })
    .select("id")
    .maybeSingle();

  if (logError) {
    // unique(provider, idempotency_key) violada = webhook repetido; já processamos, não duplicar.
    if ((logError as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[kiwify webhook] falha ao registrar evento", logError.message);
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  try {
    const targetStatus = mapKiwifyEventToSubscriptionStatus(parsed.eventType);
    if (targetStatus) {
      if (isAllowedKiwifyProduct(parsed.productId)) {
        await applySubscriptionEvent(supabase, targetStatus, parsed);
      } else {
        console.warn(
          `[kiwify webhook] product_id="${parsed.productId}" não corresponde a KIWIFY_PRODUCT_ID — evento "${parsed.eventType}" ignorado (subscriptions não alteradas).`
        );
      }
    }
    if (inserted) {
      await supabase.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[kiwify webhook] falha ao aplicar evento na assinatura", message);
    if (inserted) {
      await supabase.from("webhook_events").update({ processing_error: message }).eq("id", inserted.id);
    }
    // Retorna 200 mesmo assim: o evento já está registrado de forma idempotente
    // (webhook_events); um erro de vinculação não deve fazer a Kiwify reenviar
    // o mesmo evento indefinidamente. O erro fica salvo para investigação manual.
  }

  return NextResponse.json({ ok: true });
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
  const eventTypeGuess = typeof record.bodyParsed === "object" && record.bodyParsed !== null
    ? extractEventType(record.bodyParsed as Record<string, unknown>)
    : null;

  console.log(
    `[kiwify webhook][INSPEÇÃO] recebido — method=${record.method} query=${JSON.stringify(record.query)} eventTypeGuess=${eventTypeGuess ?? "?"}`
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
