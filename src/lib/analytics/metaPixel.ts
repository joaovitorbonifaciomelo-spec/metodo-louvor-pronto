import { META_PIXEL_ID } from "@/lib/config/pixel";

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: FbqFn;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

let initialized = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Injeta o script do Meta Pixel (fbevents.js) uma única vez. Cria o shim de
 * fila padrão da Meta antes do script real carregar, para não perder chamadas
 * feitas enquanto ele ainda está em trânsito.
 */
function injectPixelScript(): void {
  if (window.fbq) return;

  const queue: unknown[][] = [];
  const fbq: FbqFn = (...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      queue.push(args);
    }
  };
  fbq.queue = queue;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;

  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

/**
 * Inicializa o pixel e dispara o primeiro PageView. Chamar uma única vez, no
 * mount do componente global (ver src/components/analytics/meta-pixel.tsx).
 * No-op se NEXT_PUBLIC_META_PIXEL_ID não estiver configurado, se não houver
 * `window` (SSR) ou se já tiver sido inicializado nesta sessão de página.
 */
export function initMetaPixel(): void {
  if (initialized || !META_PIXEL_ID || !isBrowser()) return;
  initialized = true;

  injectPixelScript();
  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
}

/** PageView para navegações subsequentes (SPA) — não usar no primeiro load, que já é coberto por initMetaPixel. */
export function trackMetaPageView(): void {
  if (!META_PIXEL_ID || !isBrowser() || !window.fbq) return;
  window.fbq("track", "PageView");
}

/** Evento padrão da Meta (ex.: "Lead", "CompleteRegistration"). Nunca inclua PII em params. */
export function trackMetaEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!META_PIXEL_ID || !isBrowser() || !window.fbq) return;
  window.fbq("track", eventName, params);
}

/** Evento customizado da Meta (trackCustom). Nunca inclua PII em params. */
export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!META_PIXEL_ID || !isBrowser() || !window.fbq) return;
  window.fbq("trackCustom", eventName, params);
}
