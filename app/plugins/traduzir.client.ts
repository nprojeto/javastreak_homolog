/**
 * Tradutor de tela. Porte de `traduzirDOM` (index.html, 4989).
 *
 * ── Por que assim, e não `t()` em cada texto ──────────────────────────────
 * O dicionário do JavaStreak tem a FRASE EM PORTUGUÊS como chave — 1.481
 * delas. Envolver cada texto de cada template em `t()` seria mexer em todas
 * as telas e criar uma chance de esquecimento a cada frase nova.
 *
 * O legado resolvia varrendo a tela depois de desenhar. Aqui é o mesmo, com
 * um observador: quando o Vue redesenha, a varredura roda de novo.
 *
 * ⚠️ Só mexe em TEXTO VISÍVEL, e em `placeholder`/`title`. Nunca em valor
 * digitado, atributo de dado ou conteúdo de `<textarea>` — assim nome de
 * pessoa, descrição de produto e artigo passam intactos. Um elemento com a
 * classe `no-i18n` é pulado inteiro.
 *
 * ⚠️ Não entra em laço: a tradução não é ela própria uma chave em português,
 * então a segunda passada não acha nada e para.
 */
export default defineNuxtPlugin(() => {
  const { lang, t } = useTraducao()

  let agendado = false

  function traduzir(raiz: Node) {
    if (lang.value === 'pt') return
    const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    const alvos: Text[] = []
    let n: Node | null
    while ((n = it.nextNode())) {
      const pai = n.parentElement
      if (!pai) continue
      const tag = pai.nodeName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue
      if (pai.closest('.no-i18n')) continue
      alvos.push(n as Text)
    }
    for (const no of alvos) {
      const bruto = no.nodeValue || ''
      const txt = bruto.trim()
      if (!txt) continue
      const tr = t(txt)
      if (tr && tr !== txt) no.nodeValue = bruto.replace(txt, tr)
    }
    const q = (raiz as Element).querySelectorAll?.('[placeholder],[title]')
    q?.forEach((el) => {
      for (const attr of ['placeholder', 'title']) {
        const v = el.getAttribute(attr)
        if (!v) continue
        const tr = t(v.trim())
        if (tr && tr !== v.trim()) el.setAttribute(attr, tr)
      }
    })
  }

  function agendar() {
    if (agendado) return
    agendado = true
    requestAnimationFrame(() => {
      agendado = false
      traduzir(document.body)
    })
  }

  if (import.meta.client) {
    /* Uma varredura por quadro, no máximo — o Vue redesenha em rajadas. */
    new MutationObserver(agendar).observe(document.body, {
      childList: true, subtree: true, characterData: true
    })
    watch(lang, () => {
      /* Voltar para o português exige recarregar: o texto original já foi
         substituído no DOM e não temos como desfazer sem redesenhar tudo. */
      if (lang.value === 'pt') window.location.reload()
      else agendar()
    })
    agendar()
  }
})
