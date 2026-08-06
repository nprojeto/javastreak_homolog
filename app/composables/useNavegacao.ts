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
  { chave: 'manejoHub', rota: '/cacar', label: 'CAÇAR', icon: 'abate', destaque: true },
  { chave: 'inicio', rota: '/inicio', label: 'Início', icon: 'inicio', pronta: true },
  { chave: 'agenda', rota: '/agenda', label: 'Agenda', icon: 'agenda', pronta: true },
  { chave: 'manutencaoHub', rota: '/manutencao', label: 'Manutenção', icon: 'espreita' },
  { chave: 'saudeAnimal', rota: '/saude-animal', label: 'Saúde animal', icon: 'caes' },
  { chave: 'documentacao', rota: '/documentacao', label: 'Documentação', icon: 'documentacao' },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte' },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Mapa', icon: 'mapa' },
  { chave: 'trofeus', rota: '/trofeus', label: 'Sala de troféu', icon: 'trofeus' },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking' },
  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos' }
]

export const NAV_LOJISTA: ItemNav[] = [
  { chave: 'empresa', rota: '/empresa', label: 'Minha empresa', icon: 'inicio' },
  { chave: 'vitrine', rota: '/vitrine', label: 'Minha vitrine', icon: 'carrinho' },
  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos' },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte' },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Mapa', icon: 'mapa' },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking' }
]

/** Estes quatro moram na barra de cima, não na lateral. */
export const TOP_KEYS = ['trofeus', 'ranking', 'promocoes', 'mapaGeral']

/** Qual limite do plano controla cada item. */
export const MODULO_LIMITE: Record<string, string> = {
  espera: 'cevas', caes: 'canis', armadilha: 'armadilhas', documentacao: 'documentos'
}
