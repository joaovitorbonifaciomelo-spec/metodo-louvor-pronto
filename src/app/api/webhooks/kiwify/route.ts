import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EVENT_TO_STATUS,
  buildIdempotencyKey,
  buildInspectionRecord,
  extractEventType,
  extractOrderInfo,
  isAuthentic,
  isInspectionMode,
  matchUserIdByEmail,
} from "@/lib/billing/kiwify";
import type { SubscriptionRow } from "@/types/database";

/**
 * Webhook de pagamento da Kiwify (seção "Fluxo comercial"). Único lugar que
 * pode conceder/revogar acesso pago — o app NUNCA libera acesso só porque o
 * navegador voltou do checkout. Ver src/lib/billing/kiwify.ts para o que já
 * foi CONFIRMADO por inspeção de um payload de teste real (evento
 * "order_approved", estrutura de Product/Customer/Subscription) vs. o que
 * ainda não foi observado (os outros 5 eventos) ou não está confirmado
 * (mecanismo de autenticação — `isAuthentic` permanece incapaz de validar de
 * verdade até isso ser resolvido).
 */
export async function POST(request: Request) {
  const rawText = await request.text();

  // Modo de inspeção (KIWIFY_WEBHOOK_INSPECT=true): registra a entrega
  // completa (headers + query + body) sem verificar token e sem tocar em
  // `subscriptions` — usado só para descobrir o mecanismo real de
  // autenticação da Kiwify antes de confiar em `isAuthentic`. Nunca concede
  // acesso. Ver README/relatório da sessão para como desligar depois do teste.
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

  const eventType = extractEventType(body) ?? "unknown";
  const info = extractOrderInfo(body);
  const idempotencyKey = buildIdempotencyKey(eventType, info) ?? `sem-id:${crypto.randomUUID()}`;

  const supabase = createAdminClient();

  const { data: inserted, error: logError } = await supabase
    .from("webhook_events")
    .insert({ provider: "kiwify", event_type: eventType, idempotency_key: idempotencyKey, raw_payload: body })
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
    if (EVENT_TO_STATUS[eventType]) {
      await applySubscriptionEvent(supabase, eventType, info);
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
 * mecanismo real de token/assinatura da Kiwify. Nunca chama
 * applySubscriptionEvent — nenhuma assinatura é criada/alterada aqui, mesmo
 * que o payload pareça um evento real. Sempre responde 200 (a Kiwify só
 * precisa ver sucesso para marcar o teste como concluído).
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

type EventInfo = ReturnType<typeof extractOrderInfo>;

/**
 * Aplica um evento que já sabemos alterar status (EVENT_TO_STATUS[eventType]
 * existe) a uma linha de `subscriptions`. Se o usuário comprador ainda não
 * tiver conta no Supabase, a linha é criada/atualizada mesmo assim com
 * `user_id = null` e `customer_email` preenchido — o webhook nunca é
 * descartado por falta de conta; a vinculação acontece depois (ver seção
 * "vincular compra ao usuário").
 */
async function applySubscriptionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventType: string,
  info: EventInfo
) {
  const targetStatus = EVENT_TO_STATUS[eventType];
  if (!targetStatus) return;

  // Guarda específica do order_approved: só confiamos no status "active" se o
  // próprio payload confirmar Subscription.status === "active". Um
  // order_approved com outro valor aí é uma combinação nunca observada — não
  // inventamos o que fazer, só registramos o alerta e não mexemos no status
  // (os demais campos do evento ainda são salvos normalmente abaixo).
  const statusConfirmedByPayload = eventType !== "order_approved" || info.subscriptionStatus === "active";
  if (!statusConfirmedByPayload) {
    console.warn(
      `[kiwify webhook] order_approved com Subscription.status="${info.subscriptionStatus}" (esperado "active") — não atualizando status automaticamente.`
    );
  }

  const now = new Date().toISOString();

  let existing: SubscriptionRow | null = null;
  if (info.subscriptionId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("provider", "kiwify")
      .eq("provider_subscription_id", info.subscriptionId)
      .maybeSingle();
    existing = (data as unknown as SubscriptionRow) ?? null;
  }

  const userId = existing?.user_id ?? (await findUserIdByEmail(supabase, info.customerEmail));

  const update: Partial<SubscriptionRow> & Record<string, unknown> = {
    provider: "kiwify",
  };
  if (statusConfirmedByPayload) update.status = targetStatus;
  if (userId) update.user_id = userId;
  if (info.customerEmail) update.customer_email = info.customerEmail;
  if (info.subscriptionId) update.provider_subscription_id = info.subscriptionId;
  if (info.customerId) update.provider_customer_id = info.customerId;
  if (info.productId) update.provider_product_id = info.productId;
  if (info.periodEnd) update.current_period_end = info.periodEnd;

  if (statusConfirmedByPayload && targetStatus === "active") {
    update.past_due_since = null;
    update.canceled_at = null;
    if (!existing?.started_at) update.started_at = info.startedAt ?? now;
    // Subscription.start_date vale para a 1ª compra (único caso hoje: order_approved).
    // Revisar quando subscription_renewed for confirmado — provavelmente deve
    // avançar o período em vez de usar start_date de novo.
    update.current_period_start = info.startedAt ?? now;
  } else if (statusConfirmedByPayload && targetStatus === "past_due") {
    if (!existing?.past_due_since) update.past_due_since = now;
  } else if (statusConfirmedByPayload && targetStatus === "canceled") {
    update.canceled_at = now;
  }

  if (existing) {
    await supabase.from("subscriptions").update(update).eq("id", existing.id);
    return;
  }

  await supabase.from("subscriptions").insert(update);
}
