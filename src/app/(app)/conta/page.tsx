import { getAccessInfo } from "@/lib/auth/session";
import { getSubscriptionAccessStatus } from "@/lib/billing/access";
import { KIWIFY_CUSTOMER_PORTAL_URL } from "@/lib/config/billing";
import { formatDatePtBr } from "@/lib/utils";
import { Badge, Card } from "@/components/ui/card";
import { product } from "@/lib/config/product";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  refunded: "Reembolsada",
  chargeback: "Contestada (chargeback)",
  inactive: "Sem assinatura",
};

/** Área de conta — só o essencial (seção "Usuário que cancela"): status, não
 * um sistema financeiro próprio. Cancelamento/gestão fica no portal da Kiwify. */
export default async function ContaPage() {
  const { email, profile, subscription, access } = await getAccessInfo();
  const decision = getSubscriptionAccessStatus(subscription);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Conta</h1>

      <Card className="flex flex-col gap-1">
        <p className="text-sm text-base-100">{email}</p>
        {profile?.role === "admin" && <Badge tone="warning" className="w-fit">admin</Badge>}
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-base-300">Assinatura</h2>
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-base-200">{product.name}</span>
            <Badge tone={access.granted ? "accent" : "neutral"}>
              {subscription ? STATUS_LABEL[subscription.status] ?? subscription.status : "Sem assinatura"}
            </Badge>
          </div>

          {subscription?.current_period_end && (
            <p className="text-xs text-base-400">
              {subscription.status === "active" ? "Próxima renovação" : "Acesso até"}:{" "}
              {formatDatePtBr(subscription.current_period_end)}
            </p>
          )}

          {!access.granted && decision.reason !== "no_subscription" && (
            <p className="text-xs text-amber-400">
              {decision.reason === "past_due_grace_expired" && "Pagamento não confirmado."}
              {decision.reason.startsWith("canceled") && "Assinatura cancelada."}
              {decision.reason === "refunded" && "Pagamento reembolsado."}
              {decision.reason === "chargeback" && "Pagamento contestado."}
            </p>
          )}

          {KIWIFY_CUSTOMER_PORTAL_URL && (
            <a
              href={KIWIFY_CUSTOMER_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-sm text-base-300 underline hover:text-accent"
            >
              Gerenciar assinatura na Kiwify
            </a>
          )}
        </Card>
      </div>
    </div>
  );
}
