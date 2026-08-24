import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSetlistWithItems } from "@/lib/setlists/loadSetlist";
import { product } from "@/lib/config/product";
import { Card } from "@/components/ui/card";

export default async function PublicSetlistPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: setlistRow } = await supabase.from("setlists").select("id").eq("share_slug", params.slug).single();
  if (!setlistRow) notFound();

  const result = await loadSetlistWithItems(supabase, setlistRow.id);
  if (!result) notFound();

  const { setlist, items } = result;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-accent">{product.name}</p>
        <h1 className="mt-2 text-xl font-semibold text-base-50">{setlist.name}</h1>
        <p className="mt-1 text-sm text-base-400">
          {setlist.serviceType}
          {setlist.theme ? ` · ${setlist.theme}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <Card key={item.id}>
            <span className="text-xs text-base-500">
              {String(index + 1).padStart(2, "0")} — {item.moment}
            </span>
            <h2 className="text-base font-semibold text-base-50">{item.song.title}</h2>
            {item.song.artist && <p className="text-xs text-base-400">{item.song.artist}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-base-300">
              {(item.selectedKey ?? item.song.key) && <span>Tom: {item.selectedKey ?? item.song.key}</span>}
              {(item.referenceUrl ?? item.song.youtubeUrl) && (
                <a href={item.referenceUrl ?? item.song.youtubeUrl ?? "#"} target="_blank" rel="noreferrer" className="text-accent underline">
                  Referência
                </a>
              )}
            </div>
            {item.notes && <p className="mt-1 text-xs text-base-400">Obs: {item.notes}</p>}
          </Card>
        ))}
      </div>
    </main>
  );
}
