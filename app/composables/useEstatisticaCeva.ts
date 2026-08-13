/**
 * ── ESTATÍSTICA DA CEVA / ROTA ────────────────────────────────────────────
 *
 * Responde: dos abates que já saíram aqui, quantos aconteceram em condições
 * como as de agora? É a seção 4.7 do dossiê, que ficou na fila desde o porte.
 *
 * ⚠️ É FREQUÊNCIA, NÃO PROBABILIDADE, e a tela precisa dizer isso com todas
 * as letras. O app só registra ABATE — ninguém registra a espera de cinco
 * horas em que nada apareceu. Sem o denominador não existe probabilidade;
 * existe "com lua cheia saíram 4 dos meus 6 abates aqui". A diferença não é
 * preciosismo: alguém dirige 40 km por causa desse número.
 *
 * ⚠️ Dimensão sem dado NÃO conta zero — sai da conta. Contar como zero
 * derrubaria o índice por falta de informação, não por condição desfavorável,
 * e a tela ainda diria "sem histórico para: Clima" enquanto o
 * número já teria sido punido por isso.
 */

export interface Abate {
  id: string
  dataHora?: string
  quantidade?: string
  sexo?: string
  pesoAprox?: string
  comprimento?: string
  desenvolvimento?: string
  metodoAbate?: string
  obs?: string
  fotoUrl?: string
  luaFase?: string
  condicaoTempo?: string
  temp?: number | string
  umidade?: number | string
  vento?: number | string
  pressao?: number | string
  chuvaMm?: number | string
  condFonte?: string
  abatidoPorNome?: string
}

/** Condições de agora, vindas do `apiClimaCeva`. */
export interface Agora {
  luaFase?: string
  condicaoTempo?: string
  temp?: number | string
  umidade?: number | string
  vento?: number | string
  pressao?: number | string
  chuvaMm?: number | string
  /** Instante de referência. Ausente, usa o relógio. */
  quando?: Date
}

export interface Dimensao {
  chave: string
  rotulo: string
  /** Fração dos abates em condição como a de agora. `null` = sem histórico. */
  frequencia: number | null
  /** Quantos abates casaram, de quantos com dado. */
  casaram: number
  comDado: number
  /** O que é "agora" nesta dimensão, em texto. */
  agora: string
  peso: number
}

export interface Estatistica {
  /** 0 a 100. `null` sem base nenhuma. */
  indice: number | null
  /** Abates que entraram na conta. */
  base: number
  confianca: 'baixa' | 'media' | 'alta' | null
  dimensoes: Dimensao[]
  /** Rótulos das dimensões que não têm histórico. */
  semHistorico: string[]
}

const n = (v: unknown): number | null => {
  const x = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(x) ? null : x
}

/* ── faixas ───────────────────────────────────────────────────────────────
   Comparar número exato nunca casaria: 21,4 °C e 22,1 °C são a mesma noite.
   Cada grandeza vira faixa, e o casamento é entre faixas. */

export function faixaTemp(v: unknown): string {
  const x = n(v); if (x === null) return ''
  if (x < 12) return 'Abaixo de 12 °C'
  if (x < 18) return '12 a 18 °C'
  if (x < 24) return '18 a 24 °C'
  if (x < 30) return '24 a 30 °C'
  return 'Acima de 30 °C'
}
export function faixaUmidade(v: unknown): string {
  const x = n(v); if (x === null) return ''
  if (x < 40) return 'Seco (abaixo de 40%)'
  if (x < 70) return 'Ameno (40 a 70%)'
  if (x < 85) return 'Úmido (70 a 85%)'
  return 'Muito úmido (acima de 85%)'
}
export function faixaVento(v: unknown): string {
  const x = n(v); if (x === null) return ''
  if (x < 5) return 'Calmo (abaixo de 5 km/h)'
  if (x < 15) return 'Brisa (5 a 15 km/h)'
  if (x < 30) return 'Vento (15 a 30 km/h)'
  return 'Forte (acima de 30 km/h)'
}
export function faixaPressao(v: unknown): string {
  const x = n(v); if (x === null) return ''
  if (x < 1005) return 'Baixa (abaixo de 1005 hPa)'
  if (x < 1018) return 'Normal (1005 a 1018 hPa)'
  return 'Alta (acima de 1018 hPa)'
}
export function faixaChuva(v: unknown): string {
  const x = n(v); if (x === null) return ''
  if (x === 0) return 'Sem chuva'
  if (x < 2) return 'Garoa (até 2 mm)'
  if (x < 10) return 'Chuva (2 a 10 mm)'
  return 'Chuva forte (acima de 10 mm)'
}

/**
 * Período do dia. Javali é bicho de crepúsculo e de noite — separar o dia em
 * quatro pedaços diz mais que a hora cheia, que quase nunca se repete igual.
 */
export function periodoDoDia(d: Date | string | undefined): string {
  const dt = d instanceof Date ? d : new Date(String(d || ''))
  if (isNaN(dt.getTime())) return ''
  const h = dt.getHours()
  if (h < 5) return 'Madrugada'
  if (h < 11) return 'Manhã'
  if (h < 17) return 'Tarde'
  if (h < 20) return 'Fim de tarde'
  return 'Noite'
}

/**
 * Peso de cada dimensão. Lua e período pesam mais porque são o que o
 * manejador observa e sobre o que decide; pressão pesa pouco porque varia
 * numa faixa estreita e quase nunca separa um dia do outro.
 */
