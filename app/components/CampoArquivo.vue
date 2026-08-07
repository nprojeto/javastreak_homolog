<script setup lang="ts">
/**
 * Anexo de documento. Porte de bindArquivo + do bloco "anexo atual".
 *
 * ⚠️ O caminho do arquivo no bucket NUNCA chega à tela — o backend só devolve
 * `temArquivo` e o nome. Abrir passa pelo `apiAbrirDocumento`, que confere a
 * permissão e emite uma URL assinada de 5 minutos. É por isso que o botão
 * Abrir chama o servidor em vez de montar um link.
 */
import { lerArquivo, DOC_MAX_MB } from '~/composables/useArquivo'
import { useUi } from '~/stores/ui'

const props = defineProps<{
  label?: string
  obrigatorio?: boolean
  /** id do documento que já tem anexo, para o botão Abrir */
  docId?: string
  temArquivo?: boolean
  arquivoNome?: string
}>()

const dados = defineModel<string>('dados', { default: '' })
const nome = defineModel<string>('nome', { default: '' })

const ui = useUi()
const { server } = useServer()
const abrindo = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function escolheu(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { dados.value = ''; nome.value = ''; return }
  try {
    const a = await lerArquivo(f)
    dados.value = a.dados
    nome.value = a.nome
  } catch (err) {
    dados.value = ''; nome.value = ''
    if (input.value) input.value.value = ''
    ui.avisar(err instanceof Error ? err.message : 'Arquivo inválido', 'erro')
  }
}

async function abrir() {
  if (!props.docId) return
  abrindo.value = true
  try {
    const r = await server<{ url?: string }>('apiAbrirDocumento', props.docId)
    if (r?.url) window.open(r.url, '_blank')
    else ui.avisar('Não foi possível abrir', 'erro')
  } catch { /* o useServer já avisou */ } finally {
    abrindo.value = false
  }
}
</script>

<template>
  <label>
    {{ props.label || 'Arquivo (PDF ou imagem)' }}{{ props.obrigatorio && !props.temArquivo ? ' *' : '' }}
  </label>
  <input ref="input" type="file" accept="application/pdf,image/*" @change="escolheu">

  <div v-if="props.temArquivo && !dados" class="anexo">
    <span><Icone nome="link" /></span>
    <span class="nome no-i18n" :title="props.arquivoNome">{{ props.arquivoNome || 'arquivo' }}</span>
    <button type="button" class="btn sm sec" :disabled="abrindo" @click="abrir">
      {{ abrindo ? '…' : 'Abrir' }}
    </button>
  </div>
  <div v-if="props.temArquivo" class="meta dica">Escolher outro arquivo substitui este.</div>
  <div v-else class="meta dica">
    O arquivo fica privado: só você vê, e seus parceiros apenas enquanto houver
    um ciclo aberto com você. Máximo {{ DOC_MAX_MB }} MB.
  </div>
</template>

<style scoped>
.anexo {
  display: flex; align-items: center; gap: 8px; margin: 6px 0;
  padding: 8px 10px; border: 1px solid var(--linha); border-radius: 10px; background: var(--carvao-3);
}
.anexo .nome { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anexo .btn { width: auto; margin: 0; flex: none; }
.dica { margin: -2px 0 10px; }
</style>
