/**
 * Base do mapa. Porte de addBase (index.html, 10649).
 *
 * Duas camadas, como no legado: Ruas e Satélite. O "satélite" é a imagem do
 * Esri COM os rótulos por cima — satélite puro esconde nome de rua e bairro
 * justamente na camada mais útil no campo.
 *
 * O controle de camadas é próprio, com dois botões grandes, em vez do
 * seletor miúdo do Leaflet: isso aqui é usado com o dedo, no mato.
 */
import type { Map as MapaLeaflet, LayerGroup } from 'leaflet'

export async function carregarLeaflet() {
  const L = (await import('leaflet')).default
  return L
}

export async function addBase(map: MapaLeaflet, padrao: 'ruas' | 'sat' = 'ruas') {
  const L = await carregarLeaflet()

  const ruas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19, maxZoom: 21, attribution: '© OpenStreetMap'
  })
  const sat: LayerGroup = L.layerGroup([
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 21, attribution: 'Imagery © Esri' }
    ),
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 21, attribution: 'Labels © Esri' }
    )
  ])

  const camadas = { ruas, sat }
  let atual: 'ruas' | 'sat' = padrao === 'sat' ? 'sat' : 'ruas'
  camadas[atual].addTo(map)
  try { map.setMaxZoom(21) } catch { /* versão sem setMaxZoom */ }

  const ctl = new L.Control({ position: 'topright' })
  ctl.onAdd = () => {
    const d = L.DomUtil.create('div', 'js-camadas')
    d.innerHTML =
      '<button type="button" data-c="ruas">🗺️ Ruas</button>' +
      '<button type="button" data-c="sat">🛰️ Satélite</button>'
    const pintar = () => {
      for (const b of Array.from(d.getElementsByTagName('button'))) {
        b.className = b.getAttribute('data-c') === atual ? 'on' : ''
      }
    }
    L.DomEvent.disableClickPropagation(d)
    d.onclick = (ev) => {
      const alvo = (ev.target as HTMLElement).getAttribute('data-c') as 'ruas' | 'sat' | null
      if (!alvo || alvo === atual) return
      map.removeLayer(camadas[atual])
      atual = alvo
      camadas[atual].addTo(map)
      pintar()
    }
    pintar()
    return d
  }
  ctl.addTo(map)
  return camadas
}

export interface Ponto { lat: number; lng: number }

/**
 * Área aproximada em m², pela fórmula do shoelace com os graus convertidos
 * para metros na latitude média. Porte de areaPoligono.
 */
export function areaPoligono(pts: Ponto[]): number {
  if (!pts || pts.length < 3) return 0
  const latRef = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const mLat = 110574
  const mLng = 111320 * Math.cos((latRef * Math.PI) / 180)
  let soma = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    soma += (a.lng * mLng) * (b.lat * mLat) - (b.lng * mLng) * (a.lat * mLat)
  }
  return Math.abs(soma / 2)
}

export function fmtArea(m2: number): string {
  if (!m2) return '—'
  const ha = m2 / 10000
  if (ha < 1) return Math.round(m2) + ' m²'
  if (ha < 1000) return ha.toFixed(1).replace('.', ',') + ' ha'
  return (ha / 100).toFixed(1).replace('.', ',') + ' km²'
}

/**
 * Ponto dentro do polígono, por lançamento de raio. Gêmeo do `pontoDentro_`
 * do backend — e é o do SERVIDOR que vale. Este aqui é conveniência: avisa
 * antes de a pessoa mandar algo que seria recusado.
 */
export function pontoDentro(pt: Ponto, poly: Ponto[]): boolean {
  if (!pt || !poly || poly.length < 3) return false
  const x = Number(pt.lng), y = Number(pt.lat)
  if (!isFinite(x) || !isFinite(y)) return false
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = Number(poly[i]!.lng), yi = Number(poly[i]!.lat)
    const xj = Number(poly[j]!.lng), yj = Number(poly[j]!.lat)
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}
