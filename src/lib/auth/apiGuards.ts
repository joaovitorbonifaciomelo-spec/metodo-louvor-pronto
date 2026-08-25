import { NextResponse } from "next/server";
import { getAccessInfo, getSessionInfo } from "./session";

export type GuardResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireUser(): Promise<GuardResult> {
  const { userId } = await getSessionInfo();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { ok: true, userId };
}

/**
 * Como requireUser, mas também exige assinatura ativa (ou bypass de
 * owner/admin/dev) — ver src/lib/billing/access.ts. Usar em toda rota que
 * escreve/lê funcionalidades privadas do SaaS (repertórios, histórico,
 * compartilhamento). Nunca confiar só na página redirecionar para /assinar.
 */
export async function requireActiveAccess(): Promise<GuardResult> {
  const info = await getAccessInfo();
  if (!info.userId) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!info.access.granted) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "É necessário ter uma assinatura ativa do Louvor Pronto.", redirectTo: "/assinar" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, userId: info.userId };
}

export async function requireAdmin(): Promise<GuardResult> {
  const { userId, profile } = await getSessionInfo();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 }) };
  }
  return { ok: true, userId };
}
