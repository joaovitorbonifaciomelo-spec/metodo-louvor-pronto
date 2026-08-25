import { PrimaryCta, type CtaAccessState } from "./primary-cta";

export function FinalCtaSection({ access }: { access: CtaAccessState }) {
  return (
    <section className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 sm:py-24">
      <h2 className="text-[clamp(1.5rem,5vw,2.5rem)] font-semibold text-base-50">
        Seu próximo repertório pode começar agora.
      </h2>
      <PrimaryCta access={access} label="Começar por R$ 19,90/mês" />
    </section>
  );
}
