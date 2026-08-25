# Louvor Pronto — Copiloto de Repertório

Micro-SaaS para líderes de louvor e músicos: descubra quais músicas combinam
com um louvor escolhido e monte o repertório do próximo culto em minutos.

> Nome do produto e subproduto são configuráveis em `src/lib/config/product.ts`
> e pelas env vars `NEXT_PUBLIC_PRODUCT_NAME` / `NEXT_PUBLIC_PRODUCT_TAGLINE`.

## Objetivo do produto

Reduzir o trabalho manual de montar um repertório: lembrar músicas, pensar em
tom/energia/momento do culto, evitar repetição recente e organizar tudo para a
equipe. O produto entrega **decisão pronta**, não apenas um catálogo.

Duas funcionalidades centrais:

1. **"Quais músicas combinam?"** — dado um louvor, recomenda outros com score
   de compatibilidade (0-100) e motivos explicados.
2. **Montar repertório** — dado tipo de culto, estrutura de momentos e nível
   da equipe, gera 2 variantes de setlist prontas para editar e salvar.

## Stack

- **Next.js 14 (App Router) + TypeScript** — frontend e API routes no mesmo projeto.
- **Tailwind CSS** — design system dark-first, sem componentes shadcn/ui
  instalados via CLI (foram recriados manualmente em `src/components/ui`,
  no mesmo espírito visual, para não depender de rede/CLI interativa).
- **Supabase** (Postgres + Auth + RLS) — banco, autenticação, autorização.
- **Vitest** — testes unitários das regras de negócio.
- **Vercel** (recomendado) para deploy.

## Decisões arquiteturais

- **Arrays em vez de tabelas de junção**: `songs.moments`, `songs.themes` e
  `songs.tags` são `text[]` com índices GIN, em vez de `song_moments` /
  `song_themes` / `song_tags`. Mais simples de editar no admin e suficiente
  para o volume esperado (algumas centenas/poucos milhares de músicas).
- **`setlist_items.moment`**: cada item do repertório guarda o momento do
  culto para o qual foi escolhido (independente dos momentos da música em si,
  que podem ser vários). Isso permite regenerar/entender a estrutura depois de
  salva.
- **Algoritmo determinístico**: nada de IA generativa para recomendação —
  `src/lib/recommendation/*` é 100% regras explícitas, testadas e com pesos
  centralizados em `weights.ts`.
- **Sem generic `Database` forte no client Supabase**: os tipos de linha
  (`src/types/song.ts`, `src/types/setlist.ts`, `src/types/database.ts`) são
  mapeados manualmente nas queries. Evita a fricção de manter um `Database`
  100% fiel ao schema sem gerar tipos via CLI conectada a um projeto real.
- **Acesso por assinatura, sem plano Free**: `src/lib/billing/access.ts` é o
  único lugar que decide se um usuário tem acesso ao SaaS — não há período de
  teste nem limite de plano gratuito (ver seção Billing abaixo).

## Estrutura do banco (Supabase/Postgres)

Migrations em `supabase/migrations/`, aplicadas em ordem:

| Arquivo | Conteúdo |
|---|---|
| `0001_extensions_and_tables.sql` | extensões (`pgcrypto`, `pg_trgm`) + todas as tabelas |
| `0002_indexes_and_search.sql` | índices GIN/trigram + função `search_songs()` |
| `0003_rls_policies.sql` | Row Level Security de todas as tabelas |
| `0004_functions_and_triggers.sql` | `updated_at` automático + criação de profile no signup |
| `0005_catalog_enrichment.sql` | `review_required` + metadados de enriquecimento via YouTube |
| `0006_billing_subscriptions.sql` | remove o modelo Free/Pro; `subscriptions` passa a modelar status de assinatura real (Kiwify) + `webhook_events` para idempotência |
| `0007_system_heartbeat.sql` | `system_heartbeat` — linha única (id=1) usada pelo heartbeat diário (Vercel Cron) para manter o projeto Supabase Free ativo |

Tabelas principais:

```
profiles           — estende auth.users (role, church_id)
churches           — "minha igreja" (seção 21)
songs              — catálogo (metadados apenas, sem letra/cifra)
song_requests       — pedidos de músicas que não existem no catálogo
setlists            — cultos salvos
setlist_items        — músicas de cada culto (posição, tom, trava, etc.)
user_song_library    — músicas que o usuário/igreja já toca
subscriptions        — status real de assinatura (inactive/active/past_due/canceled/refunded/chargeback)
webhook_events       — log + idempotência dos webhooks de pagamento recebidos
analytics_events      — eventos internos (seção 36)
system_heartbeat     — linha única (id=1), atualizada 1x/dia pelo cron de heartbeat
```

RLS: cada usuário só edita seus próprios repertórios/dados; o catálogo de
músicas é de leitura pública (inclusive anônima, para a demo pré-login) e
escrita só por admin (`profiles.role = 'admin'`); repertórios compartilhados
(`share_slug` preenchido) ficam legíveis publicamente.

