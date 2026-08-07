/**
 * Escreve a marca escolhida no `<html data-marca="...">`, para o CSS poder
 * variar a cor de acento sem que nenhuma tela saiba disso.
 */
import { useMarca } from '~/composables/useMarca'

export default defineNuxtPlugin(() => {
  const marca = useMarca()
  if (import.meta.client) {
    document.documentElement.dataset.marca = marca.chave
  }
  useHead({ titleTemplate: (t?: string) => (t ? t + ' · ' : '') + marca.nome })
})
