/**
 * Porta da casa. Tela do app sem token volta para o login; tela de entrada
 * com token vai para o início.
 *
 * O app é SPA, então o token só existe depois de o cliente montar — por isso
 * a restauração acontece aqui, antes de qualquer decisão.
 */
import { useAuth } from '~/stores/auth'

const PUBLICAS = [
  '/', '/login', '/maioridade', '/registrar', '/registrar-empresa',
  '/confirmar-email', '/esqueci', '/nova-senha', '/verificacao'
]

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const auth = useAuth()
  if (!auth.restaurado) auth.restaurar()

  const publica = PUBLICAS.includes(to.path)
  if (!auth.token && !publica) {
    return navigateTo({ path: '/login', query: { de: to.path } })
  }
  /* Já logado não precisa ver as telas de entrada — menos a de diagnóstico. */
  if (auth.token && publica && to.path !== '/verificacao') {
    return navigateTo('/inicio')
  }
})