## Como funciona o algoritmo de recomendação

Tudo em `src/lib/recommendation/`:

- **`keyCompatibility.ts`** — `calculateKeyCompatibility()`: compara duas
  tonalidades via círculo das quintas + relativo maior/menor. Retorna um score
  0-100 e um "bucket" de exibição: `Mesmo tom` / `Transição simples` /
  `Requer adaptação`.
- **`compatibility.ts`** — `calculateSongCompatibility()`: soma ponderada de
  7 fatores (pesos em `weights.ts`, somam 100 pontos):

  ```
  Tema / similaridade temática       30
  Momento do culto                   20
  Energia                            15
  Compatibilidade tonal              15
  Dificuldade                        10
  Capotraste / facilidade             5
  Outras tags                         5
  ```

- **`reasons.ts`** — `generateCompatibilityReasons()`: traduz o breakdown
  numérico em frases (`✓ Mesmo tom`, `⚠ Mudança de energia…`), ordenadas por
  relevância, no máximo 5.
- **`repetitionPenalty.ts`** — penaliza músicas tocadas recentemente
  (-30 no último culto, -20 nos últimos 2, -10 se tocada nos últimos 5) e dá
  um pequeno bônus (+5) a músicas paradas há 90+ dias. Não é regra absoluta.
- **`generateSetlist.ts`** — gera 1-3 variantes de repertório respeitando
  estrutura por momento, curva de energia (`ENERGY_CURVE_BY_MOMENT`), nível da
  equipe, música obrigatória e músicas travadas (lock).

Todas essas funções têm testes em `tests/*.test.ts` (47 testes no total).

## Rotas criadas

### Públicas
- `/` — landing page com demo de recomendação pré-login
- `/login`, `/signup` — autenticação (email+senha e magic link)
- `/s/[slug]` — repertório compartilhado publicamente

### Autenticadas (`/(app)`)
- `/buscar` — "quais músicas combinam?"
- `/cultos` — histórico ("Meus Cultos")
- `/cultos/novo` — criar culto → gerar variantes → editar → salvar
- `/cultos/[id]` — editor do culto salvo (trocar/travar/reordenar/remover/compartilhar)

### Admin (`/admin`, exige `profiles.role = 'admin'`)
- `/admin` — dashboard
- `/admin/musicas`, `/admin/musicas/nova`, `/admin/musicas/[id]` — CRUD do catálogo
- `/admin/importar` — importação de CSV
- `/admin/solicitacoes` — ranking de músicas pedidas
- `/admin/usuarios` — listagem de usuários

### API (Route Handlers)
`songs/search`, `songs`, `songs/[id]`, `songs/[id]/compatible`, `songs/import`,
`song-requests`, `setlists`, `setlists/generate`, `setlists/[id]`,
`setlists/[id]/items`, `setlists/[id]/items/[itemId]`,
`setlists/[id]/regenerate`, `setlists/[id]/share`, `public/setlists/[slug]`,
`admin/stats`, `analytics`.

## Setup local

