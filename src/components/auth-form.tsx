"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { track } from "@/lib/analytics/track";
import { friendlyAuthError } from "@/lib/auth/friendlyError";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(friendlyAuthError(signUpError, "signup"));
          setLoading(false);
          return;
        }
        track("signup", { method: "password" });

        // Se a confirmação de email estiver habilitada no projeto Supabase, ainda não há sessão aqui.
        if (!data.session) {
          setLoading(false);
          setConfirmEmailSent(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(friendlyAuthError(signInError, "login"));
          setLoading(false);
          return;
        }
      }

      router.push("/buscar");
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err, mode));
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Informe seu email para receber o link.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (otpError) {
        setError(friendlyAuthError(otpError, "magic-link"));
        return;
      }
      setMagicLinkSent(true);
    } catch (err) {
      setLoading(false);
      setError(friendlyAuthError(err, "magic-link"));
    }
  }

  if (magicLinkSent) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-base-100">
        Enviamos um link mágico para <strong>{email}</strong>. Abra seu email para entrar.
      </div>
    );
  }

  if (confirmEmailSent) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-base-100">
        Enviamos um email de confirmação para <strong>{email}</strong>. Confirme para poder entrar.
      </div>
    );
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@igreja.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Aguarde…" : mode === "signup" ? "Criar conta grátis" : "Entrar"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-base-500">
        <div className="h-px flex-1 bg-base-800" />
        ou
        <div className="h-px flex-1 bg-base-800" />
      </div>

      <Button type="button" variant="secondary" onClick={handleMagicLink} disabled={loading}>
        Receber link mágico por email
      </Button>
    </form>
  );
}
