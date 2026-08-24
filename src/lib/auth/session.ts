import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
}

export async function getSessionInfo(): Promise<SessionInfo> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, email: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return { userId: user.id, email: user.email ?? null, profile: (profile as unknown as ProfileRow) ?? null };
}

export async function isAdmin(): Promise<boolean> {
  const { profile } = await getSessionInfo();
  return profile?.role === "admin";
}
