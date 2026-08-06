/**
 * Carrega, uma vez por sessão, o que a moldura do app precisa: os créditos
 * (faixa do topo, selo do plano, travas de criação) e o plano.
 *
 * Fica num composable e não no layout para que qualquer tela possa pedir
 * recarga depois de uma ação que muda saldo — sem duplicar a chamada.
 */
import { useCreditos } from '~/stores/creditos'
import type { Creditos } from '~/stores/creditos'
import { useAuth } from '~/stores/auth'

export function useSessaoApp() {
  const cred = useCreditos()
  const auth = useAuth()
  const { server } = useServer()

  async function carregarCreditos(forcar = false) {
    if (!auth.token) return
    if (cred.dados && !forcar) return
    if (cred.carregando) return
    cred.carregando = true
    try {
      cred.definir(await server<Creditos>('apiMeusCreditos'))
    } catch {
      /* Faixa some, app continua. Não vale travar a tela por causa dela. */
    } finally {
      cred.carregando = false
    }
  }

  return { carregarCreditos }
}

export interface Bloqueio {
  motivo: string
  rotuloAcao: string
  rota: string
}

/**
 * Porte de `bloqueioCriar`. Devolve o motivo pelo qual o botão de criar deve
 * nascer travado, ou null se está liberado.
 *
 * A ordem importa e é a do legado: CTF antes de tudo, depois a ficha, depois
 * o limite do plano.
 */
export function bloqueioCriar(
  c: Creditos | null,
  chave: string,
  qtdAtual = 0
): Bloqueio | null {
  if (!c) return null // ainda carregando: não trava à toa

  if (c.ctfEmDia === false) {
    return {
      motivo: 'Seu CTF está vencido ou não foi cadastrado. Sem ele não dá para caçar, registrar abate ou entrar na caçada de alguém.',
      rotuloAcao: 'Cadastrar CTF',
      rota: '/cacar'
    }
  }
  if (c.perfilCompleto === false) {
    return {
      motivo: 'Sua ficha de manejador ainda não existe. Sem ela o registro é salvo sem dono e não aparece na lista.',
      rotuloAcao: 'Criar meu perfil',
      rota: '/perfil'
    }
  }
  if (chave === 'ciclo') return null

  const lim = (c.limites || {})[chave]
  if (lim === undefined || lim === null || lim === -1) return null
  if (lim === 0) {
    return {
      motivo: 'Seu plano atual não inclui este recurso.',
      rotuloAcao: 'Ver planos',
      rota: '/planos'
    }
  }
  if ((Number(qtdAtual) || 0) >= lim) {
    return {
      motivo: 'Você chegou ao limite do seu plano: ' + lim + '.',
      rotuloAcao: 'Ver planos',
      rota: '/planos'
    }
  }
  return null
}
