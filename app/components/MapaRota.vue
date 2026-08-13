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
import { ICO } from '~/composables/useIcones'

export interface Marca {
  tipo: string; lat: number; lng: number
  descricao?: string; subtipo?: string; status?: string
}

const props = defineProps<{
  limite: Ponto[]
  nomeProp: string
  /** Teto do plano para marcações nesta rota. -1 = sem limite. */
  limiteMarcas?: number
}>()
const pontos = defineModel<Ponto[]>('pontos', { default: () => [] })

/**
 * ⚠️ A POSIÇÃO DE QUEM DESENHA. Faltava, e sem ela desenhar a rota estando na
 * propriedade era às cegas: o traçado nasce sobre a imagem de satélite, e quem
 * está em campo não tem como saber onde está em relação ao que está marcando.
 *
 * O ponto é só referência — não entra no traçado nem é enviado ao servidor.
 */
const eu = ref<{ lat: number; lng: number; precisao?: number } | null>(null)
let observador: number | null = null
const marcas = defineModel<Marca[]>('marcas', { default: () => [] })

/** Tipo da marcação → ícone do sistema, no lugar do emoji. */
const TIPOS_MARCA: Array<[string, string]> = [
  ['Abate', 'abate'], ['Armadilha', 'armadilha'], ['Referência', 'pino'],
  ['Aviso', 'alerta'], ['Rastro', 'canil'], ['Água', 'nuvem'],
  ['Comida/isca', 'ceva'], ['Perigo', 'alerta'], ['Foto/registro', 'camera'],
  ['Outro', 'pino']
]

const ui = useUi()
const el = ref<HTMLElement | null>(null)
const modo = ref<'traco' | 'ponto'>('traco')
const tipoMarca = ref(TIPOS_MARCA[2]![0])

let map: MapaLeaflet | null = null
let camada: FeatureGroup | null = null
let camadaEu: FeatureGroup | null = null
let pinoEu: ReturnType<NonNullable<typeof L>['circleMarker']> | null = null
let haloEu: ReturnType<NonNullable<typeof L>['circle']> | null = null
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

function iconeDe(t: string) {
  return TIPOS_MARCA.find((x) => x[0] === t)?.[1] || 'pino'
}

/** O Leaflet monta o pino fora da árvore do Vue, então o SVG vai como texto. */
function svgMarca(t: string) {
  return '<svg class="ic-svg" aria-hidden="true"><use href="#js-'
    + (ICO[iconeDe(t)] || ICO.painel) + '"/></svg>'
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
        html: svgMarca(m.tipo),
        iconSize: [28, 28], iconAnchor: [14, 14]
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
  if (modo.value === 'traco') {
    pontos.value = [...pontos.value, p]
    return
  }
  /* ⚠️ Barra no clique, e não no salvamento. Antes o desenho aceitava
     marcações sem limite e o servidor recusava as excedentes UMA A UMA na
     hora de salvar — as primeiras entravam, o resto sumia e a pessoa não
     sabia por quê. */
  const teto = props.limiteMarcas
  if (teto !== undefined && teto !== -1 && marcas.value.length >= teto) {
    ui.avisar(
      teto === 0
        ? 'Seu plano não inclui marcações na rota.'
        : 'Seu plano permite ' + teto + ' marcação(ões) por rota.',
      'erro'
    )
    return
  }
  marcas.value = [...marcas.value, { tipo: tipoMarca.value, ...p, descricao: '' }]
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
  camadaEu = L.featureGroup().addTo(map)
  map.on('click', (e) => clicou(e.latlng.lat, e.latlng.lng))
  ligarGps()
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

/**
 * Acompanha a posição enquanto a tela está aberta, e DESLIGA ao sair —
 * esquecer o observador drena a bateria de quem só fechou a aba.
 */
function ligarGps() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  observador = navigator.geolocation.watchPosition(
    (p) => {
      eu.value = {
        lat: p.coords.latitude, lng: p.coords.longitude,
        precisao: p.coords.accuracy ? Math.round(p.coords.accuracy) : undefined
      }
      desenharEu()
    },
    () => { /* sem sinal ou sem permissão: o mapa continua servindo */ },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
  )
}

