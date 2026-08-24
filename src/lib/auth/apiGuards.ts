import { NextResponse } from "next/server";
import { getSessionInfo } from "./session";

export type GuardResult = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireUser(): Promise<GuardResult> {
  const { userId } = await getSessionInfo();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { ok: true, userId };
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
