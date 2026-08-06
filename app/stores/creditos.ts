import { defineStore } from 'pinia'

/**
 * O que o `apiMeusCreditos` devolve. Alimenta a faixa do topo, o selo do
 * plano e — o mais importante — o `bloqueioCriar`, que faz o botão de criar
 * nascer travado com o motivo, em vez de deixar a pessoa preencher tudo para
 * levar recusa no fim.
 */
export interface Creditos {
  plano: string
  planoNome: string
  diasPlano: number | null
  origem: string
  cortesiaDias: number
  indicacaoDias: number
  indicacaoGuardado: number
  indicacaoGanhos: number
  indicacaoQtd: number
  chave: string
  promoAtiva: boolean
  promoDias: number
  perfilCompleto: boolean
  limites: Record<string, number>
  ctfEmDia: boolean
  docsContados: number
}

export const useCreditos = defineStore('creditos', {
  state: () => ({
    dados: null as Creditos | null,
    carregando: false
  }),

  actions: {
    definir(c: Creditos) {
      this.dados = c
    },
    limpar() {
      this.dados = null
    }
  }
})
