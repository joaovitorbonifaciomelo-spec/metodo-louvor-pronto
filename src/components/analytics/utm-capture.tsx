"use client";

import { useEffect } from "react";
import { captureUtmOnLanding } from "@/lib/marketing/utmClient";

/**
 * Monta uma única vez no layout raiz. Roda só no primeiro carregamento real
 * da aba (mount do layout raiz não se repete em navegações internas do App
 * Router), lendo window.location.search — não precisa de useSearchParams
 * porque não nos importamos com trocas de rota via <Link>, só com a URL de
 * entrada do visitante no site.
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtmOnLanding(new URLSearchParams(window.location.search));
  }, []);

  return null;
}
