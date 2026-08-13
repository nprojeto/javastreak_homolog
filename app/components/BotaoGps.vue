<script setup lang="ts">
/**
 * Localização por GPS. Porte parcial de gpsButton/pegarGps.
 *
 * Três caminhos para a coordenada, e é preciso ter os três: GPS, endereço e
 * INDICAR NO MAPA.
 *
 * ⚠️ O "indicar no mapa" ficou pendente do lote 4 e passou tempo demais assim.
 * Sem ele, marcar uma ceva só era possível estando fisicamente nela — não dava
 * para preparar a temporada em casa, nem apontar a sede de uma propriedade a
 * 40 km. Como este componente é usado por sete telas (ceva, perfil, empresa,
 * canis, abate e os dois cadastros), o botão nasce nas sete de uma vez.
 *
 * ⚠️ Este componente NÃO valida a coordenada. Quem avisa que o ponto caiu fora
 * do limite é a tela, e quem recusa é o servidor. O `limite` que chega aqui é
 * repassado ao mapa só para orientar quem está escolhendo.
 */
import { useUi } from '~/stores/ui'
import { buscarEndereco } from '~/composables/useEndereco'
import type { Ponto } from '~/composables/useMapa'

const props = defineProps<{
  /** Partes do endereço para calcular a coordenada sem sair do lugar. */
  endereco?: Array<string | undefined>
  /** Limite da propriedade, repassado ao mapa como orientação. */
  limite?: Ponto[]
  /** Nome do limite, para o aviso dentro do mapa. */
  nomeLimite?: string
}>()

const lat = defineModel<string>('lat', { default: '' })
const lng = defineModel<string>('lng', { default: '' })

const ui = useUi()
const buscando = ref(false)
const geocodando = ref(false)
const noMapa = ref(false)

function escolheuNoMapa(p: Ponto) {
  lat.value = p.lat.toFixed(6)
  lng.value = p.lng.toFixed(6)
  noMapa.value = false
  ui.avisar('Ponto marcado no mapa ✔')
}

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
      <Icone nome="pino" /> {{ buscando ? 'Localizando…' : 'Minha localização' }}
    </button>
    <button
      v-if="temEndereco"
      type="button"
      class="btn sec"
      :disabled="geocodando"
      @click="pelaAddress"
    ><Icone nome="canil" /> {{ geocodando ? 'Buscando…' : 'Usar o endereço' }}</button>
  </div>

  <button
    v-if="!noMapa"
    type="button"
    class="btn sec no-mapa"
    @click="noMapa = true"
  ><Icone nome="mapa" /> Indicar no mapa</button>

  <ClientOnly>
    <MapaEscolherPonto
      v-if="noMapa"
      :lat="lat"
      :lng="lng"
      :limite="props.limite"
      :nome-limite="props.nomeLimite"
      @escolher="escolheuNoMapa"
      @fechar="noMapa = false"
    />
  </ClientOnly>

  <div v-if="!noMapa" class="meta">
    Marque no mapa, use o GPS onde você está, ou cole a coordenada à mão.
    O GPS precisa de HTTPS e de permissão do navegador.
  </div>
</template>

<style scoped>
.acoes { display: flex; gap: 8px; }
.acoes .btn { margin: 6px 0 0; }
.no-mapa { margin: 8px 0 0; width: 100%; }
.meta { margin-top: 6px; }
</style>
