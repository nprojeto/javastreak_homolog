/**
 * Compila cada .vue isoladamente e aponta o arquivo culpado.
 *
 * ⚠️ Existe porque o erro do build diz "26 erros" e NÃO diz em quais arquivos.
 * Procurar à mão em 51 telas é o caminho para consertar o arquivo errado —
 * já aconteceu. Aqui cada arquivo é compilado sozinho, então o nome vem junto.
 *
 * Também confere o que o compilador não vê: título de tela repetido, tela sem
 * título, e componente usado que não existe.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parse } from 'vue/compiler-sfc'

function vue(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...vue(p))
    else if (nome.endsWith('.vue')) out.push(p)
  }
  return out
}

const arquivos = vue('app')
let falhas = 0

for (const f of arquivos) {
  const src = readFileSync(f, 'utf8')
  const { errors } = parse(src, { filename: f })
  for (const e of errors) {
    falhas++
    const linha = e.loc?.start?.line ? ':' + e.loc.start.line : ''
    console.log(`✗ ${f}${linha} — ${e.message}`)
  }
}

/* Componentes usados que não existem. */
const definidos = new Set(
  vue('app/components').map((f) => basename(f, '.vue'))
)
const nativos = new Set(['NuxtLink', 'NuxtPage', 'ClientOnly', 'NuxtLayout'])
for (const f of arquivos) {
  const src = readFileSync(f, 'utf8')
  if (!src.includes('<template>')) continue
  const tpl = src.split('<template>')[1]
  for (const m of tpl.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
    if (!definidos.has(m[1]) && !nativos.has(m[1])) {
      falhas++
      console.log(`✗ ${f} — componente <${m[1]}> não existe`)
    }
  }
}

/* Tela do app sem título: quebra o padrão sem ninguém perceber. */
for (const f of vue('app/pages')) {
  const src = readFileSync(f, 'utf8')
  if (!src.includes("layout: 'app'")) continue
  if (!src.includes('TituloTela') && !src.includes('CartaoModulo')) {
    console.log(`⚠️  ${f} — tela do app sem TituloTela`)
  }
}

console.log(falhas ? `\n${falhas} falha(s)` : `✓ ${arquivos.length} telas compilam, sem componente órfão`)
if (falhas) process.exit(1)
