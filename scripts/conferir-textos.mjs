/**
 * Levanta TODO texto visível das telas e aponta o que não está no dicionário.
 *
 * ⚠️ Pega também os literais dentro de `{{ }}` e de atributos ligados — foi
 * exatamente o que faltou na primeira varredura, e por isso o texto dos botões
 * que mudam conforme o estado ("Ocultar da rede") ficou sem tradução.
 *
 * Roda no CI depois do conferir:frases. Não derruba o build: avisa.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const pt = JSON.parse(readFileSync('i18n/locales/pt.json', 'utf8'))

/** Coisas que não são frase de interface e nunca devem entrar no dicionário. */
const IGNORAR = [
  /^[\d.,:/()\s-]+$/,          // máscaras e números
  /^https?:/, /^@/, /^•+$/,
  /^[a-z][A-Za-z0-9_.]*$/,     // nomes de variável que escaparam
  /\?|\|\||=>|===/,            // pedaço de expressão, não texto
  /^(JavaStreak|CPF|CNPJ|CR|CAR|JS-XXXX-XXXX)$/, // siglas iguais nos 3 idiomas
  /^HOMOLOGAÇÃO$/              // faixa de ambiente: some no dia do corte
]

function vue(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) out.push(...vue(p))
    /* A tela de diagnóstico não é produto: fica fora da exigência. */
    else if (nome.endsWith('.vue') && nome !== 'verificacao.vue') out.push(p)
  }
  return out
}

const achadas = new Set()
for (const f of vue('app')) {
  const s = readFileSync(f, 'utf8')
  if (!s.includes('<template>')) continue
  const tpl = s.split('<template>')[1].split('</template>')[0]
  for (const m of tpl.matchAll(/>([^<>{}]+)</g)) {
    const t = m[1].replace(/\s+/g, ' ').trim()
    if (t.length > 1 && /[A-Za-zÀ-ÿ]/.test(t)) achadas.add(t)
  }
  /* ⚠️ `[^'\\\n]` — sem o \n a expressão casava de uma aspa numa linha até
     outra dez linhas abaixo, e devolvia um pedaço de HTML como se fosse
     frase. Foi um falso alarme que quase me fez "consertar" um arquivo são. */
  for (const m of tpl.matchAll(/'([^'\\\n]{2,120})'/g)) {
    const t = m[1].trim()
    if (/[A-Za-zÀ-ÿ]/.test(t) && t.includes(' ')) achadas.add(t)
  }
  for (const m of tpl.matchAll(/(?:placeholder|title)="([^"{}]+)"/g)) {
    const t = m[1].trim()
    if (t.length > 1) achadas.add(t)
  }
}

const falta = [...achadas]
  .filter((t) => !pt[t])
  .filter((t) => !IGNORAR.some((re) => re.test(t)))
  .sort()

if (!falta.length) {
  console.log(`✓ ${achadas.size} textos nas telas, todos no dicionário`)
} else {
  console.log(`⚠️  ${falta.length} texto(s) sem tradução:`)
  for (const t of falta) console.log('   - ' + t)
}
