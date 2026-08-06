<script setup lang="ts">
/** Um ícone do sprite. Porte de `ico(nome, px)`. */
import { simboloDe } from '~/composables/useIcones'

const props = withDefaults(defineProps<{ nome: string; px?: number }>(), { px: 20 })
const href = computed(() => '#' + simboloDe(props.nome))
</script>

<template>
  <svg
    class="ic-svg"
    :style="{ width: props.px + 'px', height: props.px + 'px' }"
    aria-hidden="true"
  ><use :href="href" /></svg>
</template>
