/**
 * Confere o precache do service worker contra o que existe no disco.
 *
 * ⚠️ Existe por causa de uma falha que não dá erro nenhum: **UMA entrada do
 * precache que não baixa aborta a instalação inteira do worker**. O app abre
 * normalmente, ninguém percebe, e o offline simplesmente não existe. Foi o
 * que aconteceu por meses — o workflow movia a casca depois do worker ser
 * gerado, e o precache ficava apontando para um caminho morto.
 *
 * Confere também escopo e manifesto, que são a outra metade do mesmo problema:
 * worker registrado com escopo acima da própria pasta é recusado pelo
 * navegador com `SecurityError`, também em silêncio.
 *
 * Roda no CI depois do generate. **Derruba o build**, ao contrário do
 * `conferir:textos`: aqui não há degradação suave — ou o offline funciona ou
 * não existe.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = '.output/public'
const base = process.env.NUXT_APP_BASE_URL || '/'
const falhas = []

if (!existsSync(join(DIR, 'sw.js'))) {
  console.error('✘ sw.js não foi gerado — o PWA não está ativo no build.')
  process.exit(1)
}

const sw = readFileSync(join(DIR, 'sw.js'), 'utf8')

/* ---- 1. Toda entrada do precache tem arquivo? ---- */
const bloco = sw.match(/precacheAndRoute\(\[(.*?)\],/s)
if (!bloco) {
  falhas.push('não achei a lista de precache dentro do sw.js')
} else {
  const urls = [...bloco[1].matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
  if (!urls.length) falhas.push('a lista de precache está vazia')

  for (const u of urls) {
    /* A entrada é relativa ao escopo do worker, ou absoluta já com a base. */
    let rel = u.startsWith(base) ? u.slice(base.length) : u
    rel = rel.replace(/^\//, '')
    /* Entrada terminada em barra (ou vazia) é a casca: vira index.html. */
    const alvo = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel
    if (!existsSync(join(DIR, alvo))) {
      falhas.push(`precache aponta para "${u}" e o arquivo "${alvo}" não existe`)
    }
  }
  console.log(`· ${urls.length} entradas no precache`)
}

/* ---- 2. O destino do navigateFallback está no precache? ---- */
const fb = sw.match(/createHandlerBoundToURL\("([^"]*)"\)/)
if (!fb) falhas.push('sem navigateFallback: rota funda não abre offline')
else if (fb[1] !== base) falhas.push(`navigateFallback é "${fb[1]}" e a base é "${base}"`)

/* ---- 3. Escopo do registro dentro da pasta do worker ---- */
const escopos = new Set()
for (const f of readFileSync(join(DIR, 'index.html'), 'utf8').matchAll(/scope:\s*[`'"]([^`'"]*)[`'"]/g)) {
  escopos.add(f[1])
}
/* O registro mora no bundle, não no HTML: varre os chunks. */
import { readdirSync } from 'node:fs'
for (const nome of readdirSync(join(DIR, '_nuxt'))) {
  if (!nome.endsWith('.js')) continue
  const s = readFileSync(join(DIR, '_nuxt', nome), 'utf8')
  for (const f of s.matchAll(/scope:\s*[`'"]([^`'"]*)[`'"]/g)) escopos.add(f[1])
}
const escoposReais = [...escopos].filter((e) => e.startsWith('/'))
if (escoposReais.length && !escoposReais.includes(base)) {
  falhas.push(
    `nenhum registro com escopo "${base}" (achei: ${escoposReais.join(', ')}). ` +
    'Escopo acima da pasta do worker é recusado com SecurityError.'
  )
}

/* ---- 4. Manifesto apontando para dentro da base ---- */
const mf = JSON.parse(readFileSync(join(DIR, 'manifest.webmanifest'), 'utf8'))
if (mf.start_url !== base) falhas.push(`manifest.start_url é "${mf.start_url}" e deveria ser "${base}"`)
if (mf.scope !== base) falhas.push(`manifest.scope é "${mf.scope}" e deveria ser "${base}"`)
for (const ic of mf.icons || []) {
  const rel = ic.src.startsWith(base) ? ic.src.slice(base.length) : ic.src.replace(/^\//, '')
  if (!existsSync(join(DIR, rel))) falhas.push(`ícone "${ic.src}" não existe no build`)
}

if (falhas.length) {
  console.error('\n✘ Service worker inválido — o app subiria SEM offline:\n')
  for (const f of falhas) console.error('   - ' + f)
  console.error('')
  process.exit(1)
}

console.log(`✓ service worker íntegro (base "${base}"), manifesto e ícones conferidos`)
