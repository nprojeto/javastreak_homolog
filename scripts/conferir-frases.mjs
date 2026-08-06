/**
 * Confere os três dicionários. Roda no CI antes de publicar.
 *
 * Regra do dossiê: toda frase visível nova entra nos três idiomas NA MESMA
 * ENTREGA. Aqui isso deixa de ser disciplina e vira erro de build.
 */
import { readFileSync } from 'node:fs'

const ler = (l) => JSON.parse(readFileSync(`i18n/locales/${l}.json`, 'utf8'))
const pt = ler('pt')
const en = ler('en')
const es = ler('es')

const problemas = []

const kPt = Object.keys(pt)
const kEn = Object.keys(en)
const kEs = Object.keys(es)

for (const [nome, chaves] of [['en', kEn], ['es', kEs]]) {
  const faltando = kPt.filter((k) => !chaves.includes(k))
  const sobrando = chaves.filter((k) => !kPt.includes(k))
  if (faltando.length) problemas.push(`${nome}: ${faltando.length} frase(s) sem tradução → ${faltando.slice(0, 5).join(' | ')}`)
  if (sobrando.length) problemas.push(`${nome}: ${sobrando.length} chave(s) órfã(s) → ${sobrando.slice(0, 5).join(' | ')}`)
}

for (const [nome, mapa] of [['en', en], ['es', es]]) {
  const vazias = Object.keys(mapa).filter((k) => !String(mapa[k]).trim())
  if (vazias.length) problemas.push(`${nome}: ${vazias.length} tradução(ões) vazia(s)`)
}

// pt é identidade: chave e valor têm que ser a mesma coisa.
const quebradas = kPt.filter((k) => pt[k] !== k)
if (quebradas.length) problemas.push(`pt: ${quebradas.length} chave(s) com valor diferente da chave`)

if (problemas.length) {
  console.error('✗ dicionários fora de sincronia:\n' + problemas.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}

console.log(`✓ ${kPt.length} frases, pt/en/es simétricos, sem vazias`)
