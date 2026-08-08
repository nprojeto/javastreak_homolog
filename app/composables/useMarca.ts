/**
 * ── A MARCA DO APP, NUM LUGAR SÓ ─────────────────────────────────────────
 *
 * Trocar a marca é mudar UMA LINHA: `marca` no `nuxt.config.ts` (ou a
 * variável `NUXT_PUBLIC_MARCA` no workflow). Tudo o mais acompanha — logo do
 * cabeçalho, logo das telas de entrada, cor de acento, nome exibido e o
 * ícone do PWA.
 *
 * ⚠️ Nasceu por causa de uma demonstração: o app foi vestido com a marca do
 * cliente e depois voltou a ser JavaStreak — a volta custou uma linha, e não
 * caçar arquivo por arquivo, que é exatamente o tipo de trabalho que some
 * quando alguém esquece um. `meateater` fica no mapa para a próxima.
 *
 * As imagens ficam em `public/marca/`, já sem fundo. ⚠️ Elas são desenhadas
 * para o TEMA CARVÃO: o traço é osso (`#EDE7D6`), não preto. Arte preta sobre
 * o fundo escuro do app desaparece sem dar erro nenhum.
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
  const m = MARCAS[String(cfg.public.marca || 'javastreak')] || MARCAS.javastreak!

  /**
   * ⚠️ O caminho precisa do endereço base. O app é servido em
   * `/javastreak_homolog/`, e `<img src="/marca/x.png">` pede a imagem na RAIZ
   * do domínio — que não existe. O resultado é o ícone de imagem quebrada.
   * O Nuxt prefixa rota, não `src` de imagem: isso é por nossa conta.
   */
  const base = String(cfg.app.baseURL || '/').replace(/\/+$/, '')
  return { ...m, simbolo: base + m.simbolo, lockup: base + m.lockup }
}
