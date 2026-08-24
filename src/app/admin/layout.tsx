import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionInfo } from "@/lib/auth/session";
import { product } from "@/lib/config/product";
import { BrandLogo } from "@/components/brand-logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await getSessionInfo();
  if (!userId) redirect("/login");
  if (profile?.role !== "admin") redirect("/buscar");

  return (
    <div className="min-h-screen">
      <header className="safe-top sticky top-0 z-30 border-b border-base-800 bg-base-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2" aria-label={`${product.name} · Admin`}>
            <BrandLogo variant="mark" className="h-7 w-7" />
            <span className="hidden text-sm font-semibold text-base-100 sm:inline">{product.name} · Admin</span>
          </Link>
          <nav className="scrollbar-thin flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
            <Link href="/admin/musicas" className="shrink-0 rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Músicas
            </Link>
            <Link href="/admin/importar" className="shrink-0 rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Importar
            </Link>
            <Link href="/admin/solicitacoes" className="shrink-0 rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Solicitações
            </Link>
            <Link href="/admin/usuarios" className="shrink-0 rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Usuários
            </Link>
            <Link href="/buscar" className="ml-1 shrink-0 rounded-lg bg-base-800 px-3 py-2 text-base-300 hover:bg-base-700">
              Sair do admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
