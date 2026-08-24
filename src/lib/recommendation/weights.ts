/**
 * Pesos do algoritmo de compatibilidade — únicos e centralizados.
 * Some 100 pontos no total antes de penalidades de repetição.
 * Ajustar aqui, nunca espalhar números mágicos pelo código.
 */
export const COMPATIBILITY_WEIGHTS = {
  theme: 30,
  moment: 20,
  energy: 15,
  key: 15,
  difficulty: 10,
  capo: 5,
  tags: 5,
} as const;

export const COMPATIBILITY_WEIGHTS_TOTAL = Object.values(COMPATIBILITY_WEIGHTS).reduce(
  (sum, w) => sum + w,
  0
);

/**
 * Penalidade por repetição recente — não é regra absoluta, apenas reduz o
 * score para favorecer variedade. O líder pode escolher a música mesmo assim.
 */
export const REPETITION_PENALTY = {
  lastService: -30,
  lastTwoServices: -20,
  recentlyPlayed: -10, // usada nos últimos 5 cultos, fora das duas janelas acima
  recentWindow: 5,
  unusedForMonthsBonus: 5,
  unusedForMonthsThreshold: 90, // dias
} as const;

/** Curva de energia sugerida por momento do culto — usada para ordenar sugestões. */
export const ENERGY_CURVE_BY_MOMENT: Record<string, number[]> = {
  Abertura: [4, 5],
  Celebração: [5, 4, 3],
  Adoração: [3, 2, 1],
  Ministração: [2, 1],
  Ceia: [1, 2],
  Apelo: [1, 2],
  Oferta: [3, 4],
  Encerramento: [3, 4, 5],
  Outros: [3],
};
