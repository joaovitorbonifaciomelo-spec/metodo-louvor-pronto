import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getSessionInfo } from "@/lib/auth/session";

const bodySchema = z.object({
  event_name: z.enum(ANALYTICS_EVENTS),
  payload: z.record(z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const supabase = createClient();
  const { userId } = await getSessionInfo();

  const { error } = await supabase.from("analytics_events").insert({
    event_name: parsed.data.event_name,
    payload: parsed.data.payload,
    user_id: userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
