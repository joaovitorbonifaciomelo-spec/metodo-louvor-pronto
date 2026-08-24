/** Eventos internos (seção 36). Métrica central: setlist_created (seção 37). */
export const ANALYTICS_EVENTS = [
  "song_searched",
  "recommendation_generated",
  "recommendation_clicked",
  "setlist_created",
  "song_added",
  "song_removed",
  "setlist_shared",
  "song_requested",
  "signup",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
