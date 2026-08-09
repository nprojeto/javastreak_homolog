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
import {
  ESCRITAS_OFFLINE, novaChave, enfileirar, listarFila, tirarDaFila, marcarErro
} from '~/composables/useFilaOffline'

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
  /**
   * ⚠️ `podeEnfileirar` existe por causa de um defeito que só um teste pegou:
   * ao ESVAZIAR a fila, se a rede caísse no meio, esta função enfileirava o
   * item de novo e devolvia sucesso — e o laço lá embaixo, achando que tinha
   * subido, APAGAVA o registro. Perda silenciosa, no caminho que existe
   * justamente para não perder nada. O reenvio da fila chama com `false`: ali
   * a falha tem que subir como falha.
   */
  async function chamada<T = unknown>(
    acao: string, args: unknown[], podeEnfileirar: boolean
  ): Promise<T> {
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

    /**
     * Gravação enfileirável: ganha `clienteId` e `dataHora` AGORA, antes de
     * sair. Os dois precisam ser os mesmos na tentativa online e no reenvio
     * da fila — o `clienteId` para o servidor reconhecer a repetição, e a
     * `dataHora` para o registro guardar a hora do campo, não a da subida.
     * Convenção: o payload é `args[0]`, que vale para todas as ações da lista.
     */
    const enfileiravel = podeEnfileirar && ESCRITAS_OFFLINE.has(acao)
    if (enfileiravel && args[0] && typeof args[0] === 'object') {
      const p = args[0] as Record<string, unknown>
      if (!p.clienteId) p.clienteId = novaChave()
      if (!p.dataHora) p.dataHora = new Date().toISOString()
    }

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

      /**
       * Gravação vai para a fila e a tela segue como se tivesse dado certo —
       * porque vai dar: o item sobe sozinho quando a rede voltar. Devolvemos
       * o próprio payload, com o `clienteId` fazendo as vezes de id, para o
       * que foi registrado aparecer na hora.
       */
      if (enfileiravel) {
        const p = args[0] as Record<string, unknown>
        const guardou = await enfileirar({
          id: String(p.clienteId), acao, args, quando: Date.now(), tentativas: 0
        })
        if (guardou) {
          ui.setConexao(false)
          await atualizarPendentes()
          ui.avisar('Sem rede — guardado no aparelho, sobe quando voltar')
          return { ...p, id: p.clienteId, pendente: true } as T
        }
      }

      ui.setConexao(false)
      const msg = abortou
        ? 'Servidor não respondeu (tempo esgotado)'
        : e instanceof Error
          ? e.message
          : String(e)
      /**
       * ⚠️ Leitura sem rede E sem nada guardado precisa de frase própria. O
       * navegador diz só "Load failed", que não explica nada a quem está no
       * mato — e o motivo verdadeiro é que aquela tela nunca foi aberta com
       * sinal, então não houve o que guardar.
       */
      if (guardavel) {
        ui.avisar('Sem rede, e esta tela ainda não tinha dados guardados. Abra-a uma vez com sinal.', 'erro')
        throw new ErroApi('SEM_REDE_SEM_CACHE', msg)
      }
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

  /** Porta normal: gravação que falhar por rede vai para a fila. */
  async function server<T = unknown>(acao: string, ...args: unknown[]): Promise<T> {
    return chamada<T>(acao, args, true)
  }

  /**
   * Sobe o que está na fila, um a um e em ordem de chegada.
   *
   * ⚠️ Falha de REDE para tudo e mantém o item. Recusa do SERVIDOR tira o
   * item e avisa: reenviar mil vezes não muda um "não" por teto de plano, e
   * o item preso travaria toda a fila atrás dele.
   *
   * ⚠️ Sequencial, não `Promise.all`. Além da ordem, o backend cobra teto de
   * plano contando o que já existe — cinco marcações em paralelo poderiam
   * passar do limite juntas, cada uma vendo o total de antes.
   */
  async function esvaziarFila(): Promise<void> {
    if (enviando) return
    /* Só os que estão no rodízio. Recusado espera decisão do dono. */
    const itens = (await listarFila()).filter((x) => !x.erro)
    if (!itens.length) { await atualizarPendentes(); return }

    enviando = true
    ui.setEnviandoFila(true)
    let subiram = 0
    let recusados = 0
    try {
      for (const item of itens) {
        try {
          /* `false`: aqui a falha de rede PRECISA subir, senão o item é
             re-enfileirado e apagado logo em seguida. */
          await chamada(item.acao, item.args, false)
          await tirarDaFila(item.id)
          subiram++
        } catch (e) {
          const cod = e instanceof ErroApi ? e.codigo : 'REDE'
          if (cod === 'REDE' || cod === 'TEMPO_ESGOTADO' || cod === 'SEM_REDE_SEM_CACHE') break
          if (cod === 'NAO_AUTENTICADO') break   // sessão morta: tenta no próximo login
          /* ⚠️ NÃO apaga. Marca e segue para o próximo — o item fica
             guardado para o dono ver o motivo e decidir. Ver a regra 4 da
             fila: um abate não some porque o servidor disse não. */
          await marcarErro(item.id, cod)
          recusados++
        }
      }
    } finally {
      enviando = false
      ui.setEnviandoFila(false)
      await atualizarPendentes()
    }
    if (subiram) ui.avisar(subiram + ' registro(s) enviados ✔')
    if (recusados) ui.avisar(recusados + ' registro(s) recusados — abra a faixa para ver o motivo', 'erro')
  }

  async function atualizarPendentes() {
    const itens = await listarFila()
    ui.setPendentes(itens.filter((x) => !x.erro).length)
    ui.setRecusados(itens.filter((x) => !!x.erro).length)
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
      return await chamada<T>(acao, args, true)
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

  return { server, serverOpc, esvaziarFila, atualizarPendentes, ErroApi }
}

/**
 * Guarda de reentrada da fila. Fica FORA do composable, como o contador de
 * supressão: é estado do processo, não do componente. Duas telas montadas ao
 * mesmo tempo chamariam `esvaziarFila` em paralelo e o mesmo item subiria
 * duas vezes — a chave de idempotência salvaria do duplicado no banco, mas
 * não do trabalho e da confusão na contagem.
 */
let enviando = false

/**
 * Contador de supressão. Fica fora do composable de propósito: é estado do
 * processo, não do componente, e precisa valer durante um Promise.all inteiro.
 */
let suprimirUpgrade = 0
