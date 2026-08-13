/**
 * ── SEMELHANÇA DE CONDIÇÕES ───────────────────────────────────────────────
 *
 * Compara o clima de AGORA com o clima gravado em cada abate daquela ceva ou
 * rota, e diz o quanto as condições de hoje se parecem com as dos dias em que
 * houve abate ali.
 *
 * ⚠️ ISTO NÃO É PREVISÃO, e a tela precisa dizer isso. É semelhança com o
 * passado, calculada sobre a amostra de UMA pessoa naquele ponto — quase
 * sempre punhados de registros. Vender como "70% de chance de abate" seria
 * inventar uma certeza que o dado não sustenta: javali não aparece porque a
 * umidade bateu, e ninguém registra as noites em que ficou na espera e não
 * viu nada (só o abate vira linha no banco). Por isso o resultado é rotulado
 * como PARECIDO / POUCO PARECIDO, e vem sempre com o tamanho da amostra.
 *
 * ⚠️ Só entram abates com `condFonte: 'auto'` quando disponível — clima
 * preenchido à mão é lembrança, não medição, e misturar os dois faria uma
 * memória vaga pesar igual a um dado do MET Norway.
 */

/** Clima de um instante. Os campos vêm iguais do abate e do tempo real. */
export interface Clima {
  luaFase?: string
  condicaoTempo?: string
  temp?: number | string
  umidade?: number | string
  vento?: number | string
  pressao?: number | string
  chuvaMm?: number | string
  condFonte?: string
}

export interface Dimensao {
  chave: string
  rotulo: string
  /** 0 a 1. `null` quando falta dado dos dois lados. */
  nota: number | null
  agora: string
  tipico: string
}

export interface Semelhanca {
  /** 0 a 100. `null` sem amostra suficiente. */
  indice: number | null
  amostra: number
  dimensoes: Dimensao[]
  /** Rótulo honesto: o que o número quer dizer. */
  faixa: 'alta' | 'media' | 'baixa' | null
}

const n = (v: unknown): number | null => {
  const x = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(x) ? null : x
}

/**
 * As oito fases da lua formam um CICLO: 'Minguante final' e 'Lua nova' são
 * vizinhas, embora estejam nas pontas da lista. Comparar por índice sem
 * fechar o círculo daria distância máxima a fases quase idênticas.
 */
const LUA = ['Lua nova', 'Crescente inicial', 'Quarto crescente', 'Crescente final',
  'Lua cheia', 'Minguante inicial', 'Quarto minguante', 'Minguante final']

function notaLua(a?: string, b?: string): number | null {
  const ia = LUA.indexOf(String(a || '')), ib = LUA.indexOf(String(b || ''))
  if (ia < 0 || ib < 0) return null
  const d = Math.min(Math.abs(ia - ib), LUA.length - Math.abs(ia - ib))
  return 1 - d / (LUA.length / 2)
}

/**
 * As condições do tempo também têm ordem — do céu aberto à tempestade —,
 * então "Nublado" perto de "Garoa" vale mais que "Nublado" perto de "Aberto".
 * Aqui a escala NÃO é circular: tempestade não faz fronteira com céu limpo.
 */
const COND = ['Aberto', 'Parcialmente nublado', 'Nublado', 'Neblina', 'Garoa', 'Chuva', 'Tempestade']

function notaCond(a?: string, b?: string): number | null {
  const ia = COND.indexOf(String(a || '')), ib = COND.indexOf(String(b || ''))
  if (ia < 0 || ib < 0) return null
  return 1 - Math.abs(ia - ib) / (COND.length - 1)
}

/** Nota por proximidade numérica, com a tolerância própria de cada grandeza. */
function notaNum(a: unknown, b: unknown, tolerancia: number): number | null {
  const x = n(a), y = n(b)
  if (x === null || y === null) return null
  return Math.max(0, 1 - Math.abs(x - y) / tolerancia)
}

/**
 * Peso de cada dimensão. Lua e condição do tempo pesam mais porque são o que
 * o manejador de fato observa e comenta; pressão pesa pouco porque varia numa
 * faixa estreita e quase nunca distingue um dia do outro.
 */
const PESOS: Record<string, number> = {
  lua: 3, condicao: 3, temp: 2, umidade: 2, vento: 1, chuva: 1, pressao: 1
}

/** Mediana, não média: um registro extremo não desloca o valor típico. */
function mediana(v: number[]): number | null {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2
}

