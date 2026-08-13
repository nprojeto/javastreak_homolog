<script setup lang="ts">
/**
 * Data com digitação em dd/mm/aaaa e calendário nativo ao lado.
 * Porte de campoData (index.html, linha 5211).
 *
 * ⚠️ Regra herdada do dossiê: no COMPUTADOR, clicar no corpo do
 * `<input type="date">` não abre o seletor — quem abre é `showPicker()`.
 *
 * ⚠️ Mas no CELULAR era o contrário, e por isso o botão não funcionava: o
 * campo nativo estava escondido com `pointer-events: none` e 1×1 px, então o
 * recuo (`focus()` + `click()`) não alcançava nada, e `showPicker()` não
 * existe em Safari antigo. Resultado: tocar no calendário não fazia nada.
 *
 * A saída é o campo nativo TRANSPARENTE POR CIMA do botão, do tamanho dele.
 * Tocar no botão é tocar no campo — e tocar num campo de data abre o seletor
 * sozinho no iOS e no Android. No computador, o clique ainda chama
 * `showPicker()`, que é o que funciona lá. Um só desenho serve aos dois.
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

/**
 * Chamada pelo clique NO PRÓPRIO campo nativo (que está por cima do botão).
 * No celular o toque já abre o seletor sozinho; `showPicker()` é o que
 * acrescenta o comportamento no computador. Se não existir, não faz nada — e
 * não precisa, porque aí quem abre é o toque.
 */
function abrirCalendario() {
  const el = nativo.value
  if (!el) return
  el.value = modelo.value || ''
  try {
    const p = (el as HTMLInputElement & { showPicker?: () => void }).showPicker
    if (typeof p === 'function') p.call(el)
  } catch { /* já aberto, ou sem gesto do usuário: o toque resolve */ }
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
    <span class="data-btn-wrap">
      <span class="data-btn" aria-hidden="true"><Icone nome="calendario" /></span>
      <!-- ⚠️ O campo nativo fica POR CIMA do botão, invisível mas tocável.
           É ele que recebe o toque; o botão é só o desenho. -->
      <input
        ref="nativo"
        type="date"
        class="data-nativo"
        aria-label="Escolher no calendário"
        @click="abrirCalendario"
        @change="escolheu"
      >
    </span>
  </div>
</template>

<style scoped>
.data-wrap { position: relative; display: flex; gap: 6px; align-items: stretch; }
.data-txt { flex: 1; }
.data-btn-wrap { position: relative; flex: none; width: 46px; }
.data-btn {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; border: 1px solid var(--linha); background: var(--card);
  border-radius: 12px; font-size: 18px; color: var(--laranja-cl);
}
/* Invisível, mas TOCÁVEL e cobrindo o botão INTEIRO — é o alvo real do dedo.
   `opacity: 0` em vez de `display: none`: escondido de verdade, o campo não
   recebe evento nenhum. O `inset: -2px` cobre também a borda do botão, senão
   sobra uma moldura fina onde o toque não faz nada. */
.data-nativo {
  position: absolute; inset: -2px; width: auto; height: auto;
  opacity: 0; cursor: pointer; border: 0; padding: 0; margin: 0;
  /* Safari no iOS ignora largura em input[type=date] sem isto. */
  -webkit-appearance: none; appearance: none;
}
</style>
