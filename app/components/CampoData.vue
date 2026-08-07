<script setup lang="ts">
/**
 * Data com digitação em dd/mm/aaaa e calendário nativo ao lado.
 * Porte de campoData (index.html, linha 5211).
 *
 * ⚠️ Regra herdada do dossiê: clicar no corpo do `<input type="date">` NÃO
 * abre o seletor — quem abre é `showPicker()`, a partir de um gesto. Por isso
 * o campo nativo fica escondido e o botão é quem o chama.
 */
import { dataBR, dataIso, soDig } from '~/composables/useMascaras'

const props = defineProps<{ label: string; obrigatorio?: boolean }>()
/** Valor sempre em ISO (aaaa-mm-dd), que é o que o backend espera. */
const modelo = defineModel<string>({ default: '' })

const texto = ref(dataBR(modelo.value))
const nativo = ref<HTMLInputElement | null>(null)

function digitou() {
  const d = soDig(texto.value).slice(0, 8)
  let out = d
  if (d.length > 4) out = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
  else if (d.length > 2) out = `${d.slice(0, 2)}/${d.slice(2)}`
  texto.value = out
  modelo.value = dataIso(out)
}

function abrirCalendario() {
  const el = nativo.value
  if (!el) return
  el.value = modelo.value || ''
  try {
    el.showPicker()
  } catch {
    el.focus()
    el.click()
  }
}

function escolheu(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (!v) return
  modelo.value = v
  texto.value = dataBR(v)
}
</script>

<template>
  <label>{{ props.label }}{{ props.obrigatorio ? ' *' : '' }}</label>
  <div class="data-wrap">
    <input
      v-model="texto"
      class="data-txt"
      inputmode="numeric"
      maxlength="10"
      placeholder="dd/mm/aaaa"
      @input="digitou"
    >
    <button type="button" class="data-btn" title="Escolher no calendário" @click="abrirCalendario">
      <Icone nome="calendario" />
    </button>
    <input ref="nativo" type="date" class="data-nativo" @change="escolheu">
  </div>
</template>

<style scoped>
.data-wrap { position: relative; display: flex; gap: 6px; align-items: stretch; }
.data-txt { flex: 1; }
.data-btn {
  flex: none; width: 46px; border: 1px solid var(--linha); background: var(--card);
  border-radius: 12px; cursor: pointer; font-size: 18px;
}
.data-nativo { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; }
</style>
