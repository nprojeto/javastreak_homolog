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
    },

    pedirUpgrade(chave: string, precisa: string) {
      this.upgrade = { chave, precisa }
    },

    fecharUpgrade() {
      this.upgrade = null
    }
  }
})
