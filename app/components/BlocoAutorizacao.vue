<script setup lang="ts">
/**
 * Uma autorização da propriedade. Porte de blocoAutProp/coletaAut/autCompleta.
 *
 * ⚠️ Validade e anexo são OBRIGATÓRIOS — é o que comprova. O número só o
 * IBAMA usa. Na edição, o anexo já existente vale: dá para corrigir uma data
 * sem reenviar o arquivo.
 */
export interface Autorizacao {
  id?: string
  numero?: string
  vencimento?: string
  arquivoNome?: string
  temArquivo?: boolean
  vencido?: boolean
}

const props = defineProps<{ label: string; atual?: Autorizacao | null }>()

const numero = defineModel<string>('numero', { default: '' })
const validade = defineModel<string>('validade', { default: '' })
const arquivo = defineModel<string>('arquivo', { default: '' })
const arquivoNome = defineModel<string>('arquivoNome', { default: '' })
</script>

<template>
  <div class="bloco" :class="{ falta: props.atual?.vencido }">
    <h4>{{ props.label }} *</h4>

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
  </div>
</template>

<style scoped>
.bloco {
  border: 1px solid var(--linha); border-left: 4px solid var(--verde);
  border-radius: 12px; padding: 12px; margin: 12px 0; background: #fffdf8;
}
.bloco.falta { border-left-color: var(--danger); }
h4 { margin: 0 0 8px; font-size: 14px; }
</style>
