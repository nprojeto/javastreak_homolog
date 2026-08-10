<script setup lang="ts">
/**
 * Uma autorização da propriedade. Porte de blocoAutProp/coletaAut/autCompleta.
 *
 * ⚠️ Validade e anexo são OBRIGATÓRIOS — é o que comprova. O número só o
 * IBAMA usa. Na edição, o anexo já existente vale: dá para corrigir uma data
 * sem reenviar o arquivo.
 *
 * ⚠️ DOBRÁVEL, mas nunca fechado quando falta algo. As duas autorizações são
 * obrigatórias para a propriedade salvar; esconder atrás de um toque a que
 * está vencida ou vazia faria a pessoa levar a recusa sem ver o campo. Então
 * a regra é: preenchida e válida nasce fechada; faltando algo, nasce aberta.
 */
export interface Autorizacao {
  id?: string
  numero?: string
  vencimento?: string
  arquivoNome?: string
  temArquivo?: boolean
  vencido?: boolean
}

import { statusVencimento } from '~/composables/useArquivo'
import { dataBR } from '~/composables/useMascaras'

const props = defineProps<{ label: string; atual?: Autorizacao | null }>()

const numero = defineModel<string>('numero', { default: '' })
const validade = defineModel<string>('validade', { default: '' })
const arquivo = defineModel<string>('arquivo', { default: '' })
const arquivoNome = defineModel<string>('arquivoNome', { default: '' })

const temAnexo = computed(() => !!arquivo.value || !!props.atual?.temArquivo)

/** Completa = validade e anexo, que é o que o servidor exige. */
const completa = computed(() => !!validade.value && temAnexo.value)
const falta = computed(() => !completa.value || !!props.atual?.vencido)

const resumo = computed(() => {
  const p: string[] = []
  p.push(numero.value ? 'nº ' + numero.value : 'sem número')
  p.push(validade.value ? 'vence ' + dataBR(validade.value) : 'sem validade')
  p.push(temAnexo.value ? 'com anexo' : 'sem anexo')
  return p.join(' · ')
})

const estado = computed(() => statusVencimento(validade.value))
</script>

<template>
  <CartaoDobra
    :titulo="props.label + ' *'"
    :resumo="resumo"
    :selo="estado?.texto"
    :selo-classe="estado?.classe"
    :alerta="falta"
    :aberto-inicial="falta"
    class="aut"
  >
    <label>Número</label>
    <input v-model="numero" class="no-i18n">

    <CampoData v-model="validade" label="Validade" obrigatorio />

    <CampoArquivo
      v-model:dados="arquivo"
      v-model:nome="arquivoNome"
      obrigatorio
      :doc-id="props.atual?.id"
      :tem-arquivo="props.atual?.temArquivo"
      :arquivo-nome="props.atual?.arquivoNome"
    />
  </CartaoDobra>
</template>

<style scoped>
/* Aninhado dentro de um card, a autorização usa a superfície elevada para não
   virar cartão dentro de cartão da mesma cor. */
.aut { background: var(--carvao-3); }
</style>
