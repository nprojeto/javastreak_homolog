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
  const { lang, t, versaoDic } = useTraducao()

  let agendado = false
  let observador: MutationObserver | null = null

  /* Nós já varridos não voltam: sem isto, cada quadro relia a página inteira
     e a troca de idioma ficava lenta em tela grande.
     ⚠️ A marca é ZERADA a cada troca de idioma e a cada dicionário que chega.
     Sem isso, a varredura que roda antes do dicionário carimbava tudo como
     visto e o texto nunca mais era traduzido. */
  let jaVisto = new WeakSet<Text>()

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
      if (jaVisto.has(n as Text)) continue
      alvos.push(n as Text)
    }
    for (const no of alvos) {
      const bruto = no.nodeValue || ''
      const txt = bruto.trim()
      if (!txt) continue
      const tr = t(txt)
      jaVisto.add(no)
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
      /* Desliga o observador durante a varredura: as próprias trocas de texto
         disparariam mutação, e a cada quadro a página seria relida de novo. */
      observador?.disconnect()
      traduzir(document.body)
      observador?.observe(document.body, {
        childList: true, subtree: true, characterData: true
      })
    })
  }

  if (import.meta.client) {
    /* Uma varredura por quadro, no máximo — o Vue redesenha em rajadas. */
    observador = new MutationObserver(agendar)
    observador.observe(document.body, {
      childList: true, subtree: true, characterData: true
    })
    /* ⚠️ NÃO recarregue a página daqui. A tela de perfil salva o idioma na
       conta logo depois de trocar; recarregar neste ponto matava a chamada
       pela metade, a conta continuava no idioma antigo e o `apiBoot` devolvia
       tudo para trás — parecia que o botão Português não funcionava.
       Quem recarrega é a tela, depois de o salvamento terminar. */
    watch([lang, versaoDic], () => {
      jaVisto = new WeakSet<Text>()
      agendar()
    })
    agendar()
  }
})
