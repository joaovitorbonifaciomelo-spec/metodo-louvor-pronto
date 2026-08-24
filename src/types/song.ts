export const MOMENTS = [
  "Abertura",
  "Celebração",
  "Adoração",
  "Ministração",
  "Ceia",
  "Apelo",
  "Oferta",
  "Encerramento",
  "Outros",
] as const;
export type Moment = (typeof MOMENTS)[number];

export const THEMES = [
  "gratidão",
  "fidelidade",
  "graça",
  "cruz",
  "salvação",
  "entrega",
  "presença",
  "Espírito Santo",
  "adoração",
  "santidade",
  "confiança",
  "esperança",
  "cura",
  "soberania",
  "alegria",
  "celebração",
  "comunhão",
  "arrependimento",
  "missão",
] as const;
export type Theme = (typeof THEMES)[number] | (string & {});

export const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
] as const;
export type MusicalKey = (typeof KEYS)[number];

export type Difficulty = "iniciante" | "intermediaria" | "avancada";

/** 1 = muito contemplativa ... 5 = muito celebrativa */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type YoutubeStatus = "pending" | "found" | "review" | "not_found" | "confirmed";

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  version: string | null;
  key: MusicalKey | null;
  capo: number | null;
  difficulty: Difficulty | null;
  energy: EnergyLevel | null;
  bpm: number | null;
  /** string[] em vez de Moment[]: admin pode cadastrar momentos além da taxonomia inicial. */
  moments: string[];
  themes: string[];
  tags: string[];
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  active: boolean;
  /** true quando um campo (ex.: artista) não foi preenchido por falta de confiança — nunca inventado. */
  reviewRequired: boolean;
  youtubeVideoId: string | null;
  youtubeTitle: string | null;
  youtubeChannel: string | null;
  youtubeThumbnail: string | null;
  youtubeVerifiedAt: string | null;
  youtubeStatus: YoutubeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SongRow {
  id: string;
  title: string;
  artist: string | null;
  version: string | null;
  key: string | null;
  capo: number | null;
  difficulty: string | null;
  energy: number | null;
  bpm: number | null;
  moments: string[] | null;
  themes: string[] | null;
  tags: string[] | null;
  youtube_url: string | null;
  spotify_url: string | null;
  active: boolean;
  review_required: boolean;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_channel: string | null;
  youtube_thumbnail: string | null;
  youtube_verified_at: string | null;
  youtube_status: string;
  created_at: string;
  updated_at: string;
}

export function songFromRow(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    version: row.version,
    key: (row.key as MusicalKey) ?? null,
    capo: row.capo,
    difficulty: (row.difficulty as Difficulty) ?? null,
    energy: (row.energy as EnergyLevel) ?? null,
    bpm: row.bpm,
    moments: row.moments ?? [],
    themes: row.themes ?? [],
    tags: row.tags ?? [],
    youtubeUrl: row.youtube_url,
    spotifyUrl: row.spotify_url,
    active: row.active,
    reviewRequired: row.review_required ?? false,
    youtubeVideoId: row.youtube_video_id ?? null,
    youtubeTitle: row.youtube_title ?? null,
    youtubeChannel: row.youtube_channel ?? null,
    youtubeThumbnail: row.youtube_thumbnail ?? null,
    youtubeVerifiedAt: row.youtube_verified_at ?? null,
    youtubeStatus: (row.youtube_status as YoutubeStatus) ?? "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
