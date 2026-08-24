import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionInfo } from "@/lib/auth/session";
import { loadSetlistWithItems } from "@/lib/setlists/loadSetlist";
import { SetlistEditorClient } from "@/components/setlist-editor-client";

export default async function CultoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const result = await loadSetlistWithItems(supabase, params.id);
  if (!result) notFound();

  const { userId } = await getSessionInfo();
  if (result.setlist.userId !== userId) notFound();

  return (
    <SetlistEditorClient
      setlistId={params.id}
      setlist={result.setlist}
      initialItems={result.items}
      initialShareSlug={result.shareSlug}
    />
  );
}
