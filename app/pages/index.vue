<script setup lang="ts">
/**
 * Tela de boas-vindas. Porte de VIEWS.bemvindo (index.html, linha 5488).
 *
 * O seletor manejador/empresa muda só o texto e o destino do "criar conta" —
 * o login em si é o mesmo para os dois, como no legado.
 */
import { useAuth } from '~/stores/auth'

const { tk } = useTraducao()
const auth = useAuth()

const tipo = ref<'manejador' | 'empresa'>('manejador')

/* Chegar aqui é sair: o legado limpava STATE.manejador nesta tela. */
onMounted(() => {
  auth.manejador = null
  auth.empresa = null
})
</script>

<template>
  <TelaEntrada versao>
    <div class="segbar">
      <button :class="{ on: tipo === 'manejador' }" @click="tipo = 'manejador'">
        {{ tk('manejador') }}
      </button>
      <button :class="{ on: tipo === 'empresa' }" @click="tipo = 'empresa'">
        {{ tk('empresa') }}
      </button>
    </div>

    <div class="card">
      <h3>{{ tipo === 'empresa' ? tk('bv_para_emp') : tk('bv_para_manej') }}</h3>
      <p class="texto">
        {{ tipo === 'empresa' ? tk('bv_texto_emp') : tk('bv_texto_manej') }}
      </p>
    </div>

    <NuxtLink to="/login" class="btn">{{ tk('entrar') }}</NuxtLink>

    <NuxtLink
      :to="{ path: '/maioridade', query: { tipo } }"
      class="btn sec"
    >{{ tk('criarConta') }}</NuxtLink>
  </TelaEntrada>
</template>

<style scoped>
.segbar { margin-bottom: 14px; }
.card h3 { margin: 0 0 8px; }
.texto { font-size: 14.5px; line-height: 1.65; color: var(--txt); margin: 0; }
.btn { margin-top: 10px; text-decoration: none; }
</style>
