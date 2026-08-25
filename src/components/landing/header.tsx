import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { product } from "@/lib/config/product";
import { PrimaryCta, type CtaAccessState } from "./primary-cta";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#preco", label: "Preço" },
];

export function LandingHeader({ access }: { access: CtaAccessState }) {
  return (
    <header className="sticky top-0 z-20 flex w-full justify-center border-b border-base-900/80 bg-base-950/90 backdrop-blur">
      <div className="flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={product.name} className="shrink-0">
          <BrandLogo variant="full" priority className="h-7 sm:h-9" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-base-300 sm:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-base-50">
              {link.label}
            </a>
          ))}
          {!access.loggedIn && (
            <Link href="/login" className="hover:text-base-50">
              Entrar
            </Link>
          )}
        </nav>

        <PrimaryCta access={access} label="Começar agora" className="!min-h-[40px] px-4 text-sm sm:!min-h-[44px]" />
      </div>
    </header>
  );
}
