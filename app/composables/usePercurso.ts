import type { Ponto } from '~/composables/useMapa'

/**
 * ── PERCURSO EM GRAVAÇÃO ──────────────────────────────────────────────────
 *
 * O traçado que está sendo gravado numa caçada, guardado FORA do componente.
 *
 * ⚠️ Nasceu de um defeito: o percurso vivia em `ref` dentro do `PainelCampo`,
 * e sair da tela o destruía. Ir registrar um abate — que é exatamente o que se
 * faz no meio de uma caminhada — apagava tudo o que tinha sido andado, sem
 * aviso nenhum.
 *
 * ⚠️ `localStorage`, não IndexedDB. É SÍNCRONO: quando o sistema mata o app
 * sem avisar, a última gravação já está no disco. O IndexedDB é assíncrono e
 * pode perder a escrita em voo, que é justamente o caso que este arquivo
 * existe para resolver.
 *
 * ⚠️ NÃO SALVA NO SERVIDOR SOZINHO ao fechar, e isso não é escolha: com o app
 * fechado não há JavaScript rodando para chamar a API, e `sendBeacon` não
 * consegue mandar o cabeçalho de autenticação que a Edge Function exige. O
 * que dá para garantir é o traçado sobreviver no aparelho e ser oferecido
 * — ou salvo — na próxima vez que a caçada abrir.
 */

const CHAVE = 'js.percurso.v1'

export interface PercursoGuardado {
  manejoId: string
  /** Nome escolhido ANTES de começar: sem ele não dá para salvar sozinho. */
  nome: string
  propriedadeId: string
  pontos: Ponto[]
  iniciadoEm: string
  /**
   * Abates registrados enquanto este percurso gravava.
   *
   * ⚠️ É o que impede de descartar sem salvar: um abate ligado a um traçado
   * que nunca existiu vira registro órfão no relatório do IBAMA.
   */
  abates: number
  /** Foi interrompido por fechamento do app, e não por escolha. */
  interrompido?: boolean
}

function ler(): PercursoGuardado | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const s = localStorage.getItem(CHAVE)
    if (!s) return null
    const o = JSON.parse(s) as PercursoGuardado
    return o && Array.isArray(o.pontos) ? o : null
  } catch {
    return null
  }
}

function escrever(p: PercursoGuardado | null) {
  if (typeof localStorage === 'undefined') return
  try {
    if (p) localStorage.setItem(CHAVE, JSON.stringify(p))
    else localStorage.removeItem(CHAVE)
  } catch {
    /* Cota cheia ou modo privado: a gravação em memória continua valendo, e
       o percurso só se perde se o app fechar. Melhor que derrubar a tela. */
  }
}

/* Estado vivo, compartilhado entre a tela da caçada e a do abate. */
const atual = ref<PercursoGuardado | null>(null)
let carregou = false

export function usePercurso() {
  if (!carregou && typeof localStorage !== 'undefined') {
    atual.value = ler()
    carregou = true
  }

  const gravando = computed(() => !!atual.value)

  /** O percurso guardado é DESTA caçada? Um de outra não deve aparecer aqui. */
  function daCacada(manejoId: string) {
    return atual.value && String(atual.value.manejoId) === String(manejoId)
      ? atual.value
      : null
  }

  function comecar(manejoId: string, propriedadeId: string, nome: string) {
    atual.value = {
      manejoId, propriedadeId, nome,
      pontos: [], iniciadoEm: new Date().toISOString(), abates: 0
    }
    escrever(atual.value)
  }

  /**
   * ⚠️ Ponto novo só a cada 15 m. Sem esse filtro, o GPS parado gera dezenas
   * de pontos no mesmo lugar: o traçado vira um borrão, o payload cresce à
   * toa e o `localStorage` enche.
   */
  const DIST_MIN_M = 15

  function acrescentar(p: Ponto, distancia: (a: Ponto, b: Ponto) => number) {
    const cur = atual.value
    if (!cur) return
    const u = cur.pontos[cur.pontos.length - 1]
    if (u && distancia(u, p) < DIST_MIN_M) return
    cur.pontos = [...cur.pontos, { lat: p.lat, lng: p.lng }]
    escrever(cur)
  }

  /** Marca que um abate foi registrado neste percurso. */
  function marcarAbate() {
    const cur = atual.value
    if (!cur) return
    cur.abates += 1
    escrever(cur)
  }

  function limpar() {
    atual.value = null
    escrever(null)
  }

  /** Registra que o app foi fechado no meio — lido na próxima abertura. */
  function marcarInterrompido() {
    const cur = atual.value
    if (!cur) return
    cur.interrompido = true
    escrever(cur)
  }

  return {
    atual, gravando, daCacada,
    comecar, acrescentar, marcarAbate, limpar, marcarInterrompido
  }
}
