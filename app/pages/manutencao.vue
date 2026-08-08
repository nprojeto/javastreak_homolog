<script setup lang="ts">
/**
 * Manutenção — o portal. Porte de VIEWS.manutencaoHub (index.html, 8342).
 *
 * ⚠️ DUAS casas, não três. O haras saiu daqui e vive em Saúde animal. O
 * critério não é onde a máquina ou o bicho fica — é O QUE SE REGISTRA:
 * manutenção é o que quebra, desgasta e precisa de revisão; cavalo tem vacina
 * e casqueamento, que é a natureza do cão.
 *
 * A forma é a mesma de Saúde animal, de propósito: dois portais irmãos não
 * podem parecer telas de apps diferentes.
 */
import { CASAS, casaDe } from '~/composables/useTransportes'
import type { Transporte } from '~/composables/useTransportes'

definePageMeta({ layout: 'app' })

const { server } = useServer()
const lista = ref<Transporte[]>([])
const carregando = ref(true)

function conta(c: string) {
  return lista.value.filter((t) => casaDe(t.tipo) === c).length
}

onMounted(async () => {
  lista.value = await server<Transporte[]>('apiListarTransportes').catch(() => [])
  carregando.value = false
})
</script>

<template>
  <div>
    <CartaoModulo
      v-for="c in CASAS"
      :key="c.k"
      :icone="c.ic"
      :titulo="c.rot"
      :descricao="c.desc"
      :para="c.rota"
      :selo="carregando ? undefined : conta(c.k) + ' item(ns)'"
      selo-tipo="ok"
    />
  </div>
</template>
