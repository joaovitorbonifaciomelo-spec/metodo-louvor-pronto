import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { product } from "@/lib/config/product";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-sm font-semibold text-base-100">
            {product.name}
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-base-50">Entrar</h1>
        </div>
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-base-400">
          Não tem conta?{" "}
          <Link href="/signup" className="text-accent">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </main>
  );
}
