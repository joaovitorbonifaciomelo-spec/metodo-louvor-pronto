const PLACEHOLDER_COUNT = 5;

/**
 * Elemento de "prova social" ao lado do CTA do hero. Propositalmente SEM
 * fotos, nomes, estrelas ou número de usuários: não temos nenhum dado real
 * disso ainda (ver src/data/testimonials.ts). Os círculos são um ícone de
 * silhueta genérico — um placeholder visual reconhecível como tal, nunca
 * fotos da internet nem clientes fabricados.
 *
 * Quando houver fotos reais de usuários e uma nota real, troque os círculos
 * por <Image> local (nunca URL externa) e só então adicione estrelas com o
 * valor real.
 */
export function SocialProofBadge() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0" aria-hidden>
        {Array.from({ length: PLACEHOLDER_COUNT }).map((_, i) => (
          <div
            key={i}
            className="-ml-2.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-base-950 bg-base-800 ring-1 ring-accent/25 first:ml-0"
            style={{ zIndex: PLACEHOLDER_COUNT - i }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-accent/60">
              <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1a1 1 0 001 1h14a1 1 0 001-1v-1c0-2.8-3.6-5-8-5z" />
            </svg>
          </div>
        ))}
      </div>
      <p className="max-w-[220px] text-left text-xs leading-snug text-base-400 sm:max-w-[260px]">
        Feito para músicos que querem montar o culto mais rápido.
      </p>
    </div>
  );
}
