import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui/card";
import { formatDatePtBr } from "@/lib/utils";
import type { ProfileRow } from "@/types/database";

export default async function UsuariosPage() {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  const profiles = (data ?? []) as ProfileRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Usuários ({profiles.length})</h1>
      <div className="flex flex-col gap-2">
        {profiles.map((p) => (
          <Card key={p.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-base-100">{p.display_name ?? p.id}</p>
              <p className="text-xs text-base-400">Desde {formatDatePtBr(p.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Badge tone={p.plan === "pro" ? "accent" : "neutral"}>{p.plan}</Badge>
              {p.role === "admin" && <Badge tone="warning">admin</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
