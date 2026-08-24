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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
