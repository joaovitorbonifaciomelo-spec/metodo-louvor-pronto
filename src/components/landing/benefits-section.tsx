const BENEFITS = [
  { title: "Menos tempo decidindo", description: "Menos tempo procurando música por música até fechar o repertório." },
  { title: "Mais opções de repertório", description: "Descubra louvores do catálogo que talvez você não lembrasse." },
  { title: "Medleys que você talvez não lembrasse", description: "Sugestões de combinações que fazem sentido para o culto." },
  { title: "Seus cultos organizados em um só lugar", description: "Repertórios salvos e prontos para consultar quando precisar." },
];

export function BenefitsSection() {
  return (
    <section className="flex w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Por que usar o Louvor Pronto</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="rounded-2xl border border-base-800 bg-base-900/40 p-5">
            <h3 className="text-base font-semibold text-accent">{benefit.title}</h3>
            <p className="mt-1.5 text-sm text-base-400">{benefit.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
