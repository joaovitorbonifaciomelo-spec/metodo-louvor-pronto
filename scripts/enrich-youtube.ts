import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { searchYoutube } from "../src/lib/youtube/searchYoutube";
import { calculateYoutubeConfidence, YOUTUBE_CONFIDENCE_THRESHOLDS } from "../src/lib/youtube/confidence";

config({ path: path.resolve(__dirname, "..", ".env.local") });

/**
 * Enriquecimento em lote do catálogo via YouTube Data API oficial (seções 9-12
 * do briefing de performance/UX). NUNCA roda por trás de uma requisição de
 * usuário — é um processo administrativo, sob demanda:
 *
 *   npm run enrich:youtube -- --limit=20
 *
 * Requer YOUTUBE_API_KEY no .env.local (nunca NEXT_PUBLIC_). A API tem cota
 * diária padrão de 10.000 unidades e cada busca custa 100 — ou seja, ~100
 * buscas/dia no plano gratuito. Use --limit para não estourar a cota.
 */

interface SongToEnrich {
  id: string;
  title: string;
  artist: string | null;
}

function parseLimitArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  const value = arg ? Number(arg.split("=")[1]) : 20;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

function buildQuery(song: SongToEnrich): string {
  return song.artist ? `${song.title} ${song.artist} oficial` : `${song.title} louvor`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  if (!process.env.YOUTUBE_API_KEY) {
    console.error("Falta YOUTUBE_API_KEY no .env.local. Veja .env.example — obtenha em https://console.cloud.google.com/apis/credentials (ative a YouTube Data API v3).");
    process.exit(1);
  }

  const limit = parseLimitArg();
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("songs")
    .select("id, title, artist")
    .is("youtube_url", null)
    .eq("youtube_status", "pending")
    .order("title")
    .limit(limit);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const songs = (data ?? []) as SongToEnrich[];
  console.log(`Processando ${songs.length} música(s) sem referência de YouTube (limite: ${limit})…`);

  let found = 0;
  let review = 0;
  let notFound = 0;
  let apiErrors = 0;

  for (const song of songs) {
    try {
      const query = buildQuery(song);
      const candidates = await searchYoutube(query, 5);

      if (candidates.length === 0) {
        await supabase.from("songs").update({ youtube_status: "not_found" }).eq("id", song.id);
        notFound++;
        console.log(`  [não encontrada] ${song.title}`);
        continue;
      }

      const scored = candidates
        .map((c) => ({ candidate: c, ...calculateYoutubeConfidence(song, c) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0]!;

      const commonFields = {
        youtube_video_id: best.candidate.videoId,
        youtube_title: best.candidate.title,
        youtube_channel: best.candidate.channelTitle,
        youtube_thumbnail: best.candidate.thumbnailUrl,
        youtube_verified_at: new Date().toISOString(),
      };

      if (best.score >= YOUTUBE_CONFIDENCE_THRESHOLDS.autoConfirm) {
        await supabase
          .from("songs")
          .update({ ...commonFields, youtube_url: `https://www.youtube.com/watch?v=${best.candidate.videoId}`, youtube_status: "found" })
          .eq("id", song.id);
        found++;
        console.log(`  [encontrada, score ${best.score}] ${song.title} -> ${best.candidate.title}`);
      } else if (best.score >= YOUTUBE_CONFIDENCE_THRESHOLDS.minimumToSuggest) {
        await supabase.from("songs").update({ ...commonFields, youtube_status: "review" }).eq("id", song.id);
        review++;
        console.log(`  [revisar, score ${best.score}] ${song.title} -> ${best.candidate.title}`);
      } else {
        await supabase.from("songs").update({ youtube_status: "not_found" }).eq("id", song.id);
        notFound++;
        console.log(`  [confiança baixa demais, score ${best.score}] ${song.title}`);
      }
    } catch (err) {
      apiErrors++;
      console.error(`  [erro] ${song.title}:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && /quota|429/i.test(err.message)) {
        console.error("Parece ser um limite de cota da YouTube Data API — interrompendo o processamento.");
        break;
      }
    }

    await sleep(150);
  }

  console.log("\n--- Relatório ---");
  console.log(`Encontradas automaticamente: ${found}`);
  console.log(`Precisam revisão: ${review}`);
  console.log(`Não encontradas: ${notFound}`);
  console.log(`Erros de API: ${apiErrors}`);
  console.log(`Já existentes (não reprocessadas nesta rodada): ver total de músicas - ${songs.length} processadas`);
}

main();
