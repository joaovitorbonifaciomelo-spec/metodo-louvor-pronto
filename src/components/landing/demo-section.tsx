import { DiscoverDemo } from "@/components/discover-demo";

export function DemoSection() {
  return (
    <section className="flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-base-50">Veja o Louvor Pronto funcionando</h2>
        <p className="max-w-xl text-sm text-base-400 sm:text-base">
          Busque uma música do catálogo e veja na hora os medleys sugeridos — sem precisar criar conta.
        </p>
      </div>
      <DiscoverDemo />
    </section>
  );
}
