import { CompatibilityList } from "@/components/compatibility-list";
import type { HeroExamplePair } from "@/lib/landing/hero-example";

export function MedleysSection({ example }: { example: HeroExamplePair | null }) {
  return (
    <section id="recursos" className="flex w-full max-w-4xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">
          Descubra quais louvores combinam
        </h2>
        <p className="max-w-2xl text-sm text-base-400 sm:text-base">
          Escolha uma música e veja sugestões de louvores que podem funcionar juntos no culto — os{" "}
          <span className="text-base-200">medleys sugeridos</span>. A decisão final de usar ou não continua sendo
          sua.
        </p>
      </div>

      {example && (
        <div className="mx-auto w-full max-w-xl">
          <CompatibilityList
            results={[{ song: example.match, compatibility: example.compatibility, reasons: example.reasons }]}
          />
        </div>
      )}
    </section>
  );
}
