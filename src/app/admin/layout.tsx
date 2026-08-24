import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionInfo } from "@/lib/auth/session";
import { product } from "@/lib/config/product";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, profile } = await getSessionInfo();
  if (!userId) redirect("/login");
  if (profile?.role !== "admin") redirect("/buscar");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-base-800 bg-base-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/admin" className="text-sm font-semibold text-base-100">
            {product.name} · Admin
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin/musicas" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Músicas
            </Link>
            <Link href="/admin/importar" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Importar
            </Link>
            <Link href="/admin/solicitacoes" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Solicitações
            </Link>
            <Link href="/admin/usuarios" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Usuários
            </Link>
            <Link href="/buscar" className="ml-1 rounded-lg bg-base-800 px-3 py-1.5 text-base-300 hover:bg-base-700">
              Sair do admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
