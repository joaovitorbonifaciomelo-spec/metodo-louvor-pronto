const AUDIENCE = [
  "Líderes de louvor",
  "Ministros de louvor",
  "Violonistas e guitarristas",
  "Tecladistas",
  "Músicos que ajudam a montar o repertório da igreja",
];

export function AudienceSection() {
  return (
    <section className="flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
      <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Feito para quem monta repertório</h2>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {AUDIENCE.map((item) => (
          <span
            key={item}
            className="rounded-full border border-base-800 bg-base-900/40 px-4 py-2 text-sm text-base-300"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
