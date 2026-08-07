/**
 * Coordenada a partir do endereço, pelo Nominatim (OpenStreetMap).
 *
 * ⚠️ Não substitui o GPS: no campo o endereço quase nunca existe, e a
 * propriedade fica na estrada de terra. Serve para empresa e para quem está
 * cadastrando de casa — que é justamente quem não vai estar no lugar.
 *
 * ⚠️ Uso justo: uma consulta por clique, nunca ao digitar. O Nominatim é
 * gratuito e pede exatamente isso.
 */
export interface Achado { lat: string; lng: string; rotulo: string }

export async function buscarEndereco(partes: Array<string | undefined>): Promise<Achado | null> {
  const q = partes.filter(Boolean).join(', ').trim()
  if (q.length < 5) return null
  const url = 'https://nominatim.openstreetmap.org/search'
    + '?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(q)
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('Serviço de endereço indisponível')
  const l = await r.json()
  if (!Array.isArray(l) || !l.length) return null
  return {
    lat: Number(l[0].lat).toFixed(6),
    lng: Number(l[0].lon).toFixed(6),
    rotulo: String(l[0].display_name || '')
  }
}
