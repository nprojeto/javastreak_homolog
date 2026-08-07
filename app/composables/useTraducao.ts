/**
 * ── TRADUÇÃO ──────────────────────────────────────────────────────────────
 *
 * Mesma regra do `trFrase()` legado: **a frase em português É a chave**.
 * `t('Registrar abate')` devolve a própria frase em pt, e a tradução em
 * en/es. Chave sem tradução cai no português — nunca some da tela.
 *
 * Não uso @nuxtjs/i18n aqui de propósito. Aquele módulo existe para prefixo de
 * idioma na URL e conteúdo por locale, que não é o caso: são 1.481 frases
 * curtas num app atrás de login. Um composable de ~60 linhas faz o mesmo,
 * preserva o comportamento atual exatamente e não adiciona dependência.
 *
 * O dicionário entra por `import()` sob demanda. Como pt é identidade (a chave
 * já é a frase), **o usuário brasileiro não baixa dicionário nenhum** — eram
 * 247 KB de bundle quando os três vinham juntos.
 *
 * ✅ O apóstrofo deixou de ser risco. No index.html, `property's` fechava a
 * string JavaScript e derrubava o arquivo inteiro (família 6 do dossiê). Em
 * JSON é texto comum — hoje há 31 traduções assim em en.json, todas inertes.
 */
import uiPt from '~~/i18n/locales/ui-pt.json'
import uiEn from '~~/i18n/locales/ui-en.json'
import uiEs from '~~/i18n/locales/ui-es.json'

export const IDIOMAS = { pt: 'Português', en: 'English', es: 'Español' } as const
export const BANDEIRA = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' } as const

export type Idioma = keyof typeof IDIOMAS

const CHAVE_LANG = 'lang' // mesma chave do legado

function idiomaDoAparelho(): Idioma {
  try {
    const navs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || 'pt']
    for (const n of navs) {
      const c = String(n || '').slice(0, 2).toLowerCase()
      if (c === 'pt' || c === 'en' || c === 'es') return c
    }
  } catch {
    /* ambiente sem navigator */
  }
  return 'pt'
}

/**
 * Segundo dicionário do legado (`I18N`, chamado por `t()`/`t18n()`): 30 chaves
 * curtas como `entrar` e `bv_texto_manej`, cada uma com pt/en/es. Passou
 * despercebido no lote 0 e teria feito as telas de entrada mostrarem a chave
 * crua na tela. São 2 KB por idioma, então vêm todos juntos — não vale um
 * carregamento sob demanda.
 */
const UI: Record<Idioma, Record<string, string>> = { pt: uiPt, en: uiEn, es: uiEs }

/* Estado global: o idioma é um só para o app inteiro. */
const lang = ref<Idioma>('pt')
const dicionario = ref<Record<string, string>>({})
/**
 * Sobe a cada vez que um dicionário termina de carregar. É o sinal de que a
 * tela pode ser varrida — sem ele, quem varre chega antes do dicionário,
 * não acha nada e conclui que não há o que traduzir.
 */
const versaoDic = ref(0)
const carregados = new Map<Idioma, Record<string, string>>()
let iniciado = false

async function carregar(l: Idioma) {
  if (l === 'pt') {
    dicionario.value = {}
    versaoDic.value++
    return
  }
  const emCache = carregados.get(l)
  if (emCache) {
    dicionario.value = emCache
    versaoDic.value++
    return
  }
  const mod =
    l === 'en'
      ? await import('~~/i18n/locales/en.json')
      : await import('~~/i18n/locales/es.json')
  const mapa = (mod.default || mod) as Record<string, string>
  carregados.set(l, mapa)
  // Só aplica se o usuário não trocou de idioma no meio do caminho.
  if (lang.value === l) {
    dicionario.value = mapa
    versaoDic.value++
  }
}

export function useTraducao() {
  if (!iniciado && import.meta.client) {
    iniciado = true
    let salvo: string | null = null
    try {
      salvo = localStorage.getItem(CHAVE_LANG)
    } catch {
      /* modo privado */
    }
    lang.value =
      salvo && salvo in IDIOMAS ? (salvo as Idioma) : idiomaDoAparelho()
    aplicarNoHtml()
    void carregar(lang.value)
  }

  function aplicarNoHtml() {
    if (!import.meta.client) return
    document.documentElement.lang = lang.value === 'pt' ? 'pt-BR' : lang.value
  }

  /**
   * Traduz. Chave ausente devolve a própria frase, como no legado — e é isso
   * que faz a carga sob demanda ser segura: enquanto o dicionário não chegou,
   * a tela mostra português em vez de mostrar nada. Quando chega, o Vue
   * redesenha sozinho (`dicionario` é reativo).
   */
  function t(frase: string | null | undefined): string {
    if (frase == null) return ''
    if (lang.value === 'pt') return frase
    return dicionario.value[String(frase).trim()] ?? frase
  }

  /**
   * Traduz por CHAVE CURTA (o `t()` do legado). Chave desconhecida devolve a
   * própria chave, de propósito: é assim que um buraco aparece na tela em vez
   * de virar texto vazio.
   */
  function tk(chave: string): string {
    return UI[lang.value]?.[chave] ?? UI.pt[chave] ?? chave
  }

  async function setLang(l: Idioma) {
    if (!(l in IDIOMAS)) return
    lang.value = l
    try {
      localStorage.setItem(CHAVE_LANG, l)
    } catch {
      /* modo privado */
    }
    aplicarNoHtml()
    await carregar(l)
  }

  return {
    t, tk, setLang, IDIOMAS, BANDEIRA,
    lang: readonly(lang),
    versaoDic: readonly(versaoDic)
  }
}
