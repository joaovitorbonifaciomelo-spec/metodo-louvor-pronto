import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CtaAccessState {
  /** Há uma sessão logada (independente de ter assinatura ativa). */
  loggedIn: boolean;
  /** Assinatura ativa (ou bypass admin/dev) — mesmo valor de access.granted. */
  granted: boolean;
}

/**
 * Único lugar que decide para onde os CTAs de conversão da landing apontam.
 * Nunca linkar direto para KIWIFY_CHECKOUT_URL aqui — isso é responsabilidade
 * exclusiva de /assinar (ver src/lib/config/billing.ts).
 */
export function primaryCtaHref({ loggedIn, granted }: CtaAccessState): string {
  if (!loggedIn) return "/signup";
  return granted ? "/buscar" : "/assinar";
}

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
  const text = access.loggedIn && access.granted ? "Abrir Louvor Pronto" : label;
  return (
    <Link href={href} className={cn(BASE_CLASSES, className)}>
      {text}
    </Link>
  );
}
