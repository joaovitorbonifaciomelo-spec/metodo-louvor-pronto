-- Catálogo mais completo (seções 8/9/14 do briefing de UX/performance):
-- flag de revisão manual + metadados de enriquecimento via YouTube Data API.

alter table public.songs
  add column if not exists review_required boolean not null default false,
  add column if not exists youtube_video_id text,
  add column if not exists youtube_title text,
  add column if not exists youtube_channel text,
  add column if not exists youtube_thumbnail text,
  add column if not exists youtube_verified_at timestamptz,
  add column if not exists youtube_status text not null default 'pending'
    check (youtube_status in ('pending', 'found', 'review', 'not_found', 'confirmed'));

create index if not exists songs_review_required_idx on public.songs (review_required);
create index if not exists songs_youtube_status_idx on public.songs (youtube_status);

-- Sem artista atribuído com confiança suficiente (ver scripts/mark-review-required.ts) —
-- marcadas para revisão manual no /admin em vez de inventar um artista.
