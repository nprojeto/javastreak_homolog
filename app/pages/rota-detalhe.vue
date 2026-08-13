<script setup lang="ts">
/**
 * Detalhe da rota: traçado no mapa, marcações e abates registrados nela.
 * Porte de VIEWS.rotaDetalhe (index.html, 9076).
 */
import { dataBR } from '~/composables/useMascaras'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Rota } from '~/pages/rotas.vue'

definePageMeta({ layout: 'app' })

interface Marcacao {
  id: string; tipo: string; subtipo?: string; status?: string
  descricao?: string; lat?: number; lng?: number
  dataHora?: string; fotoUrl?: string
}

/** Tipo da marcação → ícone do sistema. Emoji não herda cor nem tamanho. */
const ICONE_MARCA: Record<string, string> = {
  Abate: 'abate', Armadilha: 'armadilha', 'Referência': 'pino', Aviso: 'alerta',
  Rastro: 'canil', 'Água': 'nuvem', 'Comida/isca': 'ceva', Perigo: 'alerta',
  'Foto/registro': 'camera', Outro: 'pino'
}

const route = useRoute()
const { server } = useServer()

const id = computed(() => String(route.query.id || ''))
const rota = ref<Rota | null>(null)
const prop = ref<Propriedade | null>(null)
const marcacoes = ref<Marcacao[] | null>(null)
const erro = ref('')

function fmtDist(m: number) {
  if (!m) return '0 m'
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km'
}

onMounted(async () => {
  try {
    const [minhas, comigo] = await Promise.all([
      server<Rota[]>('apiListarRotas'),
      server<Rota[]>('apiRotasCompartilhadasComigo').catch(() => [] as Rota[])
    ])
    const r = [...(minhas || []), ...(comigo || [])].find((x) => x.id === id.value) || null
    if (!r) { erro.value = 'Rota não encontrada'; return }
    rota.value = r

    if (r.propriedadeId) {
      const ps = await server<Propriedade[]>('apiListarPropriedades').catch(() => [] as Propriedade[])
      prop.value = (ps || []).find((p) => p.id === r.propriedadeId) || null
    }
    marcacoes.value = await server<Marcacao[]>('apiListarMarcacoes', id.value)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a rota'
  }
})
</script>

<template>
  <div>
    <TituloTela titulo="Rota" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!rota" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3 class="no-i18n"><Icone nome="rotas" /> {{ rota.nome || 'Rota' }}</h3>
        <div class="meta no-i18n">
          <template v-if="rota.propriedade">{{ rota.propriedade }} · </template>
          {{ rota.tipoTransporte || '' }}
        </div>
        <div class="meta">
          {{ fmtDist(Number(rota.distancia) || 0) }} ·
          {{ (rota.pontos || []).length }} pontos ·
          {{ dataBR(rota.dataCadastro) }}
        </div>
      </div>

      <ClientOnly>
        <MapaPontos
          :limites="prop?.temLimite ? [{ nome: prop.nome, pontos: prop.limite }] : []"
          :tracado="rota.pontos || []"
          :pinos="(marcacoes || [])
            .filter((m) => m.lat && m.lng)
            .map((m) => ({ lat: Number(m.lat), lng: Number(m.lng), titulo: m.tipo, cor: '#2f6ea8' }))"
          altura="44vh"
        />
      </ClientOnly>

      <h3 class="sec">Marcações</h3>
      <div v-if="marcacoes === null" class="card"><div class="meta">Carregando…</div></div>
      <div v-else-if="!marcacoes.length" class="card">
        <div class="meta">Nenhuma marcação nesta rota.</div>
      </div>
      <div v-for="m in marcacoes || []" :key="m.id" class="card marca">
        <span class="ic"><Icone :nome="ICONE_MARCA[m.tipo] || 'pino'" /></span>
        <div class="grow">
          <b>{{ m.tipo }}</b>
          <span v-if="m.subtipo" class="pill no-i18n">{{ m.subtipo }}</span>
          <span v-if="m.status" class="pill" :class="m.status === 'Ativa' ? 'ok' : ''">{{ m.status }}</span>
          <div v-if="m.descricao" class="meta no-i18n">{{ m.descricao }}</div>
          <div class="meta">{{ dataBR(m.dataHora) }}</div>
        </div>
        <img v-if="m.fotoUrl" :src="String(m.fotoUrl)" class="thumb" alt="">
      </div>

      <NuxtLink to="/rotas" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.sec { margin: 14px 4px 6px; font-size: 15px; }
.marca { display: flex; align-items: flex-start; gap: 10px; }
.marca .ic { font-size: 21px; flex: none; }
.marca .grow { flex: 1; min-width: 0; }
.marca .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.pill.ok { background: var(--verde-claro); color: var(--verde-esc); }
.thumb { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex: none; }
.btn { margin-top: 14px; text-decoration: none; }
</style>
