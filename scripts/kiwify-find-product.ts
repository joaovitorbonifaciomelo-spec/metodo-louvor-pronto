import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "..", ".env.local") });

/**
 * Utilitário local, somente-leitura: encontra o product_id real do Louvor
 * Pronto na Kiwify via API pública oficial, para configurar KIWIFY_PRODUCT_ID
 * (ver src/lib/billing/kiwify.ts). NÃO altera nada na Kiwify — só GET.
 *
 * Uso:
 *   npm run kiwify:find-product
 *
 * Requer em .env.local (NUNCA cole essas credenciais no chat):
 *   KIWIFY_API_CLIENT_ID=...
 *   KIWIFY_API_CLIENT_SECRET=...
 *   KIWIFY_API_ACCOUNT_ID=...
 * Gere essas 3 credenciais em: Kiwify → Apps → API → "Criar API Key".
 * O client_secret só aparece uma vez na criação — copie na hora.
 *
 * O access_token gerado aqui é só temporário e nunca é salvo em arquivo.
 */

const TOKEN_URL = "https://public-api.kiwify.com/v1/oauth/token";
const PRODUCTS_URL = "https://public-api.kiwify.com/v1/products";

interface KiwifyProduct {
  id: string;
  name: string;
  type?: string;
  payment_type?: string;
  status?: string;
}

interface ProductsPage {
  pagination: { count: number; page_number: number; page_size: number };
  data: KiwifyProduct[];
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar token OAuth (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Resposta do OAuth não trouxe access_token.");
  return json.access_token;
}

/** Só GET — nunca chama criação/edição/exclusão de produto. */
async function listAllProducts(accessToken: string, accountId: string): Promise<KiwifyProduct[]> {
  const products: KiwifyProduct[] = [];
  const pageSize = 100;
  let page = 1;

  for (;;) {
    const url = new URL(PRODUCTS_URL);
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("page_number", String(page));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-kiwify-account-id": accountId,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao listar produtos (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as ProductsPage;
    products.push(...json.data);

    const fetchedSoFar = page * pageSize;
    if (json.data.length === 0 || fetchedSoFar >= json.pagination.count) break;
    page += 1;
  }

  return products;
}

async function main() {
  const clientId = process.env.KIWIFY_API_CLIENT_ID;
  const clientSecret = process.env.KIWIFY_API_CLIENT_SECRET;
  const accountId = process.env.KIWIFY_API_ACCOUNT_ID;

  if (!clientId || !clientSecret || !accountId) {
    console.error("Faltam credenciais no .env.local. Adicione (nunca cole no chat):");
    console.error("  KIWIFY_API_CLIENT_ID=");
    console.error("  KIWIFY_API_CLIENT_SECRET=");
    console.error("  KIWIFY_API_ACCOUNT_ID=");
    console.error('Gere em: Kiwify → Apps → API → "Criar API Key" (o client_secret só aparece uma vez).');
    process.exit(1);
  }

  console.log("Gerando token OAuth...");
  const accessToken = await getAccessToken(clientId, clientSecret);

  console.log("Listando produtos (GET /v1/products)...");
  const products = await listAllProducts(accessToken, accountId);

  console.log(`\n${products.length} produto(s) encontrado(s):\n`);
  for (const p of products) {
    console.log(`- id: ${p.id}`);
    console.log(`  name: ${p.name}`);
    console.log(`  type: ${p.type ?? "—"}`);
    console.log(`  payment_type: ${p.payment_type ?? "—"}`);
    console.log(`  status: ${p.status ?? "—"}`);
  }

  const match = products.find((p) => /louvor\s*pronto/i.test(p.name));

  if (match) {
    console.log("\n=== PRODUTO ENCONTRADO ===");
    console.log(`name: ${match.name}`);
    console.log(`product_id: ${match.id}`);
    console.log("\nConfigure KIWIFY_PRODUCT_ID com esse valor (.env.local e Vercel).");
  } else {
    console.log(
      '\nNenhum produto com nome contendo "Louvor Pronto" foi encontrado automaticamente. Veja a lista acima e identifique manualmente qual é o produto correto.'
    );
  }
}

main().catch((err) => {
  console.error("Erro:", err instanceof Error ? err.message : err);
  process.exit(1);
});
