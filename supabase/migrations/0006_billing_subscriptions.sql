-- Migração comercial: remove o modelo Free/Pro (seção "Alteração importante
-- de negócio — remover Free + Pro"). O acesso ao SaaS deixa de depender de um
-- limite de plano gratuito e passa a depender de uma assinatura paga real
-- (status em `subscriptions`). Nenhum dado de usuário é apagado aqui — só a
-- lógica comercial (coluna `plan` e a assinatura "free" automática do signup).

begin;

-- ---------------------------------------------------------------------------
-- profiles — "plan" deixa de existir; acesso não é mais por plano
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles drop column if exists plan;

-- ---------------------------------------------------------------------------
-- subscriptions — modela status de assinatura real (Kiwify), não Free/Pro
-- ---------------------------------------------------------------------------
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions drop constraint if exists subscriptions_user_id_key;
alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_provider_subscription_requires_provider;

-- Antes de remover a coluna `plan`: qualquer assinatura antiga com plan='free'
-- não pode continuar com status='active', porque depois desta migração
-- 'active' passa a significar assinatura PAGA real. Precisa rodar enquanto a
-- coluna `plan` ainda existe (antes do `drop column` abaixo). Só toca linhas
-- plan='free' — assinaturas pagas reais (plan='pro', se alguma já existir)
-- não são alteradas por esta linha.
update public.subscriptions
  set status = 'inactive'
  where plan = 'free';

alter table public.subscriptions
  alter column user_id drop not null,
  drop column if exists plan,
  add column if not exists customer_email text,
  add column if not exists provider_product_id text,
  add column if not exists started_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists past_due_since timestamptz,
  add column if not exists canceled_at timestamptz;

-- Um usuário pode ter mais de uma assinatura ao longo do tempo (cancelou e
-- assinou de novo, ou trocou de provider) — por isso `user_id` NÃO é unique
-- (mantido assim de propósito; ver índice não-único abaixo). A autorização em
-- src/lib/auth/session.ts (resolveAccess, em src/lib/billing/access.ts) busca
-- TODAS as assinaturas do usuário e concede acesso se QUALQUER uma delas
-- satisfizer getSubscriptionAccessStatus agora — não presume uma única linha
-- por usuário nem só a mais recente por updated_at.
alter table public.subscriptions
  add constraint subscriptions_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.subscriptions
  alter column status set default 'inactive';

-- Preserva os 6 status válidos do novo modelo; só normaliza para 'inactive'
-- qualquer valor que não seja um deles (ex.: lixo/typo de uma migração
-- anterior) OU nulo. Antes desta migração o check só permitia
-- ('active','canceled','past_due'), então 'inactive'/'refunded'/'chargeback'
-- não podiam existir ainda — a lista completa aqui é por segurança/clareza,
-- não porque esses valores já existissem.
update public.subscriptions
  set status = 'inactive'
  where status is null
     or status not in ('inactive', 'active', 'past_due', 'canceled', 'refunded', 'chargeback');

-- Reforça a integridade do campo: depois da normalização acima não deve
-- restar nenhum status nulo, então o banco passa a proibir isso de vez.
alter table public.subscriptions
  alter column status set not null;

alter table public.subscriptions
  add constraint subscriptions_status_check
    check (status in ('inactive', 'active', 'past_due', 'canceled', 'refunded', 'chargeback'));

-- provider_subscription_id só faz sentido junto de um provider conhecido —
-- nunca guardar um id de assinatura "solto" sem saber de qual provider ele é.
alter table public.subscriptions
  add constraint subscriptions_provider_subscription_requires_provider
    check (provider_subscription_id is null or provider is not null);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_customer_email_idx on public.subscriptions (lower(customer_email));
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create unique index if not exists subscriptions_provider_subscription_id_key
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- webhook_events — log + idempotência dos webhooks recebidos (Kiwify e
-- futuros providers). Nunca confiar em um webhook sem registrar antes.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  idempotency_key text not null,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, idempotency_key)
);

create index if not exists webhook_events_provider_event_idx on public.webhook_events (provider, event_type);

alter table public.webhook_events enable row level security;
-- Sem policies: só service role (usado pelo endpoint de webhook) acessa esta tabela.

-- ---------------------------------------------------------------------------
-- handle_new_user — não cria mais assinatura "free" automática no signup.
-- Sem assinatura = sem acesso (ver src/lib/billing/access.ts).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

commit;
