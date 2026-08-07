<script setup lang="ts">
/**
 * Desenho da rota dentro do limite. Porte de VIEWS.rotaDesenhar +
 * desenhoAdd + setModoDesenho (index.html, 9115-9175).
 *
 * ⚠️ Vértice fora do limite NÃO ENTRA. Recusar no ato é mais claro do que
 * deixar desenhar tudo e reprovar no fim, quando já não dá para saber qual
 * ponto estragou. O servidor recusa igual, com `ROTA_FORA`.
 *
 * ⚠️ `interactive: false` em tudo, pelo mesmo motivo do limite da
 * propriedade: com a camada interativa, o clique dentro da área desenhada
 * não chega ao mapa.
 *
 * Dois modos: traçado (liga os pontos do caminho) e aviso (marcações soltas).
 */
import type { Map as MapaLeaflet, FeatureGroup } from 'leaflet'
import { addBase, carregarLeaflet, pontoDentro } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'
import { useUi } from '~/stores/ui'

export interface Marca {
  tipo: string; lat: number; lng: number
  descricao?: string; subtipo?: string; status?: string
}

const props = defineProps<{ limite: Ponto[]; nomeProp: string }>()
const pontos = defineModel<Ponto[]>('pontos', { default: () => [] })
const marcas = defineModel<Marca[]>('marcas', { default: () => [] })

const TIPOS_MARCA: Array<[string, string]> = [
  ['Abate', '🐗'], ['Armadilha', '🪤'], ['Referência', '📍'], ['Aviso', '⚠️'],
  ['Rastro', '🐾'], ['Água', '💧'], ['Comida/isca', '🌽'], ['Perigo', '☠️'],
  ['Foto/registro', '📷'], ['Outro', '📌']
]

const ui = useUi()
const el = ref<HTMLElement | null>(null)
const modo = ref<'traco' | 'ponto'>('traco')
const tipoMarca = ref(TIPOS_MARCA[2]![0])

let map: MapaLeaflet | null = null
let camada: FeatureGroup | null = null
let L: Awaited<ReturnType<typeof carregarLeaflet>> | null = null

const distancia = computed(() => {
  let d = 0
  for (let i = 1; i < pontos.value.length; i++) {
    const a = pontos.value[i - 1]!, b = pontos.value[i]!
    const dLat = (b.lat - a.lat) * 110574
    const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180)
    d += Math.sqrt(dLat * dLat + dLng * dLng)
  }
  return d
})

const distTexto = computed(() =>
  distancia.value < 1000
    ? Math.round(distancia.value) + ' m'
    : (distancia.value / 1000).toFixed(2).replace('.', ',') + ' km'
)

function emoji(t: string) {
  return TIPOS_MARCA.find((x) => x[0] === t)?.[1] || '📌'
}

function redesenhar() {
  if (!camada || !L) return
  camada.clearLayers()

  L.polygon(props.limite.map((p) => [p.lat, p.lng] as [number, number]), {
    color: '#2f7d3a', weight: 2, fillColor: '#2f7d3a',
    fillOpacity: 0.10, interactive: false
  }).addTo(camada)

  const xy = pontos.value.map((p) => [p.lat, p.lng] as [number, number])
  if (xy.length > 1) {
    L.polyline(xy, { color: '#2f6ea8', weight: 4, interactive: false }).addTo(camada)
  }
  xy.forEach((p, i) => {
    L!.circleMarker(p, {
      radius: i === 0 ? 7 : 5, color: '#fff',
      fillColor: i === 0 ? '#b23b3b' : '#2f6ea8',
      fillOpacity: 1, weight: 2, interactive: false
    }).addTo(camada!)
  })

  for (const m of marcas.value) {
    L.marker([m.lat, m.lng], {
      icon: L.divIcon({
        className: 'marca-rota',
        html: '<span>' + emoji(m.tipo) + '</span>',
        iconSize: [26, 26], iconAnchor: [13, 13]
      }),
      interactive: false
    }).addTo(camada)
  }
}

