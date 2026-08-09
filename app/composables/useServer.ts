/**
 * ── A ÚNICA PORTA PARA O SERVIDOR ─────────────────────────────────────────
 *
 * Porte fiel do `server()` do index.html (linha 4518). No legado, as 176
 * chamadas do app passavam todas por aquela função; aqui vale o mesmo
 * contrato: nenhum `fetch` solto em tela nenhuma, nunca.
 *
 * É por isso que a fase 2 é barata. Quando o backend virar Laravel, o formato
 * muda de { action, args, token } para REST — e MUDA SÓ ESTE ARQUIVO. As 80
 * telas não sabem, e não devem saber, como o servidor é falado.
 *
 * Protocolo atual (Supabase Edge Function, Deno):
 *   POST { action: 'apiListarCevas', args: [...], token: '...' }
 *   →    { ok: true,  data: ... }
 *   →    { ok: false, error: 'CODIGO' }
 */
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { msgErro } from '~/composables/useMsgErro'
import { LEITURAS_OFFLINE, chaveDe, guardar, recuperar } from '~/composables/useCacheOffline'

const TEMPO_LIMITE = 25000 // igual ao legado

/** Erro de servidor com o código preservado, para a tela poder decidir. */
export class ErroApi extends Error {
  codigo: string
  plano: boolean
  chave: string

  constructor(codigo: string, mensagem?: string) {
    super(mensagem || codigo)
    this.name = 'ErroApi'
    this.codigo = codigo
    this.plano = false
    this.chave = ''
  }
}

export function useServer() {
  const cfg = useRuntimeConfig()
  const auth = useAuth()
  const ui = useUi()

  /**
   * Chama uma ação do servidor.
   *
   * @example const cevas = await server<Ceva[]>('apiListarCevas')
   * @example await server('apiSalvarCeva', dados)
   */
  async function server<T = unknown>(acao: string, ...args: unknown[]): Promise<T> {
    const ctrl = new AbortController()
    const relogio = setTimeout(() => ctrl.abort(), TEMPO_LIMITE)

    /**
     * ⚠️ A chave carrega a IDENTIDADE de quem pede. Sem isso, dois usuários
     * no mesmo aparelho compartilhariam cache — e o segundo veria as
     * propriedades do primeiro. O token serve como identidade porque muda a
     * cada login; sair da conta ainda apaga tudo, no `auth.encerrar()`.
     */
    const guardavel = LEITURAS_OFFLINE.has(acao)
    const chave = guardavel ? chaveDe(auth.token || 'anon', acao, args) : ''

    let resposta: { ok?: boolean; data?: T; error?: string }

    try {
      const r = await fetch(cfg.public.apiUrl, {
        method: 'POST',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          Authorization: 'Bearer ' + cfg.public.apiKey,
          apikey: cfg.public.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: acao, args, token: auth.token })
      })
      resposta = await r.json()
    } catch (e: unknown) {
      clearTimeout(relogio)
      const abortou = e instanceof Error && e.name === 'AbortError'

      /**
       * ⚠️ ESTE é o único lugar em que o cache entra: a rede falhou, o
       * servidor não chegou a dizer nada. Se ele tivesse respondido `ok:false`
       * o fluxo estaria lá embaixo, e uma recusa jamais pode virar dado
       * velho — pela mesma razão que nunca pode virar lista vazia.
       */
      if (guardavel) {
        const g = await recuperar<T>(chave)
        if (g) {
          ui.usandoCache(g.quando)
          return g.dado
        }
      }

      ui.setConexao(false)
      const msg = abortou
        ? 'Servidor não respondeu (tempo esgotado)'
        : e instanceof Error
          ? e.message
          : String(e)
      ui.avisar('Erro: ' + msg, 'erro')
      throw new ErroApi(abortou ? 'TEMPO_ESGOTADO' : 'REDE', msg)
    } finally {
      clearTimeout(relogio)
    }

    if (!resposta.ok) {
      const codigo = String(resposta.error || 'ERRO')

      // Sessão morta: o token não vale mais. Limpa e deixa a tela redirecionar.
      if (codigo === 'NAO_AUTENTICADO') {
        ui.setConexao(true)
        auth.encerrar()
        ui.avisar('Sessão expirada, entre novamente', 'erro')
        throw new ErroApi('NAO_AUTENTICADO', 'Sessão expirada')
      }

      // PLANO_NECESSARIO|chave|precisa — o servidor manda o que falta.
      if (codigo.indexOf('PLANO_NECESSARIO') === 0) {
        ui.setConexao(true)
        const p = codigo.split('|')
        const erro = new ErroApi('PLANO_NECESSARIO', 'Plano necessário')
        erro.plano = true
        erro.chave = p[1] || ''
        if (!suprimirUpgrade) ui.pedirUpgrade(p[1] || '', p[2] || '')
        throw erro
      }

      /**
       * ⚠️ PERFIL_INCOMPLETO é a armadilha nº 1 do dossiê: o vínculo do
       * manejador vazio. Aqui ela NÃO pode virar lista vazia — se virar, o
       * registro some da tela e a caçada ao bug recomeça do zero.
       */
      ui.setConexao(true)
      /* O aviso mostra a frase, não o código: `PROP_IRREGULAR|Sítio X` não diz
         nada a quem está usando. O código continua no erro, para a tela poder
         decidir (o login usa EMAIL_NAO_CONFIRMADO, por exemplo). */
      ui.avisar(msgErro(new Error(codigo)), 'erro')
      throw new ErroApi(codigo)
    }

    ui.setConexao(true)
    /* Deu certo: guarda para a próxima vez que faltar rede. Sem `await` de
       propósito — a tela não espera o disco para mostrar o que já tem. */
    if (guardavel) void guardar(chave, resposta.data)
    return resposta.data as T
  }

  /**
   * Lista opcional de formulário. Se o plano não libera o recurso, devolve
   * vazio em vez de jogar o usuário para a tela de planos — sem isso, um item
   * bloqueado derruba o formulário inteiro (Promise.all rejeita no primeiro
   * erro).
   *
   * ⚠️ Diferença deliberada do legado: aqui o silêncio vale SÓ para bloqueio de
   * plano. No index.html o `.catch` devolvia [] para qualquer erro, e era isso
   * que escondia falha de vínculo (famílias 1 e 5 do dossiê). Qualquer outro
   * erro segue subindo.
   */
  async function serverOpc<T = unknown[]>(
    acao: string,
    ...args: unknown[]
  ): Promise<T | (unknown[] & { bloqueadoPorPlano?: boolean })> {
    suprimirUpgrade++
    try {
      return await server<T>(acao, ...args)
    } catch (e) {
      if (e instanceof ErroApi && e.plano) {
        const vazio: unknown[] & { bloqueadoPorPlano?: boolean } = []
        vazio.bloqueadoPorPlano = true
        return vazio
      }
      throw e
    } finally {
      suprimirUpgrade--
    }
  }

  return { server, serverOpc, ErroApi }
}

/**
 * Contador de supressão. Fica fora do composable de propósito: é estado do
 * processo, não do componente, e precisa valer durante um Promise.all inteiro.
 */
let suprimirUpgrade = 0
