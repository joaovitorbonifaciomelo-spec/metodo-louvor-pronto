import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionInfo } from "@/lib/auth/session";
import { product } from "@/lib/config/product";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, email } = await getSessionInfo();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-base-800 bg-base-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/buscar" className="text-sm font-semibold text-base-100">
            {product.name}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/buscar" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Buscar
            </Link>
            <Link href="/cultos" className="rounded-lg px-3 py-1.5 text-base-300 hover:bg-base-800 hover:text-base-100">
              Meus Cultos
            </Link>
            <Link
              href="/cultos/novo"
              className="ml-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-fg hover:bg-accent/90"
            >
              Novo Culto
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-xs text-base-500 sm:px-6">
        <span>{email}</span>
        <SignOutButton />
      </footer>
    </div>
  );
}
