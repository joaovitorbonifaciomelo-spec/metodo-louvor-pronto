import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionInfo } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { formatDatePtBr } from "@/lib/utils";
import type { SetlistRow } from "@/types/database";

export default async function CultosPage() {
  const { userId } = await getSessionInfo();
  const supabase = createClient();

  const { data } = await supabase
    .from("setlists")
    .select("*, setlist_items(count)")
    .eq("user_id", userId as string)
    .order("service_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const setlists = (data ?? []) as (SetlistRow & { setlist_items: { count: number }[] })[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-base-50">Meus Cultos</h1>
        <Link href="/cultos/novo" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90">
          Novo Culto
        </Link>
      </div>

      {setlists.length === 0 ? (
        <Card className="text-center text-sm text-base-400">
          Você ainda não salvou nenhum repertório.{" "}
          <Link href="/cultos/novo" className="text-accent underline">
            Monte o primeiro agora
          </Link>
          .
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {setlists.map((s) => (
            <Link key={s.id} href={`/cultos/${s.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-base-700">
                <div>
                  <h2 className="font-medium text-base-100">{s.name}</h2>
                  <p className="text-xs text-base-400">
                    {s.service_type} · {formatDatePtBr(s.service_date)}
                    {s.theme ? ` · ${s.theme}` : ""}
                  </p>
                </div>
                <span className="text-xs text-base-400">{s.setlist_items?.[0]?.count ?? 0} músicas</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
