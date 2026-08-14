/**
 * Abrir um arquivo que só existe atrás de uma URL assinada.
 *
 * ⚠️ `window.open` DEPOIS de um `await` é bloqueado. O Safari do iOS (e o
 * bloqueador de pop-up de qualquer navegador) só permite abrir aba dentro do
 * gesto que a pediu — e a URL assinada só chega depois da ida ao servidor, já
 * fora dele. O resultado era o botão "Ver" não fazer nada, em silêncio.
 *
 * A saída é abrir a aba VAZIA no clique, que ainda está no gesto, e apontá-la
 * para o arquivo quando a URL chegar.
 */

/** Chame no primeiro instante do clique, antes de qualquer `await`. */
export function abrirAbaVazia(): Window | null {
  if (typeof window === 'undefined') return null
  try {
    const w = window.open('', '_blank')
    /* Uma palavra enquanto a URL não chega: aba em branco parece travada. */
    if (w) w.document.write('<p style="font:16px system-ui;padding:24px">Abrindo…</p>')
    return w
  } catch {
    return null
  }
}

/**
 * Aponta a aba para o arquivo. Sem aba — bloqueador agressivo —, tenta a
 * navegação direta, que é pior mas ainda mostra o documento.
 */
export function mostrar(aba: Window | null, url: string) {
  if (aba && !aba.closed) aba.location.href = url
  else window.open(url, '_blank')
}
