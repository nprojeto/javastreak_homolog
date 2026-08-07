<script setup lang="ts">
/**
 * Sino de avisos. Porte de carregarAvisos + atualizarBadge + a lista
 * (index.html, 7834).
 *
 * ⚠️ Existia um buraco: o admin enviava o aviso, ele era gravado, e NINGUÉM
 * o via — a ação `apiAvisos` nunca era chamada no Nuxt. O aviso saía do
 * remetente e não chegava a lugar nenhum.
 *
 * O que já foi lido fica marcado no aparelho, como no legado: é preferência
 * de leitura, não dado de negócio.
 */
import { useAuth } from '~/stores/auth'
import { dataBR } from '~/composables/useMascaras'

const CHAVE_LIDOS = 'mj_avisos_lidos'

interface Aviso {
  id: string; titulo: string; mensagem: string
  criadoEm?: string; autorNome?: string; publico?: string
}

const auth = useAuth()
const { server } = useServer()

const avisos = ref<Aviso[]>([])
const aberto = ref(false)
const lidos = ref<string[]>([])

const naoLidos = computed(() => avisos.value.filter((a) => !lidos.value.includes(a.id)).length)

function carregarLidos() {
  try {
    lidos.value = JSON.parse(localStorage.getItem(CHAVE_LIDOS) || '[]')
  } catch {
    lidos.value = []
  }
}

function marcarTodos() {
  lidos.value = avisos.value.map((a) => a.id)
  try {
    localStorage.setItem(CHAVE_LIDOS, JSON.stringify(lidos.value))
  } catch { /* modo privado */ }
}

function abrir() {
  aberto.value = !aberto.value
  if (aberto.value) marcarTodos()
}

onMounted(async () => {
  if (!auth.token) return
  carregarLidos()
  try {
    avisos.value = await server<Aviso[]>('apiAvisos')
  } catch {
    /* Aviso é acessório: falha aqui não pode atrapalhar o resto da moldura. */
  }
})
</script>

<template>
  <div class="sino-wrap">
    <button class="sino" title="Avisos" @click="abrir">
      <Icone nome="notificacao" :px="24" />
      <span v-if="naoLidos" class="badge">{{ naoLidos }}</span>
    </button>

    <div v-if="aberto" class="painel">
      <div class="cab">
        <b>📢 Avisos</b>
        <button class="ib" @click="aberto = false">✕</button>
      </div>
      <div v-if="!avisos.length" class="meta vazio">Nenhum aviso no momento.</div>
      <div v-for="a in avisos" :key="a.id" class="aviso">
        <b class="no-i18n">{{ a.titulo }}</b>
        <div class="meta no-i18n">{{ a.mensagem }}</div>
        <div class="meta">
          {{ dataBR(a.criadoEm) }}<template v-if="a.autorNome"> · {{ a.autorNome }}</template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sino-wrap { position: relative; flex: none; }
.sino {
  background: none; border: 0; color: #fff; cursor: pointer;
  display: flex; align-items: center; padding: 4px; position: relative;
}
.sino :deep(.ic-svg) { stroke: #fff; }
.badge {
  position: absolute; top: -2px; right: -4px;
  background: var(--laranja); color: #fff; font-size: 10px; font-weight: 700;
  border-radius: 999px; padding: 1px 5px; min-width: 16px; text-align: center;
}
.painel {
  position: absolute; top: 38px; right: 0; width: min(84vw, 320px);
  background: #fff; border: 1px solid var(--linha); border-radius: 12px;
  box-shadow: var(--sombra); z-index: 80; max-height: 60vh; overflow-y: auto;
  color: var(--txt);
}
.cab { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--linha); }
.cab b { flex: 1; }
.ib { border: 0; background: none; cursor: pointer; font-size: 15px; }
.vazio { padding: 16px 12px; text-align: center; }
.aviso { padding: 10px 12px; border-bottom: 1px solid var(--linha); }
.aviso .meta { margin: 3px 0 0; }
</style>
