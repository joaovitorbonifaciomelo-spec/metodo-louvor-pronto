import Link from "next/link";
import { DiscoverDemo } from "@/components/discover-demo";
import { BrandLogo } from "@/components/brand-logo";
import { product } from "@/lib/config/product";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center">
      <header className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-4 sm:px-6 sm:py-6">
        <Link href="/" aria-label={product.name}>
          <BrandLogo variant="full" priority className="h-8 sm:h-10" />
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/login" className="rounded-lg px-2 py-2 text-base-300 hover:text-base-100">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-3 py-2 font-medium text-accent-fg hover:bg-accent/90 sm:px-3.5"
          >
            Testar grátis
          </Link>
        </nav>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-8 pt-8 text-center sm:px-6 sm:pb-10 sm:pt-16">
        <span className="text-xs font-medium uppercase tracking-widest text-accent">{product.tagline}</span>
        <h1 className="text-[clamp(1.75rem,7vw,3.25rem)] font-semibold leading-[1.15] text-base-50">
          Monte o repertório do próximo culto em minutos.
        </h1>
        <p className="max-w-xl text-[15px] text-base-400 sm:text-lg">
          Escolha uma música, descubra quais louvores combinam e monte seu setlist sem começar do zero.
        </p>
      </section>

      <section className="w-full max-w-3xl px-4 pb-20 sm:px-6 sm:pb-24">
        <DiscoverDemo />
      </section>

      <footer className="w-full max-w-5xl px-4 pb-10 text-center text-xs text-base-500 sm:px-6">
        {product.name} — {new Date().getFullYear()}
      </footer>
    </main>
  );
}
