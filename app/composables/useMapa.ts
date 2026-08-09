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

  /**
   * ⚠️ `maxNativeZoom` mais baixo que `maxZoom` é o que faz o mapa NÃO SUMIR
   * no zoom fundo: o Leaflet para de pedir imagem nova e amplia a última que
   * tem. Sem isso, no interior o Esri devolve um quadrado cinza escrito
   * "Map data not yet available" — que é resposta válida, não erro, então
   * nenhum tratamento de falha pega.
   *
   * O satélite fica em 18 porque em área rural o Esri raramente tem imagem
   * além disso. Ampliar um pouco borrado é melhor que ficar cinza.
   */
  const ruas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19, maxZoom: 20, attribution: '© OpenStreetMap'
  })
  const sat: LayerGroup = L.layerGroup([
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 18, maxZoom: 20, attribution: 'Imagery © Esri' }
    ),
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 18, maxZoom: 20, attribution: 'Labels © Esri' }
    )
  ])

  const camadas = { ruas, sat }
  let atual: 'ruas' | 'sat' = padrao === 'sat' ? 'sat' : 'ruas'
  camadas[atual].addTo(map)
  try { map.setMaxZoom(20) } catch { /* versão sem setMaxZoom */ }

  const ctl = new L.Control({ position: 'topright' })
  ctl.onAdd = () => {
    const d = L.DomUtil.create('div', 'js-camadas')
    /* O controle vive fora da árvore do Vue, então o ícone do sprite vai
       como texto — o `<use>` acha o símbolo mesmo assim, porque o sprite é
       montado uma vez no layout. */
    const ic = (n: string) =>
      '<svg class="ic-svg" aria-hidden="true"><use href="#js-' + n + '"/></svg>'
    d.innerHTML =
      '<button type="button" data-c="ruas">' + ic('b10') + 'Ruas</button>' +
      '<button type="button" data-c="sat">' + ic('d9') + 'Satélite</button>'
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

/** Metros entre dois pontos, plano local. Basta: aqui nada passa de km. */
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = (b.lat - a.lat) * 110574
  const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * Distância até o traçado — perpendicular ao segmento mais próximo, não ao
 * vértice mais próximo. A diferença importa: num trecho reto e longo, medir
 * pelo vértice diria "300 m fora da rota" para quem está caminhando em cima
 * dela.
 */
export function distanciaARota(pt: Ponto, rota: Ponto[]): number {
  if (!rota || !rota.length) return Infinity
  if (rota.length === 1) return distanciaM(pt, rota[0]!)
  const mLat = 110574
  const mLng = 111320 * Math.cos((pt.lat * Math.PI) / 180)
  const px = pt.lng * mLng, py = pt.lat * mLat
  let melhor = Infinity
  for (let i = 1; i < rota.length; i++) {
    const ax = rota[i - 1]!.lng * mLng, ay = rota[i - 1]!.lat * mLat
    const bx = rota[i]!.lng * mLng, by = rota[i]!.lat * mLat
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    /* Segmento de comprimento zero (vértice repetido): cai no ponto. */
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    const qx = ax + t * dx, qy = ay + t * dy
    const d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy))
    if (d < melhor) melhor = d
  }
  return melhor
}

/** Distância legível: metros até 1 km, depois km com uma casa. */
export function fmtDist(m: number): string {
  if (!isFinite(m)) return '—'
  if (m < 1000) return Math.round(m) + ' m'
  return (m / 1000).toFixed(1).replace('.', ',') + ' km'
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
