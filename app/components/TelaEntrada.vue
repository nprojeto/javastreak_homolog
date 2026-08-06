<script setup lang="ts">
/**
 * Casca das telas de entrada (bem-vindo, login, cadastro, recuperação).
 * No legado esse cabeçalho era colado à mão em cada `app('<div ...>')`, com o
 * logo repetido como 21 KB de base64 dentro do HTML. Aqui é um componente e o
 * logo é um arquivo — o navegador baixa uma vez e reaproveita.
 */
defineProps<{
  /** Mostra o carimbo de versão no rodapé (só bem-vindo e login mostravam). */
  versao?: boolean
}>()

const cfg = useRuntimeConfig()
const homolog = cfg.public.ambiente === 'homologacao'
</script>

<template>
  <div class="wrap">
    <p v-if="homolog" class="ambiente">HOMOLOGAÇÃO</p>

    <div class="logo">
      <img src="/logo.png" alt="JavaStreak">
    </div>

    <slot />

    <div v-if="versao" class="ver">{{ cfg.public.appVer }}</div>
  </div>
</template>

<style scoped>
.wrap { max-width: 560px; margin: 0 auto; padding: 10px 14px 28px; }
.logo { text-align: center; margin: 10px 0 4px; }
.logo img { width: 100%; max-width: 290px; }
.ver { text-align: center; margin-top: 12px; font-size: 11px; color: #cfc9bd; }
.ambiente {
  display: block;
  text-align: center;
  background: var(--laranja);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 4px 10px;
  border-radius: 999px;
  margin: 4px auto 0;
  max-width: 180px;
}
</style>
