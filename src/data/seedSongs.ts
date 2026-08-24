import type { Difficulty, EnergyLevel, Moment } from "@/types/song";

/**
 * Catálogo inicial do MVP — 200 músicas.
 *
 * Fonte:
 *  - "original": as 100 músicas do Método Louvor Pronto, na lista e nas seções
 *    (Celebração/Adoração/Ceia-Apelo/Ministração/Encerramento) fornecidas pelo usuário.
 *  - "additional": as 100 músicas adicionais fornecidas pelo usuário para expandir o catálogo.
 *
 * Cross-check de duplicatas entre as duas listas: ver scripts/audit-seed-catalog.ts
 * e o relatório gerado em data/seed-audit-report.md. Nenhuma duplicata exata foi
 * encontrada; alguns pares de título parecido (ex.: "Único" / "Ao Único") foram
 * revisados manualmente e confirmados como composições distintas.
 *
 * IMPORTANTE — o que NÃO fazemos aqui:
 *  - não armazenamos letras nem cifras;
 *  - não inventamos key/capo/bpm/link do YouTube: ficam null até um admin confirmar
 *    a informação real (ver seção 7 do briefing). Isso é intencional, não uma lacuna.
 *  - moments/themes/energy/difficulty/tags são uma classificação editorial inicial,
 *    passível de correção no /admin — servem para o algoritmo de compatibilidade
 *    ter dados suficientes desde o dia 1 (ver seção 9/10 do briefing).
 */

export interface SeedSongInput {
  title: string;
  artist: string | null;
  moments: Moment[];
  themes: string[];
  energy: EnergyLevel;
  tags: string[];
  difficulty: Difficulty;
  source: "original" | "additional";
}

function s(
  title: string,
  artist: string | null,
  moments: Moment[],
  themes: string[],
  energy: EnergyLevel,
  tags: string[] = [],
  difficulty: Difficulty = "intermediaria"
): Omit<SeedSongInput, "source"> {
  return { title, artist, moments, themes, energy, tags, difficulty };
}

// ---------------------------------------------------------------------------
// 100 músicas ORIGINAIS do Método Louvor Pronto
// ---------------------------------------------------------------------------

