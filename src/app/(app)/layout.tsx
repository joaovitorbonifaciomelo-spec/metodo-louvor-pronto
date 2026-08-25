import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccessInfo } from "@/lib/auth/session";
import { product } from "@/lib/config/product";
import { SignOutButton } from "@/components/sign-out-button";
import { BottomNav } from "@/components/bottom-nav";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Único ponto de checagem de acesso para toda a área privada do app (todas as
 * páginas sob (app) passam por aqui). Não basta para as rotas de API — essas
 * têm sua própria checagem via requireActiveAccess (ver src/lib/auth/apiGuards.ts).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, email, access } = await getAccessInfo();
  if (!userId) redirect("/login");
  if (!access.granted) redirect("/assinar");

  return (
    <div className="min-h-screen">
      <header className="safe-top sticky top-0 z-30 border-b border-base-800 bg-base-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/buscar" className="flex min-w-0 items-center gap-2" aria-label={product.name}>
            <BrandLogo variant="mark" className="h-8 w-8 shrink-0" />
            <span className="truncate text-sm font-semibold text-base-100">{product.name}</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/buscar" className="rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Buscar
            </Link>
            <Link href="/cultos" className="rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Meus Cultos
            </Link>
            <Link
              href="/cultos/novo"
              className="ml-1 rounded-lg bg-accent px-3.5 py-2 font-medium text-accent-fg hover:bg-accent/90"
            >
              Novo Culto
            </Link>
            <Link href="/conta" className="rounded-lg px-3 py-2 text-base-300 hover:bg-base-800 hover:text-base-100">
              Conta
            </Link>
          </nav>
          <div className="hidden items-center gap-3 text-xs text-base-400 sm:flex">
            <span className="max-w-[160px] truncate">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="pb-safe-bottom-nav mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 sm:pb-8">{children}</main>

      <BottomNav />
    </div>
  );
}
