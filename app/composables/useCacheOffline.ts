/**
 * ── CACHE DE LEITURA OFFLINE ──────────────────────────────────────────────
 *
 * Guarda a última resposta boa das leituras e a devolve quando a rede cai.
 * Vive em IndexedDB porque `localStorage` é síncrono (trava a interface) e
 * tem teto de poucos megabytes — o guiamento de uma propriedade grande já
 * passa disso.
 *
 * ── AS TRÊS REGRAS QUE NÃO PODEM SER QUEBRADAS ──
 *
 * ⚠️ 1. SÓ CAI NO CACHE QUANDO A REDE FALHA. Recusa do servidor (`ok:false`)
 *    nunca vira dado velho, do mesmo jeito que nunca pode virar lista vazia.
 *    `PROP_IRREGULAR` tem que aparecer; se um dado guardado tapasse o buraco,
 *    a pessoa criaria ceva numa propriedade fechada e só descobriria depois.
 *    É a mesma armadilha que o `serverOpc` já evita, num outro disfarce.
 *
 * ⚠️ 2. SÓ LEITURA, e só as da lista abaixo. Gravação em cache seria fila de
 *    escrita, que é outro problema (e exige chave de idempotência no
 *    servidor, senão o `PrecisaTabela` duplica o registro no reenvio).
 *
 * ⚠️ 3. O CACHE É POR CONTA. A chave carrega a identidade de quem pediu, e
 *    sair da conta apaga tudo. Sem isso, trocar de usuário no mesmo aparelho
 *    mostraria propriedade alheia — que é vazamento, não bug de tela.
 */

const BANCO = 'javastreak-offline'
const LOJA = 'respostas'
const VERSAO = 1

/** Quanto tempo um dado guardado ainda vale a pena mostrar. */
const VALIDADE_MS = 1000 * 60 * 60 * 24 * 14

/**
 * Leituras que valem guardar. Lista fechada de propósito: heurística por
 * nome ("tudo que começa com apiListar") pegaria ação de admin e leitura
 * cara sem ninguém decidir. Aqui está o que serve no campo, sem rede.
 */
export const LEITURAS_OFFLINE = new Set([
  /* casca */
  'apiBoot', 'apiMeusCreditos', 'apiAvisos', 'apiAgenda',
  /* o caminho da caça */
  'apiMeuCtf', 'apiListarPropriedades', 'apiListarCevas', 'apiListarRotas',
  'apiListarMarcacoes',
  'apiListarManejos', 'apiManejo', 'apiManejoGuia',
  'apiAbatesDoManejo', 'apiAmigosDoManejo',
  /* documentação e bichos */
  'apiListarDocumentos', 'apiListarCanis', 'apiListarCaes',
  'apiListarSaude', 'apiListarTransportes', 'apiListarSaudeTransp',
  'apiListarManutencao'
])

export interface Guardado<T = unknown> { dado: T; quando: number }

let bancoAberto: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (bancoAberto) return bancoAberto
  bancoAberto = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return }
      const req = indexedDB.open(BANCO, VERSAO)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA)
      }
      req.onsuccess = () => resolve(req.result)
      /* Safari em navegação privada recusa abrir. Sem cache, o app segue. */
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return bancoAberto
}

function transacao(db: IDBDatabase, modo: IDBTransactionMode) {
  return db.transaction(LOJA, modo).objectStore(LOJA)
}

/**
 * Chave da entrada. Leva a identidade da conta, a ação e os argumentos —
 * `apiManejo('M1')` e `apiManejo('M2')` são respostas diferentes.
 */
export function chaveDe(dono: string, acao: string, args: unknown[]): string {
  let a = '[]'
  try { a = JSON.stringify(args ?? []) } catch { a = '?' }
  return dono + '|' + acao + '|' + a
}

export async function guardar(chave: string, dado: unknown): Promise<void> {
  const db = await abrir()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const r = transacao(db, 'readwrite').put({ dado, quando: Date.now() } as Guardado, chave)
      r.onsuccess = () => resolve()
      /* Cota estourada: não é motivo para derrubar a chamada que deu certo. */
      r.onerror = () => resolve()
    } catch { resolve() }
  })
}

export async function recuperar<T>(chave: string): Promise<Guardado<T> | null> {
  const db = await abrir()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const r = transacao(db, 'readonly').get(chave)
      r.onsuccess = () => {
        const v = r.result as Guardado<T> | undefined
        if (!v || typeof v.quando !== 'number') { resolve(null); return }
        if (Date.now() - v.quando > VALIDADE_MS) { resolve(null); return }
        resolve(v)
      }
      r.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

/** Apaga tudo. Chamado ao sair da conta — ver a regra 3 no topo. */
export async function limparCache(): Promise<void> {
  const db = await abrir()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const r = transacao(db, 'readwrite').clear()
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    } catch { resolve() }
  })
}