function clicou(lat: number, lng: number) {
  if (!pontoDentro({ lat, lng }, props.limite)) {
    ui.avisar('Este ponto está fora do limite desenhado de ' + props.nomeProp, 'erro')
    return
  }
  const p = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
  if (modo.value === 'traco') pontos.value = [...pontos.value, p]
  else marcas.value = [...marcas.value, { tipo: tipoMarca.value, ...p, descricao: '' }]
}

function desfazer() {
  if (modo.value === 'traco') pontos.value = pontos.value.slice(0, -1)
  else marcas.value = marcas.value.slice(0, -1)
}
function limpar() {
  if (modo.value === 'traco') pontos.value = []
  else marcas.value = []
}

watch([pontos, marcas], redesenhar, { deep: true })

onMounted(async () => {
  L = await carregarLeaflet()
  if (!el.value) return
  map = L.map(el.value, { preferCanvas: true, zoomAnimation: false, minZoom: 3 })
    .setView([-15.78, -47.93], 4)
  await addBase(map)
  camada = L.featureGroup().addTo(map)
  map.on('click', (e) => clicou(e.latlng.lat, e.latlng.lng))
  setTimeout(() => {
    map?.invalidateSize()
    redesenhar()
    try {
      if (props.limite.length >= 3) {
        map?.fitBounds(props.limite.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 17 })
      }
    } catch { /* limite degenerado */ }
  }, 150)
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div>
    <div class="modos">
      <button type="button" :class="{ on: modo === 'traco' }" @click="modo = 'traco'">
        ✏️ Traçado
      </button>
      <button type="button" :class="{ on: modo === 'ponto' }" @click="modo = 'ponto'">
        📍 Aviso / marcação
      </button>
    </div>

    <div class="meta dica">
      <template v-if="modo === 'ponto'">
        <b>Modo aviso:</b> toque no mapa onde quer colocar uma referência.
      </template>
      <template v-else>
        <b>Modo traçado:</b> toque no mapa para ligar os pontos do caminho.
      </template>
    </div>

    <template v-if="modo === 'ponto'">
      <label for="m_tipo">Tipo da marcação</label>
      <select id="m_tipo" v-model="tipoMarca">
        <option v-for="t in TIPOS_MARCA" :key="t[0]" :value="t[0]">{{ t[1] }} {{ t[0] }}</option>
      </select>
    </template>

    <div class="dash">
      <div class="kpi"><b>{{ pontos.length }}</b><span>pontos</span></div>
      <div class="kpi"><b>{{ distTexto }}</b><span>distância</span></div>
      <div class="kpi"><b>{{ marcas.length }}</b><span>marcações</span></div>
    </div>

    <div ref="el" class="mapa" />

    <div class="acoes">
      <button type="button" class="btn sec" @click="desfazer">↶ Desfazer</button>
      <button type="button" class="btn sec" @click="limpar">🗑️ Limpar</button>
    </div>
  </div>
</template>

<style scoped>
.mapa { height: 50vh; min-height: 300px; border-radius: 12px; border: 1px solid var(--linha); }
.modos { display: flex; gap: 6px; margin-bottom: 6px; }
.modos button {
  flex: 1; padding: 9px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: #fff; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--txt);
}
.modos button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.dica { margin-bottom: 8px; }
.dash { display: flex; gap: 8px; margin: 8px 0; }
.kpi { flex: 1; background: #fff; border: 1px solid var(--linha); border-radius: 12px; padding: 8px; text-align: center; }
.kpi b { display: block; font-size: 16px; }
.kpi span { font-size: 11px; color: #7a7466; }
.acoes { display: flex; gap: 8px; margin-top: 10px; }
.acoes .btn { margin: 0; }
</style>

<style>
/* Fora do scoped: o Leaflet cria o divIcon fora da árvore do componente. */
.marca-rota { display: flex; align-items: center; justify-content: center; font-size: 19px; }
</style>
