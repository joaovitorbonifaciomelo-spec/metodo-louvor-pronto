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
  isKiwifyEvent,
} from "@/lib/billing/kiwify";
import type { SubscriptionRow } from "@/types/database";

/**
 * Webhook de pagamento da Kiwify (seção "Fluxo comercial"). Único lugar que
 * pode conceder/revogar acesso pago — o app NUNCA libera acesso só porque o
 * navegador voltou do checkout. Ver src/lib/billing/kiwify.ts para as
 * ressalvas sobre o que está 100% confirmado pela documentação pública da
 * Kiwify (nomes de evento) vs. o que é melhor esforço (verificação do token e
 * nomes de campo do payload) até o primeiro teste real.
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
    if (isKiwifyEvent(eventType) && EVENT_TO_STATUS[eventType]) {
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

/** Busca o usuário pelo e-mail via Admin API (não há coluna de e-mail em `profiles`). */
async function findUserIdByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null
): Promise<string | null> {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();

  // Base de usuários pequena nesta fase do produto — uma página de 200 cobre o caso real.
  // Se o catálogo de usuários crescer muito, paginar aqui.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
  return match?.id ?? null;
}

type EventInfo = ReturnType<typeof extractOrderInfo>;

async function applySubscriptionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  eventType: keyof typeof EVENT_TO_STATUS,
  info: EventInfo
) {
  const status = EVENT_TO_STATUS[eventType]!;
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
    status,
    provider: "kiwify",
  };
  if (userId) update.user_id = userId;
  if (info.customerEmail) update.customer_email = info.customerEmail;
  if (info.subscriptionId) update.provider_subscription_id = info.subscriptionId;
  if (info.customerId) update.provider_customer_id = info.customerId;
  if (info.productId) update.provider_product_id = info.productId;
  if (info.periodEnd) update.current_period_end = info.periodEnd;

  if (status === "active") {
    update.past_due_since = null;
    update.canceled_at = null;
    if (!existing?.started_at) update.started_at = now;
    update.current_period_start = now;
  } else if (status === "past_due") {
    if (!existing?.past_due_since) update.past_due_since = now;
  } else if (status === "canceled") {
    update.canceled_at = now;
  }

  if (existing) {
    await supabase.from("subscriptions").update(update).eq("id", existing.id);
    return;
  }

  await supabase.from("subscriptions").insert(update);
}
