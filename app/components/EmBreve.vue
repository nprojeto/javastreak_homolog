<script setup lang="ts">
/**
 * Tela ainda não portada. Existe para que o menu nunca leve a um 404 e para
 * que fique claro QUANDO cada parte chega — em vez de um item que
 * simplesmente não faz nada.
 */
defineProps<{ titulo: string; lote: string; descricao: string }>()
</script>

<template>
  <div class="card obra">
    <div class="big">🚧</div>
    <h2>{{ titulo }}</h2>
    <p>{{ descricao }}</p>
    <div class="meta">Chega no <b>{{ lote }}</b> da migração.</div>
    <NuxtLink to="/inicio" class="btn sec">Voltar ao início</NuxtLink>
  </div>
</template>

<style scoped>
.obra { text-align: center; padding: 26px 18px; }
.big { font-size: 40px; margin-bottom: 6px; }
h2 { margin: 0 0 6px; font-size: 19px; }
p { font-size: 14.5px; line-height: 1.6; margin: 0 0 10px; color: var(--txt); }
.btn { margin-top: 14px; text-decoration: none; }
</style>
