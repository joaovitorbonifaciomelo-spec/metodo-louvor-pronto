import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";

/** Evita que um usuário já autenticado fique preso em /login ou /signup. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await getSessionInfo();
  if (userId) redirect("/buscar");

  return <>{children}</>;
}