const ORIGINAL_RAW: Omit<SeedSongInput, "source">[] = [
  // CELEBRAÇÃO (1-25)
  s("A Casa É Sua", null, ["Celebração"], ["celebração", "presença"], 5),
  s("Grande É o Senhor", null, ["Celebração"], ["soberania", "celebração"], 5),
  s("Vitorioso És", null, ["Celebração"], ["celebração", "confiança"], 5),
  s("Nosso General É Cristo", null, ["Celebração"], ["soberania"], 5, ["guerra-espiritual"]),
  s("Celebrai com Júbilo", null, ["Celebração"], ["celebração", "alegria"], 5),
  s("Deus de Promessas", null, ["Celebração"], ["fidelidade"], 4, [], "avancada"),
  s("Te Agradeço", null, ["Celebração", "Oferta"], ["gratidão"], 4),
  s("O Nosso Deus É Soberano", null, ["Celebração"], ["soberania"], 5),
  s("Cantarei Teu Amor Pra Sempre", null, ["Celebração"], ["fidelidade", "celebração"], 4),
  s("Louve", null, ["Celebração"], ["celebração", "alegria"], 5, [], "iniciante"),
  s("Galileu", null, ["Celebração"], ["salvação", "celebração"], 5),
  s("Pra Sempre", null, ["Celebração"], ["fidelidade"], 4),
  s("A Alegria do Senhor", null, ["Celebração"], ["alegria"], 5, [], "iniciante"),
  s("Ele É Exaltado", null, ["Celebração"], ["celebração", "soberania"], 4, ["hino-classico"]),
  s("Quero Louvar-Te", null, ["Celebração"], ["celebração", "adoração"], 4),
  s("Em Espírito e em Verdade", null, ["Celebração", "Adoração"], ["adoração"], 3),
  s("Eu Navegarei", null, ["Celebração"], ["confiança", "esperança"], 4, ["hino-classico"]),
  s("Deus É Deus", null, ["Celebração"], ["soberania"], 5),
  s("Porque Ele Vive", null, ["Celebração", "Encerramento"], ["esperança"], 4, ["hino-classico"], "iniciante"),
  s("Grandioso És Tu", null, ["Celebração", "Adoração"], ["soberania"], 3, ["hino-classico"], "iniciante"),
  s("A Ele a Glória", null, ["Celebração", "Encerramento"], ["celebração"], 4),
  s("Ele Reina", null, ["Celebração"], ["soberania"], 5),
  s("Digno é o Senhor", null, ["Celebração"], ["soberania", "adoração"], 4),
  s("Eu e Minha Casa", null, ["Celebração"], ["fidelidade", "missão"], 4),
  s("Te Louvarei", null, ["Celebração"], ["celebração", "gratidão"], 4),

  // ADORAÇÃO (26-50)
  s("Lugar Secreto", null, ["Adoração"], ["presença", "confiança"], 2),
  s("Ninguém Explica Deus", null, ["Adoração"], ["soberania", "confiança"], 3),
  s("Aquieta Minh'Alma", null, ["Adoração", "Ministração"], ["confiança", "esperança"], 1),
  s("Yeshua", null, ["Adoração"], ["adoração", "santidade"], 3),
  s("Santo Espírito", null, ["Adoração"], ["Espírito Santo"], 2),
  s("Tu És Tudo Que Tenho", null, ["Adoração"], ["entrega", "confiança"], 2),
  s("Pra Onde Irei?", null, ["Adoração"], ["presença", "confiança"], 2),
  s("Boa Parte", null, ["Adoração"], ["entrega", "presença"], 2),
  s("Único", null, ["Adoração"], ["adoração", "soberania"], 3),
  s("Quero Conhecer Jesus", null, ["Adoração"], ["presença", "entrega"], 2),
  s("Bondade de Deus", null, ["Adoração"], ["fidelidade", "gratidão"], 3, ["contemporaneo"]),
  s("Creio Que Tu És a Cura", null, ["Adoração", "Ministração"], ["cura", "confiança"], 2),
  s("Rei dos Reis", null, ["Adoração"], ["soberania"], 3),
  s("Hosana", null, ["Adoração", "Celebração"], ["adoração", "celebração"], 4),
  s("Meu Respirar", null, ["Adoração"], ["entrega", "presença"], 2),
  s("Aclame ao Senhor", null, ["Adoração", "Celebração"], ["celebração"], 4),
  s("Reina em Mim", null, ["Adoração"], ["entrega", "soberania"], 3),
  s("Abre os Olhos do Meu Coração", null, ["Adoração"], ["presença", "santidade"], 2, ["hino-classico"]),
  s("Jesus Em Tua Presença", null, ["Adoração"], ["presença"], 2),
  s("Espírito, Enche a Minha Vida", null, ["Adoração"], ["Espírito Santo"], 2),
  s("Nos Braços do Pai", null, ["Adoração", "Ministração"], ["confiança", "presença"], 1),
  s("Pai Nosso", null, ["Adoração"], ["presença", "santidade"], 2, ["oracao"]),
  s("Mais Perto Quero Estar", null, ["Adoração"], ["presença", "entrega"], 2, ["hino-classico"]),
  s("Tu És Santo", null, ["Adoração"], ["santidade"], 2),
  s("Eu Vou Construir", null, ["Adoração"], ["fidelidade", "entrega"], 3),

  // CEIA / APELO (51-70)
  s("Rude Cruz", null, ["Ceia"], ["cruz", "salvação"], 1, ["hino-classico"], "iniciante"),
  s("Alvo Mais Que a Neve", null, ["Ceia"], ["cruz", "santidade"], 1, ["hino-classico"], "iniciante"),
  s("Foi na Cruz", null, ["Ceia"], ["cruz", "salvação"], 1),
  s("Nada Além do Sangue", null, ["Ceia"], ["cruz", "salvação"], 1, ["hino-classico"]),
  s("Graça", null, ["Ceia", "Apelo"], ["graça"], 1),
  s("Filho Pródigo", null, ["Apelo"], ["arrependimento", "graça"], 1),
  s("Quebrantado", null, ["Apelo"], ["arrependimento", "entrega"], 1),
  s("Eis-Me Aqui", null, ["Apelo"], ["entrega", "missão"], 1),
  s("Vim Para Adorar-Te", null, ["Ceia", "Adoração"], ["adoração", "entrega"], 1),
  s("Leva-Me Além", null, ["Apelo", "Ministração"], ["entrega", "confiança"], 1),
  s("Quero Descer", null, ["Apelo"], ["entrega", "arrependimento"], 1),
  s("Sonda-Me, Usa-Me", null, ["Apelo"], ["entrega", "arrependimento"], 1, ["hino-classico"]),
  s("Renova-Me", null, ["Apelo"], ["entrega", "Espírito Santo"], 1),
  s("Estou Contigo Senhor", null, ["Ceia", "Apelo"], ["confiança", "entrega"], 1),
  s("Meu Tributo", null, ["Ceia"], ["gratidão", "entrega"], 2),
  s("A Vitória da Cruz", null, ["Ceia"], ["cruz", "salvação"], 2),
  s("Consagração", null, ["Apelo"], ["entrega", "santidade"], 1),
  s("Me Derramar", null, ["Apelo"], ["entrega"], 1),
  s("Aos Pés da Cruz", null, ["Ceia"], ["cruz", "arrependimento"], 1),
  s("Fiel a Mim", null, ["Ceia", "Apelo"], ["fidelidade", "confiança"], 1),

  // MINISTRAÇÃO / FUNDO (71-85)
  s("Deus Está Aqui", null, ["Ministração", "Adoração"], ["presença"], 2),
  s("A Presença", null, ["Ministração"], ["presença"], 1),
  s("Em Teus Braços", null, ["Ministração"], ["confiança", "presença"], 1),
  s("Rendido Estou", null, ["Ministração"], ["entrega"], 1),
  s("Descansarei", null, ["Ministração"], ["confiança", "esperança"], 1),
  s("Ele Vem", null, ["Ministração", "Encerramento"], ["esperança"], 2),
  s("Me Atraiu", null, ["Ministração"], ["presença", "entrega"], 1),
  s("Quando Ele Vem", null, ["Ministração"], ["presença", "esperança"], 1),
  s("Eu Me Rendo", null, ["Ministração"], ["entrega"], 1),
  s("Todavia Me Alegrarei", null, ["Ministração"], ["confiança", "alegria"], 2),
  s("Ousado Amor", null, ["Ministração", "Adoração"], ["graça", "confiança"], 2, ["contemporaneo"], "avancada"),
  s("Caminho no Deserto", null, ["Ministração"], ["confiança", "esperança"], 1),
  s("A Bênção", null, ["Ministração", "Encerramento"], ["fidelidade"], 2),
  s("Vou Crer", null, ["Ministração"], ["confiança", "esperança"], 2),
  s("Tu És Fiel, Senhor", null, ["Ministração"], ["fidelidade"], 1),

  // ENCERRAMENTO (86-100)
  s("Rei Meu", null, ["Encerramento"], ["soberania", "celebração"], 3),
  s("Seja Engrandecido", null, ["Encerramento", "Celebração"], ["soberania"], 4),
  s("Sou Feliz", null, ["Encerramento"], ["alegria"], 4, [], "iniciante"),
  s("Nada Temerei", null, ["Encerramento"], ["confiança", "esperança"], 3),
  s("Emanuel", null, ["Encerramento"], ["presença", "salvação"], 3),
  s("Graça Sobre Graça", null, ["Encerramento"], ["graça"], 3),
  s("Há um Rio", null, ["Encerramento", "Adoração"], ["Espírito Santo", "alegria"], 3),
  s("Maravilhoso És", null, ["Encerramento"], ["soberania", "adoração"], 3),
  s("Rei Jesus", null, ["Encerramento", "Celebração"], ["soberania"], 4),
  s("Vim Para Exaltar-Te", null, ["Encerramento", "Celebração"], ["celebração"], 4),
  s("Eu Sei Que Não Estou Só", null, ["Encerramento"], ["confiança", "esperança"], 3),
  s("Deus Cuida de Mim", null, ["Encerramento"], ["confiança"], 3, [], "iniciante"),
  s("Coração Igual ao Teu", null, ["Encerramento", "Ministração"], ["santidade", "entrega"], 2),
  s("Grande em Misericórdia", null, ["Encerramento"], ["graça", "fidelidade"], 3),
  s("Eu Vou Celebrar", null, ["Encerramento", "Celebração"], ["celebração", "alegria"], 4),
];

