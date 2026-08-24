import { describe, expect, it } from "vitest";
import { parseCsv, parseSongsCsv } from "@/lib/csv/parseSongsCsv";

describe("parseCsv", () => {
  it("splits simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('title,note\n"Bondade, de Deus",ok')).toEqual([
      ["title", "note"],
      ["Bondade, de Deus", "ok"],
    ]);
  });
});

const HEADER = "title,artist,version,key,capo,difficulty,energy,bpm,moments,themes,tags,youtube_url";

describe("parseSongsCsv", () => {
  it("parses a valid row with multi-value fields", () => {
    const csv = `${HEADER}\nBondade de Deus,Isaías Saad,,G,0,intermediaria,3,80,Adoração|Ministração,fidelidade|gratidão,contemporaneo,https://youtube.com/watch?v=abc`;
    const result = parseSongsCsv(csv);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      title: "Bondade de Deus",
      artist: "Isaías Saad",
      key: "G",
      capo: 0,
      energy: 3,
      moments: ["Adoração", "Ministração"],
      themes: ["fidelidade", "gratidão"],
    });
  });

  it("accepts rows with missing optional data as null", () => {
    const csv = `${HEADER}\nMúsica Sem Metadados,,,,,,,,Adoração,,,`;
    const result = parseSongsCsv(csv);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0]?.key).toBeUndefined();
    expect(result.valid[0]?.capo).toBeNull();
    expect(result.valid[0]?.energy).toBeNull();
  });

  it("rejects a row with an invalid moment", () => {
    const csv = `${HEADER}\nMúsica X,,,,,,,,MomentoInvalido,,,`;
    const result = parseSongsCsv(csv);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]?.errors.join(" ")).toMatch(/moments/);
  });

  it("rejects a row without title", () => {
    const csv = `${HEADER}\n,Artista,,,,,,,,,,`;
    const result = parseSongsCsv(csv);
    expect(result.invalid).toHaveLength(1);
  });

  it("reports a missing-header error instead of crashing", () => {
    const result = parseSongsCsv("title,artist\nX,Y");
    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0]?.errors[0]).toMatch(/Cabeçalho inválido/);
  });
});
