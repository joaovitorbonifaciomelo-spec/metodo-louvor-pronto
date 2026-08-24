"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Sem generic <Database> aqui de propósito: nossos tipos de linha (src/types/*)
 * são mapeados manualmente nas queries via songFromRow/setlistFromRow etc.,
 * o que evita a fricção de manter um Database genérico 100% fiel ao schema.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
