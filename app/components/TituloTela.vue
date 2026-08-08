<script setup lang="ts">
/**
 * Título da tela. Porte do `setCrumb` do legado.
 *
 * ⚠️ NÃO é um cartão. Treze telas tinham cada uma o seu cabeçalho num cartão
 * com barra colorida, e os portais não tinham nenhum — o app parecia mudar de
 * dono a cada clique. Aqui é só um rótulo, sempre no mesmo lugar, com a mesma
 * cor e o mesmo peso.
 */
defineProps<{ titulo: string; descricao?: string }>()
</script>

<template>
  <div class="tt">
    <h2>{{ titulo }}</h2>
    <p v-if="descricao">{{ descricao }}</p>
  </div>
</template>

<style scoped>
.tt { margin: 2px 2px 12px; }
.tt h2 {
  margin: 0; font-size: 13px; letter-spacing: .09em;
  text-transform: uppercase; color: var(--laranja-cl);
}
.tt p { margin: 5px 0 0; font-size: 13px; line-height: 1.5; color: var(--osso-2); }
</style>
