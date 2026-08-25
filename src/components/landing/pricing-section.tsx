import { pricing } from "@/lib/config/product";
import { PrimaryCta, type CtaAccessState } from "./primary-cta";

const INCLUDED = [
  "Montar repertórios ilimitados",
  "Medleys sugeridos para cada música",
  "Salvar e consultar cultos",
  "Acesso completo ao catálogo",
  "Atualizações do produto",
];

export function PricingSection({ access }: { access: CtaAccessState }) {
  return (
    <section id="preco" className="flex w-full max-w-4xl flex-col items-center gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Preço</h2>

      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-accent/30 bg-base-900/60 p-6 text-center sm:p-8">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">Louvor Pronto</span>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-semibold text-base-50">{pricing.displayPrice}</span>
          <span className="pb-1 text-base-400">/{pricing.interval}</span>
        </div>

        <ul className="flex w-full flex-col gap-2.5 text-left text-sm text-base-300">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <PrimaryCta access={access} label="Assinar Louvor Pronto" className="w-full" />
        <p className="text-xs text-base-400">Cancele quando quiser.</p>
      </div>
    </section>
  );
}
