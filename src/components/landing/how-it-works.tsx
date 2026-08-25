const STEPS = [
  {
    number: "1",
    title: "Escolha um louvor ou comece um novo culto",
    description: "Busque uma música do catálogo ou crie um culto novo para começar a montar o repertório.",
  },
  {
    number: "2",
    title: "Veja sugestões que combinam",
    description: "O Louvor Pronto mostra louvores compatíveis com base em tom, tema, momento e energia.",
  },
  {
    number: "3",
    title: "Monte e salve seu repertório",
    description: "Organize o setlist do culto e deixe salvo para consultar quando precisar.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Como funciona</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="flex flex-col gap-3 rounded-2xl border border-base-800 bg-base-900/40 p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {step.number}
            </span>
            <h3 className="text-base font-semibold text-base-50">{step.title}</h3>
            <p className="text-sm text-base-400">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
