/**
 * Atribuição UTM do funil (landing → signup/login → /assinar → checkout
 * Kiwify). Este módulo é puro (sem `document`/`next/headers`) para poder ser
 * testado direto e reutilizado tanto no client (captura) quanto no server
 * (montagem da URL de checkout) — ver utmClient.ts e utmServer.ts.
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

/** Click IDs além dos UTMs "clássicos" — hoje só fbclid, mas a lista pode crescer (ex.: gclid). */
export const CLICK_ID_KEYS = ["fbclid"] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

const ALL_KEYS = [...UTM_KEYS, ...CLICK_ID_KEYS];

export type UtmData = Partial<Record<UtmKey | ClickIdKey, string>>;

export const UTM_COOKIE_NAME = "lp_utm";
export const UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias — janela do funil, não é sessão de navegador

const MAX_VALUE_LENGTH = 200;

/** Nunca deixamos passar quebras de linha/controle — esses valores só circulam em querystring/cookie/header. */
function sanitizeValue(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\r\n\t]/g, "");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_VALUE_LENGTH);
}

/**
 * Extrai e sanitiza utm_source/medium/campaign/content/term + fbclid de uma
 * URLSearchParams (aceita também ReadonlyURLSearchParams do next/navigation,
 * que estende URLSearchParams). Ignora qualquer outro parâmetro da URL.
 */
export function parseUtmFromSearchParams(searchParams: URLSearchParams): UtmData {
  const result: UtmData = {};
  for (const key of ALL_KEYS) {
    const raw = searchParams.get(key);
    if (raw === null) continue;
    const clean = sanitizeValue(raw);
    if (clean) result[key] = clean;
  }
  return result;
}

/** Existe pelo menos uma origem/click id válido capturado. */
export function hasAnyUtm(data: UtmData): boolean {
  return ALL_KEYS.some((key) => Boolean(data[key]));
}

export function serializeUtmCookie(data: UtmData): string {
  return JSON.stringify(data);
}

/** Nunca lança erro em valor corrompido/adulterado — trata como "sem atribuição". */
export function parseUtmCookie(raw: string | undefined | null): UtmData {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: UtmData = {};
    for (const key of ALL_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string") {
        const clean = sanitizeValue(value);
        if (clean) result[key] = clean;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Acrescenta os parâmetros de tracking válidos a uma URL de checkout já
 * existente (mutação in-place, mesmo padrão de URLSearchParams.set usado em
 * /assinar). Nomes de parâmetro idênticos aos que a Kiwify já lê em
 * TrackingParameters (utm_source, utm_medium, ...) — nenhum remapeamento.
 */
export function appendUtmToUrl(url: URL, data: UtmData): void {
  for (const key of ALL_KEYS) {
    const value = data[key];
    if (value) url.searchParams.set(key, value);
  }
}
