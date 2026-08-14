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
import type { Map as MapaLeaflet, FeatureGroup, CircleMarker, Circle, Polyline, Marker } from 'leaflet'
import { addBase, carregarLeaflet, rumo } from '~/composables/useMapa'
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
  /** Ligado, o toque no mapa vira escolha de ponto em vez de arrastar. */
  escolhendo?: boolean
  /** Ponto em edição, desenhado como alvo até ser salvo. */
  pontoNovo?: Ponto | null
  /** Para onde o aparelho aponta, 0–360 do norte. `null` = sem bússola. */
  rumoAparelho?: number | null
  /** Ponto da rota a alcançar. Vira a seta laranja e o tracejado. */
  alvo?: Ponto | null
}>()

const emit = defineEmits<{ escolher: [Ponto]; arrastou: [] }>()

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
let camadaNovo: FeatureGroup | null = null // ponto em edição
let pinoEu: CircleMarker | null = null
let halo: Circle | null = null
let cone: Marker | null = null        // setor da bússola
let setaAlvo: Marker | null = null    // para onde caminhar
let linhaAlvo: Polyline | null = null // tracejado até a rota
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

/**
 * Posição: halo da precisão, cone da bússola, pino e a seta do rumo.
 *
 * ⚠️ O mapa é NORTE ACIMA (o Leaflet não gira), então tanto o cone quanto a
 * seta usam o rumo ABSOLUTO, sem descontar nada. Girar por rumo relativo aqui
 * é o erro clássico: funciona com o celular apontado ao norte e erra em todo
 * o resto.
 *
 * ⚠️ Move em vez de redesenhar. Recriar as camadas a cada passo do GPS faz o
 * pino piscar, e piscar de dois em dois segundos numa tela que fica aberta a
 * caminhada inteira é insuportável.
 */
async function desenharEu() {
  const L = await carregarLeaflet()
  if (!map || !camadaEu) return
  const p = props.eu
  if (!p) {
    camadaEu.clearLayers()
    pinoEu = null; halo = null; cone = null; setaAlvo = null; linhaAlvo = null
    return
  }
  const centro: [number, number] = [p.lat, p.lng]

  if (!pinoEu) {
    halo = L.circle(centro, {
      radius: p.precisao || 0, color: '#e8552b', weight: 1,
      fillColor: '#e8552b', fillOpacity: 0.12, interactive: false
    }).addTo(camadaEu)
    cone = L.marker(centro, {
      interactive: false, zIndexOffset: 500,
      icon: L.divIcon({ className: 'guia-cone', html: htmlCone(), iconSize: [64, 64], iconAnchor: [32, 32] })
    }).addTo(camadaEu)
    pinoEu = L.circleMarker(centro, {
      radius: 8, color: '#fff', weight: 3, fillColor: '#e8552b', fillOpacity: 1, interactive: false
    }).addTo(camadaEu)
  } else {
    pinoEu.setLatLng(centro)
    halo?.setLatLng(centro)
    cone?.setLatLng(centro)
    if (p.precisao) halo?.setRadius(p.precisao)
  }

  /* O cone só existe quando há bússola: sem rumo, um cone apontando para um
     lado qualquer é pior que cone nenhum — a pessoa acredita nele. */
  const el = cone?.getElement()?.firstElementChild as HTMLElement | undefined
  if (el) {
    const r = props.rumoAparelho
    el.style.display = r === null || r === undefined ? 'none' : 'block'
    if (r !== null && r !== undefined) el.style.transform = 'rotate(' + r + 'deg)'
  }

  desenharAlvo(L, centro)

  if (props.seguir) map.panTo(centro, { animate: true, duration: 0.5 })
}