### 1. Pré-requisitos
- Node.js 20+
- Uma conta/projeto no [Supabase](https://supabase.com) (grátis)

### 2. Instalar dependências

```bash
npm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com os dados do seu projeto Supabase (**Project Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> O nome da chave pública mudou entre projetos Supabase mais novos/antigos
> ("Publishable key" vs. "anon public"). O app aceita as duas variáveis —
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` tem prioridade se ambas existirem
> (ver `src/lib/supabase/env.ts`).

> Sem essas variáveis, o app builda e roda normalmente, mas qualquer chamada
> ao Supabase falha (erro de conexão logado no console, nunca escondido) —
> não há crash silencioso.

### 4. Rodar as migrations

Opção A — [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <seu-project-ref>
supabase db push
```

Opção B — colar manualmente cada arquivo de `supabase/migrations/` (em ordem
numérica) no **SQL Editor** do painel do Supabase.

### 5. Criar o primeiro admin

Depois de criar sua conta pelo `/signup`, torne-a admin via SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<seu-user-id>';
```

(`<seu-user-id>` está em **Authentication → Users** no painel do Supabase.)

### 6. Importar as 200 músicas do catálogo inicial

O catálogo inicial (100 músicas do Método Louvor Pronto + 100 adicionais,
ver `src/data/seedSongs.ts`) já vem auditado contra duplicatas
(`npm run audit:catalog` gera `data/seed-audit-report.md`).

Duas formas de carregar:

```bash
# A) via service role (recomendado em dev — idempotente, não duplica)
npm run seed

# B) via CSV, pelo /admin/importar (cole o conteúdo de data/seed-songs.csv)
npm run generate:seed-csv   # regenera data/seed-songs.csv a partir do dataset TS
```

### 7. Rodar o projeto

```bash
npm run dev
```

Abra http://localhost:3000.

## Como testar

```bash
npm run test        # 47 testes unitários (algoritmo, CSV, dedupe, planos)
npm run typecheck
npm run lint
```

## Como fazer build

```bash
npm run build
```

O build passa mesmo sem `.env.local` configurado (todas as páginas que usam
Supabase são renderizadas dinamicamente; as chamadas de rede só acontecem em
runtime).

## Como fazer deploy (Vercel)

1. Suba o repositório para o GitHub.
2. Importe o projeto na [Vercel](https://vercel.com/new).
3. Configure em **Project Settings → Environment Variables** (Production **e** Preview),
   marcadas como **Non-sensitive** (variáveis `NEXT_PUBLIC_*` não podem ser "Sensitive"
   na Vercel — o valor precisa poder ser lido de volta e embutido no bundle do client):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` — o
     app aceita qualquer um dos dois nomes, ver `src/lib/supabase/env.ts`)
   - `NEXT_PUBLIC_SITE_URL` = URL de produção (ex.: `https://seu-projeto.vercel.app`)
   - `SUPABASE_SERVICE_ROLE_KEY` (opcional — nenhuma rota da aplicação usa hoje;
     só é necessária se algum script/rota admin passar a precisar dela)
4. No painel do Supabase, em **Authentication → URL Configuration**, defina:
   - **Site URL**: a mesma URL de produção acima
   - **Redirect URLs**: `https://seu-projeto.vercel.app/**` e `http://localhost:3000/**`
   
   Sem isso, confirmação de email e magic link não redirecionam corretamente em produção.
5. Deploy. O middleware (`middleware.ts`) já cuida do refresh de sessão do Supabase Auth.

**Diagnóstico**: se o signup/login falhar com "Failed to fetch" em produção, é
quase sempre env var ausente/incorreta na Vercel — o servidor loga no console
(nunca o valor, só o nome da variável faltando) via `src/lib/supabase/env.ts`.

## Billing

Sem plano Free e sem trial: o SaaS só libera acesso para quem tem assinatura
`active` (ver `src/lib/billing/access.ts` — único ponto de decisão de acesso,
usado tanto na página `(app)/layout.tsx` quanto em cada rota de API privada
via `requireActiveAccess`). `role = 'admin'` e ambiente fora de produção
(`NODE_ENV !== "production"`) sempre têm acesso, sem hardcodar e-mail algum.

Provider inicial: **Kiwify** (`src/lib/config/billing.ts` centraliza a config;
`src/lib/billing/kiwify.ts` mapeia os eventos reais da Kiwify e valida o
webhook). Para ativar:

1. Criar o produto/checkout na Kiwify e configurar `KIWIFY_CHECKOUT_URL`.
2. Cadastrar um webhook na Kiwify apontando para `/api/webhooks/kiwify`, com
   todos os triggers marcados, e configurar `KIWIFY_WEBHOOK_TOKEN` com o token
   gerado.
3. (Opcional) `KIWIFY_CUSTOMER_PORTAL_URL` para o assinante gerenciar a própria
   assinatura, e `KIWIFY_PAST_DUE_GRACE_DAYS` para ajustar a tolerância de
   cobrança atrasada (padrão: 3 dias).

**Ressalva importante**: os nomes dos 10 eventos de webhook da Kiwify
(`compra_aprovada`, `subscription_renewed`, `subscription_canceled`,
`subscription_late`, `compra_reembolsada`, `chargeback`, etc.) vêm da
documentação oficial da API. Já o mecanismo exato de verificação do token e os
nomes de campo do payload de order/subscription **não estão 100% documentados
publicamente** — a implementação atual usa a convenção mais comum (token na
query string da URL do webhook) e extrai campos com múltiplos nomes
candidatos, mas todo payload recebido é sempre gravado em `webhook_events.raw_payload`
primeiro. Confira o primeiro webhook de teste real e ajuste
`src/lib/billing/kiwify.ts` se necessário.

## O que depende de decisão de negócio

- Preço da assinatura (mensal/anual) — nada hardcoded, ver `KIWIFY_CHECKOUT_URL`.
- Se solicitação de música (seção 20) deve ser aberta a usuários anônimos.
- Regras de "Minha Igreja" além do MVP (seção 21) — hoje só existe a tabela
  `user_song_library`/`churches`, sem UI dedicada.
- Regras comerciais exatas para reembolso/chargeback além de revogar o acesso.

## Catálogo inicial

`src/data/seedSongs.ts` documenta a origem de cada música (`source: "original"`
para as 100 do Método Louvor Pronto, `"additional"` para as 100 adicionais) e
por que nenhuma foi descartada por duplicidade — ver
`npm run audit:catalog` → `data/seed-audit-report.md`.

Nenhuma letra ou cifra é armazenada — apenas metadados e classificação
editorial (moments/themes/energy/tags), ajustável depois em `/admin`.
