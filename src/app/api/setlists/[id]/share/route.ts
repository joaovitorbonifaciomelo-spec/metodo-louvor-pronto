import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/apiGuards";
import { trackServer } from "@/lib/analytics/trackServer";
import { slugify, randomSlugSuffix } from "@/lib/utils";

/** Gera (ou reaproveita) o link público de compartilhamento (seção 19). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const { data: setlist, error: fetchError } = await supabase
    .from("setlists")
    .select("id, name, share_slug, user_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !setlist) return NextResponse.json({ error: "Culto não encontrado." }, { status: 404 });
  if (setlist.user_id !== guard.userId) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  let slug = setlist.share_slug as string | null;
  if (!slug) {
    slug = `${slugify(setlist.name)}-${randomSlugSuffix()}`;
    const { error: updateError } = await supabase.from("setlists").update({ share_slug: slug }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await trackServer(supabase, "setlist_shared", { setlistId: params.id }, guard.userId);
  return NextResponse.json({ shareSlug: slug, shareUrl: `/s/${slug}` });
}
