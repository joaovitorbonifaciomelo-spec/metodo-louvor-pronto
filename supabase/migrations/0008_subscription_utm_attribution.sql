-- Atribuição de vendas por UTM (auditoria "Auditar atribuição de vendas
-- Kiwify"): a Kiwify já envia `TrackingParameters` em todo webhook de venda
-- real (confirmado inspecionando os payloads recebidos), mas `subscriptions`
-- não tinha onde guardar isso — o dado chegava e era descartado. Puramente
-- aditiva: só colunas novas, nullable, nada existente é alterado.
--
-- first-touch: estas colunas só são preenchidas na CRIAÇÃO da assinatura
-- (ver src/app/api/webhooks/kiwify/route.ts) — uma renovação nunca sobrescreve
-- a atribuição original, mesmo que venha com TrackingParameters diferente ou
-- nulo.

alter table public.subscriptions
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists kiwify_src text,
  add column if not exists kiwify_sck text;
