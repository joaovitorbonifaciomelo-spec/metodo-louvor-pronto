"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const ExitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
    <path
      d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 01-2-2V7a2 2 0 012-2h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ITEMS = [
  { href: "/buscar", label: "Descobrir", icon: SearchIcon },
  { href: "/cultos", label: "Repertórios", icon: ListIcon },
];

/** Navegação inferior mobile (seção "Navegação do app" do briefing de UX). Só até sm. */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-base-800 bg-base-950/95 backdrop-blur sm:hidden"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium",
                active ? "text-accent" : "text-base-400"
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}

        <Link
          href="/cultos/novo"
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-base-400"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg">
            <PlusIcon />
          </span>
          Novo culto
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-base-400"
        >
          <ExitIcon />
          Sair
        </button>
      </div>
    </nav>
  );
}
