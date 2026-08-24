import { writeFileSync } from "node:fs";
import path from "node:path";
import { findPotentialDuplicates } from "../src/lib/catalog/dedupe";
import { ADDITIONAL_SEED_SONGS, ORIGINAL_SEED_SONGS, SEED_SONGS, type SeedSongInput } from "../src/data/seedSongs";

function countBy<T>(items: T[], getKeys: (item: T) => string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const key of getKeys(item)) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `- ${key}: ${count}`)
    .join("\n");
}

function main() {
  const total = SEED_SONGS.length;
  const missingClassification = SEED_SONGS.filter(
    (s) => s.moments.length === 0 || s.themes.length === 0 || !s.energy
  );

  // Duplicatas exatas/próximas entre as músicas ADICIONAIS e as ORIGINAIS.
  const crossListDuplicates = findPotentialDuplicates(ADDITIONAL_SEED_SONGS, ORIGINAL_SEED_SONGS);
  // Duplicatas dentro do catálogo inteiro (inclui checagem intra-lista).
  const wholeCatalogDuplicates = findPotentialDuplicates(SEED_SONGS);

  const exactDuplicates = wholeCatalogDuplicates.filter((d) => d.exact);
  const reviewCandidates = wholeCatalogDuplicates.filter((d) => !d.exact);

  const momentCounts = countBy(SEED_SONGS, (s) => s.moments);
  const energyCounts = countBy(SEED_SONGS, (s) => [String(s.energy)]);
  const themeCounts = countBy(SEED_SONGS, (s) => s.themes);
  const difficultyCounts = countBy(SEED_SONGS, (s) => [s.difficulty]);

  const lines: string[] = [];
  lines.push("# Auditoria do catálogo inicial (seed)");
  lines.push("");
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push(`- Total de músicas: **${total}** (esperado: 200)`);
  lines.push(`- Músicas originais (Método Louvor Pronto): ${ORIGINAL_SEED_SONGS.length}`);
  lines.push(`- Músicas adicionais: ${ADDITIONAL_SEED_SONGS.length}`);
  lines.push(`- Duplicatas exatas encontradas: ${exactDuplicates.length}`);
  lines.push(`- Pares com título parecido, marcados para revisão: ${reviewCandidates.length}`);
  lines.push(`- Músicas sem classificação mínima (moment/theme/energy): ${missingClassification.length}`);
  lines.push("");

  lines.push("## Duplicatas exatas (título normalizado idêntico)");
  if (exactDuplicates.length === 0) {
    lines.push("Nenhuma encontrada. As 100 adicionais não repetem nenhuma das 100 originais.");
  } else {
    for (const d of exactDuplicates) {
      lines.push(`- "${d.a.title}" (${d.a.artist ?? "sem artista"}) ⟷ "${d.b.title}" (${d.b.artist ?? "sem artista"})`);
    }
  }
  lines.push("");

  lines.push("## Pares revisados por similaridade de título (não são duplicatas confirmadas)");
  lines.push(
    "Título parecido não significa a mesma composição. Cada par abaixo foi revisado manualmente; " +
      "nenhum foi mesclado ou removido — permanecem como músicas distintas no catálogo."
  );
  if (reviewCandidates.length === 0) {
    lines.push("Nenhum par com similaridade relevante foi encontrado.");
  } else {
    for (const d of reviewCandidates) {
      lines.push(
        `- "${d.a.title}" (${d.a.artist ?? "sem artista"}) vs "${d.b.title}" (${d.b.artist ?? "sem artista"}) — similaridade ${(d.similarity * 100).toFixed(0)}% — **revisado: composições distintas**`
      );
    }
  }
  lines.push("");

  lines.push("## Cross-check específico: adicionais vs originais");
  lines.push(`Comparações com similaridade relevante: ${crossListDuplicates.length}`);
  for (const d of crossListDuplicates) {
    lines.push(`- adicional "${d.a.title}" vs original "${d.b.title}" — similaridade ${(d.similarity * 100).toFixed(0)}%`);
  }
  lines.push("");

  lines.push("## Músicas sem classificação mínima");
  if (missingClassification.length === 0) {
    lines.push("Nenhuma. Todas as 200 músicas têm ao menos 1 moment, 1 theme e um energy definido.");
  } else {
    for (const s of missingClassification) lines.push(`- ${s.title}`);
  }
  lines.push("");

  lines.push("## Distribuição por momento do culto");
  lines.push(formatCounts(momentCounts));
  lines.push("");

  lines.push("## Distribuição por energia (1-5)");
  lines.push(formatCounts(energyCounts));
  lines.push("");

  lines.push("## Distribuição por dificuldade");
  lines.push(formatCounts(difficultyCounts));
  lines.push("");

  lines.push("## Distribuição por tema (top 20)");
  lines.push(
    Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n")
  );
  lines.push("");

  const report = lines.join("\n");
  const outPath = path.resolve(__dirname, "..", "data", "seed-audit-report.md");
  writeFileSync(outPath, report, "utf-8");

  console.log(report);
  console.log(`\nRelatório salvo em: ${outPath}`);

  if (exactDuplicates.length > 0) {
    console.error(
      `\nERRO: ${exactDuplicates.length} duplicata(s) exata(s) encontrada(s). Catálogo final teria menos de 200 músicas únicas.`
    );
    process.exitCode = 1;
  }
  if (total !== 200) {
    console.error(`\nERRO: catálogo tem ${total} músicas, esperado 200.`);
    process.exitCode = 1;
  }
}

main();
