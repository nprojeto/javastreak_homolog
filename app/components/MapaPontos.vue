<script setup lang="ts">
/**
 * Mapa só de leitura: limites de propriedade e pinos.
 * Porte de desenharPropDaCeva + desenharLimitesEm (index.html, 8259 / 5949).
 *
 * Reaproveitado pela ceva, pela rota e, mais adiante, pelo mapa geral.
 */
import type { Map as MapaLeaflet, FeatureGroup } from 'leaflet'
import { addBase, carregarLeaflet } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'

export interface Limite { nome: string; pontos: Ponto[] }
export interface Pino {
  lat: number; lng: number; titulo?: string; cor?: string
  /** Linhas extras do balão: o que aconteceu naquele ponto. */
  linhas?: string[]
}

export interface RotaMapa {
  nome?: string; pontos: Ponto[]; cor?: string; linhas?: string[]
}

const props = withDefaults(defineProps<{
  limites?: Limite[]
  pinos?: Pino[]
  tracado?: Ponto[]
  /** Rotas desenhadas com balão — o `tracado` continua para o caso simples. */
  rotas?: RotaMapa[]
  altura?: string
}>(), { altura: '38vh' })

/* O balão é HTML, e nome de ceva vem do usuário. */
function esc(t: string) {
  return String(t || '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
}

const el = ref<HTMLElement | null>(null)
let map: MapaLeaflet | null = null
let camada: FeatureGroup | null = null

async function desenhar() {
  const L = await carregarLeaflet()
  if (!map || !camada) return
  camada.clearLayers()

  for (const lim of props.limites || []) {
    if (!lim.pontos || lim.pontos.length < 3) continue
    L.polygon(lim.pontos.map((p) => [p.lat, p.lng] as [number, number]), {
      color: '#2f7d3a', weight: 2, fillColor: '#2f7d3a', fillOpacity: 0.12
    }).addTo(camada).bindPopup('<b>' + lim.nome + '</b>')
  }

  if (props.tracado && props.tracado.length > 1) {
    L.polyline(props.tracado.map((p) => [p.lat, p.lng] as [number, number]), {
      color: '#2f6ea8', weight: 4
    }).addTo(camada)
  }

  /* Rotas com balão próprio: é onde os eventos daquela rota são contados. */
  for (const r of props.rotas || []) {
    if ((r.pontos || []).length < 2) continue
    const extra = (r.linhas || []).map((l) => '<br>' + esc(l)).join('')
    L.polyline(r.pontos.map((p) => [p.lat, p.lng] as [number, number]), {
      color: r.cor || '#2f6ea8', weight: 4
    }).addTo(camada).bindPopup('<b>' + esc(r.nome || 'Rota') + '</b>' + extra)
  }

  for (const p of props.pinos || []) {
    const extra = (p.linhas || []).map((l) => '<br>' + esc(l)).join('')
    L.circleMarker([p.lat, p.lng], {
      radius: 8, color: '#fff', weight: 2,
      fillColor: p.cor || '#b8863b', fillOpacity: 1
    }).addTo(camada).bindPopup('<b>' + esc(p.titulo || '') + '</b>' + extra)
  }

  /* Enquadra tudo o que existe. Sem nada, fica na visão do Brasil. */
  try {
    const b = camada.getBounds()
    if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 16 })
  } catch { /* camada vazia */ }
}

watch(() => [props.limites, props.pinos, props.tracado, props.rotas], desenhar, { deep: true })

onMounted(async () => {
  const L = await carregarLeaflet()
  if (!el.value) return
  map = L.map(el.value, { preferCanvas: true }).setView([-15.78, -47.93], 4)
  await addBase(map)
  camada = L.featureGroup().addTo(map)
  setTimeout(() => { map?.invalidateSize(); desenhar() }, 150)
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div ref="el" class="mapa" :style="{ height: props.altura }" />
</template>

<style scoped>
.mapa { min-height: 240px; border-radius: 12px; border: 1px solid var(--linha); }
</style>
