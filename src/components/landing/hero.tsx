import { CompatibilityList } from "@/components/compatibility-list";
import { product, pricing } from "@/lib/config/product";
import type { HeroExamplePair } from "@/lib/landing/hero-example";
import { PrimaryCta, type CtaAccessState } from "./primary-cta";
import { SocialProofBadge } from "./social-proof-badge";

export function Hero({ access, example }: { access: CtaAccessState; example: HeroExamplePair | null }) {
  return (
    <section className="flex w-full max-w-5xl flex-col items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:flex-row lg:items-center lg:gap-12 lg:pt-20">
      <div className="flex flex-col items-center gap-5 text-center lg:w-1/2 lg:items-start lg:text-left">
        <span className="text-xs font-medium uppercase tracking-widest text-accent">{product.tagline}</span>
        <h1 className="text-[clamp(1.75rem,6vw,3.25rem)] font-semibold leading-[1.15] text-base-50">
          Monte o repertório do próximo culto em minutos.
        </h1>
        <p className="max-w-xl text-[15px] text-base-400 sm:text-lg">
          Encontre louvores que combinam, descubra medleys e organize seu setlist sem começar do zero toda semana.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          <PrimaryCta access={access} label="Começar agora" className="w-full sm:w-auto" />
          <span className="text-sm text-base-300">
            {pricing.displayPrice}/{pricing.interval} · <span className="text-base-400">cancele quando quiser</span>
          </span>
        </div>

        <div className="mt-2">
          <SocialProofBadge />
        </div>
      </div>

      <div className="w-full lg:w-1/2">
        {example ? (
          <div className="rounded-2xl border border-base-800 bg-base-900/40 p-4 sm:p-5">
            <p className="mb-3 text-center text-sm text-base-400 lg:text-left">
              Exemplo real do catálogo — a partir de{" "}
              <span className="text-base-100">{example.base.title}</span>:
            </p>
            <CompatibilityList
              results={[{ song: example.match, compatibility: example.compatibility, reasons: example.reasons }]}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-base-800 bg-base-900/40 p-8 text-center text-sm text-base-400">
            Escolha uma música e veja na hora quais louvores combinam com ela.
          </div>
        )}
      </div>
    </section>
  );
}
