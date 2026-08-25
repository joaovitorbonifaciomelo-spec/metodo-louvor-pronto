import Image from "next/image";
import { Card } from "@/components/ui/card";
import { testimonials } from "@/data/testimonials";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-accent" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden>
          {i < rating ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

/**
 * Só renderiza quando houver depoimentos reais em src/data/testimonials.ts —
 * nunca mostra uma seção de avaliações vazia ou com dados fabricados.
 */
export function TestimonialsSection() {
  if (testimonials.length === 0) return null;

  return (
    <section className="flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">
        Quem vive o louvor entende a diferença
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name} className="flex flex-col gap-3">
            <Stars rating={testimonial.rating} />
            <p className="text-sm text-base-300">&ldquo;{testimonial.quote}&rdquo;</p>
            <div className="mt-auto flex items-center gap-3 pt-2">
              {testimonial.avatarSrc && (
                <Image
                  src={testimonial.avatarSrc}
                  alt={testimonial.name}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-medium text-base-100">{testimonial.name}</p>
                {testimonial.context && <p className="text-xs text-base-400">{testimonial.context}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