/**
 * Cone de visada: setor translúcido mais uma ponta SÓLIDA.
 *
 * ⚠️ Só o gradiente não lê sobre imagem de satélite — verde escuro e sombra
 * de mata comem um laranja a 55% de opacidade, e o que sobra é uma mancha que
 * ninguém identifica como direção. A ponta sólida com contorno branco é o que
 * faz a direção do aparelho ser vista de relance.
 *
 * O desenho aponta para CIMA em zero grau, igual à agulha da faixa.
 */
function htmlCone() {
  return '<div class="cone-gira"><svg viewBox="0 0 64 64" width="64" height="64">'
    + '<defs><radialGradient id="jsCone" cx="50%" cy="50%" r="50%">'
    + '<stop offset="30%" stop-color="#e8552b" stop-opacity=".6"/>'
    + '<stop offset="100%" stop-color="#e8552b" stop-opacity="0"/>'
    + '</radialGradient></defs>'
    + '<path d="M32 32 L14 2 A34 34 0 0 1 50 2 Z" fill="url(#jsCone)"/>'
    + '<path d="M32 3 L39 17 L32 13.5 L25 17 Z" fill="#e8552b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>'
    + '</svg></div>'
}

/**
 * Seta laranja para onde caminhar, mais o tracejado até o ponto da rota.
 * A seta fica NA BORDA do pino, não no meio do caminho: quem olha de relance
 * lê "para lá", que é a única coisa que precisa ler.
 */
function desenharAlvo(L: Awaited<ReturnType<typeof carregarLeaflet>>, centro: [number, number]) {
  if (!camadaEu) return
  const alvo = props.alvo
  if (!alvo) {
    if (setaAlvo) { camadaEu.removeLayer(setaAlvo); setaAlvo = null }
    if (linhaAlvo) { camadaEu.removeLayer(linhaAlvo); linhaAlvo = null }
    return
  }
  const destino: [number, number] = [alvo.lat, alvo.lng]
  const ang = rumo({ lat: centro[0], lng: centro[1] }, alvo)

  if (!linhaAlvo) {
    linhaAlvo = L.polyline([centro, destino], {
      color: '#e8552b', weight: 2, dashArray: '6 6', opacity: 0.9, interactive: false
    }).addTo(camadaEu)
  } else {
    linhaAlvo.setLatLngs([centro, destino])
  }

  /* O giro fica no invólucro e o deslocamento na seta: girando o conjunto,
     ela descreve um anel em volta do pino e sempre aponta para fora. Girar a
     seta já deslocada a faria orbitar sobre si mesma, apontando para dentro
     em metade das direções. */
  const html = '<div class="seta-gira" style="transform:rotate(' + ang + 'deg)">'
    + '<svg viewBox="0 0 24 24" width="26" height="26">'
    + '<path d="M12 1 L20 21 L12 16 L4 21 Z" fill="#e8552b" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>'
    + '</svg></div>'
  if (!setaAlvo) {
    setaAlvo = L.marker(centro, {
      interactive: false, zIndexOffset: 600,
      icon: L.divIcon({ className: 'guia-seta-alvo', html, iconSize: [72, 72], iconAnchor: [36, 36] })
    }).addTo(camadaEu)
  } else {
    setaAlvo.setLatLng(centro)
    const e = setaAlvo.getElement()?.firstElementChild as HTMLElement | undefined
    if (e) e.style.transform = 'rotate(' + ang + 'deg)'
  }
}

