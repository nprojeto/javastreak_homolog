import { defineStore } from 'pinia'
import { limparCache } from '~/composables/useCacheOffline'

const CHAVE_TOKEN = 'mj_token' // mesma chave do index.html legado

export interface Manejador { id?: string; nome?: string; [k: string]: unknown }
export interface Empresa { id?: string; nome?: string; [k: string]: unknown }

/** Resposta do authResp_() do backend: apiLogin e apiConfirmarEmail devolvem isto. */
export interface RespostaAuth {
  token: string
  tipo: 'manejador' | 'empresa'
  admin?: boolean
  manejador?: Manejador | null
  empresa?: Empresa | null
  idioma?: string
  login?: string
  promoInd?: unknown
}

export const useAuth = defineStore('auth', {
  state: () => ({
    token: '' as string,
    tipo: 'manejador' as 'manejador' | 'empresa',
    admin: false,
    login: '' as string,
    manejador: null as Manejador | null,
    empresa: null as Empresa | null,
    /** Sobe quando o servidor devolve NAO_AUTENTICADO. */
    expirouAgora: false,
    restaurado: false
  }),

  getters: {
    autenticado: (s) => !!s.token,
    nome: (s) =>
      s.tipo === 'empresa' ? (s.empresa?.nome || '') : (s.manejador?.nome || '')
  },

  actions: {
    /** Lê o token do aparelho. Só roda no cliente (o app é SPA). */
    restaurar() {
      try {
        this.token = localStorage.getItem(CHAVE_TOKEN) || ''
      } catch {
        this.token = ''
      }
      this.restaurado = true
    },

    salvarToken(t: string) {
      this.token = t || ''
      try {
        if (t) localStorage.setItem(CHAVE_TOKEN, t)
        else localStorage.removeItem(CHAVE_TOKEN)
      } catch {
        /* modo privado do Safari: segue em memória */
      }
    },

    /**
     * Porte do aplicarAuth() legado.
     *
     * ⚠️ Sem token não existe login. O legado seguia em frente mesmo assim e
     * desenhava a tela inicial com uma sessão fantasma — foi o que fez o
     * cadastro "entrar direto" com o HTML e a função descasados. Aqui recusa.
     */
    aplicarAuth(r: RespostaAuth | null): boolean {
      if (!r || !r.token) return false
      this.salvarToken(r.token)
      this.tipo = r.tipo || 'manejador'
      this.admin = !!r.admin
      this.login = r.login || ''
      if (this.tipo === 'empresa') {
        this.empresa = r.empresa || null
        this.manejador = null
      } else {
        this.manejador = r.manejador || null
        this.empresa = null
      }
      this.expirouAgora = false
      return true
    },

    /** Limpa tudo. Quem redireciona é a tela — a store não conhece rota. */
    encerrar() {
      this.salvarToken('')
      this.manejador = null
      this.empresa = null
      this.admin = false
      this.login = ''
      this.expirouAgora = true
      /* ⚠️ O cache offline morre junto com a sessão. Deixá-lo para trás faria
         o próximo login no mesmo aparelho enxergar propriedade, ceva e
         documento de quem saiu — vazamento, não falha de tela. */
      void limparCache()
    },

    reconhecerExpiracao() {
      this.expirouAgora = false
    }
  }
})
