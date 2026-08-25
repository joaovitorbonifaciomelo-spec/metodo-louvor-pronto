/**
 * Meta Pixel — configurado via variável de ambiente (Vercel Production).
 * Nunca hardcodar o ID; se a variável não existir, o tracking vira no-op
 * (ver src/lib/analytics/metaPixel.ts) e o app continua funcionando normal.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || null;
