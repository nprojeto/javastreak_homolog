<script setup lang="ts">
/**
 * ── ESCOLHER UM PONTO NO MAPA ─────────────────────────────────────────────
 *
 * Estava pendente desde o lote 4 (ver o comentário antigo em `BotaoGps`): até
 * agora, quem não conseguia GPS só podia digitar a coordenada à mão. Marcar
 * uma ceva de casa, ou apontar a localização de uma propriedade a 40 km, era
 * impossível sem estar fisicamente no lugar.
 *
 * ⚠️ MIRA FIXA NO CENTRO, mapa que anda por baixo. É a diferença que decide o
 * uso no celular: com pino solto, o dedo cobre exatamente o ponto que se está
 * tentando acertar, e o toque erra por dez metros sem que se veja. Com a mira
 * fixa, arrasta-se o mapa e o alvo fica sempre visível. Vale o toque direto
 * também, para quem estiver num computador.
 *
 * ⚠️ Satélite por padrão. Ceva, porteira e sede não aparecem no mapa de ruas:
 * quem marca ponto em área rural precisa da imagem, não do traçado viário.
 *
 * ⚠️ NÃO valida nada. Se o ponto cai fora do limite da propriedade, quem avisa
 * é a tela que usa este componente, e quem recusa é o servidor. O limite
 * recebido aqui é desenhado só para orientar quem está escolhendo.
 */
import type { Map as MapaLeaflet, FeatureGroup } from 'leaflet'
import { addBase, carregarLeaflet, pontoDentro } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'
import { buscarEndereco } from '~/composables/useEndereco'
import { useUi } from '~/stores/ui'

const props = defineProps<{
  /** Ponto inicial. Sem ele, o mapa abre no GPS ou no Brasil. */
  lat?: string
  lng?: string
  /** Limite da propriedade, só para orientar. Não bloqueia. */
  limite?: Ponto[]
  /** Nome mostrado no aviso de "fora do limite". */
  nomeLimite?: string
}>()

const emit = defineEmits<{ escolher: [Ponto]; fechar: [] }>()

const ui = useUi()
const el = ref<HTMLElement | null>(null)
const centro = ref<Ponto | null>(null)
const busca = ref('')
const buscando = ref(false)
let map: MapaLeaflet | null = null
let camada: FeatureGroup | null = null

const fora = computed(() => {
  const c = centro.value
  const lim = props.limite || []
  if (!c || lim.length < 3) return false
  return !pontoDentro(c, lim)
})

async function desenharLimite() {
  const L = await carregarLeaflet()
  if (!map || !camada) return
  camada.clearLayers()
  const lim = props.limite || []
  if (lim.length >= 3) {
    L.polygon(lim.map((p) => [p.lat, p.lng] as [number, number]), {
      color: '#2f7d3a', weight: 2, fillColor: '#2f7d3a', fillOpacity: 0.12,
      /* Camada interativa engole o arrasto e o mapa trava. */
      interactive: false
    }).addTo(camada)
  }
}

function atualizarCentro() {
  if (!map) return
  const c = map.getCenter()
  centro.value = { lat: c.lat, lng: c.lng }
}

async function irPara(p: Ponto, zoom = 17) {
  if (!map) return
  map.setView([p.lat, p.lng], zoom)
  atualizarCentro()
}

