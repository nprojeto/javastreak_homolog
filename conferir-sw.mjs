/**
 * Confere o service worker do build contra o que existe no disco.
 *
 * ⚠️ Existe por causa de uma falha que não dá erro nenhum: **UMA entrada do
 * precache que não baixa aborta a instalação inteira do worker**. O app abre
 * normalmente, ninguém percebe, e o offline simplesmente não existe. Foi o
 * que aconteceu por meses.
 *
 * ⚠️ A BASE É DESCOBERTA NO PRÓPRIO BUILD, não recebida por variável de
 * ambiente. A primeira versão lia `NUXT_APP_BASE_URL`, e o passo do CI que a
 * chamava não tinha essa variável — o script reprovou um build correto duas
 * vezes seguidas, acusando escopo, manifesto e ícones todos errados. Receber
 * a verdade de fora é criar duas fontes que precisam concordar; ler do build
 * elimina a pergunta. O que se confere aqui é COERÊNCIA INTERNA: o worker, o
 * manifesto e os ícones têm que falar da mesma base que o HTML usou.
 *
 * Roda no CI depois do generate. **Derruba o build**, ao contrário do
 * `conferir:textos`: aqui não há meio-termo — ou o offline funciona ou não
 * existe.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = '.output/public'
const falhas = []

function parar(msg) {
  console.error('✘ ' + msg)
  process.exit(1)
}

if (!existsSync(join(DIR, 'index.html'))) parar('não achei ' + DIR + '/index.html — o build não saiu.')
if (!existsSync(join(DIR, 'sw.js'))) parar('sw.js não foi gerado — o PWA não está ativo no build.')

const html = readFileSync(join(DIR, 'index.html'), 'utf8')
const sw = readFileSync(join(DIR, 'sw.js'), 'utf8')

/* ---- 0. Qual base o build usou? ----
   Sai dos próprios caminhos dos arquivos do Nuxt no HTML: em subpasta eles
   vêm como "/javastreak_homolog/_nuxt/…", na raiz como "/_nuxt/…". */
const ref = html.match(/(?:src|href)="([^"]*?)_nuxt\//)
if (!ref) parar('não achei nenhuma referência a _nuxt/ no index.html para descobrir a base.')
const base = ref[1] || '/'
console.log(`· base do build: "${base}"`)

/** Caminho no disco para uma URL do precache, relativa ou absoluta. */
function noDisco(u) {
  let rel = u.startsWith(base) ? u.slice(base.length) : u
  rel = rel.replace(/^\//, '')
  /* Terminada em barra (ou vazia) é a casca: o servidor entrega o index. */
  return rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel
}

/* ---- 1. Toda entrada do precache tem arquivo? ---- */
const bloco = sw.match(/precacheAndRoute\(\[(.*?)\],/s)
if (!bloco) {
  falhas.push('não achei a lista de precache dentro do sw.js')
} else {
  const urls = [...bloco[1].matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
  if (!urls.length) falhas.push('a lista de precache está vazia')
  for (const u of urls) {
    const alvo = noDisco(u)
    if (!existsSync(join(DIR, alvo))) {
      falhas.push(`precache aponta para "${u}" e o arquivo "${alvo}" não existe`)
    }
  }
  console.log(`· ${urls.length} entradas no precache`)
}

/* ---- 2. O destino do navigateFallback está na base ---- */
const fb = sw.match(/createHandlerBoundToURL\("([^"]*)"\)/)
if (!fb) falhas.push('sem navigateFallback: rota funda não abre offline')
else if (fb[1] !== base) falhas.push(`navigateFallback é "${fb[1]}" e o build está em "${base}"`)

/* ---- 3. Escopo do registro dentro da pasta do worker ----
   Worker em /sub/sw.js não pode reivindicar "/": o navegador recusa com
   SecurityError, em silêncio, e o offline nunca existe. */
const escopos = new Set()
for (const nome of readdirSync(join(DIR, '_nuxt'))) {
  if (!nome.endsWith('.js')) continue
  const s = readFileSync(join(DIR, '_nuxt', nome), 'utf8')
  for (const m of s.matchAll(/scope:\s*[`'"](\/[^`'"]*)[`'"]/g)) escopos.add(m[1])
}
if (escopos.size && !escopos.has(base)) {
  falhas.push(
    `nenhum registro com escopo "${base}" (achei: ${[...escopos].join(', ')}). ` +
    'Escopo acima da pasta do worker é recusado com SecurityError.'
  )
}

/* ---- 4. Manifesto e ícones apontando para dentro da base ---- */
if (!existsSync(join(DIR, 'manifest.webmanifest'))) {
  falhas.push('manifest.webmanifest não foi gerado')
} else {
  const mf = JSON.parse(readFileSync(join(DIR, 'manifest.webmanifest'), 'utf8'))
  if (mf.start_url !== base) falhas.push(`manifest.start_url é "${mf.start_url}" e o build está em "${base}"`)
  if (mf.scope !== base) falhas.push(`manifest.scope é "${mf.scope}" e o build está em "${base}"`)
  for (const ic of mf.icons || []) {
    const alvo = noDisco(ic.src)
    if (!existsSync(join(DIR, alvo))) falhas.push(`ícone "${ic.src}" não existe no build`)
  }
}

if (falhas.length) {
  console.error('\n✘ Service worker inválido — o app subiria SEM offline:\n')
  for (const f of falhas) console.error('   - ' + f)
  console.error('')
  process.exit(1)
}

console.log(`✓ service worker íntegro, manifesto e ícones coerentes com a base "${base}"`)
