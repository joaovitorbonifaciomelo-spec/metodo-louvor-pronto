import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccessInfo } from "@/lib/auth/session";
import { getSubscriptionAccessStatus, type AccessReason } from "@/lib/billing/access";
import { KIWIFY_CHECKOUT_URL, KIWIFY_CUSTOMER_PORTAL_URL } from "@/lib/config/billing";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { product } from "@/lib/config/product";

/**
 * Prefill oficialmente suportado pela Kiwify via query string do checkout
 * (?email=&name=) — reduz digitação e ajuda a associar a compra à conta.
 * Ver https://ajuda.kiwify.com.br/pt-br/article/como-preencher-os-campos-do-checkout-pela-url-de7ezo/
 */
function buildCheckoutUrl(email: string | null, displayName: string | null): string | null {
  if (!KIWIFY_CHECKOUT_URL) return null;
  const url = new URL(KIWIFY_CHECKOUT_URL);
  if (email) url.searchParams.set("email", email);
  if (displayName) url.searchParams.set("name", displayName);
  return url.toString();
}

const STATUS_COPY: Partial<Record<AccessReason, { title: string; body: string }>> = {
  past_due_grace_expired: {
    title: "Pagamento pendente",
    body: "Identificamos um problema no pagamento da sua assinatura. Atualize a forma de pagamento para continuar usando o Louvor Pronto.",
  },
  canceled_period_ended: {
    title: "Assinatura cancelada",
    body: "Sua assinatura foi cancelada e o período pago já terminou. Assine novamente para voltar a ter acesso.",
  },
  canceled_no_period_info: {
    title: "Assinatura cancelada",
    body: "Sua assinatura foi cancelada. Assine novamente para voltar a ter acesso.",
  },
  refunded: {
    title: "Assinatura encerrada",
    body: "O pagamento da sua assinatura foi reembolsado, então o acesso foi encerrado.",
  },
  chargeback: {
    title: "Assinatura encerrada",
    body: "Identificamos uma contestação (chargeback) no pagamento da sua assinatura, então o acesso foi encerrado.",
  },
};

export default async function AssinarPage() {
  const { userId, email, profile, subscription, access } = await getAccessInfo();
  if (!userId) redirect("/login");
  if (access.granted) redirect("/buscar");

  // access.reason aqui já considera bypass — como não foi concedido, o motivo
  // real vem direto do status da assinatura (sem bypass de admin/dev).
  const reason = getSubscriptionAccessStatus(subscription).reason;
  const copy = STATUS_COPY[reason];
  const checkoutUrl = buildCheckoutUrl(email, profile?.display_name ?? null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10 sm:px-6">
      <Link href="/" aria-label={product.name}>
        <BrandLogo variant="full" priority className="h-10" />
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-base-800 bg-base-900/60 p-6 text-center sm:p-8">
        <h1 className="text-xl font-semibold text-base-50">{copy?.title ?? product.name}</h1>
        <p className="mt-2 text-sm text-base-400">
          {copy?.body ?? "Monte repertórios, encontre medleys e prepare o culto em minutos."}
        </p>
        {!copy && <p className="mt-1 text-sm text-base-400">Você ainda não possui uma assinatura ativa.</p>}

        <div className="mt-6 flex flex-col gap-3">
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              className="min-h-[44px] w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-fg transition-transform hover:bg-accent/90 active:scale-[0.98]"
            >
              Assinar {product.name}
            </a>
          ) : (
            <p className="rounded-lg border border-base-800 bg-base-950 px-4 py-3 text-xs text-base-400">
              O checkout ainda não foi configurado. Assim que estiver disponível, o botão de assinatura aparecerá aqui.
            </p>
          )}

          {reason === "past_due_grace_expired" && KIWIFY_CUSTOMER_PORTAL_URL && (
            <a
              href={KIWIFY_CUSTOMER_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-300 underline hover:text-accent"
            >
              Atualizar forma de pagamento
            </a>
          )}
        </div>
      </div>

      <SignOutButton />
    </main>
  );
}
