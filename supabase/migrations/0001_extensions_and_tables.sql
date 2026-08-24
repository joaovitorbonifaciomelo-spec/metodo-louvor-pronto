-- Louvor Pronto — schema inicial
-- Decisão de arquitetura: em vez de tabelas de junção song_tags/song_moments/song_themes
-- (sugeridas no briefing), usamos colunas text[] em `songs` com índices GIN. Para o volume
-- esperado (centenas/poucos milhares de músicas) isso é mais simples de consultar e editar
-- pelo admin, sem perder performance de busca. Ver README > "Decisões arquiteturais".

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- profiles — estende auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  church_id uuid references public.churches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.churches
  add constraint churches_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- songs — catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  version text,
  key text,
  capo smallint,
  difficulty text check (difficulty in ('iniciante', 'intermediaria', 'avancada')),
  energy smallint check (energy between 1 and 5),
  bpm smallint,
  moments text[] not null default '{}',
  themes text[] not null default '{}',
  tags text[] not null default '{}',
  youtube_url text,
  spotify_url text,
  active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'original', 'additional', 'csv_import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- song_requests — músicas pedidas que não existem no catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'added', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- setlists / setlist_items
-- ---------------------------------------------------------------------------
create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  church_id uuid references public.churches (id) on delete set null,
  name text not null,
  service_type text not null check (service_type in ('Domingo', 'Jovens', 'Ceia', 'Oração', 'Vigília', 'Outro')),
  theme text,
  service_date date,
  team_level text not null default 'intermediaria' check (team_level in ('iniciante', 'intermediaria', 'avancada')),
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete restrict,
  position smallint not null,
  moment text not null default 'Outros',
  selected_key text,
  notes text,
  reference_url text,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (setlist_id, position)
);

-- ---------------------------------------------------------------------------
-- user_song_library — "minha igreja toca esta música" (seção 21)
-- ---------------------------------------------------------------------------
create table if not exists public.user_song_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  church_id uuid references public.churches (id) on delete set null,
  song_id uuid not null references public.songs (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'setlist_usage')),
  created_at timestamptz not null default now(),
  unique (user_id, song_id)
);

-- ---------------------------------------------------------------------------
-- subscriptions — desacoplado de billing real (seção 26)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- analytics_events (seção 36)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
