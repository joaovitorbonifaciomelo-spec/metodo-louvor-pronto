# Candidatos NÃO inseridos — expansão de catálogo (~500 músicas)

Nenhum destes foi inserido no banco. Motivo em cada caso: risco real de
colisão semântica ou de artista/versão não confirmado o suficiente para
inserir com confiança, conforme a regra de "melhor não inserir do que
inserir errado" da tarefa de expansão do catálogo.

## Risco de duplicata semântica (título com as mesmas palavras, ordem trocada)

- **"Espírito Santo" — Fernanda Brum**: já existe no catálogo "Santo Espírito"
  (sem artista, `source=original`). São as mesmas duas palavras invertidas;
  não há confiança suficiente de que sejam composições diferentes o
  bastante para conviver sem confundir o usuário na busca. Se, no futuro,
  for confirmado que são músicas realmente distintas (por exemplo, ouvindo
  as duas gravações), inserir manualmente com um `version`/nota que deixe
  isso explícito.

## Candidatos descartados por serem provavelmente a mesma composição já
## presente no catálogo sob outro título (versão em português vs. original
## internacional, ou vice-versa)

Estes **não estão neste arquivo como linhas de dados** porque nunca chegaram
a virar candidatos formais — foram descartados ainda durante a pesquisa,
antes de entrar no CSV. Registrando aqui só para documentar o raciocínio:

- "Goodness of God" (Bethel Music) — já representado por "Bondade de Deus"
  (existente, sem artista).
- "Reckless Love" (Cory Asbury) — já representado por "Ousado Amor"
  (existente, sem artista).
- "Shout to the Lord" (Hillsong) — já representado por "Aclame ao Senhor"
  (existente, sem artista).
- "Here I Am to Worship" (Tim Hughes) — já representado por "Vim Para
  Adorar-Te" (existente, sem artista).
- "How Great Thou Art" — já representado por "Grandioso És Tu" (existente,
  sem artista; confirmado como Harpa Cristã nº 526).
- "Way Maker" (Sinach) — já representado por "Caminho no Deserto"
  (existente, sem artista; confirmado como a versão de Soraya Moraes).
- "How Great Is Our God" (Chris Tomlin) — já representado por "Quão Grande
  É o Meu Deus" (existente, Soraya Moraes).
- "He Is Exalted" (Twila Paris) — já representado por "Ele É Exaltado"
  (existente, sem artista; confirmado como composição de Adhemar de
  Campos/domínio congregacional).

## Artista/atribuição ambígua entre fontes (não incluído por segurança)

- **"500 Graus"**: aparece atribuído tanto a Thalles Roberto quanto a
  Cassiane em fontes diferentes da pesquisa — sem confirmar qual/se são
  músicas distintas, não incluí nenhuma das duas.
- **"Pelo Sangue"**: é hino da Harpa Cristã (nº 192) segundo uma fonte, mas
  também apareceu numa lista de sucessos do Renascer Praise (provável
  regravação do hino, não composição própria) — não incluído para não
  atribuir um hino tradicional a um artista específico sem confirmação.
- **"Nosso General"** (Adhemar de Campos): já existe "Nosso General É
  Cristo" no catálogo (sem artista) — títulos parecidos demais para
  arriscar sem confirmar se é a mesma música.
- **"Quão Grande És Tu"** (André Valadão): possível mesma composição de
  "How Great Thou Art" / mesmo campo semântico de "Grandioso És Tu"
  (já existente) — não incluído por segurança.
- **"Aurora"** (Julliany Souza): não ficou claro nas fontes se é faixa-título
  de um álbum ou uma música específica — não incluído.
- **"Cinco Pães e Dois Peixinhos" / "Um Chamado"**: atribuídas à banda
  Quatro Por Um (não a Marcus Salles individualmente, apesar de ele ter
  integrado o grupo) — não incluídas para não atribuir ao artista errado.

## Como usar este arquivo

Se alguma dessas músicas for confirmada (ouvindo a gravação real, ou com
uma fonte que resolva a ambiguidade), adicione uma linha correspondente em
`data/expansion-candidates.csv` (ou um novo lote) e rode
`npm run import:csv -- data/expansion-candidates.csv` de novo — o processo
é idempotente e não duplica o que já foi inserido.
