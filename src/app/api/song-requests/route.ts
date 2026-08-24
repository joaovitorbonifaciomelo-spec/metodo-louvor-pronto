import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth/apiGuards";
import { trackServer } from "@/lib/analytics/trackServer";

const bodySchema = z.object({ query: z.string().trim().min(1).max(200) });

/** Usuário solicita uma música que não foi encontrada na busca (seção 20). */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o nome da música." }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("song_requests")
    .insert({ query: parsed.data.query, user_id: guard.userId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await trackServer(supabase, "song_requested", { query: parsed.data.query }, guard.userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Ranking de solicitações para o admin decidir o que adicionar ao catálogo (seção 20/23). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const { data, error } = await supabase.from("song_requests").select("query, status").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, { query: string; count: number; pending: number }>();
  for (const row of data ?? []) {
    const key = row.query.trim().toLowerCase();
    const entry = counts.get(key) ?? { query: row.query.trim(), count: 0, pending: 0 };
    entry.count += 1;
    if (row.status === "pending") entry.pending += 1;
    counts.set(key, entry);
  }

  const ranking = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  return NextResponse.json({ ranking });
}
