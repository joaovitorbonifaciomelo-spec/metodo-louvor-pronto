import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { songFromRow, type SongRow } from "@/types/song";
import { SongForm } from "@/components/admin/song-form";

export default async function EditarMusicaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("songs").select("*").eq("id", params.id).single();
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Editar música</h1>
      <SongForm song={songFromRow(data as SongRow)} />
    </div>
  );
}
