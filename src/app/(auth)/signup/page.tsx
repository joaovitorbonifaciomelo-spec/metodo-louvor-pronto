import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border border-base-800 bg-base-900/60 p-5 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link href="/" aria-label="Método Louvor Pronto">
            <BrandLogo variant="full" priority className="h-12" />
          </Link>
          <h1 className="mt-5 text-xl font-semibold text-base-50">Criar conta</h1>
          <p className="mt-1 text-sm text-base-400">Comece a montar repertórios melhores em minutos.</p>
        </div>
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-sm text-base-400">
          Já tem conta?{" "}
          <Link href="/login" className="text-accent">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
