<script setup lang="ts">
/**
 * ── MAPA DE GUIAMENTO ─────────────────────────────────────────────────────
 *
 * Só leitura, feito para ser olhado andando: limite da propriedade, traçado
 * da rota, cevas, avisos e a posição de quem está caminhando.
 *
 * ⚠️ Diferença do `MapaPontos`: aqui a posição é AO VIVO (`watchPosition`),
 * não um clique em "minha localização". Quem está no mato precisa ver o ponto
 * andar, senão o mapa não responde à pergunta que importa — "estou no
 * caminho?".
 *
 * ⚠️ `interactive: false` em polígono e traçado, pelo mesmo motivo das outras
 * telas de mapa: camada interativa engole o toque e o mapa não arrasta.
 *
 * ⚠️ O traçado ganha setas de sentido. Rota é caminho, não área: sem indicar
 * a direção, quem chega pelo meio não sabe para que lado seguir.
 */
import type { Map as MapaLeaflet, FeatureGroup, CircleMarker, Circle, Polyline } from 'leaflet'
import { addBase, carregarLeaflet } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'

export interface LimiteGuia { id?: string; nome: string; limite: Ponto[] }
export interface RotaGuia { id: string; nome: string; pontos: Ponto[]; tipoTransporte?: string }
export interface CevaGuia { id: string; nome: string; lat: number; lng: number }
export interface MarcaGuia {
  id: string; tipo: string; subtipo?: string; status?: string
  lat: number; lng: number; descricao?: string
}

const props = defineProps<{
  limites: LimiteGuia[]
  rotas: RotaGuia[]
  cevas: CevaGuia[]
  marcacoes: MarcaGuia[]
  altura?: string
  /** Posição atual, vinda da tela — é ela que manda no GPS. */
  eu?: { lat: number; lng: number; precisao?: number } | null
  /** Recentrar sozinho a cada passo. */
  seguir?: boolean
}>()

/** Cor por tipo de aviso. Perigo e armadilha puxam vermelho de propósito. */
const COR_MARCA: Record<string, string> = {
  Armadilha: '#c0392b', Perigo: '#c0392b', Aviso: '#e8a33d',
  Abate: '#8e44ad', 'Referência': '#2f6ea8', Rastro: '#8a6a3b',
  'Água': '#2f9fd0', 'Comida/isca': '#b8863b', 'Foto/registro': '#6b675c'
}

const el = ref<HTMLElement | null>(null)
let map: MapaLeaflet | null = null
let base: FeatureGroup | null = null      // limite, rota, cevas, avisos
let camadaEu: FeatureGroup | null = null  // posição — redesenhada sozinha
let pinoEu: CircleMarker | null = null
let halo: Circle | null = null
let enquadrou = false

async function desenharBase() {
  const L = await carregarLeaflet()
  if (!map || !base) return
  base.clearLayers()

  for (const lim of props.limites || []) {
    if (!lim.limite || lim.limite.length < 3) continue
    L.polygon(lim.limite.map((p) => [p.lat, p.lng] as [number, number]), {
      color: '#2f7d3a', weight: 2, fillColor: '#2f7d3a', fillOpacity: 0.10, interactive: false
    }).addTo(base)
  }

  for (const r of props.rotas || []) {
    if (!r.pontos || r.pontos.length < 2) continue
    const linha: [number, number][] = r.pontos.map((p) => [p.lat, p.lng])
    /* Vinco branco por baixo: sobre satélite, azul em cima de verde escuro
       some. Duas linhas custam nada e o traçado passa a ler em qualquer base. */
    L.polyline(linha, { color: '#ffffff', weight: 8, opacity: 0.65, interactive: false }).addTo(base)
    const traco: Polyline = L.polyline(linha, { color: '#2f6ea8', weight: 4, interactive: false })
    traco.addTo(base)
    setas(L, linha)
    /* Começo e fim, para saber por onde entrar. */
    marcaLetra(L, r.pontos[0]!, 'A', '#2f6ea8')
    marcaLetra(L, r.pontos[r.pontos.length - 1]!, 'B', '#2f6ea8')
  }

  for (const c of props.cevas || []) {
    L.circleMarker([c.lat, c.lng], {
      radius: 9, color: '#fff', weight: 2, fillColor: '#b8863b', fillOpacity: 1
    }).addTo(base).bindPopup('<b>' + escapar(c.nome) + '</b><br>Ceva')
  }

  for (const k of props.marcacoes || []) {
    const cor = COR_MARCA[k.tipo] || '#6b675c'
    const inativa = k.status === 'Inativa'
    L.circleMarker([k.lat, k.lng], {
      radius: 7, color: '#fff', weight: 2,
      fillColor: cor, fillOpacity: inativa ? 0.35 : 1
    }).addTo(base).bindPopup(
      '<b>' + escapar(k.tipo) + (k.subtipo ? ' · ' + escapar(k.subtipo) : '') + '</b>'
      + (k.status ? '<br>' + escapar(k.status) : '')
      + (k.descricao ? '<br>' + escapar(k.descricao) : '')
    )
  }

  if (!enquadrou) enquadrar()
}

