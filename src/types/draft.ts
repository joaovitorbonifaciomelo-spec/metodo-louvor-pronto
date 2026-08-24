import type { Song } from "./song";

export interface DraftSetlistItem {
  tempId: string;
  song: Song;
  moment: string;
  selectedKey: string | null;
  notes: string | null;
  referenceUrl: string | null;
  locked: boolean;
}
