import type { SongRow } from "./song";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
  church_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChurchRow {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface SetlistRow {
  id: string;
  user_id: string;
  church_id: string | null;
  name: string;
  service_type: string;
  theme: string | null;
  service_date: string | null;
  team_level: string;
  share_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetlistItemRow {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  moment: string;
  selected_key: string | null;
  notes: string | null;
  reference_url: string | null;
  locked: boolean;
  created_at: string;
}

export interface SongRequestRow {
  id: string;
  query: string;
  user_id: string | null;
  status: "pending" | "reviewing" | "added" | "rejected";
  created_at: string;
}

export interface UserSongLibraryRow {
  id: string;
  user_id: string;
  church_id: string | null;
  song_id: string;
  source: "manual" | "setlist_usage";
  created_at: string;
}

export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled" | "refunded" | "chargeback";

export interface SubscriptionRow {
  id: string;
  user_id: string | null;
  customer_email: string | null;
  status: SubscriptionStatus;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_product_id: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_type: string;
  idempotency_key: string;
  raw_payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  processing_error: string | null;
}

/** Linha única (id=1) usada pelo heartbeat diário (Vercel Cron) — mantém o
 * projeto Supabase Free ativo. Nunca acumula linhas: sempre UPSERT em id=1. */
export interface SystemHeartbeatRow {
  id: number;
  last_seen: string;
}

export interface AnalyticsEventRow {
  id: string;
  user_id: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Tipagem mínima e manual das tabelas usadas pelo app (não gerada via CLI —
 * ver README para como regenerar com `supabase gen types` quando o projeto
 * Supabase estiver conectado).
 */
export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string }; Update: Partial<ProfileRow> };
      churches: { Row: ChurchRow; Insert: Partial<ChurchRow> & { name: string }; Update: Partial<ChurchRow> };
      songs: {
        Row: SongRow;
        Insert: Partial<SongRow> & { title: string };
        Update: Partial<SongRow>;
      };
      setlists: {
        Row: SetlistRow;
        Insert: Partial<SetlistRow> & { user_id: string; name: string; service_type: string };
        Update: Partial<SetlistRow>;
      };
      setlist_items: {
        Row: SetlistItemRow;
        Insert: Partial<SetlistItemRow> & { setlist_id: string; song_id: string; position: number };
        Update: Partial<SetlistItemRow>;
      };
      song_requests: {
        Row: SongRequestRow;
        Insert: Partial<SongRequestRow> & { query: string };
        Update: Partial<SongRequestRow>;
      };
      user_song_library: {
        Row: UserSongLibraryRow;
        Insert: Partial<UserSongLibraryRow> & { user_id: string; song_id: string };
        Update: Partial<UserSongLibraryRow>;
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow>;
        Update: Partial<SubscriptionRow>;
      };
      webhook_events: {
        Row: WebhookEventRow;
        Insert: Partial<WebhookEventRow> & { provider: string; event_type: string; idempotency_key: string; raw_payload: Record<string, unknown> };
        Update: Partial<WebhookEventRow>;
      };
      analytics_events: {
        Row: AnalyticsEventRow;
        Insert: Partial<AnalyticsEventRow> & { event_name: string };
        Update: Partial<AnalyticsEventRow>;
      };
      system_heartbeat: {
        Row: SystemHeartbeatRow;
        Insert: Partial<SystemHeartbeatRow> & { id: number };
        Update: Partial<SystemHeartbeatRow>;
      };
    };
  };
}
