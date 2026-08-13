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
  /** Rota de destino. Sem ela, o botão emite `criar` — para telas em que o
      formulário abre na própria página. */
  para?: string
  /**
   * O que o limite conta, quando isso não é óbvio na tela.
   *
   * ⚠️ Nasceu de uma confusão real: a garagem mostrava 3 veículos e dizia
   * "você chegou ao limite: 10". O limite de transportes é COMPARTILHADO entre
   * garagem, marina e haras — a conta estava certa, a tela é que não contava a
   * história inteira.
   */
  oQueConta?: string
}>()

const emit = defineEmits<{ criar: [] }>()

const cred = useCreditos()
const bloqueio = computed(() =>
  bloqueioCriar(cred.dados, props.chave, props.quantidade || 0)
)
</script>

<template>
  <div v-if="bloqueio" class="card travado">
    <div class="meta">
      <Icone nome="bloqueio" /> {{ bloqueio.motivo }}
      <template v-if="props.oQueConta"> ({{ props.oQueConta }})</template>
    </div>
    <NuxtLink :to="bloqueio.rota" class="btn sec">{{ bloqueio.rotuloAcao }}</NuxtLink>
  </div>
  <NuxtLink v-else-if="props.para" :to="props.para" class="btn">{{ props.rotulo }}</NuxtLink>
  <button v-else class="btn" @click="emit('criar')">{{ props.rotulo }}</button>
</template>

<style scoped>
.travado { border-left: 5px solid var(--alerta); }
.btn { text-decoration: none; }
.travado .btn { margin-top: 8px; }
</style>
