-- RLS (seção 30). Regra geral: usuário só mexe no que é dele; catálogo é
-- de leitura pública/autenticada e escrita só de admin; nada depende só do frontend.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- churches
-- ---------------------------------------------------------------------------
alter table public.churches enable row level security;

create policy "churches_select_authenticated" on public.churches
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "churches_insert_authenticated" on public.churches
  for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- songs — catálogo global
-- ---------------------------------------------------------------------------
alter table public.songs enable row level security;

create policy "songs_select_active_public" on public.songs
  for select using (active = true or public.is_admin(auth.uid()));

create policy "songs_write_admin_only" on public.songs
  for insert with check (public.is_admin(auth.uid()));

create policy "songs_update_admin_only" on public.songs
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "songs_delete_admin_only" on public.songs
  for delete using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- song_requests
-- ---------------------------------------------------------------------------
alter table public.song_requests enable row level security;

create policy "song_requests_select_own_or_admin" on public.song_requests
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "song_requests_insert_own" on public.song_requests
  for insert with check (auth.role() = 'authenticated' and (user_id = auth.uid() or user_id is null));

create policy "song_requests_update_admin_only" on public.song_requests
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- setlists
-- ---------------------------------------------------------------------------
alter table public.setlists enable row level security;

create policy "setlists_select_own_admin_or_shared" on public.setlists
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()) or share_slug is not null);

create policy "setlists_insert_own" on public.setlists
  for insert with check (user_id = auth.uid());

create policy "setlists_update_own" on public.setlists
  for update using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "setlists_delete_own" on public.setlists
  for delete using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- setlist_items — segue a visibilidade do setlist pai
-- ---------------------------------------------------------------------------
alter table public.setlist_items enable row level security;

create policy "setlist_items_select_via_parent" on public.setlist_items
  for select using (
    exists (
      select 1 from public.setlists s
      where s.id = setlist_items.setlist_id
        and (s.user_id = auth.uid() or public.is_admin(auth.uid()) or s.share_slug is not null)
    )
  );

create policy "setlist_items_write_via_parent" on public.setlist_items
  for insert with check (
    exists (select 1 from public.setlists s where s.id = setlist_items.setlist_id and s.user_id = auth.uid())
  );

create policy "setlist_items_update_via_parent" on public.setlist_items
  for update using (
    exists (select 1 from public.setlists s where s.id = setlist_items.setlist_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.setlists s where s.id = setlist_items.setlist_id and s.user_id = auth.uid())
  );

create policy "setlist_items_delete_via_parent" on public.setlist_items
  for delete using (
    exists (select 1 from public.setlists s where s.id = setlist_items.setlist_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- user_song_library
-- ---------------------------------------------------------------------------
alter table public.user_song_library enable row level security;

create policy "user_song_library_owner_all" on public.user_song_library
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- subscriptions — só o dono lê; escrita só via service role (webhooks/admin)
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- analytics_events — qualquer um insere (tracking), só admin lê
-- ---------------------------------------------------------------------------
alter table public.analytics_events enable row level security;

create policy "analytics_events_insert_any" on public.analytics_events
  for insert with check (true);

create policy "analytics_events_select_admin_only" on public.analytics_events
  for select using (public.is_admin(auth.uid()));