const DIMENSOES: Array<{ chave: string; rotulo: string; peso: number; de: (a: Abate | Agora) => string }> = [
  { chave: 'lua', rotulo: 'Lua', peso: 3, de: (x) => String(x.luaFase || '') },
  { chave: 'periodo', rotulo: 'Período do dia', peso: 3,
    de: (x) => periodoDoDia(('dataHora' in x ? x.dataHora : undefined) || ('quando' in x ? x.quando : undefined)) },
  { chave: 'clima', rotulo: 'Clima', peso: 2, de: (x) => String(x.condicaoTempo || '') },
  { chave: 'temp', rotulo: 'Temperatura', peso: 2, de: (x) => faixaTemp(x.temp) },
  { chave: 'umidade', rotulo: 'Umidade', peso: 1, de: (x) => faixaUmidade(x.umidade) },
  { chave: 'vento', rotulo: 'Vento', peso: 1, de: (x) => faixaVento(x.vento) },
  { chave: 'chuva', rotulo: 'Chuva', peso: 1, de: (x) => faixaChuva(x.chuvaMm) },
  { chave: 'pressao', rotulo: 'Pressão', peso: 1, de: (x) => faixaPressao(x.pressao) }
]

/**
 * Confiança pelo tamanho da amostra. Não muda o índice — muda o que a tela
 * diz sobre ele. Dois abates dando 100 é ruído; vinte abates dando 100 é
 * padrão.
 */
function confiancaDe(base: number): 'baixa' | 'media' | 'alta' {
  if (base < 5) return 'baixa'
  if (base < 15) return 'media'
  return 'alta'
}

export function estatisticaDe(agora: Agora | null, abates: Abate[]): Estatistica {
  const base = abates.length
  const vazio: Estatistica = { indice: null, base, confianca: null, dimensoes: [], semHistorico: [] }
  if (!base || !agora) return vazio

  const ref: Agora = { ...agora, quando: agora.quando || new Date() }
  const dimensoes: Dimensao[] = []
  const semHistorico: string[] = []

  for (const d of DIMENSOES) {
    const valorAgora = d.de(ref)
    /* Sem saber a condição de agora, a dimensão não pode ser julgada. */
    if (!valorAgora) {
      dimensoes.push({ chave: d.chave, rotulo: d.rotulo, frequencia: null,
        casaram: 0, comDado: 0, agora: '—', peso: d.peso })
      semHistorico.push(d.rotulo)
      continue
    }
    const comDado = abates.filter((a) => !!d.de(a)).length
    if (!comDado) {
      dimensoes.push({ chave: d.chave, rotulo: d.rotulo, frequencia: null,
        casaram: 0, comDado: 0, agora: valorAgora, peso: d.peso })
      semHistorico.push(d.rotulo)
      continue
    }
    const casaram = abates.filter((a) => d.de(a) === valorAgora).length
    dimensoes.push({
      chave: d.chave, rotulo: d.rotulo,
      frequencia: casaram / comDado,
      casaram, comDado, agora: valorAgora, peso: d.peso
    })
  }

  /* Média ponderada só do que tem histórico. Ver o aviso do topo. */
  let soma = 0, peso = 0
  for (const d of dimensoes) {
    if (d.frequencia === null) continue
    soma += d.frequencia * d.peso
    peso += d.peso
  }
  if (!peso) return { ...vazio, dimensoes, semHistorico }

  return {
    indice: Math.round((soma / peso) * 100),
    base,
    confianca: confiancaDe(base),
    dimensoes,
    semHistorico
  }
}

/* ── resumo por dimensão, para os gráficos da aba Resumo ────────────────── */

export interface Barra { rotulo: string; valor: number }

/** Quantos abates por valor daquela dimensão, do mais frequente ao menos. */
export function contarPor(abates: Abate[], chave: string): Barra[] {
  if (chave === 'sexo') return contar(abates.map((a) => String(a.sexo || '')))
  if (chave === 'horario') {
    return contar(abates.map((a) => {
      const d = new Date(String(a.dataHora || ''))
      return isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0') + 'h'
    }))
  }
  const d = DIMENSOES.find((x) => x.chave === chave)
  if (!d) return []
  return contar(abates.map((a) => d.de(a)))
}

function contar(valores: string[]): Barra[] {
  const c: Record<string, number> = {}
  for (const v of valores) if (v) c[v] = (c[v] || 0) + 1
  return Object.keys(c)
    .map((k) => ({ rotulo: k, valor: c[k]! }))
    .sort((a, b) => b.valor - a.valor)
}

/** As abas da aba Resumo, na ordem em que aparecem. */
export const ABAS_RESUMO = [
  { chave: 'sexo', rotulo: 'Sexo' },
  { chave: 'periodo', rotulo: 'Período' },
  { chave: 'horario', rotulo: 'Horário' },
  { chave: 'clima', rotulo: 'Clima' },
  { chave: 'lua', rotulo: 'Lua' },
  { chave: 'temp', rotulo: 'Temperatura' },
  { chave: 'umidade', rotulo: 'Umidade' },
  { chave: 'vento', rotulo: 'Vento' },
  { chave: 'pressao', rotulo: 'Pressão' },
  { chave: 'chuva', rotulo: 'Chuva' }
]
