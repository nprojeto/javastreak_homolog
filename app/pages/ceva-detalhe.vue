<script setup lang="ts">
/**
 * Detalhe da ceva: onde ela fica, dentro de qual propriedade.
 *
 * ⚠️ ALIMENTO E NÍVEL DO TRATADOURO SAÍRAM daqui e do produto. Eram um
 * cadastro a mais que ninguém mantinha em dia, e dado desatualizado é pior
 * que dado nenhum — o alimento entrava como dimensão da estatística da ceva e
 * sujava o índice com o farelo de três meses atrás.
 *
 * ⚠️ A ESTATÍSTICA não vive aqui: ela abre no pino do mapa, que é onde a
 * pergunta "vale a pena ir nesta hoje?" aparece de verdade.
 */
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'

definePageMeta({ layout: 'app' })

const route = useRoute()
const { server, serverOpc } = useServer()

const id = computed(() => String(route.query.id || ''))
const ceva = ref<Ceva | null>(null)
const prop = ref<Propriedade | null>(null)
const erro = ref('')

async function carregar() {
  erro.value = ''
  try {
    const lista = await server<Ceva[]>('apiListarCevas')
    ceva.value = (lista || []).find((c) => String(c.id) === id.value) || null
    if (!ceva.value) { erro.value = 'Ceva não encontrada.'; return }
    const props_ = await serverOpc<Propriedade[]>('apiListarPropriedades')
    prop.value = ((props_ as Propriedade[]) || [])
      .find((p) => String(p.id) === String(ceva.value?.propriedadeId)) || null
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a ceva'
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Ceva" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!ceva" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab">
        <img v-if="ceva.fotoUrl" :src="String(ceva.fotoUrl)" class="thumb" alt="">
        <div class="grow">
          <h3 class="no-i18n"><Icone nome="ceva" /> {{ ceva.nome || 'Ceva' }}</h3>
          <div class="meta"><span class="pill">{{ ceva.tipo }}</span></div>
          <div v-if="prop" class="meta no-i18n">{{ prop.nome }}</div>
        </div>
        <NuxtLink :to="{ path: '/ceva', query: { id } }" class="ib" title="Editar"><Icone nome="editar" /></NuxtLink>
      </div>

      <ClientOnly>
        <MapaPontos
          :limites="prop?.temLimite ? [{ nome: prop.nome, pontos: prop.limite }] : []"
          :pinos="ceva.lat && ceva.lng
            ? [{ lat: Number(ceva.lat), lng: Number(ceva.lng), titulo: ceva.nome || 'Ceva', icone: 'ceva' }]
            : []"
        />
      </ClientOnly>

      <div v-if="!prop" class="card">
        <div class="meta">Esta ceva não está ligada a nenhuma propriedade.</div>
      </div>

      <div v-if="ceva.obs" class="card">
        <p class="no-i18n">{{ ceva.obs }}</p>
      </div>

      <PainelCompartilhar tipo="ceva" :id="id" :nome="ceva.nome" />

      <div class="card">
        <div class="meta">
          <Icone nome="grafico" /> O histórico de abates e as condições de hoje
          abrem ao tocar nesta ceva no mapa da Rede.
        </div>
        <NuxtLink to="/mapa" class="btn sec"><Icone nome="mapa" /> Abrir no mapa</NuxtLink>
      </div>

      <NuxtLink to="/espera" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.cab { display: flex; align-items: center; gap: 10px; }
.cab .thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; }
.cab .grow { flex: 1; min-width: 0; }
.cab h3 { margin: 0; font-size: 16px; }
.cab .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; color: var(--laranja-cl); cursor: pointer; font-size: 17px; padding: 4px 6px; text-decoration: none; }
.btn.sec { margin-top: 10px; text-decoration: none; }
</style>