/** Pino da posição: move em vez de recriar, senão pisca a cada passo. */
function desenharEu() {
  if (!map || !camadaEu || !L) return
  const p = eu.value
  if (!p) return
  const centro: [number, number] = [p.lat, p.lng]
  if (!pinoEu) {
    haloEu = L.circle(centro, {
      radius: p.precisao || 0, color: '#e8552b', weight: 1,
      fillColor: '#e8552b', fillOpacity: 0.12, interactive: false
    }).addTo(camadaEu)
    pinoEu = L.circleMarker(centro, {
      radius: 7, color: '#fff', weight: 3,
      fillColor: '#e8552b', fillOpacity: 1, interactive: false
    }).addTo(camadaEu)
  } else {
    pinoEu.setLatLng(centro)
    haloEu?.setLatLng(centro)
    if (p.precisao) haloEu?.setRadius(p.precisao)
  }
}

/** Centraliza onde estou, sem mexer no traçado. */
function irParaMim() {
  if (!map || !eu.value) return
  map.setView([eu.value.lat, eu.value.lng], Math.max(map.getZoom(), 17))
}

onBeforeUnmount(() => {
  if (observador !== null) navigator.geolocation.clearWatch(observador)
  observador = null
  map?.remove(); map = null
})
</script>

<template>
  <div>
    <div class="modos">
      <button type="button" :class="{ on: modo === 'traco' }" @click="modo = 'traco'">
        <Icone nome="editar" /> Traçado
      </button>
      <button type="button" :class="{ on: modo === 'ponto' }" @click="modo = 'ponto'">
        <Icone nome="pino" /> Aviso / marcação
      </button>
      <!-- Só aparece com posição em mãos: botão que não faz nada é pior que
           botão nenhum. -->
      <button v-if="eu" type="button" class="onde" title="Onde estou" @click="irParaMim">
        <Icone nome="pino" />
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
        <option v-for="t in TIPOS_MARCA" :key="t[0]" :value="t[0]">{{ t[0] }}</option>
      </select>
    </template>

    <div class="dash">
      <div class="kpi"><b>{{ pontos.length }}</b><span>pontos</span></div>
      <div class="kpi"><b>{{ distTexto }}</b><span>distância</span></div>
      <div class="kpi">
        <b>{{ marcas.length }}<template v-if="props.limiteMarcas !== undefined && props.limiteMarcas !== -1">/{{ props.limiteMarcas }}</template></b>
        <span>marcações</span>
      </div>
    </div>

    <div ref="el" class="mapa" />

    <div class="acoes">
      <button type="button" class="btn sec" @click="desfazer"><Icone nome="desfazer" /> Desfazer</button>
      <button type="button" class="btn sec" @click="limpar"><Icone nome="excluir" /> Limpar</button>
    </div>
  </div>
</template>

<style scoped>
.mapa { height: 50vh; min-height: 300px; border-radius: 12px; border: 1px solid var(--linha); }
.onde { flex: none; width: 44px; color: var(--laranja-cl); }
.modos { display: flex; gap: 6px; margin-bottom: 6px; }
.modos button {
  flex: 1; padding: 9px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-weight: 600; font-size: 13px; color: var(--txt);
}
.modos button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.dica { margin-bottom: 8px; }
.dash { display: flex; gap: 8px; margin: 8px 0; }
.kpi { flex: 1; background: var(--card); border: 1px solid var(--linha); border-radius: 12px; padding: 8px; text-align: center; }
.kpi b { display: block; font-size: 16px; }
.kpi span { font-size: 11px; color: var(--osso-2); }
.acoes { display: flex; gap: 8px; margin-top: 10px; }
.acoes .btn { margin: 0; }
</style>

<style>
/* Fora do scoped: o Leaflet cria o divIcon fora da árvore do componente. */
.marca-rota { display: flex; align-items: center; justify-content: center; }
.marca-rota .ic-svg {
  width: 22px; height: 22px; stroke: #2f6ea8; stroke-width: 2;
  background: var(--card); border-radius: 50%; padding: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
}
</style>
