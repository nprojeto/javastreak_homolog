<script setup lang="ts">
/**
 * Desenho do limite da propriedade. Porte de VIEWS.propLimite +
 * redesenharLimite (index.html, 5975).
 *
 * ⚠️ Tudo é desenhado com `interactive: false`. É o clique NO MAPA que
 * acrescenta vértice; com o polígono interativo, a partir do 3º ponto clicar
 * dentro da área já desenhada não fazia nada — a camada engolia o clique.
 * Custou tempo no legado e está registrado lá.
 */
import type { Map as MapaLeaflet, FeatureGroup } from 'leaflet'
import { addBase, areaPoligono, fmtArea, carregarLeaflet } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'

const pontos = defineModel<Ponto[]>({ default: () => [] })
const props = defineProps<{ centroInicial?: { lat?: number; lng?: number } }>()

const el = ref<HTMLElement | null>(null)
let map: MapaLeaflet | null = null
let camada: FeatureGroup | null = null
let L: Awaited<ReturnType<typeof carregarLeaflet>> | null = null

const area = computed(() =>
  pontos.value.length > 2 ? fmtArea(areaPoligono(pontos.value)) : '—'
)

function redesenhar() {
  if (!camada || !L) return
  camada.clearLayers()
  const xy = pontos.value.map((p) => [p.lat, p.lng] as [number, number])
  if (xy.length > 2) {
    L.polygon(xy, {
      color: '#2f7d3a', weight: 3, fillColor: '#2f7d3a',
      fillOpacity: 0.18, interactive: false
    }).addTo(camada)
  } else if (xy.length === 2) {
    L.polyline(xy, {
      color: '#2f7d3a', weight: 3, dashArray: '6,6', interactive: false
    }).addTo(camada)
  }
  xy.forEach((p, i) => {
    L!.circleMarker(p, {
      radius: i === 0 ? 7 : 5, color: '#fff',
      fillColor: i === 0 ? '#b23b3b' : '#2f7d3a',
      fillOpacity: 1, weight: 2, interactive: false
    }).addTo(camada!)
  })
}

function desfazer() {
  if (pontos.value.length) pontos.value = pontos.value.slice(0, -1)
}
function limpar() { pontos.value = [] }

watch(pontos, redesenhar, { deep: true })

onMounted(async () => {
  L = await carregarLeaflet()
  if (!el.value) return
  map = L.map(el.value, { preferCanvas: true, zoomAnimation: false, minZoom: 3 })
    .setView([-15.78, -47.93], 4)
  await addBase(map)
  camada = L.featureGroup().addTo(map)

  map.on('click', (e) => {
    pontos.value = [...pontos.value, {
      lat: +e.latlng.lat.toFixed(6),
      lng: +e.latlng.lng.toFixed(6)
    }]
  })

  setTimeout(() => {
    map?.invalidateSize()
    if (pontos.value.length) {
      try {
        map?.fitBounds(pontos.value.map((p) => [p.lat, p.lng]), {
          padding: [40, 40], maxZoom: 16
        })
      } catch { /* pontos degenerados */ }
    } else if (props.centroInicial?.lat && props.centroInicial?.lng) {
      map?.setView([props.centroInicial.lat, props.centroInicial.lng], 15)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map?.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => { /* sem GPS, fica na visão do Brasil */ },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
    redesenhar()
  }, 150)
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div>
    <div class="meta">
      Toque no mapa para marcar os cantos da propriedade. A partir de 3 pontos a
      área se fecha sozinha.
    </div>

    <div class="dash">
      <div class="kpi"><b>{{ pontos.length }}</b><span>pontos</span></div>
      <div class="kpi"><b>{{ area }}</b><span>área</span></div>
    </div>

    <div ref="el" class="mapa" />

    <div class="acoes">
      <button type="button" class="btn sec" @click="desfazer"><Icone nome="desfazer" /> Desfazer</button>
      <button type="button" class="btn sec" @click="limpar"><Icone nome="excluir" /> Limpar</button>
    </div>
  </div>
</template>

<style scoped>
/* `touch-action: none`: o gesto é do mapa, não da página. */
/**
 * ⚠️ `position: relative` + `isolation` + `overflow: hidden` NO ELEMENTO DO
 * MAPA. O CSS do Leaflet não posiciona `.leaflet-container`, e os controles
 * dele são `position: absolute` com `z-index: 1000` — sem um ancestral
 * posicionado aqui, eles se prendem ao primeiro que existir acima e aparecem
 * FORA do mapa, por cima do resto da tela. `isolation` fecha o contexto de
 * empilhamento para que aquele 1000 não dispute com nada da página, e o
 * `overflow` mantém as telhas dentro dos cantos arredondados.
 */
.mapa {
  position: relative; isolation: isolate; overflow: hidden;
  height: 50vh; min-height: 300px; border-radius: 12px; border: 1px solid var(--linha); touch-action: none;
}
.dash { display: flex; gap: 8px; margin: 8px 0; }
.kpi { flex: 1; background: var(--card); border: 1px solid var(--linha); border-radius: 12px; padding: 8px; text-align: center; }
.kpi b { display: block; font-size: 17px; }
.kpi span { font-size: 11px; color: var(--osso-2); }
.acoes { display: flex; gap: 8px; margin-top: 10px; }
.acoes .btn { margin: 0; }
</style>
