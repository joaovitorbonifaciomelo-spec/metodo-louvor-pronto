import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccessInfo } from "@/lib/auth/session";
import { trackServer } from "@/lib/analytics/trackServer";
import { songFromRow, type SongRow } from "@/types/song";
import { calculateSongCompatibility } from "@/lib/recommendation/compatibility";
import { generateCompatibilityReasons } from "@/lib/recommendation/reasons";

/**
 * Sem assinatura ativa (inclusive visitante não logado, para a demo pública
 * pré-login — seção "Demonstração pública"), o resultado é limitado a uma
 * amostra pequena. Não é um plano grátis: é só a vitrine antes de assinar.
 */
const DEMO_RESULT_LIMIT = 3;

/**
 * "Quais louvores combinam?" / medleys sugeridos (seções 5-6). Determinístico
 * — sem chamada a IA.
 *
 * Performance: música base, catálogo e informação de acesso são buscados em
 * paralelo (nenhum depende do outro), e o evento de analytics não bloqueia a
 * resposta (fire-and-forget).
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "5") || 5));

  const supabase = createClient();

  const [{ data: baseRow, error: baseError }, { data: catalogRows, error: catalogError }, accessInfo] =
    await Promise.all([
      supabase.from("songs").select("*").eq("id", params.id).single(),
      supabase.from("songs").select("*").eq("active", true).neq("id", params.id).limit(500),
      getAccessInfo(),
    ]);

  if (baseError || !baseRow) {
    return NextResponse.json({ error: "Música base não encontrada." }, { status: 404 });
  }
  if (catalogError) {
    return NextResponse.json({ error: catalogError.message }, { status: 500 });
  }

  const base = songFromRow(baseRow as SongRow);
  const candidates = ((catalogRows ?? []) as SongRow[]).map(songFromRow);

  const entitled = accessInfo.access.granted;
  const limit = entitled ? requestedLimit : Math.min(requestedLimit, DEMO_RESULT_LIMIT);

  const sorted = candidates
    .map((candidate) => {
      const { score, breakdown } = calculateSongCompatibility(base, candidate);
      return {
        song: candidate,
        compatibility: score,
        reasons: generateCompatibilityReasons(base, candidate, breakdown),
      };
    })
    .sort((a, b) => b.compatibility - a.compatibility);

  const results = sorted.slice(0, limit);
  const lockedCount = entitled ? 0 : Math.max(0, sorted.length - results.length);

  void trackServer(
    supabase,
    "recommendation_generated",
    { songId: base.id, resultCount: results.length },
    accessInfo.userId
  ).catch(() => undefined);

  return NextResponse.json({ base, results, entitled, lockedCount });
}
