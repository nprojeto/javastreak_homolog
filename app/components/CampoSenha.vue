<script setup lang="ts">
/** Senha + confirmação, com o medidor ao vivo. Porte de avisoSenha/forcaSenha. */
import { SENHA_REGRA, faltasDaSenha } from '~/composables/useSenha'

const senha = defineModel<string>('senha', { default: '' })
const confirma = defineModel<string>('confirma', { default: '' })

const faltas = computed(() => (senha.value ? faltasDaSenha(senha.value) : []))
const naoConfere = computed(
  () => !!confirma.value && senha.value !== confirma.value
)
</script>

<template>
  <div class="two">
    <div>
      <label>Senha *</label>
      <input v-model="senha" type="password" autocomplete="new-password">
    </div>
    <div>
      <label>Confirmar *</label>
      <input v-model="confirma" type="password" autocomplete="new-password">
    </div>
  </div>

  <div class="meta regra">{{ SENHA_REGRA }}</div>
  <div v-if="faltas.length" class="meta ruim">Falta: {{ faltas.join(', ') }}</div>
  <div v-else-if="senha" class="meta bom">Senha aceita ✓</div>
  <div v-if="naoConfere" class="meta ruim">As senhas não conferem</div>
</template>

<style scoped>
.regra { margin: 8px 0 4px; line-height: 1.5; }
.ruim { color: var(--danger); margin: 2px 0 10px; }
.bom { color: var(--ok); margin: 2px 0 10px; }
</style>
