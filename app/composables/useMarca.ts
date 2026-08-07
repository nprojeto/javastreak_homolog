/**
 * ── A MARCA DO APP, NUM LUGAR SÓ ─────────────────────────────────────────
 *
 * Trocar a marca é mudar UMA LINHA: `marca` no `nuxt.config.ts` (ou a
 * variável `NUXT_PUBLIC_MARCA` no workflow). Tudo o mais acompanha — logo do
 * cabeçalho, logo das telas de entrada, cor de acento, nome exibido e o
 * ícone do PWA.
 *
 * ⚠️ Existe por causa da demonstração: o app está vestido com a marca do
 * cliente para a apresentação, e depois volta a ser JavaStreak. Sem isto,
 * a volta significaria caçar arquivo por arquivo — que é exatamente o tipo
 * de trabalho que some quando alguém esquece um.
 *
 * As imagens ficam em `public/marca/`, já sem fundo.
 */
export interface Marca {
  chave: string
  /** Nome exibido no cabeçalho e no título da página. */
  nome: string
  /** Símbolo sozinho — cabeçalho, menu, favicon. */
  simbolo: string
  /** Assinatura completa — telas de entrada. */
  lockup: string
}

const MARCAS: Record<string, Marca> = {
  javastreak: {
    chave: 'javastreak',
    nome: 'JavaStreak',
    simbolo: '/marca/javastreak-simbolo.png',
    lockup: '/marca/javastreak.png'
  },
  meateater: {
    chave: 'meateater',
    nome: 'MeatEater',
    simbolo: '/marca/meateater-simbolo.png',
    lockup: '/marca/meateater.png'
  }
}

export function useMarca(): Marca {
  const cfg = useRuntimeConfig()
  const escolhida = String(cfg.public.marca || 'javastreak')
  return MARCAS[escolhida] || MARCAS.javastreak!
}
