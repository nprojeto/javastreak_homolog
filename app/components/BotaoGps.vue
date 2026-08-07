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
import { buscarEndereco } from '~/composables/useEndereco'

const props = defineProps<{
  /** Partes do endereço para calcular a coordenada sem sair do lugar. */
  endereco?: Array<string | undefined>
}>()

const lat = defineModel<string>('lat', { default: '' })
const lng = defineModel<string>('lng', { default: '' })

const ui = useUi()
const buscando = ref(false)
const geocodando = ref(false)

const temEndereco = computed(
  () => (props.endereco || []).filter(Boolean).join(', ').trim().length >= 5
)

/** Calcula a coordenada a partir do endereço já digitado. */
async function pelaAddress() {
  geocodando.value = true
  try {
    const a = await buscarEndereco(props.endereco || [])
    if (!a) { ui.avisar('Endereço não encontrado — confira ou use o GPS', 'erro'); return }
    lat.value = a.lat
    lng.value = a.lng
    ui.avisar('Coordenada preenchida pelo endereço ✔')
  } catch (e) {
    ui.avisar(e instanceof Error ? e.message : 'Não foi possível buscar o endereço', 'erro')
  } finally {
    geocodando.value = false
  }
}

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
  <div class="acoes">
    <button type="button" class="btn gps" :disabled="buscando" @click="pegarGps">
      📍 {{ buscando ? 'Localizando…' : 'Minha localização' }}
    </button>
    <button
      v-if="temEndereco"
      type="button"
      class="btn sec"
      :disabled="geocodando"
      @click="pelaAddress"
    >🏠 {{ geocodando ? 'Buscando…' : 'Usar o endereço' }}</button>
  </div>
  <div class="meta">
    O GPS precisa de HTTPS e de permissão do navegador. Sem ele, use o endereço
    ou cole a coordenada à mão.
  </div>
</template>

<style scoped>
.acoes { display: flex; gap: 8px; }
.acoes .btn { margin: 6px 0 0; }
.meta { margin-top: 6px; }
</style>
