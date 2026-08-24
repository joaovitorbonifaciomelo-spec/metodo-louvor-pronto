export const SERVICE_TYPES = ["Domingo", "Jovens", "Ceia", "Oração", "Vigília", "Outro"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const TEAM_LEVELS = ["iniciante", "intermediaria", "avancada"] as const;
export type TeamLevel = (typeof TEAM_LEVELS)[number];

export interface SetlistStructureSlot {
  moment: string;
  count: number;
}

export interface Setlist {
  id: string;
  userId: string;
  churchId: string | null;
  name: string;
  serviceType: ServiceType;
  theme: string | null;
  serviceDate: string | null;
  teamLevel: TeamLevel;
  createdAt: string;
  updatedAt: string;
}

export interface SetlistItem {
  id: string;
  setlistId: string;
  songId: string;
  position: number;
  moment: string;
  selectedKey: string | null;
  notes: string | null;
  referenceUrl: string | null;
  locked: boolean;
}

export interface SetlistItemWithSong extends SetlistItem {
  song: import("./song").Song;
}
