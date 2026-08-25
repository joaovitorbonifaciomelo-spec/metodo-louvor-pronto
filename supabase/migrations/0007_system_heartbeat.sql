-- Heartbeat diário (Vercel Cron) para manter o projeto Supabase Free ativo
-- — sem isso, um projeto sem atividade por um período pode ser pausado
-- automaticamente. Uma única linha (id=1), sempre atualizada via UPSERT —
-- nunca insere uma linha nova a cada execução.

begin;

create table if not exists public.system_heartbeat (
  id integer primary key,
  last_seen timestamptz not null default now(),
  constraint system_heartbeat_single_row check (id = 1)
);

alter table public.system_heartbeat enable row level security;
-- Sem policies de propósito: acesso só via service role, no endpoint
-- /api/cron/supabase-heartbeat (server-only, autenticado pelo CRON_SECRET da
-- Vercel). Nenhum usuário — nem autenticado, nem admin — precisa ler/escrever
-- esta tabela pela API pública.

commit;