/** Setas de sentido a cada trecho longo o bastante para caber uma. */
function setas(L: Awaited<ReturnType<typeof carregarLeaflet>>, linha: [number, number][]) {
  if (!base) return
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1]!, b = linha[i]!
    const mLat = (a[0] + b[0]) / 2, mLng = (a[1] + b[1]) / 2
    const ang = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
    L.marker([mLat, mLng], {
      interactive: false,
      icon: L.divIcon({
        className: 'guia-seta',
        html: '<span style="transform:rotate(' + (-ang) + 'deg)">➤</span>',
        iconSize: [16, 16], iconAnchor: [8, 8]
      })
    }).addTo(base)
  }
}

function marcaLetra(L: Awaited<ReturnType<typeof carregarLeaflet>>, p: Ponto, letra: string, cor: string) {
  if (!base) return
  L.marker([p.lat, p.lng], {
    interactive: false,
    icon: L.divIcon({
      className: 'guia-ab',
      html: '<span style="background:' + cor + '">' + letra + '</span>',
      iconSize: [22, 22], iconAnchor: [11, 11]
    })
  }).addTo(base)
}

/** Posição: pino + halo da precisão. Redesenhar tudo a cada passo pisca. */
async function desenharEu() {
  const L = await carregarLeaflet()
  if (!map || !camadaEu) return
  const p = props.eu
  if (!p) {
    camadaEu.clearLayers()
    pinoEu = null; halo = null
    return
  }
  const centro: [number, number] = [p.lat, p.lng]
  if (!pinoEu) {
    halo = L.circle(centro, {
      radius: p.precisao || 0, color: '#e8552b', weight: 1,
      fillColor: '#e8552b', fillOpacity: 0.12, interactive: false
    }).addTo(camadaEu)
    pinoEu = L.circleMarker(centro, {
      radius: 8, color: '#fff', weight: 3, fillColor: '#e8552b', fillOpacity: 1, interactive: false
    }).addTo(camadaEu)
  } else {
    pinoEu.setLatLng(centro)
    halo?.setLatLng(centro)
    if (p.precisao) halo?.setRadius(p.precisao)
  }
  if (props.seguir) map.panTo(centro, { animate: true, duration: 0.5 })
}

/** Enquadra o caminho todo. Exposto: o botão "ver tudo" chama de fora. */
function enquadrar() {
  if (!map || !base) return
  try {
    const b = base.getBounds()
    if (b.isValid()) { map.fitBounds(b, { padding: [28, 28], maxZoom: 17 }); enquadrou = true }
  } catch { /* nada desenhado ainda */ }
}

function escapar(s: string) {
  return String(s || '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
}

defineExpose({ enquadrar })

watch(() => [props.limites, props.rotas, props.cevas, props.marcacoes], desenharBase, { deep: true })
watch(() => props.eu, desenharEu, { deep: true })

onMounted(async () => {
  const L = await carregarLeaflet()
  if (!el.value) return
  map = L.map(el.value, { preferCanvas: true, zoomControl: true }).setView([-15.78, -47.93], 4)
  /* Satélite por padrão: no mato, a imagem diz mais que o mapa de ruas. */
  await addBase(map, 'sat')
  base = L.featureGroup().addTo(map)
  camadaEu = L.featureGroup().addTo(map)
  setTimeout(() => { map?.invalidateSize(); desenharBase(); desenharEu() }, 150)
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div ref="el" class="mapa" :style="{ height: props.altura || '58vh' }" />
</template>

<style>
/* Sem `scoped`: as setas e as letras A/B nascem fora da árvore do Vue,
   dentro do Leaflet, e um seletor com hash não as alcançaria. */
.guia-seta { color: #2f6ea8; font-size: 15px; line-height: 16px; text-align: center; text-shadow: 0 0 3px #fff, 0 0 3px #fff; }
.guia-seta span { display: inline-block; }
.guia-ab span {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%; color: #fff;
  font-size: 12px; font-weight: 700; border: 2px solid #fff;
}
</style>

<style scoped>
.mapa { border-radius: 12px; border: 1px solid var(--linha); }
</style>
