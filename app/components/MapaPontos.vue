<script setup lang="ts">
/**
 * Mapa só de leitura: limites de propriedade e pinos.
 * Porte de desenharPropDaCeva + desenharLimitesEm (index.html, 8259 / 5949).
 *
 * Reaproveitado pela ceva, pela rota e, mais adiante, pelo mapa geral.
 */
import type { Map as MapaLeaflet, FeatureGroup } from 'leaflet'
import { addBase, carregarLeaflet } from '~/composables/useMapa'
import { simboloDe } from '~/composables/useIcones'
import type { Ponto } from '~/composables/useMapa'

export interface Limite { nome: string; pontos: Ponto[] }
export interface Pino {
  lat: number; lng: number; titulo?: string; cor?: string
  /** Linhas extras do balão: o que aconteceu naquele ponto. */
  linhas?: string[]
  /** Foto do pino: perfil da pessoa, logo da loja. */
  foto?: string
  /** Ícone do sistema, quando não há foto. */
  icone?: string
  /** Botões do balão. O rótulo é traduzido pelo chamador. */
  acoes?: Array<{ rotulo: string; url: string }>
  /**
   * Item que o pino representa. Com isto, tocar no pino AVISA a tela em vez de
   * abrir balão — é o que leva o painel da ceva para o mapa, em vez de deixá-lo
   * numa aba que ninguém abre no meio do mato.
   */
  sel?: { tipo: 'ceva' | 'rota'; id: string }
  /**
   * Índice 0–100 mostrado NO pino, como a etiqueta da imagem do legado.
   * É o que faz o mapa responder "qual delas hoje?" sem abrir nada.
   */
  indice?: number | null
}

export interface RotaMapa {
  nome?: string; pontos: Ponto[]; cor?: string; linhas?: string[]
  sel?: { tipo: 'ceva' | 'rota'; id: string }
}

const props = withDefaults(defineProps<{
  limites?: Limite[]
  pinos?: Pino[]
  tracado?: Ponto[]
  /** Rotas desenhadas com balão — o `tracado` continua para o caso simples. */
  rotas?: RotaMapa[]
  altura?: string
  /**
   * ⚠️ Reenquadrar a cada redesenho arrasta o mapa de volta enquanto a pessoa
   * está olhando outro canto — foi o que acontecia no mapa da rede, onde os
   * dados chegam em partes e cada chegada puxava a vista de volta. Ligado,
   * enquadra SÓ na primeira vez que houver o que mostrar; o resto é do dedo.
   */
  enquadrarUmaVez?: boolean
}>(), { altura: '38vh' })

const emit = defineEmits<{
  pronto: []
  selecionar: [{ tipo: 'ceva' | 'rota'; id: string; nome: string }]
}>()

/** Já enquadrou uma vez? Ver `enquadrarUmaVez`. */
let enquadrou = false

/**
 * Gota com foto ou ícone dentro. A cor da borda é a do tipo — é ela que
 * diferencia ceva de rota de loja num relance, mesmo com foto no meio.
 */
function pinoHtml(p: Pino) {
  const cor = p.cor || '#b8863b'
  const miolo = p.foto
    ? '<img src="' + esc(p.foto) + '" alt="">'
    /* `simboloDe` traduz o nome para o id do sprite — o mesmo caminho do
       componente `<Icone>`, para um nome errado não virar pino vazio. */
    : '<svg><use href="#' + esc(simboloDe(p.icone || 'painel')) + '"/></svg>'
  /* A etiqueta pega a cor da faixa, não do tipo: é ela que se lê de longe. */
  const et = (p.indice === null || p.indice === undefined) ? ''
    : '<span class="js-et js-et-' + faixaDoIndice(p.indice) + '">' + p.indice + '</span>'
  return '<span class="js-gota" style="--pc:' + esc(cor) + '">'
    + '<span class="js-face">' + miolo + '</span>' + et + '</span>'
}

