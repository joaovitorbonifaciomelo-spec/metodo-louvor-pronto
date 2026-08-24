import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsEventName } from "./events";

/** Insere um evento de analytics diretamente (uso dentro de route handlers, sem round-trip HTTP). */
export async function trackServer(
  supabase: SupabaseClient,
  eventName: AnalyticsEventName,
  payload: Record<string, unknown> = {},
  userId: string | null = null
): Promise<void> {
  try {
    await supabase.from("analytics_events").insert({ event_name: eventName, payload, user_id: userId });
  } catch {
    // analytics nunca deve derrubar a request principal.
  }
}