/** Valor mais repetido — para lua e condição, que são categorias. */
function maisComum(v: string[]): string {
  const c: Record<string, number> = {}
  for (const x of v) if (x) c[x] = (c[x] || 0) + 1
  let melhor = '', qtd = 0
  for (const k in c) if (c[k]! > qtd) { melhor = k; qtd = c[k]! }
  return melhor
}

const fmt = (v: number | null, suf = '') => (v === null ? '—' : Math.round(v * 10) / 10 + suf)

/**
 * ⚠️ AMOSTRA MÍNIMA DE 3. Com um ou dois abates, qualquer número pareceria
 * significativo e não seria — a tela mostra os registros e não calcula índice.
 */
export const AMOSTRA_MINIMA = 3

export function compararClima(agora: Clima | null, abates: Clima[]): Semelhanca {
  /* Clima medido vale mais que clima lembrado. Se houver medidos suficientes,
     os preenchidos à mão ficam de fora; senão, entram todos — melhor pouca
     evidência declarada que nenhuma. */
  const medidos = abates.filter((a) => String(a.condFonte || '') === 'auto')
  const usados = medidos.length >= AMOSTRA_MINIMA ? medidos : abates

  const vazio: Semelhanca = { indice: null, amostra: usados.length, dimensoes: [], faixa: null }
  if (!agora || usados.length < AMOSTRA_MINIMA) return vazio

  const tipico = {
    lua: maisComum(usados.map((a) => String(a.luaFase || ''))),
    condicao: maisComum(usados.map((a) => String(a.condicaoTempo || ''))),
    temp: mediana(usados.map((a) => n(a.temp)).filter((x): x is number => x !== null)),
    umidade: mediana(usados.map((a) => n(a.umidade)).filter((x): x is number => x !== null)),
    vento: mediana(usados.map((a) => n(a.vento)).filter((x): x is number => x !== null)),
    pressao: mediana(usados.map((a) => n(a.pressao)).filter((x): x is number => x !== null)),
    chuva: mediana(usados.map((a) => n(a.chuvaMm)).filter((x): x is number => x !== null))
  }

  const dimensoes: Dimensao[] = [
    { chave: 'lua', rotulo: 'Fase da lua', nota: notaLua(agora.luaFase, tipico.lua),
      agora: String(agora.luaFase || '—'), tipico: tipico.lua || '—' },
    { chave: 'condicao', rotulo: 'Céu', nota: notaCond(agora.condicaoTempo, tipico.condicao),
      agora: String(agora.condicaoTempo || '—'), tipico: tipico.condicao || '—' },
    /* Tolerâncias: a distância a partir da qual a dimensão deixa de contar.
       8 °C, 30 pontos de umidade, 15 km/h, 10 hPa, 5 mm. */
    { chave: 'temp', rotulo: 'Temperatura', nota: notaNum(agora.temp, tipico.temp, 8),
      agora: fmt(n(agora.temp), ' °C'), tipico: fmt(tipico.temp, ' °C') },
    { chave: 'umidade', rotulo: 'Umidade', nota: notaNum(agora.umidade, tipico.umidade, 30),
      agora: fmt(n(agora.umidade), '%'), tipico: fmt(tipico.umidade, '%') },
    { chave: 'vento', rotulo: 'Vento', nota: notaNum(agora.vento, tipico.vento, 15),
      agora: fmt(n(agora.vento), ' km/h'), tipico: fmt(tipico.vento, ' km/h') },
    { chave: 'chuva', rotulo: 'Chuva', nota: notaNum(agora.chuvaMm, tipico.chuva, 5),
      agora: fmt(n(agora.chuvaMm), ' mm'), tipico: fmt(tipico.chuva, ' mm') },
    { chave: 'pressao', rotulo: 'Pressão', nota: notaNum(agora.pressao, tipico.pressao, 10),
      agora: fmt(n(agora.pressao), ' hPa'), tipico: fmt(tipico.pressao, ' hPa') }
  ]

  /* ⚠️ Média PONDERADA só do que existe. Dimensão sem dado dos dois lados sai
     da conta inteira — contá-la como zero puxaria o índice para baixo por
     falta de informação, não por diferença de clima. */
  let soma = 0, peso = 0
  for (const d of dimensoes) {
    if (d.nota === null) continue
    const p = PESOS[d.chave] || 1
    soma += d.nota * p
    peso += p
  }
  if (!peso) return { ...vazio, dimensoes }

  const indice = Math.round((soma / peso) * 100)
  const faixa = indice >= 70 ? 'alta' : indice >= 45 ? 'media' : 'baixa'
  return { indice, amostra: usados.length, dimensoes, faixa }
}
