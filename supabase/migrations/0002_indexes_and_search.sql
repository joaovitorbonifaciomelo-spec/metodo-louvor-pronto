-- Busca rápida e autocomplete (seção 31): trigram para prefix/partial match,
-- GIN para arrays, tsvector para busca combinada título+artista.

create index if not exists songs_title_trgm_idx on public.songs using gin (title gin_trgm_ops);
create index if not exists songs_artist_trgm_idx on public.songs using gin (artist gin_trgm_ops);
create index if not exists songs_moments_idx on public.songs using gin (moments);
create index if not exists songs_themes_idx on public.songs using gin (themes);
create index if not exists songs_tags_idx on public.songs using gin (tags);
create index if not exists songs_active_idx on public.songs (active);

create index if not exists setlist_items_setlist_id_idx on public.setlist_items (setlist_id);
create index if not exists setlist_items_song_id_idx on public.setlist_items (song_id);
create index if not exists setlists_user_id_idx on public.setlists (user_id);
create index if not exists setlists_service_date_idx on public.setlists (service_date desc);
create index if not exists song_requests_status_idx on public.song_requests (status);
create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);

-- RPC usada pelo autocomplete/busca de músicas (seção 31): ordena por similaridade
-- de trigram no título, com fallback para artista, e mantém apenas ativas.
create or replace function public.search_songs(search_query text, result_limit int default 10)
returns setof public.songs
language sql
stable
as $$
  select *
  from public.songs
  where active = true
    and (
      title ilike '%' || search_query || '%'
      or artist ilike '%' || search_query || '%'
      or similarity(title, search_query) > 0.15
    )
  order by
    (title ilike search_query || '%') desc,
    similarity(title, search_query) desc,
    title asc
  limit result_limit;
$$;
