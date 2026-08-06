import { defineStore } from 'pinia'

/**
 * Estado que vem do `apiPing` — ação pública, roda antes de qualquer login.
 * É dele que saem o teto de contas (a "parede de vagas") e o estado da
 * promoção de indicação, que decidem o que o cadastro mostra.
 */
export const useApp = defineStore('app', {
  state: () => ({
    appNome: 'JavaStreak',
    apiVer: '',
    vagas: { manejador: true, empresa: true },
    promoIndAtiva: false,
    promoIndDias: 10,
    carregado: false
  }),

  actions: {
    aplicarPing(p: {
      appNome?: string
      apiVer?: string
      vagas?: { manejador?: boolean; empresa?: boolean }
      promoInd?: { ativa?: boolean; dias?: number }
    }) {
      if (p.appNome) this.appNome = p.appNome
      if (p.apiVer) this.apiVer = p.apiVer
      if (p.vagas) {
        this.vagas = {
          manejador: p.vagas.manejador !== false,
          empresa: p.vagas.empresa !== false
        }
      }
      this.promoIndAtiva = !!p.promoInd?.ativa
      this.promoIndDias = Number(p.promoInd?.dias) || 10
      this.carregado = true
    },

    /**
     * O servidor recusou por teto cheio depois de o app achar que havia vaga.
     * Marca para a tela virar a parede sem precisar recarregar.
     */
    esgotou(tipo: 'manejador' | 'empresa') {
      this.vagas = { ...this.vagas, [tipo]: false }
    }
  }
})
