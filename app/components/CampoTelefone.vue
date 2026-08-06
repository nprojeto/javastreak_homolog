<script setup lang="ts">
/** Telefone com código de país e máscara. Porte de campoTel/mTel/telCompleto. */
import { PAISES, aplicaMask, soDig, telCompleto } from '~/composables/useMascaras'

const props = defineProps<{ label: string; obrigatorio?: boolean }>()
const modelo = defineModel<string>({ default: '' })

const pais = ref('55')
const bruto = ref('')

const mask = computed(() => PAISES.find((p) => p.c === pais.value)?.mask || '')

watch([bruto, pais], () => {
  bruto.value = aplicaMask(bruto.value, mask.value)
  modelo.value = telCompleto(pais.value, bruto.value)
})

/* Trocar de país zera o número: a máscara antiga não vale para o novo. */
watch(pais, () => { bruto.value = '' })

defineExpose({ digitos: computed(() => soDig(bruto.value)) })
</script>

<template>
  <label>{{ props.label }}{{ props.obrigatorio ? ' *' : '' }}</label>
  <div class="tel-linha">
    <select v-model="pais">
      <option v-for="p in PAISES" :key="p.c" :value="p.c">
        {{ p.flag }} +{{ p.c === '0' ? '' : p.c }}
      </option>
    </select>
    <input v-model="bruto" inputmode="tel" :placeholder="mask || 'número'">
  </div>
</template>

<style scoped>
.tel-linha { display: flex; gap: 6px; }
.tel-linha select { width: 108px; flex: none; }
.tel-linha input { flex: 1; }
</style>
