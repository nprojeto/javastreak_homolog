<script setup lang="ts">
/**
 * Botão de criar que nasce travado, com o motivo. Porte de botaoCriar.
 *
 * ⚠️ Regra de negócio, não enfeite: sem CTF, sem ficha ou no limite do plano,
 * a pessoa descobre ANTES de preencher o formulário inteiro. A ordem dos
 * motivos é a do legado — CTF primeiro, depois a ficha, depois o plano.
 */
import { useCreditos } from '~/stores/creditos'
import { bloqueioCriar } from '~/composables/useSessaoApp'

const props = defineProps<{
  rotulo: string
  /** chave do limite no plano: 'cevas', 'rotas', 'documentos'… */
  chave: string
  quantidade?: number
  para: string
}>()

const cred = useCreditos()
const bloqueio = computed(() =>
  bloqueioCriar(cred.dados, props.chave, props.quantidade || 0)
)
</script>

<template>
  <div v-if="bloqueio" class="card travado">
    <div class="meta">🔒 {{ bloqueio.motivo }}</div>
    <NuxtLink :to="bloqueio.rota" class="btn sec">{{ bloqueio.rotuloAcao }}</NuxtLink>
  </div>
  <NuxtLink v-else :to="props.para" class="btn">{{ props.rotulo }}</NuxtLink>
</template>

<style scoped>
.travado { border-left: 5px solid var(--alerta); }
.btn { text-decoration: none; }
.travado .btn { margin-top: 8px; }
</style>
