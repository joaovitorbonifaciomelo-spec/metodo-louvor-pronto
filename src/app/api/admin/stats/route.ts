import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/apiGuards";
import { getAdminStats } from "@/lib/admin/stats";

/** Dashboard administrativo (seção 23). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const stats = await getAdminStats(supabase);
  return NextResponse.json(stats);
}
