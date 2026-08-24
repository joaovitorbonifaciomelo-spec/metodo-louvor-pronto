import Link from "next/link";
import { DiscoverDemo } from "@/components/discover-demo";
import { product } from "@/lib/config/product";

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center">
      <header className="flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight text-base-100">{product.name}</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-base-300 hover:text-base-100">
            Entrar
          </Link>
          <Link href="/signup" className="rounded-lg bg-accent px-3.5 py-2 font-medium text-accent-fg hover:bg-accent/90">
            Testar grátis
          </Link>
        </nav>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-4 px-6 pb-10 pt-10 text-center sm:pt-16">
        <span className="text-xs font-medium uppercase tracking-widest text-accent">{product.tagline}</span>
        <h1 className="text-3xl font-semibold leading-tight text-base-50 sm:text-5xl">
          Monte o repertório do próximo culto em minutos.
        </h1>
        <p className="max-w-xl text-base text-base-400 sm:text-lg">
          Escolha uma música, descubra quais louvores combinam e monte seu setlist sem começar do zero.
        </p>
      </section>

      <section className="w-full max-w-3xl px-6 pb-24">
        <DiscoverDemo />
      </section>

      <footer className="w-full max-w-5xl px-6 pb-10 text-center text-xs text-base-500">
        {product.name} — {new Date().getFullYear()}
      </footer>
    </main>
  );
}
