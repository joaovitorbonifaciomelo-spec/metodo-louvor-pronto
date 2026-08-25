import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAccess } from "@/lib/auth/apiGuards";
import { loadSetlistWithItems } from "@/lib/setlists/loadSetlist";
import { SERVICE_TYPES, TEAM_LEVELS } from "@/types/setlist";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const result = await loadSetlistWithItems(supabase, params.id);
  if (!result) return NextResponse.json({ error: "Culto não encontrado." }, { status: 404 });
  return NextResponse.json(result);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  theme: z.string().trim().max(200).nullable().optional(),
  serviceDate: z.string().trim().nullable().optional(),
  teamLevel: z.enum(TEAM_LEVELS).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { serviceType, theme, serviceDate, teamLevel, name } = parsed.data;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (serviceType !== undefined) update.service_type = serviceType;
  if (theme !== undefined) update.theme = theme;
  if (serviceDate !== undefined) update.service_date = serviceDate;
  if (teamLevel !== undefined) update.team_level = teamLevel;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("setlists")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", guard.userId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao atualizar culto." }, { status: 500 });
  }

  return NextResponse.json({ setlist: data });
}
