import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(__dirname, "..", ".env.local") });

/**
 * Marca review_required=true para músicas sem artista (ou sem tom) — nunca
 * inventamos o valor, só sinalizamos para revisão manual no /admin.
 * Idempotente: só toca linhas com review_required=false.
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("songs")
    .update({ review_required: true })
    .is("artist", null)
    .eq("review_required", false)
    .select("id");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`${data?.length ?? 0} música(s) marcada(s) como "precisa de revisão" (sem artista confiável).`);
}

main();
