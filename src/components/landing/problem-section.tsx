const PAINS = [
  "Procurar música por música até fechar o repertório.",
  "Não saber com certeza o que combina com o que já foi escolhido.",
  "Repetir sempre o mesmo repertório por falta de tempo para pesquisar.",
  "Ter dificuldade em encaixar os momentos do culto (abertura, adoração, ministração...).",
  "Lembrar de um louvor bom só depois que o culto já terminou.",
];

export function ProblemSection() {
  return (
    <section className="flex w-full max-w-4xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">
        Montar o repertório não deveria tomar tanto tempo.
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PAINS.map((pain) => (
          <li
            key={pain}
            className="flex items-start gap-3 rounded-xl border border-base-800 bg-base-900/40 p-4 text-sm text-base-300"
          >
            <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
              ✕
            </span>
            <span>{pain}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
