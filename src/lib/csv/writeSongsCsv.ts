import type { SeedSongInput } from "@/data/seedSongs";

const HEADER = ["title", "artist", "version", "key", "capo", "difficulty", "energy", "bpm", "moments", "themes", "tags", "youtube_url"];

function csvField(value: string): string {
  if (/[",\n|]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializa o catálogo (seedSongs.ts) no mesmo formato aceito pelo importador CSV do admin. */
export function writeSongsCsv(songs: SeedSongInput[]): string {
  const lines = [HEADER.join(",")];

  for (const song of songs) {
    const row = [
      song.title,
      song.artist ?? "",
      "",
      "",
      "",
      song.difficulty,
      String(song.energy),
      "",
      song.moments.join("|"),
      song.themes.join("|"),
      song.tags.join("|"),
      "",
    ];
    lines.push(row.map(csvField).join(","));
  }

  return lines.join("\n");
}
