import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadSetlistWithItems } from "@/lib/setlists/loadSetlist";

/** Página pública de compartilhamento (seção 19) — sem autenticação. */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: setlistRow, error } = await supabase
    .from("setlists")
    .select("id")
    .eq("share_slug", params.slug)
    .single();

  if (error || !setlistRow) {
    return NextResponse.json({ error: "Repertório não encontrado." }, { status: 404 });
  }

  const result = await loadSetlistWithItems(supabase, setlistRow.id);
  if (!result) return NextResponse.json({ error: "Repertório não encontrado." }, { status: 404 });

  return NextResponse.json(result);
}
