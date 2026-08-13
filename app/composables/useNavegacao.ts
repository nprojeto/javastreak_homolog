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

/**
 * ⚠️ MENU CURTO, de propósito. Propriedades, Cevas e Rotas NÃO ficam aqui —
 * elas vivem dentro de CAÇAR, porque só fazem sentido em sequência: sem CTF
 * não se caça, sem propriedade regular não há ceva nem rota. Espalhar tudo no
 * menu escondia essa ordem e enchia a lateral com onze itens.
 *
 * Os quatro do fim (`TOP_KEYS`) moram na barra de atalhos, não na lateral, e
 * o `suporte` (`CONTA_KEYS`) mora no menu da conta, ao lado do sino. Os itens
 * continuam declarados aqui de propósito: é a lista única de rotas do menu, e
 * apagá-los daqui esconderia que a rota existe.
 */
export const NAV_MANEJADOR: ItemNav[] = [
  { chave: 'manejoHub', rota: '/cacar', label: 'CAÇAR', icon: 'abate', destaque: true, pronta: true },
  { chave: 'inicio', rota: '/inicio', label: 'Início', icon: 'inicio', pronta: true },
  { chave: 'agenda', rota: '/agenda', label: 'Agenda', icon: 'agenda', pronta: true },
  { chave: 'manutencaoHub', rota: '/manutencao', label: 'Manutenção', icon: 'espreita', pronta: true },
  { chave: 'saudeAnimal', rota: '/saude-animal', label: 'Saúde animal', icon: 'caes', pronta: true },
  { chave: 'documentacao', rota: '/documentacao', label: 'Documentação', icon: 'documentacao', pronta: true },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte', pronta: true },

  { chave: 'trofeus', rota: '/trofeus', label: 'Sala de troféu', icon: 'trofeus', pronta: true },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking', pronta: true },
  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos', pronta: true },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Rede', icon: 'network', pronta: true }
]

export const NAV_LOJISTA: ItemNav[] = [
  { chave: 'empresa', rota: '/empresa', label: 'Minha empresa', icon: 'inicio', pronta: true },
  { chave: 'vitrine', rota: '/vitrine', label: 'Minha vitrine', icon: 'carrinho', pronta: true },
  { chave: 'patrocinio', rota: '/patrocinio', label: 'Patrocínio', icon: 'patrocinio', pronta: true },
  { chave: 'suporte', rota: '/suporte', label: 'Suporte', icon: 'suporte', pronta: true },

  { chave: 'promocoes', rota: '/promocoes', label: 'Promoções', icon: 'avisos', pronta: true },
  { chave: 'ranking', rota: '/ranking', label: 'Ranking', icon: 'ranking', pronta: true },
  { chave: 'mapaGeral', rota: '/mapa', label: 'Rede', icon: 'network', pronta: true }
]

/** Estes moram na barra de atalhos, acima do conteúdo. */
export const TOP_KEYS = ['trofeus', 'ranking', 'promocoes', 'mapaGeral']

/**
 * Estes moram no menu da conta (`MenuConta`), ao lado do sino, e por isso são
 * peneirados da lateral. Duas portas para a mesma tela, uma acima da outra,
 * só ocupam espaço — o mesmo motivo que juntou perfil, planos e compras lá.
 */
export const CONTA_KEYS = ['suporte']

/** Qual limite do plano controla cada item. */
export const MODULO_LIMITE: Record<string, string> = {
  espera: 'cevas', caes: 'caesPorCanil', armadilha: 'armadilhas', documentacao: 'documentos'
}
