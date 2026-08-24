"use client";

import type { AnalyticsEventName } from "./events";

/** Dispara um evento de analytics do client. Nunca bloqueia a UI nem lança erro. */
export function track(eventName: AnalyticsEventName, payload: Record<string, unknown> = {}): void {
  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name: eventName, payload }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // analytics nunca deve quebrar a experiência do usuário.
  }
}
