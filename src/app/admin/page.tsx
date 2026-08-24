import { createClient } from "@/lib/supabase/server";
import { getAdminStats } from "@/lib/admin/stats";
import { Card } from "@/components/ui/card";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs text-base-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-base-50">{value}</p>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const stats = await getAdminStats(supabase);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-base-50">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Músicas (ativas / total)" value={stats.activeSongs} />
        <StatCard label="Usuários" value={stats.totalUsers} />
        <StatCard label="Repertórios criados" value={stats.totalSetlists} />
        <StatCard label="Solicitações pendentes" value={stats.pendingRequests} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-base-200">Músicas mais pesquisadas</h2>
          {stats.topSearches.length === 0 ? (
            <p className="text-sm text-base-400">Sem dados ainda.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm text-base-300">
              {stats.topSearches.map((s) => (
                <li key={s.query} className="flex justify-between">
                  <span>{s.query}</span>
                  <span className="text-base-400">{s.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-base-200">Músicas mais solicitadas</h2>
          {stats.topRequests.length === 0 ? (
            <p className="text-sm text-base-400">Sem dados ainda.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm text-base-300">
              {stats.topRequests.map((r) => (
                <li key={r.query} className="flex justify-between">
                  <span>{r.query}</span>
                  <span className="text-base-400">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="sm:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-base-200">Músicas mais adicionadas a repertórios</h2>
          {stats.mostAddedSongs.length === 0 ? (
            <p className="text-sm text-base-400">Sem dados ainda.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm text-base-300">
              {stats.mostAddedSongs.map((s) => (
                <li key={s.title} className="flex justify-between">
                  <span>
                    {s.title} {s.artist ? `— ${s.artist}` : ""}
                  </span>
                  <span className="text-base-400">{s.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
