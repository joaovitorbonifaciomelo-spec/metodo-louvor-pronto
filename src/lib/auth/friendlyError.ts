import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Traduz erros de auth (Supabase ou falha de rede) em mensagens amigáveis
 * para o usuário final. O erro real sempre é logado no console (não escondido,
 * seção "Auth — erro atual" do briefing) para diagnóstico — só o texto exibido
 * ao usuário é simplificado.
 */
export function friendlyAuthError(error: unknown, context: string): string {
  // eslint-disable-next-line no-console
  console.error(`[auth:${context}]`, error);

  if (!isSupabaseConfigured()) {
    return "O login ainda não foi configurado neste ambiente. Fale com o administrador do sistema.";
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return "Não conseguimos falar com o servidor agora. Verifique sua conexão e tente novamente em instantes.";
  }
  if (normalized.includes("already registered") || normalized.includes("already been registered") || normalized.includes("user already exists")) {
    return "Este email já tem uma conta. Tente entrar em vez de criar uma nova.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu email antes de entrar — veja o link de confirmação que enviamos na sua caixa de entrada.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.";
  }
  if (normalized.includes("password") && (normalized.includes("short") || normalized.includes("weak") || normalized.includes("at least"))) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (normalized.includes("invalid email")) {
    return "Digite um email válido.";
  }

  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
