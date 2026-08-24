import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function SolicitacoesPage() {
  const supabase = createClient();
  const { data } = await supabase.from("song_requests").select("query, status").limit(5000);

  const counts = new Map<string, { query: string; count: number; pending: number }>();
  for (const row of data ?? []) {
    const key = row.query.trim().toLowerCase();
    const entry = counts.get(key) ?? { query: row.query.trim(), count: 0, pending: 0 };
    entry.count += 1;
    if (row.status === "pending") entry.pending += 1;
    counts.set(key, entry);
  }
  const ranking = Array.from(counts.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Solicitações de músicas</h1>
      {ranking.length === 0 ? (
        <Card className="text-sm text-base-400">Nenhuma solicitação ainda.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {ranking.map((r) => (
            <Card key={r.query} className="flex items-center justify-between">
              <span className="text-sm text-base-100">{r.query}</span>
              <span className="text-xs text-base-400">
                {r.count} solicitação{r.count === 1 ? "" : "es"} · {r.pending} pendente{r.pending === 1 ? "" : "s"}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
