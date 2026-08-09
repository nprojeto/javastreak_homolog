import { defineStore } from 'pinia'

export interface Aviso {
  id: number
  texto: string
  tipo: 'info' | 'erro'
}

export interface PedidoUpgrade {
  chave: string
  precisa: string
}

let seq = 0

export const useUi = defineStore('ui', {
  state: () => ({
    avisos: [] as Aviso[],
    /** null enquanto nenhuma chamada aconteceu ainda. */
    conectado: null as boolean | null,
    /**
     * Quando o app está servindo dado guardado por falta de rede, guarda o
     * instante da leitura mais VELHA em uso. Zerado assim que uma chamada
     * volta a dar certo. É o que a faixa de offline mostra.
     */
    dadoDe: null as number | null,
    /** Quantas gravações esperam a rede voltar. */
    pendentes: 0,
    /** Quantas o servidor recusou e continuam guardadas, esperando decisão. */
    recusados: 0,
    /** Sobe enquanto a fila está subindo, para a faixa mostrar. */
    enviandoFila: false,
    /** Preenchido quando o servidor responde PLANO_NECESSARIO. */
    upgrade: null as PedidoUpgrade | null
  }),

  actions: {
    /** Equivalente ao toast() do legado. */
    avisar(texto: string, tipo: Aviso['tipo'] = 'info') {
      const id = ++seq
      this.avisos.push({ id, texto, tipo })
      setTimeout(() => {
        this.avisos = this.avisos.filter((a) => a.id !== id)
      }, 4000)
    },

    setConexao(ok: boolean) {
      this.conectado = ok
      /* Voltou a rede: o que está na tela deixa de ser dado velho. */
      if (ok) this.dadoDe = null
    },

    /**
     * Marca que a tela está mostrando dado guardado. Fica com o instante
     * MAIS ANTIGO em uso: se uma tela junta três leituras e uma é de ontem,
     * é a de ontem que a pessoa precisa saber.
     */
    usandoCache(quando: number) {
      this.conectado = false
      if (this.dadoDe === null || quando < this.dadoDe) this.dadoDe = quando
    },

    setPendentes(n: number) {
      this.pendentes = n
    },

    setRecusados(n: number) {
      this.recusados = n
    },

    setEnviandoFila(v: boolean) {
      this.enviandoFila = v
    },

    pedirUpgrade(chave: string, precisa: string) {
      this.upgrade = { chave, precisa }
    },

    fecharUpgrade() {
      this.upgrade = null
    }
  }
})