function usarGps() {
  if (!navigator.geolocation) { ui.avisar('Seu aparelho não oferece localização', 'erro'); return }
  navigator.geolocation.getCurrentPosition(
    (p) => irPara({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => ui.avisar('Não foi possível obter a localização', 'erro'),
    { enableHighAccuracy: true, timeout: 15000 }
  )
}

/** Busca por endereço ou nome de lugar, para chegar perto sem arrastar o mundo. */
async function buscarLugar() {
  if (busca.value.trim().length < 3) return
  buscando.value = true
  try {
    const a = await buscarEndereco([busca.value])
    if (!a) { ui.avisar('Endereço não encontrado — arraste o mapa até o local', 'erro'); return }
    await irPara({ lat: Number(a.lat), lng: Number(a.lng) }, 15)
  } catch {
    ui.avisar('Não foi possível buscar o endereço', 'erro')
  } finally {
    buscando.value = false
  }
}

function confirmar() {
  if (!centro.value) return
  emit('escolher', centro.value)
}

onMounted(async () => {
  const L = await carregarLeaflet()
  if (!el.value) return

  const la = Number(props.lat), ln = Number(props.lng)
  const temInicial = isFinite(la) && isFinite(ln) && (la !== 0 || ln !== 0)

  map = L.map(el.value, { zoomControl: true, preferCanvas: true })
    .setView(temInicial ? [la, ln] : [-15.78, -47.93], temInicial ? 17 : 4)
  await addBase(map, 'sat')
  camada = L.featureGroup().addTo(map)
  await desenharLimite()

  /* Se não veio ponto e há limite, abre enquadrando a propriedade — é onde a
     pessoa vai marcar, e poupa procurar o lugar no mapa do Brasil inteiro. */
  if (!temInicial && (props.limite || []).length >= 3) {
    const b = L.latLngBounds((props.limite || []).map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(b, { padding: [24, 24], maxZoom: 17 })
  }

  map.on('move', atualizarCentro)
  /* Toque direto também posiciona: no computador é o gesto natural. */
  map.on('click', (ev: { latlng: { lat: number; lng: number } }) => {
    irPara({ lat: ev.latlng.lat, lng: ev.latlng.lng }, map!.getZoom())
  })

  setTimeout(() => { map?.invalidateSize(); atualizarCentro() }, 150)
  if (!temInicial && !(props.limite || []).length) usarGps()
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div class="picker">
    <div class="topo">
      <input
        v-model="busca"
        class="no-i18n"
        placeholder="Buscar endereço ou cidade"
        @keyup.enter="buscarLugar"
      >
      <button type="button" class="mini" :disabled="buscando" @click="buscarLugar">
        <Icone nome="buscar" :px="16" />
      </button>
      <button type="button" class="mini" title="Minha localização" @click="usarGps">
        <Icone nome="pino" :px="16" />
      </button>
    </div>

    <div class="palco">
      <div ref="el" class="mapa" />
      <!-- A mira não recebe toque: se recebesse, o mapa não arrastaria. -->
      <div class="mira" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="40" height="40">
          <circle cx="20" cy="20" r="12" fill="none" stroke="#fff" stroke-width="3" />
          <circle cx="20" cy="20" r="12" fill="none" stroke="#e8552b" stroke-width="2" />
          <line x1="20" y1="2" x2="20" y2="10" stroke="#e8552b" stroke-width="2" />
          <line x1="20" y1="30" x2="20" y2="38" stroke="#e8552b" stroke-width="2" />
          <line x1="2" y1="20" x2="10" y2="20" stroke="#e8552b" stroke-width="2" />
          <line x1="30" y1="20" x2="38" y2="20" stroke="#e8552b" stroke-width="2" />
          <circle cx="20" cy="20" r="2.5" fill="#e8552b" />
        </svg>
      </div>
    </div>

    <div class="coord no-i18n">
      <template v-if="centro">{{ centro.lat.toFixed(6) }}, {{ centro.lng.toFixed(6) }}</template>
      <template v-else>—</template>
    </div>

    <div v-if="fora" class="meta alerta">
      <Icone nome="alerta" /> Este ponto está fora do limite de {{ nomeLimite || 'da propriedade' }}
    </div>

    <div class="acoes">
      <button type="button" class="btn" :disabled="!centro" @click="confirmar">
        <Icone nome="confirmar" /> Usar este ponto
      </button>
      <button type="button" class="btn sec" @click="emit('fechar')">Cancelar</button>
    </div>
  </div>
</template>

<style scoped>
.picker { margin: 8px 0; }

.topo { display: flex; gap: 6px; margin-bottom: 8px; }
.topo input { margin: 0; flex: 1; }
.mini {
  flex: none; border: 1px solid var(--linha); background: var(--carvao-3);
  color: var(--laranja-cl); border-radius: 10px; padding: 0 12px; cursor: pointer;
}

.palco { position: relative; }
.mapa { height: 46vh; min-height: 260px; border-radius: 12px; border: 1px solid var(--linha); }
.mira {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  pointer-events: none; z-index: 500;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .5));
}

.coord {
  text-align: center; font-size: 13px; font-weight: 700;
  padding: 8px; margin-top: 8px;
  background: var(--carvao-3); border-radius: 10px;
}
.alerta { color: var(--alerta); margin-top: 6px; }

.acoes { display: flex; gap: 8px; margin-top: 8px; }
.acoes .btn { flex: 1; margin: 0; }
</style>
