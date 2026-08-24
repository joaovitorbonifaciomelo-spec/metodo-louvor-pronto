import { z } from "zod";
import { MOMENTS } from "@/types/song";

/**
 * Parser CSV simples com suporte a campos entre aspas (RFC4180-ish).
 * Evita depender de uma lib externa para um formato conhecido e pequeno.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\r") {
      // ignora, \n cuida da quebra de linha
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const MULTI_VALUE_SEPARATOR = "|";

function splitMulti(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(MULTI_VALUE_SEPARATOR)
    .map((v) => v.trim())
    .filter(Boolean);
}

const songCsvRowSchema = z.object({
  title: z.string().trim().min(1, "título é obrigatório"),
  artist: z.string().trim().optional(),
  version: z.string().trim().optional(),
  key: z.string().trim().optional(),
  capo: z.number().int().min(0).max(12).nullable(),
  difficulty: z.enum(["iniciante", "intermediaria", "avancada"]).optional(),
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
  bpm: z.number().int().min(40).max(300).nullable(),
  moments: z.array(z.enum(MOMENTS)),
  themes: z.array(z.string()),
  tags: z.array(z.string()),
  youtube_url: z.string().url().optional(),
});

export type ValidSongCsvRow = z.infer<typeof songCsvRowSchema>;

export interface CsvImportError {
  rowNumber: number;
  errors: string[];
  raw: Record<string, string>;
}

export interface CsvImportResult {
  valid: ValidSongCsvRow[];
  invalid: CsvImportError[];
}

const REQUIRED_HEADER = [
  "title",
  "artist",
  "version",
  "key",
  "capo",
  "difficulty",
  "energy",
  "bpm",
  "moments",
  "themes",
  "tags",
  "youtube_url",
];

function toNullableInt(value: string | undefined): number | null | undefined {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

/**
 * Parseia e valida um CSV de músicas no formato da seção 22 do briefing.
 * Campos multivalorados (moments/themes/tags) usam "|" como separador interno,
 * já que "," é o separador de coluna.
 */
export function parseSongsCsv(text: string): CsvImportResult {
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return { valid: [], invalid: [] };

  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const missingColumns = REQUIRED_HEADER.filter((col) => !header.includes(col));
  if (missingColumns.length > 0) {
    return {
      valid: [],
      invalid: [
        {
          rowNumber: 1,
          errors: [`Cabeçalho inválido. Colunas faltando: ${missingColumns.join(", ")}`],
          raw: {},
        },
      ],
    };
  }

  const valid: ValidSongCsvRow[] = [];
  const invalid: CsvImportError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i] ?? [];
    const raw: Record<string, string> = {};
    header.forEach((col, idx) => {
      raw[col] = cols[idx] ?? "";
    });

    const capo = toNullableInt(raw.capo);
    const energyRaw = toNullableInt(raw.energy);
    const bpm = toNullableInt(raw.bpm);

    const candidate = {
      title: raw.title,
      artist: raw.artist || undefined,
      version: raw.version || undefined,
      key: raw.key || undefined,
      capo: Number.isNaN(capo) ? null : capo,
      difficulty: (raw.difficulty || undefined) as ValidSongCsvRow["difficulty"],
      energy: Number.isNaN(energyRaw) ? null : energyRaw,
      bpm: Number.isNaN(bpm) ? null : bpm,
      moments: splitMulti(raw.moments),
      themes: splitMulti(raw.themes),
      tags: splitMulti(raw.tags),
      youtube_url: raw.youtube_url || undefined,
    };

    const result = songCsvRowSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        rowNumber: i + 1,
        errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        raw,
      });
    }
  }

  return { valid, invalid };
}
