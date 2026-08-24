import type { ServiceType } from "@/types/setlist";
import type { SetlistStructureSlot } from "@/lib/recommendation/generateSetlist";

/** Estruturas padrão sugeridas por tipo de culto — só um ponto de partida editável. */
export const DEFAULT_STRUCTURE_BY_SERVICE_TYPE: Record<ServiceType, SetlistStructureSlot[]> = {
  Domingo: [
    { moment: "Celebração", count: 2 },
    { moment: "Adoração", count: 2 },
    { moment: "Ministração", count: 1 },
    { moment: "Encerramento", count: 1 },
  ],
  Jovens: [
    { moment: "Celebração", count: 2 },
    { moment: "Adoração", count: 2 },
    { moment: "Ministração", count: 1 },
  ],
  Ceia: [
    { moment: "Adoração", count: 1 },
    { moment: "Ceia", count: 2 },
    { moment: "Ministração", count: 1 },
  ],
  Oração: [
    { moment: "Adoração", count: 1 },
    { moment: "Ministração", count: 2 },
  ],
  Vigília: [
    { moment: "Celebração", count: 2 },
    { moment: "Adoração", count: 2 },
    { moment: "Ministração", count: 2 },
    { moment: "Encerramento", count: 1 },
  ],
  Outro: [
    { moment: "Celebração", count: 1 },
    { moment: "Adoração", count: 1 },
    { moment: "Encerramento", count: 1 },
  ],
};
