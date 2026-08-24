import { writeFileSync } from "node:fs";
import path from "node:path";
import { SEED_SONGS } from "../src/data/seedSongs";
import { writeSongsCsv } from "../src/lib/csv/writeSongsCsv";

const outPath = path.resolve(__dirname, "..", "data", "seed-songs.csv");
writeFileSync(outPath, writeSongsCsv(SEED_SONGS), "utf-8");
console.log(`CSV gerado com ${SEED_SONGS.length} músicas em ${outPath}`);
