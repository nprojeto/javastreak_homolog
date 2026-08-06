/**
 * Extrai do index.html legado:
 *   - FRASES.en / FRASES.es  -> i18n/locales/en.json, es.json
 *   - o bloco <style>        -> app/assets/css/legado.css
 *
 * Uso:  node scripts/extrair-do-html.mjs ../caminho/para/index.html
 *
 * Roda em cima do fonte cru. Não usa regex para "entender" JavaScript: acha o
 * início do objeto e conta chaves, que é o único jeito que não mente quando há
 * chave com aspas dentro do texto.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const entrada = process.argv[2]
if (!entrada) {
  console.error('uso: node scripts/extrair-do-html.mjs <caminho do index.html>')
  process.exit(1)
}
const src = readFileSync(resolve(entrada), 'utf8')

/** Devolve o trecho { ... } que começa na posição do primeiro "{" após `de`. */
function bloco(texto, de) {
  const i = texto.indexOf('{', de)
  let d = 0
  for (let k = i; k < texto.length; k++) {
    if (texto[k] === '{') d++
    else if (texto[k] === '}') {
      d--
      if (d === 0) return texto.slice(i, k + 1)
    }
  }
  throw new Error('bloco não fechado a partir de ' + de)
}

/* ---------- FRASES ---------- */
const mF = /var FRASES\s*=\s*\{/.exec(src)
if (!mF) throw new Error('FRASES não encontrado')
const frases = bloco(src, mF.index)

// eslint-disable-next-line no-new-func
const objeto = new Function('return (' + frases + ')')()

let total = 0
for (const lang of ['en', 'es']) {
  const mapa = objeto[lang]
  if (!mapa) throw new Error('FRASES.' + lang + ' não encontrado')
  const chaves = Object.keys(mapa)
  const ordenado = {}
  for (const k of chaves.sort()) ordenado[k] = mapa[k]
  const destino = resolve('i18n/locales/' + lang + '.json')
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, JSON.stringify(ordenado, null, 2) + '\n')
  console.log(lang + '.json:', chaves.length, 'frases')
  total = total || chaves.length
  if (chaves.length !== total) console.warn('⚠️  assimetria entre idiomas')
}

// pt é a própria chave — o arquivo existe só para o app ter os três idiomas
// explícitos e para conferência de cobertura.
const en = JSON.parse(readFileSync('i18n/locales/en.json', 'utf8'))
const pt = {}
for (const k of Object.keys(en)) pt[k] = k
writeFileSync('i18n/locales/pt.json', JSON.stringify(pt, null, 2) + '\n')
console.log('pt.json:', Object.keys(pt).length, 'frases (chave = valor)')

/* ---------- CSS ---------- */
const estilos = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
if (!estilos.length) throw new Error('nenhum <style> encontrado')
const destinoCss = resolve('app/assets/css/legado.css')
mkdirSync(dirname(destinoCss), { recursive: true })
writeFileSync(
  destinoCss,
  '/* Extraído do index.html legado por scripts/extrair-do-html.mjs.\n' +
    '   Copiado como está, de propósito: reorganizar agora misturaria dois\n' +
    '   riscos numa entrega só. A faxina é assunto do lote 9. */\n\n' +
    estilos.join('\n\n')
)
console.log('legado.css:', estilos.join('\n').split('\n').length, 'linhas')
