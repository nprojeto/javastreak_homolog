/**
 * Definição do menu. Porte de NAV_MANEJADOR / NAV_LOJISTA / TOP_KEYS /
 * MODULO_LIMITE (index.html, 4603-4642).
 *
 * `rota` é o caminho no Nuxt; `pronta: false` marca o que ainda não foi
 * portado — o item aparece, mas leva a uma tela que diz em qual lote ele
 * chega, em vez de dar 404.
 */
export interface ItemNav {
  chave: string
  rota: string
  label: string
  icon: string
  destaque?: boolean
  pronta?: boolean
}

export const NAV_MANEJADOR: ItemNav[] = [
  { chave: 'manejoHub', rota: '/cacar', label: 'CAÇAR', icon: 'abate', destaque: true, pronta: true },
  { chave: 'inicio', rota: '/inicio', label: 'Início', icon: 'inicio', pronta: true },
  { chave: 'agenda', rota: '/agenda', label: 'Agenda', icon: 'agenda', pronta: true },
  { chave: 'manutencaoHub', rota: '/manutencao', label: 'Manutenção', icon: 'espreita', pronta: true },
  { chave: 'caes', rota: '/canis', label: 'Cães', icon: 'caes', pronta: true },
  { chave: 'propriedades', rota: '/propriedades', label: 'Propriedades', icon: 'areas', pronta: true },
  { chave: 'espera', rota: '/espera', label: 'Cevas', icon: 'espera', pronta: true },
  { chave: 'rotas', rota: '/rotas', label: 'Rotas', icon: 'rotas', pronta: true },
  { chave: 'documentacao', rota: '/documentacao', label: 'Documentação', icon: 'documentacao', pronta: true },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte', pronta: true },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Mapa', icon: 'mapa', pronta: true },
  { chave: 'trofeus', rota: '/trofeus', label: 'Sala de troféu', icon: 'trofeus', pronta: true },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking', pronta: true },
  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos', pronta: true }
]

export const NAV_LOJISTA: ItemNav[] = [
  { chave: 'empresa', rota: '/empresa', label: 'Minha empresa', icon: 'inicio', pronta: true },
  { chave: 'vitrine', rota: '/vitrine', label: 'Minha vitrine', icon: 'carrinho', pronta: true },
  { chave: 'patrocinio', rota: '/patrocinio', label: 'Patrocínio', icon: 'patrocinio', pronta: true },
  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos', pronta: true },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte', pronta: true },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Mapa', icon: 'mapa', pronta: true },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking' }
]

/** Estes quatro moram na barra de cima, não na lateral. */
export const TOP_KEYS = ['trofeus', 'ranking', 'promocoes', 'mapaGeral']

/** Qual limite do plano controla cada item. */
export const MODULO_LIMITE: Record<string, string> = {
  espera: 'cevas', caes: 'canis', armadilha: 'armadilhas', documentacao: 'documentos'
}
