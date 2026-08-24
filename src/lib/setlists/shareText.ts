import type { SetlistItemWithSong } from "@/types/setlist";

/** Texto pronto para WhatsApp (seção 19). */
export function buildShareText(setlistName: string, items: SetlistItemWithSong[]): string {
  const lines = [setlistName.toUpperCase(), ""];

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.song.title}`);
    if (item.selectedKey || item.song.key) lines.push(`Tom: ${item.selectedKey ?? item.song.key}`);
    if (item.referenceUrl || item.song.youtubeUrl) {
      lines.push(`Referência: ${item.referenceUrl ?? item.song.youtubeUrl}`);
    }
    if (item.notes) lines.push(`Obs: ${item.notes}`);
    lines.push("");
  });

  return lines.join("\n").trim();
}
