const FAQ = [
  { q: "O Louvor Pronto ensina a tocar?", a: "Não. É uma ferramenta para quem já toca e quer ajuda para montar repertórios." },
  { q: "Os medleys são automáticos?", a: "São sugestões de músicas que podem funcionar juntas; a decisão final continua sendo do músico/líder." },
  { q: "Posso cancelar?", a: "Sim, conforme fluxo da assinatura Kiwify." },
  { q: "Funciona no celular?", a: "Sim, interface responsiva." },
  { q: "Preciso instalar alguma coisa?", a: "Não, funciona pelo navegador." },
];

export function FaqSection() {
  return (
    <section className="flex w-full max-w-3xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-20">
      <h2 className="text-center text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Perguntas frequentes</h2>
      <dl className="flex flex-col gap-4">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-xl border border-base-800 bg-base-900/40 p-4 sm:p-5">
            <dt className="text-sm font-semibold text-base-50">{item.q}</dt>
            <dd className="mt-1.5 text-sm text-base-400">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
