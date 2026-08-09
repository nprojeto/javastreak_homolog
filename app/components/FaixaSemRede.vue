<script setup lang="ts">
/**
 * Faixa de "sem rede". Aparece quando o app está servindo dado guardado.
 *
 * ⚠️ Ela é a contrapartida obrigatória do cache. Mostrar dado velho sem dizer
 * que é velho seria mentir por omissão — e no campo a diferença importa: uma
 * ceva excluída hoje de manhã continua no mapa até a rede voltar.
 *
 * ⚠️ Mostra a HORA da última leitura, não "há 3 horas". Tempo relativo não
 * atravessa os três idiomas: português e espanhol põem a partícula antes
 * ("há 5 min", "hace 5 min") e o inglês põe depois ("5 min ago"), então a
 * frase não se monta com um pedaço traduzido e um número no meio. A hora do
 * relógio precisa de uma palavra só, e ainda responde melhor à pergunta de
 * quem está no mato: quando foi a última vez que isto sincronizou.
 */
import { useUi } from '~/stores/ui'

const ui = useUi()

/** Relógio próprio: sem ele, o dado de ontem nunca ganha a data. */
const agora = ref(Date.now())
let tique: ReturnType<typeof setInterval> | null = null

const quando = computed(() => {
  if (!ui.dadoDe) return ''
  const d = new Date(ui.dadoDe)
  const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  /* De outro dia, a data vai junto — senão "às 14:32" esconde que o dado é
     de anteontem, que é exatamente o que a faixa existe para não deixar. */
  const mesmoDia = d.toDateString() === new Date(agora.value).toDateString()
  return mesmoDia ? hora : d.toLocaleDateString() + ' ' + hora
})

onMounted(() => { tique = setInterval(() => { agora.value = Date.now() }, 60000) })
onBeforeUnmount(() => { if (tique) clearInterval(tique) })
</script>

<template>
  <div v-if="ui.dadoDe" class="sem-rede" role="status">
    <Icone nome="nuvem" :px="16" />
    <span>Sem rede — mostrando o que foi salvo às</span>
    <b class="no-i18n">{{ quando }}</b>
  </div>
</template>

<style scoped>
.sem-rede {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px; font-size: 12px; font-weight: 600;
  background: var(--alerta); color: #1f1d18;
}
.sem-rede b { font-weight: 800; }
</style>
