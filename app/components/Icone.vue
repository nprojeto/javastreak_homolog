<script setup lang="ts">
/** Um ícone do sprite. Porte de `ico(nome, px)`. */
import { simboloDe } from '~/composables/useIcones'

/**
 * `px` é opcional de propósito. Sem ele, o tamanho vem do CSS conforme o
 * lugar — o legado já traz as regras: `.btn .ic-svg`, `.ib .ic-svg`,
 * `h3 .ic-svg`, `.menu-card .ic .ic-svg`, `.empty .big .ic-svg`,
 * `.sb-ico .ic-svg`. Forçar tamanho inline atropelava tudo isso.
 */
const props = defineProps<{ nome: string; px?: number }>()
const href = computed(() => '#' + simboloDe(props.nome))
const estilo = computed(() =>
  props.px ? { width: props.px + 'px', height: props.px + 'px' } : undefined
)
</script>

<template>
  <svg
    class="ic-svg"
    :style="estilo"
    aria-hidden="true"
  ><use :href="href" /></svg>
</template>
