import {
  UTM_COOKIE_MAX_AGE_SECONDS,
  UTM_COOKIE_NAME,
  hasAnyUtm,
  parseUtmCookie,
  parseUtmFromSearchParams,
  serializeUtmCookie,
  type UtmData,
} from "./utm";

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

function readUtmCookie(): UtmData {
  if (!isBrowser()) return {};
  const match = document.cookie.split("; ").find((pair) => pair.startsWith(`${UTM_COOKIE_NAME}=`));
  if (!match) return {};
  const raw = decodeURIComponent(match.slice(UTM_COOKIE_NAME.length + 1));
  return parseUtmCookie(raw);
}

function writeUtmCookie(data: UtmData): void {
  if (!isBrowser()) return;
  const value = encodeURIComponent(serializeUtmCookie(data));
  document.cookie = `${UTM_COOKIE_NAME}=${value}; path=/; max-age=${UTM_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * Captura first-touch: só grava o cookie se ainda não existir nenhuma
 * atribuição válida guardada. Nunca sobrescreve uma origem paga já
 * registrada (mesmo com um clique novo mais tarde no funil) e nunca grava
 * um cookie vazio quando a URL de entrada não tem UTM/fbclid nenhum — ver
 * comportamento "landing sem UTMs" nos testes.
 */
export function captureUtmOnLanding(searchParams: URLSearchParams): void {
  if (!isBrowser()) return;
  if (hasAnyUtm(readUtmCookie())) return;

  const incoming = parseUtmFromSearchParams(searchParams);
  if (!hasAnyUtm(incoming)) return;

  writeUtmCookie(incoming);
}
