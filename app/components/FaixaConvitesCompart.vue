<script setup lang="ts">
/**
 * Convites de compartilhamento recebidos — ceva e propriedade.
 *
 * ⚠️ Fica na tela de INÍCIO, não numa aba própria. Convite que só aparece
 * onde ninguém entra é convite que apodrece: quem convidou acha que
 * compartilhou, quem recebeu nunca soube. Aqui ele está no caminho.
 *
 * ⚠️ Some sozinha quando não há convite. Uma faixa vazia ocupando espaço na
 * abertura do app seria pior que não existir.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

interface Convite {
  id: string
  tipo: 'ceva' | 'propriedade'
  itemNome?: string
  donoNome?: string
  criadoEm?: string
}

const { server } = useServer()
const ui = useUi()

const convites = ref<Convite[]>([])
const respondendo = ref('')

const ICONE: Record<string, string> = { ceva: 'ceva', propriedade: 'areas' }

async function carregar() {
  try {
    convites.value = await server<Convite[]>('apiMeusConvitesCompart')
  } catch {
    /* Acessório: falhar aqui não pode atrapalhar a abertura do app. */
    convites.value = []
  }
}

async function responder(c: Convite, resposta: 'aceito' | 'recusado') {
  respondendo.value = c.id
  try {
    await server('apiResponderCompartilhamento', c.tipo, c.id, resposta)
    ui.avisar(resposta === 'aceito'
      ? 'Convite aceito ✔ — o item já aparece no seu mapa'
      : 'Convite recusado')
    await carregar()
  } catch { /* já avisado */ } finally {
    respondendo.value = ''
  }
}

onMounted(carregar)
</script>

<template>
  <div v-if="convites.length" class="card convites">
    <h3><Icone nome="compartilhar" /> Compartilharam com você</h3>
    <div v-for="c in convites" :key="c.id" class="item">
      <span class="ic"><Icone :nome="ICONE[c.tipo] || 'pino'" :px="20" /></span>
      <div class="grow">
        <b class="no-i18n">{{ c.itemNome || c.tipo }}</b>
        <div class="meta no-i18n">
          {{ c.donoNome }}<template v-if="c.criadoEm"> · {{ dataBR(c.criadoEm) }}</template>
        </div>
      </div>
      <div class="acoes">
        <button class="btn sm" :disabled="respondendo === c.id" @click="responder(c, 'aceito')">
          Aceitar
        </button>
        <button class="btn sm sec" :disabled="respondendo === c.id" @click="responder(c, 'recusado')">
          Recusar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.convites { border-left: 4px solid var(--laranja); margin-bottom: 12px; }
.convites h3 { margin: 0 0 8px; font-size: 15px; }
.item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--linha); }
.item:first-of-type { border-top: 0; }
.ic {
  flex: none; width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--carvao-3); color: var(--laranja-cl);
}
.item .grow { flex: 1; min-width: 0; }
.item b { font-size: 14px; }
.item .meta { margin: 1px 0 0; }
.acoes { display: flex; flex-direction: column; gap: 4px; flex: none; }
.acoes .btn { width: auto; margin: 0; padding: 5px 12px; font-size: 11.5px; }
</style>
