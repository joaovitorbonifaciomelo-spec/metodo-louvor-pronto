export interface Testimonial {
  name: string;
  /** Contexto curto — obrigatório deixar claro se a avaliação é sobre outro
   * produto (ex.: "Sobre o Método Louvor Pronto") e não sobre o SaaS. */
  context?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  quote: string;
  /** Caminho local em /public — nunca URL externa/foto genérica da internet. */
  avatarSrc?: string;
}

/**
 * NENHUM depoimento real do Louvor Pronto (SaaS) foi fornecido até o momento
 * desta implementação — o array começa vazio de propósito. NÃO preencher com
 * depoimentos, nomes, notas ou fotos inventadas.
 *
 * A seção de depoimentos (src/components/landing/testimonials-section.tsx) só
 * aparece na landing page quando este array tiver pelo menos 1 item real —
 * ela retorna null enquanto estiver vazio, em vez de mostrar uma seção falsa.
 *
 * Se no futuro só houver avaliações do Kit/Método Louvor Pronto (infoproduto)
 * e não especificamente do SaaS, preencha o campo `context` deixando isso
 * explícito, por exemplo:
 *   context: "Sobre o Método Louvor Pronto"
 * Nunca escrever algo que dê a entender que a pessoa usou o SaaS se ela
 * avaliou apenas o outro produto.
 */
export const testimonials: Testimonial[] = [];
