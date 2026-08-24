import { describe, expect, it } from "vitest";
import { generateSetlist } from "@/lib/recommendation/generateSetlist";
import { makeSong } from "./testFixtures";

const catalog = [
  makeSong({ id: "abertura-1", moments: ["Abertura"], energy: 5, difficulty: "iniciante" }),
  makeSong({ id: "cel-1", moments: ["Celebração"], energy: 5, difficulty: "iniciante", themes: ["celebração"] }),
  makeSong({ id: "cel-2", moments: ["Celebração"], energy: 4, difficulty: "intermediaria", themes: ["alegria"] }),
  makeSong({ id: "ado-1", moments: ["Adoração"], energy: 3, difficulty: "intermediaria", themes: ["graça"] }),
  makeSong({ id: "ado-2", moments: ["Adoração"], energy: 2, difficulty: "avancada", themes: ["entrega"] }),
  makeSong({ id: "enc-1", moments: ["Encerramento"], energy: 3, difficulty: "iniciante" }),
];

describe("generateSetlist", () => {
  it("fills every slot of the structure in order", () => {
    const [variant] = generateSetlist({
      songs: catalog,
      structure: [
        { moment: "Celebração", count: 2 },
        { moment: "Adoração", count: 2 },
        { moment: "Encerramento", count: 1 },
      ],
      teamLevel: "avancada",
      variantCount: 1,
    });

    expect(variant?.items).toHaveLength(5);
    expect(variant?.items.map((i) => i.moment)).toEqual([
      "Celebração",
      "Celebração",
      "Adoração",
      "Adoração",
      "Encerramento",
    ]);
    expect(variant?.items.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("respects locked items and keeps them in place", () => {
    const [variant] = generateSetlist({
      songs: catalog,
      structure: [{ moment: "Celebração", count: 2 }],
      teamLevel: "avancada",
      variantCount: 1,
      lockedItems: [{ position: 1, songId: "cel-2" }],
    });

    expect(variant?.items[0]?.song.id).toBe("cel-2");
    expect(variant?.items[0]?.locked).toBe(true);
  });

  it("places the mandatory song in a slot matching its moment", () => {
    const [variant] = generateSetlist({
      songs: catalog,
      structure: [
        { moment: "Celebração", count: 1 },
        { moment: "Adoração", count: 1 },
      ],
      teamLevel: "avancada",
      variantCount: 1,
      mandatorySongId: "ado-2",
    });

    const placed = variant?.items.find((i) => i.song.id === "ado-2");
    expect(placed?.moment).toBe("Adoração");
  });

  it("filters candidates by team level when possible", () => {
    const [variant] = generateSetlist({
      songs: catalog,
      structure: [{ moment: "Adoração", count: 2 }],
      teamLevel: "iniciante",
      variantCount: 1,
    });

    // nenhuma música de Adoração é "iniciante" — deve cair para o próximo nível permitido
    // sem quebrar, e ainda preencher os slots.
    expect(variant?.items).toHaveLength(2);
  });

  it("produces distinct-enough variants when variantCount > 1", () => {
    const variants = generateSetlist({
      songs: catalog,
      structure: [{ moment: "Celebração", count: 1 }],
      teamLevel: "avancada",
      variantCount: 2,
    });

    expect(variants).toHaveLength(2);
    expect(variants[0]?.label).toBe("A");
    expect(variants[1]?.label).toBe("B");
  });

  it("returns an empty item list when the structure is empty", () => {
    const [variant] = generateSetlist({
      songs: catalog,
      structure: [],
      teamLevel: "avancada",
      variantCount: 1,
    });
    expect(variant?.items).toHaveLength(0);
  });
});
