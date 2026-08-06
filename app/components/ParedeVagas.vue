<script setup lang="ts">
/**
 * Teto de contas atingido. Porte de paredeVagas.
 *
 * Aparece ANTES do formulário, de propósito: deixar a pessoa preencher tudo
 * para levar `VAGAS_ESGOTADAS` no fim seria cruel.
 */
defineProps<{ tipo: 'manejador' | 'empresa' }>()
</script>

<template>
  <AbasTipoConta :atual="tipo" />
  <div class="card parede">
    <div class="emoji">🤝</div>
    <h3>Cadastro temporariamente fechado</h3>
    <p>
      Estamos trabalhando para aumentar nossa comunidade e muito em breve iremos
      liberar para novos membros.
    </p>
    <NuxtLink to="/" class="btn sec">Voltar</NuxtLink>
  </div>
</template>

<style scoped>
.parede { border-top: 4px solid var(--alerta); text-align: center; }
.emoji { font-size: 44px; margin: 6px 0; }
h3 { margin: 0 0 6px; }
p { font-size: 14.5px; line-height: 1.6; margin: 0 0 12px; }
.btn { text-decoration: none; }
</style>
