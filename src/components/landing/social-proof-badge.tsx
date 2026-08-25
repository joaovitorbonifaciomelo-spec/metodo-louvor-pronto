import Image from "next/image";

/**
 * Fotos reais fornecidas em assets/avatar-0N.webp (cópia servida em
 * public/avatars/). Usadas só como elemento visual de avatares no hero —
 * sem nome, cargo, nota ou citação atrelados, porque ainda não temos texto
 * de depoimento real para acompanhá-las (ver src/data/testimonials.ts).
 */
const AVATARS = [
  "/avatars/avatar-01.webp",
  "/avatars/avatar-02.webp",
  "/avatars/avatar-03.webp",
  "/avatars/avatar-04.webp",
  "/avatars/avatar-05.webp",
];

export function SocialProofBadge() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0" aria-hidden>
        {AVATARS.map((src, i) => (
          <div
            key={src}
            className="-ml-2.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-base-950 ring-1 ring-accent/25 first:ml-0"
            style={{ zIndex: AVATARS.length - i }}
          >
            <Image
              src={src}
              alt=""
              width={72}
              height={72}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <p className="max-w-[220px] text-left text-xs leading-snug text-base-400 sm:max-w-[260px]">
        Feito para músicos que querem montar o culto mais rápido.
      </p>
    </div>
  );
}
