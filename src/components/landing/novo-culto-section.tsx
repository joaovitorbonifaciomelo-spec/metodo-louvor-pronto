import { Badge } from "@/components/ui/card";
import { MOMENTS } from "@/types/song";

const HIGHLIGHTS = [
  "Crie um culto e escolha as músicas por momento (abertura, adoração, ministração...).",
  "Organize o repertório na ordem que vai usar no culto.",
  "Salve e consulte de novo quando precisar, sem refazer do zero.",
];

export function NovoCultoSection() {
  return (
    <section className="flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:gap-12">
      <div className="flex flex-col gap-4 lg:w-1/2">
        <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">
          Um repertório organizado para cada culto
        </h2>
        <ul className="flex flex-col gap-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-base-300">
              <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="w-full rounded-2xl border border-base-800 bg-base-900/40 p-5 lg:w-1/2">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-400">Momentos do culto</p>
        <div className="flex flex-wrap gap-2">
          {MOMENTS.map((moment) => (
            <Badge key={moment} tone="neutral">
              {moment}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
