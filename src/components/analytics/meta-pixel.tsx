"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID } from "@/lib/config/pixel";
import { initMetaPixel, trackMetaPageView } from "@/lib/analytics/metaPixel";

/**
 * Carrega o Meta Pixel só no browser (nunca no servidor) e cuida do PageView
 * em navegações SPA sem duplicar o do primeiro carregamento. Monte uma única
 * vez no layout raiz. Não renderiza nada (além do <noscript> de fallback) se
 * NEXT_PUBLIC_META_PIXEL_ID não estiver configurado.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const isFirstPathname = useRef(true);

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (isFirstPathname.current) {
      isFirstPathname.current = false;
      return;
    }
    trackMetaPageView();
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element -- pixel de fallback sem JS, next/image não se aplica */}
      <img
        height={1}
        width={1}
        alt=""
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}
