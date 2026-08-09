/**
 * ── FILA DE GRAVAÇÃO OFFLINE ──────────────────────────────────────────────
 *
 * O que foi registrado sem rede fica aqui até subir. Companheira do
 * `useCacheOffline`, que faz o inverso: um guarda o que veio, outro guarda o
 * que vai.
 *
 * ── AS REGRAS ──
 *
 * ⚠️ 1. SÓ AS AÇÕES DA LISTA. Enfileirar qualquer gravação seria prometer o
 *    que não se pode cumprir: `apiCriarAbate` busca o tempo no instante do
 *    abate e recusa se não conseguir, então um abate enfileirado falharia na
 *    subida. Enquanto o clima do passado não existir, ele fica de fora.
 *
 * ⚠️ 2. CHAVE DE IDEMPOTÊNCIA SEMPRE. Cada item nasce com um `clienteId` que
 *    vai no corpo da chamada. Sem ele, um reenvio depois de a resposta se
 *    perder cria o registro DUAS vezes — e o backend reexecuta cada ação por
 *    conta própria (`PrecisaTabela`), o que dobra a chance.
 *
 * ⚠️ 3. A HORA É A DO REGISTRO, NÃO A DA SUBIDA. `dataHora` é carimbada aqui,
 *    no aparelho, quando a pessoa salva. Deixar o servidor carimbar faria uma
 *    marcação feita às 6h da manhã constar das 15h.
 *
 * ⚠️ 4. RECUSA DO SERVIDOR PARA O ITEM, MAS NÃO O APAGA. Se o servidor
 *    respondeu "não" — teto de plano, ponto fora da propriedade —, reenviar
 *    mil vezes não muda a resposta e travaria tudo o que está atrás. Então o
 *    item é marcado com `erro`, sai do rodízio automático e **continua
 *    guardado**, à espera de o dono decidir.
 *
 *    Foi por causa do ABATE que isto ficou assim. Descartar sozinho servia
 *    para uma marcação; para um abate, não: a pessoa matou o animal,
 *    registrou, e horas depois um aviso passageiro diria que se perdeu. Um
 *    registro que vai ao relatório do IBAMA não desaparece porque um teto de
 *    plano estourou enquanto o celular estava no bolso.
 */

const BANCO = 'javastreak-fila'
const LOJA = 'pendentes'
const VERSAO = 1

/** Gravações que a fila sabe reenviar. Ver a regra 1. */
export const ESCRITAS_OFFLINE = new Set(['apiCriarMarcacao', 'apiCriarAbate'])

/**
 * Nome legível de cada uma, para a fila poder dizer o que está segurando em
 * vez de mostrar o nome da ação ao usuário.
 */
export const NOME_ESCRITA: Record<string, string> = {
  apiCriarMarcacao: 'Marcação no mapa',
  apiCriarAbate: 'Abate'
}

export interface ItemFila {
  id: string
  acao: string
  args: unknown[]
  quando: number
  /** Quantas vezes a rede falhou neste item. Só para mostrar. */
  tentativas: number
  /** Código da recusa do servidor. Preenchido, o item sai do rodízio. */
  erro?: string
}

let bancoAberto: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (bancoAberto) return bancoAberto
  bancoAberto = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return }
      const req = indexedDB.open(BANCO, VERSAO)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(LOJA)) db.createObjectStore(LOJA, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return bancoAberto
}

/** Identificador único do aparelho para esta gravação. Ver a regra 2. */
export function novaChave(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'c_' + crypto.randomUUID()
  } catch { /* navegador antigo */ }
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
}

export async function enfileirar(item: ItemFila): Promise<boolean> {
  const db = await abrir()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const r = db.transaction(LOJA, 'readwrite').objectStore(LOJA).put(item)
      r.onsuccess = () => resolve(true)
      r.onerror = () => resolve(false)
    } catch { resolve(false) }
  })
}

export async function listarFila(): Promise<ItemFila[]> {
  const db = await abrir()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const r = db.transaction(LOJA, 'readonly').objectStore(LOJA).getAll()
      r.onsuccess = () => {
        const v = (r.result || []) as ItemFila[]
        /* Ordem de chegada: quem registrou primeiro sobe primeiro. */
        resolve(v.sort((a, b) => a.quando - b.quando))
      }
      r.onerror = () => resolve([])
    } catch { resolve([]) }
  })
}

/** Marca a recusa e tira do rodízio automático, sem apagar. Ver a regra 4. */
export async function marcarErro(id: string, erro: string): Promise<void> {
  const itens = await listarFila()
  const item = itens.find((x) => x.id === id)
  if (!item) return
  await enfileirar({ ...item, erro })
}

/** Devolve um item recusado ao rodízio, para o dono tentar de novo. */
export async function reativar(id: string): Promise<void> {
  const itens = await listarFila()
  const item = itens.find((x) => x.id === id)
  if (!item) return
  const limpo = { ...item }
  delete limpo.erro
  await enfileirar(limpo)
}

export async function tirarDaFila(id: string): Promise<void> {
  const db = await abrir()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const r = db.transaction(LOJA, 'readwrite').objectStore(LOJA).delete(id)
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    } catch { resolve() }
  })
}

export async function limparFila(): Promise<void> {
  const db = await abrir()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const r = db.transaction(LOJA, 'readwrite').objectStore(LOJA).clear()
      r.onsuccess = () => resolve()
      r.onerror = () => resolve()
    } catch { resolve() }
  })
}
