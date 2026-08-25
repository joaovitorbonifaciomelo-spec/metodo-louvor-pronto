/**
 * Cliente server-to-server da API pública oficial da Kiwify (Sales), usado
 * para verificar de forma independente se uma venda reportada por um webhook
 * realmente existe na nossa conta Kiwify — sem depender de validar a
 * assinatura do webhook (o mecanismo `?signature=` continua NÃO CONFIRMADO,
 * ver src/lib/billing/kiwify.ts).
 *
 * Em vez de confiar no corpo do webhook (que um atacante poderia forjar),
 * confiamos nas NOSSAS PRÓPRIAS credenciais OAuth (KIWIFY_API_CLIENT_ID/
 * CLIENT_SECRET/ACCOUNT_ID, com permissão de Vendas) para perguntar
 * diretamente à Kiwify "esse order_id existe, é dessa conta, e é desse
 * produto?". Um atacante não consegue forjar essa resposta sem conhecer um
 * order_id real da nossa conta (um UUID) — muito mais difícil que forjar um
 * corpo de webhook.
 *
 * Endpoints oficiais confirmados na documentação da Kiwify
 * (https://docs.kiwify.com.br/api-reference/auth/oauth e
 * https://docs.kiwify.com.br/api-reference/sales/single) — não inventados.
 *
 * NUNCA loga client_id/client_secret/access_token, mesmo em erro.
 */

const TOKEN_URL = "https://public-api.kiwify.com/v1/oauth/token";
const SALES_URL = "https://public-api.kiwify.com/v1/sales";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Cache em memória do processo — evita gerar um token novo a cada webhook
// (cada token dura 86400s segundo a API oficial). Reinicia a cada deploy/cold
// start, o que é aceitável (só custa uma chamada extra de OAuth).
let cachedToken: CachedToken | null = null;

interface KiwifyApiCredentials {
  clientId: string;
  clientSecret: string;
  accountId: string;
}

function getApiCredentials(): KiwifyApiCredentials | null {
  const clientId = process.env.KIWIFY_API_CLIENT_ID;
  const clientSecret = process.env.KIWIFY_API_CLIENT_SECRET;
  const accountId = process.env.KIWIFY_API_ACCOUNT_ID;
  if (!clientId || !clientSecret || !accountId) return null;
  return { clientId, clientSecret, accountId };
}

export function isKiwifyApiConfigured(): boolean {
  return getApiCredentials() !== null;
}

async function getAccessToken(credentials: KiwifyApiCredentials): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    // Nunca incluir o corpo da resposta no erro — a própria Kiwify já
    // ecoou um valor de credencial de volta num erro 400 em um teste manual
    // anterior, então tratamos qualquer corpo de erro do OAuth como sensível.
    throw new Error(`Falha ao gerar token OAuth da Kiwify (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number | string };
  if (!json.access_token) throw new Error("Resposta do OAuth da Kiwify não trouxe access_token.");

  const expiresInSeconds = Number(json.expires_in) || 3600;
  cachedToken = { accessToken: json.access_token, expiresAt: now + expiresInSeconds * 1000 };
  return cachedToken.accessToken;
}

export interface KiwifySale {
  id: string;
  status: string | null;
  productId: string | null;
  customerEmail: string | null;
  refundedAt: string | null;
}

/**
 * Consulta GET /v1/sales/{id} — fonte de verdade independente do webhook.
 *
 * Retorna null quando:
 * - as credenciais da API (KIWIFY_API_CLIENT_ID/SECRET/ACCOUNT_ID) não estão
 *   configuradas — NUNCA se deve prosseguir como se a venda fosse válida
 *   quando não é possível verificá-la;
 * - a Kiwify responde qualquer status de erro para esse order_id (a
 *   documentação oficial não especifica o código exato para "não
 *   encontrado", então tratamos qualquer falha na consulta como "não
 *   verificado", nunca como "encontrado por padrão").
 *
 * Erros de rede/infra (não relacionados ao order_id) propagam como exceção
 * para o chamador decidir como tratar.
 */
export async function fetchKiwifySale(orderId: string): Promise<KiwifySale | null> {
  const credentials = getApiCredentials();
  if (!credentials) return null;

  const accessToken = await getAccessToken(credentials);

  const res = await fetch(`${SALES_URL}/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-kiwify-account-id": credentials.accountId,
    },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    id: string;
    status?: string;
    product?: { id?: string };
    customer?: { email?: string };
    refunded_at?: string | null;
  };

  return {
    id: json.id,
    status: json.status ?? null,
    productId: json.product?.id ?? null,
    customerEmail: json.customer?.email ? json.customer.email.trim().toLowerCase() : null,
    refundedAt: json.refunded_at ?? null,
  };
}
