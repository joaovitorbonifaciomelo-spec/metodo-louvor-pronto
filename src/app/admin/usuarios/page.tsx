import { createClient } from "@/lib/supabase/server";
import { resolveAccess } from "@/lib/billing/access";
import { Badge, Card } from "@/components/ui/card";
import { formatDatePtBr } from "@/lib/utils";
import type { ProfileRow, SubscriptionRow } from "@/types/database";

function subscriptionBadgeTone(granted: boolean): "accent" | "neutral" | "warning" {
  return granted ? "accent" : "neutral";
}

export default async function UsuariosPage() {
  const supabase = createClient();
  const [{ data: profileData }, { data: subscriptionData }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("subscriptions").select("*").order("updated_at", { ascending: false }),
  ]);

  const profiles = (profileData ?? []) as ProfileRow[];
  const subscriptions = (subscriptionData ?? []) as SubscriptionRow[];
  // Todas as assinaturas por usuário (não só a mais recente) — a lista já
  // vem ordenada por updated_at desc, ordem que resolveAccess usa só como
  // referência de exibição quando nenhuma delas concede acesso.
  const subscriptionsByUser = new Map<string, SubscriptionRow[]>();
  for (const s of subscriptions) {
    if (!s.user_id) continue;
    const list = subscriptionsByUser.get(s.user_id) ?? [];
    list.push(s);
    subscriptionsByUser.set(s.user_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Usuários ({profiles.length})</h1>
      <div className="flex flex-col gap-2">
        {profiles.map((p) => {
          // Mesma resolução de acesso usada pelo resto do SaaS (getAccessInfo
          // em src/lib/auth/session.ts) — concede acesso se QUALQUER
          // assinatura do usuário for válida agora, não só a mais recente.
          const { subscription, access } = resolveAccess(p.role, subscriptionsByUser.get(p.id) ?? []);
          return (
            <Card key={p.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-base-100">{p.display_name ?? p.id}</p>
                <p className="text-xs text-base-400">Desde {formatDatePtBr(p.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={subscriptionBadgeTone(access.granted)}>{subscription?.status ?? "sem assinatura"}</Badge>
                {!access.granted && p.role !== "admin" && (
                  <span className="text-xs text-base-500" title={access.reason}>
                    sem acesso
                  </span>
                )}
                {p.role === "admin" && <Badge tone="warning">admin</Badge>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