/** Três faixas, as mesmas do painel — para o pino e o painel não discordarem. */
function faixaDoIndice(v: number) {
  return v >= 60 ? 'alta' : v >= 30 ? 'media' : 'baixa'
}

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
    const linha = L.polyline(r.pontos.map((p) => [p.lat, p.lng] as [number, number]), {
      color: r.cor || '#2f6ea8', weight: 4
    })
    linha.addTo(camada)
    if (r.sel) {
      const s = r.sel, t = r.nome || 'Rota'
      linha.on('click', () => emit('selecionar', { tipo: s.tipo, id: s.id, nome: t }))
    } else {
      linha.bindPopup('<b>' + esc(r.nome || 'Rota') + '</b>' + extra)
    }
  }

  for (const p of props.pinos || []) {
    const extra = (p.linhas || []).map((l) => '<br>' + esc(l)).join('')
    const botoes = (p.acoes || []).map((a) =>
      '<a class="js-bt" href="' + esc(a.url) + '" target="_blank" rel="noopener">'
      + esc(a.rotulo) + '</a>').join('')
    const balao = '<b>' + esc(p.titulo || '') + '</b>' + extra
      + (botoes ? '<div class="js-bts">' + botoes + '</div>' : '')

    /* Foto ou ícone viram um pino DESENHADO; sem os dois, o círculo simples
       de sempre. Marcador com conteúdo é muito mais fácil de achar no meio de
       um mapa de satélite que uma bolinha de 8 px. */
    const alvo = p.foto || p.icone
      ? L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'js-pino',
          html: pinoHtml(p),
          iconSize: [44, 52],
          iconAnchor: [22, 50],
          popupAnchor: [0, -46]
        })
      })
      : L.circleMarker([p.lat, p.lng], {
        radius: 8, color: '#fff', weight: 2,
        fillColor: p.cor || '#b8863b', fillOpacity: 1
      })
    alvo.addTo(camada)
    /* ⚠️ Pino com `sel` NÃO abre balão: o toque leva ao painel completo, e um
       balão por cima só atrapalharia a leitura do que abre embaixo. */
    if (p.sel) {
      const s = p.sel, t = p.titulo || ''
      alvo.on('click', () => emit('selecionar', { tipo: s.tipo, id: s.id, nome: t }))
    } else {
      alvo.bindPopup(balao)
    }
  }

  /* Enquadra tudo o que existe. Sem nada, fica na visão do Brasil. */
  if (props.enquadrarUmaVez && enquadrou) return
  try {
    const b = camada.getBounds()
    if (b.isValid()) {
      map.fitBounds(b, { padding: [30, 30], maxZoom: 16 })
      enquadrou = true
    }
  } catch { /* camada vazia */ }
}

/** Reenquadra sob demanda — é o botão "ver tudo" da tela. */
function enquadrar() {
  if (!map || !camada) return
  try {
    const b = camada.getBounds()
    if (b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 16 })
  } catch { /* camada vazia */ }
}

defineExpose({ enquadrar, mapa: () => map })

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

<style>
/* ⚠️ SEM `scoped`. Pino e balão nascem dentro do Leaflet, fora da árvore do
   Vue, e um seletor com hash não os alcançaria. */
.js-pino { background: none; border: 0; }

/* Gota: círculo com a foto e uma ponta embaixo, apontando o lugar exato. */
.js-gota {
  position: relative; display: block; width: 44px; height: 44px;
  border-radius: 50%; background: var(--pc, #b8863b);
  box-shadow: 0 2px 6px rgba(0, 0, 0, .45);
}
/* A ponta é um quadrado girado, coberto pela metade de baixo do círculo. */
.js-gota::after {
  content: ''; position: absolute; left: 50%; bottom: -4px;
  width: 14px; height: 14px; margin-left: -7px;
  background: var(--pc, #b8863b); transform: rotate(45deg); border-radius: 2px;
}
.js-face {
  position: absolute; inset: 3px; border-radius: 50%; overflow: hidden;
  background: #201E17; display: flex; align-items: center; justify-content: center;
  z-index: 1;
}
.js-face img { width: 100%; height: 100%; object-fit: cover; display: block; }
.js-face svg {
  width: 22px; height: 22px; stroke: var(--pc, #b8863b);
  fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}

/* Etiqueta do índice, pendurada na base da gota. */
.js-et {
  position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
  z-index: 2; min-width: 22px; padding: 1px 5px;
  border-radius: 999px; border: 2px solid #fff;
  font: 700 11px/1.3 system-ui, sans-serif; text-align: center; color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .5);
}
.js-et-alta { background: #2f7d3a; }
.js-et-media { background: #C8892B; }
.js-et-baixa { background: #8A8375; }

/* Botões do balão: WhatsApp, ver loja. */
.js-bts { display: flex; gap: 6px; margin-top: 8px; }
.js-bt {
  flex: 1; text-align: center; text-decoration: none;
  font-size: 11.5px; font-weight: 700; padding: 6px 8px; border-radius: 8px;
  background: #E8552B; color: #fff;
}
.js-bt + .js-bt { background: none; color: #E8552B; border: 1px solid #E8552B; }
</style>

<style scoped>
.mapa { min-height: 240px; border-radius: 12px; border: 1px solid var(--linha); }
</style>
