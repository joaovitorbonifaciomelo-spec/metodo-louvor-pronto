import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Heartbeat diário (Vercel Cron, ver vercel.json) — mantém o projeto Supabase
 * Free ativo fazendo uma escrita mínima e legítima uma vez por dia. Nunca
 * acumula linhas: sempre UPSERT em `system_heartbeat.id = 1`.
 *
 * Autenticação: a Vercel, quando `CRON_SECRET` está configurada, envia
 * automaticamente `Authorization: Bearer <CRON_SECRET>` nas chamadas de cron
 * (comportamento oficial documentado pela própria Vercel) — não é uma
 * convenção nossa. Sem `CRON_SECRET` configurada, rejeita tudo (nunca aceita
 * "Bearer undefined"/sem header como válido).
 *
 * Endpoint 100% server-side: `system_heartbeat` não tem nenhuma policy de
 * RLS pública — só o client admin (service role) consegue escrever aqui.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron:supabase-heartbeat] CRON_SECRET não configurado — rejeitando por segurança.");
    return NextResponse.json({ error: "Heartbeat não configurado." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("system_heartbeat").upsert({ id: 1, last_seen: new Date().toISOString() });

    if (error) {
      console.error("[cron:supabase-heartbeat] falha ao gravar heartbeat:", error.message);
      return NextResponse.json({ error: "Falha ao executar o heartbeat." }, { status: 500 });
    }
  } catch (err) {
    console.error("[cron:supabase-heartbeat] erro inesperado:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Falha ao executar o heartbeat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
