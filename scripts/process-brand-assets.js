/**
 * Gera os assets de marca otimizados a partir dos arquivos originais em
 * assets/brand-source/ (fora de public/, não são servidos como estão —
 * pesam ~1.5-1.8MB cada). Rode de novo se a logo original for substituída.
 *
 *   node scripts/process-brand-assets.js
 */
const sharp = require("sharp");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fullSrc = path.join(root, "assets", "brand-source", "logo-full-original.png");
const markSrc = path.join(root, "assets", "brand-source", "logo-mark-original.png");

async function main() {
  await sharp(fullSrc)
    .trim()
    .resize({ width: 900, withoutEnlargement: true })
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(root, "public", "brand", "logo-full.png"));

  const markTrimmed = sharp(markSrc).trim();
  await markTrimmed.clone().resize(512, 512).png().toFile(path.join(root, "public", "brand", "logo-mark-512.png"));
  await markTrimmed.clone().resize(180, 180).png().toFile(path.join(root, "public", "brand", "logo-mark-180.png"));

  await sharp(markSrc).resize(512, 512).png().toFile(path.join(root, "src", "app", "icon.png"));
  await sharp(markSrc).resize(180, 180).png().toFile(path.join(root, "src", "app", "apple-icon.png"));

  console.log("Assets de marca gerados em public/brand/, src/app/icon.png e src/app/apple-icon.png.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