// ---------------------------------------------------------------------------
// 100 músicas ADICIONAIS (expansão do catálogo)
// ---------------------------------------------------------------------------

const ADDITIONAL_RAW: Omit<SeedSongInput, "source">[] = [
  s("Bênçãos Que Não Têm Fim", "Isadora Pompeo", ["Adoração"], ["gratidão", "fidelidade"], 3),
  s("Raridade", "Anderson Freire", ["Adoração", "Ministração"], ["confiança", "gratidão"], 2),
  s("Deserto", "Maria Marçal", ["Ministração"], ["confiança", "esperança"], 1),
  s("Se Eu Não Te Ouvir", "Sarah Farias", ["Ministração", "Apelo"], ["entrega", "presença"], 1),
  s("Quem É Esse?", "Julliany Souza", ["Celebração"], ["soberania", "celebração"], 4),
  s("Acalma Meu Coração", "Anderson Freire", ["Ministração"], ["confiança", "esperança"], 1),
  s("Era a Mão de Deus", "Kailane Frauches", ["Adoração", "Ministração"], ["fidelidade", "confiança"], 2),
  s("Passa Lá em Casa Jesus", "Kailane Frauches", ["Adoração"], ["presença", "entrega"], 2),
  s("Os Sonhos de Deus", "Gabriela Rocha", ["Ministração"], ["esperança", "confiança"], 2),
  s("A Vitória Chegou", "Luanna Dourado / Aurelina Dourado", ["Celebração"], ["celebração", "confiança"], 5),
  s("Jeová Jireh", "Aline Barros", ["Celebração", "Adoração"], ["fidelidade", "confiança"], 3),
  s("Enche-Me", "Isaías Saad / Gabriela Rocha", ["Adoração"], ["Espírito Santo", "entrega"], 2),
  s("Cuido dos Detalhes", "André e Felipe / Isadora Pompeo", ["Adoração"], ["confiança", "fidelidade"], 2),
  s("Grandes Coisas", "Fernandinho", ["Celebração"], ["soberania", "celebração"], 5, ["contemporaneo"], "avancada"),
  s("Hino da Vitória", "Cassiane", ["Celebração"], ["celebração", "confiança"], 4),
  s("Cura", "Maria Marçal", ["Ministração", "Apelo"], ["cura"], 1),
  s("Casa do Pai", "Aline Barros", ["Adoração", "Encerramento"], ["presença", "esperança"], 3),
  s("Estamos de Pé", "Marcus Salles", ["Celebração"], ["celebração", "confiança"], 4),
  s("O Que Sua Glória Fez Comigo", "Fernanda Brum", ["Celebração", "Adoração"], ["gratidão", "celebração"], 4),
  s("Mesmo Sem Entender", "Thalles Roberto", ["Ministração"], ["confiança", "fidelidade"], 2),
  s("Meu Universo", "PG", ["Adoração"], ["adoração", "entrega"], 2),
  s("Aba", "Kemuel / Ton Carfi", ["Adoração"], ["presença", "confiança"], 2),
  s("Vida aos Sepulcros", "Gabriela Rocha", ["Celebração", "Adoração"], ["salvação", "esperança"], 3),
  s("Oh Quão Lindo Esse Nome É", "Kemuel", ["Adoração"], ["adoração", "santidade"], 2),
  s("Pode Morar Aqui", "Theo Rubia", ["Adoração"], ["presença", "Espírito Santo"], 2),
  s("Restitui", "Davi Sacer", ["Apelo", "Ministração"], ["esperança", "graça"], 1),
  s("Amigo Espírito Santo", "Cassiane", ["Adoração"], ["Espírito Santo"], 2),
  s("Minha Calmaria", "Gabriel Brito / André e Felipe", ["Ministração"], ["confiança", "esperança"], 1),
  s("Venha Ao Teu Reino", "Davi Sacer", ["Celebração", "Adoração"], ["soberania"], 3),
  s("Arde Outra Vez", "Thalles Roberto", ["Adoração", "Ministração"], ["Espírito Santo", "entrega"], 2),
  s("A Resposta", "Thalles Roberto", ["Celebração"], ["salvação", "celebração"], 4),
  s("Jesus é o Caminho", "Heloisa Rosa", ["Adoração"], ["salvação", "confiança"], 2),
  s("Coração de Joelhos", "Samuel Miranda", ["Apelo", "Ministração"], ["arrependimento", "entrega"], 1),
  s("Canção do Céu", "Anderson Freire", ["Adoração"], ["esperança", "adoração"], 2),
  s("Coração Valente", "Anderson Freire", ["Celebração"], ["confiança", "esperança"], 4),
  s("É Tudo Sobre Você", "MORADA", ["Adoração"], ["adoração", "entrega"], 2),
  s("Creio em Ti", "Arthur Callazans / Anderson Freire", ["Adoração", "Ministração"], ["confiança"], 2),
  s("Há um Lugar", "Heloisa Rosa", ["Adoração"], ["presença", "esperança"], 2),
  s("Vim Falar com Deus", "Delino Marçal", ["Adoração"], ["presença", "confiança"], 2, ["oracao"]),
  s("O Teu Amor", "Kemuel", ["Adoração"], ["graça", "fidelidade"], 2),
  s("Deus Não Desperdiça Suas Lágrimas", "Paulo Neto", ["Ministração"], ["esperança", "confiança"], 1),
  s("Atraídos pelo Fogo", "Casa Worship", ["Celebração", "Adoração"], ["Espírito Santo", "celebração"], 4),
  s("Sua Paz", "Isadora Pompeo", ["Ministração"], ["confiança", "esperança"], 1),
  s("Eu Não Sou Mais Órfão", "Gabriel Brito", ["Adoração"], ["salvação", "confiança"], 2),
  s("Nada Além de Ti", "Thalles Roberto", ["Adoração"], ["entrega", "adoração"], 2),
  s("Eu Vou Passar Pela Cruz", "PG", ["Ceia", "Apelo"], ["cruz", "entrega"], 1),
  s("Resultado", "Isadora Pompeo", ["Celebração"], ["gratidão", "celebração"], 4),
  s("És Real Pra Mim", "Fernanda Brum", ["Adoração"], ["confiança", "adoração"], 2),
  s("Atrai Meu Coração", "Nani Azevedo", ["Adoração"], ["entrega", "presença"], 2),
  s("Deus de Futuro", "Sarah Farias", ["Celebração", "Adoração"], ["esperança", "fidelidade"], 3),
  s("Meu Prazer", "PG", ["Adoração"], ["adoração", "entrega"], 2),
  s("A Mensagem da Cruz", "Nani Azevedo", ["Ceia"], ["cruz", "salvação"], 1),
  s("Todos Um", "Kemuel", ["Celebração", "Adoração"], ["comunhão"], 3),
  s("Não Chore João", "MORADA", ["Ministração"], ["esperança", "confiança"], 1),
  s("Eu Tenho Você", "Incendiários / Marcelo Markes", ["Ministração"], ["confiança", "presença"], 1),
  s("Vencendo de Joelhos", "Kemilly Santos", ["Apelo", "Ministração"], ["entrega", "confiança"], 1),
  s("Em Todas as Áreas", "Gabriel Brito", ["Celebração"], ["soberania", "confiança"], 4),
  s("Santo Pra Sempre", "Fernandinho", ["Adoração"], ["santidade"], 2),
  s("Para Ti Eu Vou", "Central 3", ["Adoração", "Apelo"], ["entrega", "missão"], 2),
  s("Se Eles Soubessem", "Laura Souguellis", ["Celebração", "Adoração"], ["missão", "gratidão"], 3),
  s("Tudo É Perda", "Felipe Rodrigues", ["Adoração"], ["entrega", "adoração"], 2),
  s("Todas as Coisas / Tudo Entregarei", "Isaías Saad", ["Adoração"], ["entrega"], 2),
  s("Vamos Cantar", "Julia Vitória / Marcelo Markes", ["Celebração"], ["celebração", "alegria"], 5, [], "iniciante"),
  s("O Nome de Jesus", "Isadora Pompeo", ["Celebração", "Adoração"], ["soberania", "adoração"], 3),
  s("Vem", "Julia Vitória", ["Adoração"], ["presença", "Espírito Santo"], 2),
  s("Nas Palavras de Lázaro", "Preto no Branco", ["Ministração"], ["esperança", "confiança"], 2),
  s("Vejo Uma Luz", "Rebeca Carvalho", ["Ministração"], ["esperança"], 2),
  s("Atos 2", "Gabriela Rocha", ["Celebração", "Adoração"], ["Espírito Santo", "celebração"], 4),
  s("Deus Me Levantou", "Thalles Roberto", ["Celebração"], ["confiança", "esperança"], 4),
  s("Eu Não Vou Parar", "Midian Lima", ["Celebração"], ["missão", "confiança"], 4),
  s("Até Que o Senhor Venha", "Alessandro Vilas Boas", ["Encerramento"], ["esperança"], 3),
  s("Deixa Queimar", "Alessandro Vilas Boas", ["Adoração"], ["Espírito Santo"], 3),
  s("Ruja o Leão", "fhop music", ["Celebração"], ["soberania", "celebração"], 5),
  s("Só Tu És Santo", "MORADA", ["Adoração"], ["santidade"], 2),
  s("Teu Amor Não Falha", "Nívea Soares", ["Adoração"], ["fidelidade"], 2),
  s("Que Se Abram os Céus", "Nívea Soares", ["Celebração", "Adoração"], ["Espírito Santo", "celebração"], 4),
  s("Preciso de Ti", "Diante do Trono", ["Adoração"], ["entrega", "confiança"], 2),
  s("Águas Purificadoras", "Diante do Trono", ["Ministração", "Apelo"], ["santidade", "arrependimento"], 1),
  s("Manancial", "Diante do Trono", ["Adoração"], ["Espírito Santo", "presença"], 2),
  s("Canção do Apocalipse", "Diante do Trono", ["Celebração", "Adoração"], ["soberania", "santidade"], 3),
  s("Tempo de Festa", "Diante do Trono", ["Celebração"], ["celebração", "alegria"], 5),
  s("Quão Grande É o Meu Deus", "Soraya Moraes", ["Celebração", "Adoração"], ["soberania"], 4, ["contemporaneo"]),
  s("Deus de Aliança", "Toque no Altar", ["Celebração"], ["fidelidade"], 4),
  s("Marca da Promessa", "Trazendo a Arca", ["Adoração"], ["fidelidade", "soberania"], 3),
  s("Sobre as Águas", "Trazendo a Arca", ["Adoração", "Ministração"], ["confiança"], 2),
  s("Olha Pra Mim", "Toque no Altar", ["Ministração"], ["presença", "confiança"], 1),
  s("Deus de Milagres", "Davi Sacer", ["Celebração"], ["soberania", "cura"], 4),
  s("Tua Graça Me Basta", "Davi Sacer", ["Adoração"], ["graça"], 2),
  s("Essência da Adoração", "David Quinlan", ["Adoração"], ["adoração"], 2),
  s("Abraça-Me", "David Quinlan", ["Ministração"], ["presença", "confiança"], 1),
  s("Ao Único", "Koinonya", ["Adoração", "Celebração"], ["adoração", "soberania"], 3),
  s("Não Há Deus Maior", "Comunidade da Graça", ["Celebração"], ["soberania"], 4),
  s("Poder Pra Salvar", "Aline Barros", ["Celebração"], ["salvação", "soberania"], 4),
  s("Santo, Santo, Santo", "tradicional", ["Encerramento", "Adoração"], ["santidade"], 2, ["hino-classico"], "iniciante"),
  s("Firme nas Promessas", "tradicional", ["Encerramento"], ["fidelidade"], 3, ["hino-classico"], "iniciante"),
  s("Chuvas de Graça", "Harpa Cristã", ["Adoração"], ["graça"], 2, ["hinario"], "iniciante"),
  s("Vencendo Vem Jesus", "tradicional", ["Encerramento"], ["esperança", "celebração"], 3, ["hino-classico"], "iniciante"),
  s("Castelo Forte", "tradicional", ["Celebração", "Encerramento"], ["soberania", "confiança"], 3, ["hino-classico"], "iniciante"),
  s("Segura na Mão de Deus", "tradicional", ["Ministração", "Encerramento"], ["confiança"], 2, ["hino-classico"], "iniciante"),
  s("Primeiro Amor", "Carlinhos Felix", ["Adoração", "Apelo"], ["arrependimento", "entrega"], 1),
];

export const ORIGINAL_SEED_SONGS: SeedSongInput[] = ORIGINAL_RAW.map((r) => ({ ...r, source: "original" }));
export const ADDITIONAL_SEED_SONGS: SeedSongInput[] = ADDITIONAL_RAW.map((r) => ({ ...r, source: "additional" }));

export const SEED_SONGS: SeedSongInput[] = [...ORIGINAL_SEED_SONGS, ...ADDITIONAL_SEED_SONGS];

if (ORIGINAL_SEED_SONGS.length !== 100) {
  throw new Error(`Esperava 100 músicas originais, encontrou ${ORIGINAL_SEED_SONGS.length}`);
}
if (ADDITIONAL_SEED_SONGS.length !== 100) {
  throw new Error(`Esperava 100 músicas adicionais, encontrou ${ADDITIONAL_SEED_SONGS.length}`);
}
