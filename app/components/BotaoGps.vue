<script setup lang="ts">
/**
 * Localização por GPS. Porte parcial de gpsButton/pegarGps.
 *
 * ⚠️ FALTA aqui o "Indicar no mapa" (`abrirMapaPicker`), que é Leaflet e
 * chega no lote 4, junto com o resto do mapa. Até lá, quem não conseguir GPS
 * digita a coordenada à mão — os dois campos continuam editáveis, como no
 * legado.
 */
import { useUi } from '~/stores/ui'

const lat = defineModel<string>('lat', { default: '' })
const lng = defineModel<string>('lng', { default: '' })

const ui = useUi()
const buscando = ref(false)

function pegarGps() {
  if (!navigator.geolocation) {
    ui.avisar('Seu aparelho não oferece localização', 'erro')
    return
  }
  buscando.value = true
  navigator.geolocation.getCurrentPosition(
    (p) => {
      lat.value = p.coords.latitude.toFixed(6)
      lng.value = p.coords.longitude.toFixed(6)
      buscando.value = false
      ui.avisar('Localização preenchida ✔')
    },
    (e) => {
      buscando.value = false
      ui.avisar(
        e.code === e.PERMISSION_DENIED
          ? 'Permissão de localização negada — libere no navegador ou digite as coordenadas'
          : 'Não foi possível obter a localização',
        'erro'
      )
    },
    { enableHighAccuracy: true, timeout: 15000 }
  )
}
</script>

<template>
  <div class="two">
    <div>
      <label>Latitude *</label>
      <input v-model="lat" inputmode="decimal">
    </div>
    <div>
      <label>Longitude *</label>
      <input v-model="lng" inputmode="decimal">
    </div>
  </div>
  <button type="button" class="btn gps" :disabled="buscando" @click="pegarGps">
    📍 {{ buscando ? 'Localizando…' : 'Minha localização' }}
  </button>
  <div class="meta">
    O seletor no mapa chega junto com o mapa, no lote 4. Até lá dá para colar a
    coordenada à mão.
  </div>
</template>

<style scoped>
.meta { margin-top: 6px; }
</style>
