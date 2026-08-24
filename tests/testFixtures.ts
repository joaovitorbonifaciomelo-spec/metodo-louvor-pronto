import type { Song } from "@/types/song";

let counter = 0;

export function makeSong(overrides: Partial<Song> = {}): Song {
  counter++;
  return {
    id: overrides.id ?? `song-${counter}`,
    title: overrides.title ?? `Música ${counter}`,
    artist: overrides.artist ?? null,
    version: overrides.version ?? null,
    key: overrides.key ?? "G",
    capo: overrides.capo ?? null,
    difficulty: overrides.difficulty ?? "intermediaria",
    energy: overrides.energy ?? 3,
    bpm: overrides.bpm ?? null,
    moments: overrides.moments ?? ["Adoração"],
    themes: overrides.themes ?? ["graça"],
    tags: overrides.tags ?? [],
    youtubeUrl: overrides.youtubeUrl ?? null,
    spotifyUrl: overrides.spotifyUrl ?? null,
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}
