import { z } from "zod";
import { MOMENTS } from "@/types/song";

export const DIFFICULTIES = ["iniciante", "intermediaria", "avancada"] as const;
export const MOMENTS_ENUM = MOMENTS;
/** Temas aceitam qualquer string — a taxonomia da seção 9 é um ponto de partida, não uma trava. */
export const THEMES_FREEFORM = z.string().trim().min(1);

export const createSongSchema = z.object({
  title: z.string().trim().min(1, "título é obrigatório"),
  artist: z.string().trim().nullable().optional(),
  version: z.string().trim().nullable().optional(),
  key: z.string().trim().nullable().optional(),
  capo: z.number().int().min(0).max(12).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  moments: z.array(z.enum(MOMENTS_ENUM)).default([]),
  themes: z.array(THEMES_FREEFORM).default([]),
  tags: z.array(z.string()).default([]),
  youtubeUrl: z.string().url().nullable().optional(),
  spotifyUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional().default(true),
});

export type CreateSongInput = z.infer<typeof createSongSchema>;