/** Alvo do ponto em edição: um anel, para não se confundir com pino salvo. */
async function desenharNovo() {
  const L = await carregarLeaflet()
  if (!map || !camadaNovo) return
  camadaNovo.clearLayers()
  const p = props.pontoNovo
  if (!p) return
  L.circleMarker([p.lat, p.lng], {
    radius: 13, color: '#e8552b', weight: 3, fill: false, interactive: false
  }).addTo(camadaNovo)
  L.circleMarker([p.lat, p.lng], {
    radius: 4, color: '#e8552b', weight: 2, fillColor: '#e8552b', fillOpacity: 1, interactive: false
  }).addTo(camadaNovo)
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

/**
 * Centraliza na posição com zoom de trabalho.
 *
 * ⚠️ Zoom 19 é ~20 m de largura visível num celular — é a escala em que dá
 * para ver a divisa da mata e a trilha ao lado. `setView` em vez de `panTo`
 * porque o ponto é justamente mudar o zoom junto, e não só arrastar.
 */
async function centralizar(zoom = 19) {
  const L = await carregarLeaflet()
  if (!map || !props.eu) return
  map.setView([props.eu.lat, props.eu.lng], zoom, { animate: true })
  void L
}

defineExpose({ enquadrar, centralizar })

watch(() => [props.limites, props.rotas, props.cevas, props.marcacoes], desenharBase, { deep: true })
watch(() => [props.eu, props.rumoAparelho, props.alvo], desenharEu, { deep: true })
watch(() => props.pontoNovo, desenharNovo, { deep: true })

/**
 * ⚠️ `invalidateSize` quando o modo de escolha entra ou sai. Ligá-lo insere um
 * aviso logo abaixo do mapa e muda a altura disponível na tela; sem recalcular,
 * o Leaflet continua com as medidas antigas e desenha telha e marcador fora do
 * lugar — o que aparece como mapa "vazando" por cima do que vem depois.
 */
watch(() => props.escolhendo, () => {
  setTimeout(() => map?.invalidateSize(), 60)
})

onMounted(async () => {
  const L = await carregarLeaflet()
  if (!el.value) return
  map = L.map(el.value, { preferCanvas: true, zoomControl: true }).setView([-15.78, -47.93], 4)
  /* Satélite por padrão: no mato, a imagem diz mais que o mapa de ruas. */
  await addBase(map, 'sat')
  base = L.featureGroup().addTo(map)
  camadaEu = L.featureGroup().addTo(map)
  camadaNovo = L.featureGroup().addTo(map)
  /* ⚠️ O toque só vira ponto no modo de escolha. Fora dele, tocar no mapa não
     pode marcar nada: quem está andando encosta na tela o tempo todo. */
  /* ⚠️ `dragstart`, não `move`: `move` dispara também quando o `panTo` do
     seguimento mexe o mapa, e o seguimento se desligaria sozinho no primeiro
     passo. `dragstart` só acontece com o dedo. */
  map.on('dragstart', () => emit('arrastou'))
  map.on('click', (ev: { latlng: { lat: number; lng: number } }) => {
    if (!props.escolhendo) return
    emit('escolher', { lat: ev.latlng.lat, lng: ev.latlng.lng })
  })
  setTimeout(() => { map?.invalidateSize(); desenharBase(); desenharEu(); desenharNovo() }, 150)
})

onBeforeUnmount(() => { map?.remove(); map = null })
</script>

<template>
  <div ref="el" class="mapa" :class="{ escolhendo: props.escolhendo }" :style="{ height: props.altura || '58vh' }" />
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

/* Cone da bússola e seta do rumo. O giro é no invólucro; a seta fica
   deslocada para cima DENTRO dele, e por isso orbita o pino. */
.guia-cone, .guia-seta-alvo { background: none; border: 0; }
.cone-gira { width: 64px; height: 64px; transform-origin: 50% 50%; transition: transform .25s linear; }
.seta-gira {
  width: 72px; height: 72px; transform-origin: 50% 50%;
  display: flex; justify-content: center; align-items: flex-start;
  transition: transform .25s linear;
}
.seta-gira svg { margin-top: 6px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
</style>

<style scoped>
/* ⚠️ `touch-action: none` entrega o gesto ao Leaflet. Sem isso o navegador
   disputa a pinça com o mapa e acaba zoomando a página. */
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
  border-radius: 12px; border: 1px solid var(--linha); touch-action: none;
}
.mapa.escolhendo { border-color: var(--laranja-cl); box-shadow: 0 0 0 2px rgba(255, 122, 26, .25); cursor: crosshair; }
</style>
