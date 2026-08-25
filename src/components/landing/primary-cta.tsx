"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/analytics/metaPixel";
import { primaryCtaHref, type CtaAccessState } from "@/lib/landing/cta-href";

export type { CtaAccessState };

const BASE_CLASSES =
  "inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-fg transition-colors hover:bg-accent/90";

export function PrimaryCta({
  access,
  label,
  className,
}: {
  access: CtaAccessState;
  label: string;
  className?: string;
}) {
  const href = primaryCtaHref(access);
  const isAppEntry = access.loggedIn && access.granted;
  const text = isAppEntry ? "Abrir Louvor Pronto" : label;

  function handleClick() {
    // Assinante entrando no app não é intenção de aquisição — não conta como Lead.
    if (isAppEntry) return;
    trackMetaEvent("Lead", { content_name: label });
  }

  return (
    <Link href={href} className={cn(BASE_CLASSES, className)} onClick={handleClick}>
      {text}
    </Link>
  );
}
