/**
 * Tipos e casas dos meios de transporte, num lugar só.
 *
 * ⚠️ Ficam aqui, e não na tela, porque três telas precisam da mesma verdade:
 * a Manutenção (portal), a Garagem e a Marina. Duplicar a lista era o caminho
 * mais curto para uma delas ficar desatualizada em silêncio.
 *
 * ⚠️ O CAVALO não está aqui. Ele é uma linha em `transportes` no banco, mas
 * pertence a Saúde animal — o que se registra nele é vacina e casqueamento,
 * não óleo e licenciamento.
 */
export interface Transporte {
  id: string; tipo?: string; identificacao?: string; fotoUrl?: string
  obs?: string; meio?: string; mesLicenciamento?: string; mesIpva?: string
  kmAtual?: string; ultimaRevisao?: string; proximaRevisao?: string
  correiaDentada?: string; trocaPneus?: string; proximaTrocaOleo?: string
  dataNascimento?: string
}

export type Casa = 'garagem' | 'marina'

export const CASAS = [
  {
    k: 'garagem' as const,
    rot: 'GARAGEM',
    desc: 'Carros, motos e quadriciclos: manutenção',
    ic: 'garagem',
    rota: '/garagem'
  },
  {
    k: 'marina' as const,
    rot: 'MARINA',
    desc: 'Barcos e embarcações: manutenção',
    ic: 'marina',
    rota: '/marina'
  }
]

export const TIPOS: Record<Casa, string[]> = {
  garagem: ['Carro', 'Moto', 'Quadriciclo', 'Caminhonete', 'Outro'],
  marina: ['Barco', 'Lancha', 'Bote', 'Caiaque', 'Canoa', 'Jet ski', 'Outra embarcação']
}

export const TIPOS_HARAS = ['Cavalo']

export function casaDe(tipo?: string): Casa | 'haras' {
  if (TIPOS_HARAS.includes(String(tipo))) return 'haras'
  if (TIPOS.marina.includes(String(tipo))) return 'marina'
  return 'garagem'
}
