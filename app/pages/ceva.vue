<script setup lang="ts">
/**
 * Nova ceva / editar. Porte de VIEWS.cevaForm + salvarCeva (index.html, 8215).
 *
 * ⚠️ A ceva nasce presa a uma propriedade REGULAR, com o ponto DENTRO do
 * desenho. As conferências aqui são só para a pessoa não esperar o ida-e-volta:
 * a regra que vale é a do servidor (`checarCevaNaPropriedade_`), que recusa
 * com `PROP_IRREGULAR`, `PROP_SEM_LIMITE` ou `FORA_DA_PROPRIEDADE`.
 *
 * ⚠️ Propriedade irregular APARECE no seletor, marcada. Esconder faria a
 * pessoa procurar uma propriedade que ela sabe que cadastrou.
 */
import { useUi } from '~/stores/ui'
import { pontoDentro } from '~/composables/useMapa'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'

definePageMeta({ layout: 'app' })

const TIPOS = ['Árvore', 'Banco', 'Standart', 'Plataforma', 'Chão', 'Mangueiro', 'Outro']

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const props_ = ref<Propriedade[]>([])
const erro = ref('')
const pronto = ref(false)

const nome = ref('')
const propId = ref('')
const tipo = ref(TIPOS[0]!)
const lat = ref('')
const lng = ref('')
const obs = ref('')
const foto = ref('')
const fotoAtual = ref('')
const salvando = ref(false)

const prop = computed(() => props_.value.find((p) => p.id === propId.value) || null)

const avisoProp = computed(() => {
  const p = prop.value
  if (!p) return ''
  if (!p.temLimite) return 'Esta propriedade não tem limite desenhado e não pode receber ceva.'
  if (!p.regular) return 'Esta propriedade está irregular (autorização vencida ou faltando) e não pode receber ceva.'
  return ''
})

const foraDoLimite = computed(() => {
  const p = prop.value
  const la = parseFloat(lat.value), ln = parseFloat(lng.value)
  if (!p?.temLimite || isNaN(la) || isNaN(ln)) return false
  return !pontoDentro({ lat: la, lng: ln }, p.limite || [])
})

async function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { foto.value = ''; return }
  try {
    const a = await lerArquivo(f, { tipos: ['image/jpeg', 'image/png', 'image/webp'], maxMb: FOTO_MAX_MB })
    foto.value = a.dados
  } catch (err) {
    foto.value = ''
    ui.avisar(err instanceof Error ? err.message : 'Imagem inválida', 'erro')
  }
}

onMounted(async () => {
  try {
    props_.value = await server<Propriedade[]>('apiListarPropriedades')
    if (id.value) {
      const l = await server<Ceva[]>('apiListarCevas')
      const c = (l || []).find((x) => x.id === id.value)
      if (!c) { erro.value = 'Ceva não encontrada'; return }
      nome.value = c.nome || ''
      propId.value = c.propriedadeId || ''
      tipo.value = c.tipo || TIPOS[0]!
      lat.value = String(c.lat ?? '')
      lng.value = String(c.lng ?? '')
      obs.value = c.obs || ''
      fotoAtual.value = c.fotoUrl || ''
    }
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o formulário'
  }
})

async function salvar() {
  if (!nome.value) { ui.avisar('Informe o nome', 'erro'); return }
  if (!prop.value) { ui.avisar('Escolha a propriedade onde fica esta ceva', 'erro'); return }
  if (avisoProp.value) { ui.avisar(avisoProp.value, 'erro'); return }
  if (!lat.value || !lng.value) { ui.avisar('Marque a localização da ceva', 'erro'); return }
  if (foraDoLimite.value) {
    ui.avisar('Este ponto está fora do limite desenhado de ' + (prop.value.nome || ''), 'erro')
    return
  }

  salvando.value = true
  try {
    const d = {
      nome: nome.value, tipo: tipo.value, lat: lat.value, lng: lng.value,
      obs: obs.value, foto: foto.value, propriedadeId: prop.value.id
    }
    if (id.value) await server('apiEditar', 'ceva', id.value, d)
    else await server('apiCriarCeva', d)
    ui.avisar('Ceva salva ✔')
    await router.push('/espera')
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <TituloTela titulo="Ceva" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!pronto" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3>{{ id ? 'Editar ceva' : 'Nova ceva' }}</h3>

        <label for="c_nome">Nome / identificação *</label>
        <input id="c_nome" v-model="nome" class="no-i18n" placeholder="Ex: Ceva do Riacho">

        <label for="c_prop">Propriedade *</label>
        <select id="c_prop" v-model="propId">
          <option value="">— escolha a propriedade —</option>
          <option v-for="p in props_" :key="p.id" :value="p.id">
            {{ p.nome }}{{ p.regular ? '' : (p.temLimite ? ' (irregular)' : ' (sem limite)') }}
          </option>
        </select>
        <div v-if="avisoProp" class="meta ruim aviso"><Icone nome="alerta" /> {{ avisoProp }}</div>

        <label for="c_tipo">Tipo de ponto *</label>
        <select id="c_tipo" v-model="tipo">
          <option v-for="t in TIPOS" :key="t">{{ t }}</option>
        </select>

        <BotaoGps v-model:lat="lat" v-model:lng="lng" />
        <div v-if="foraDoLimite" class="meta ruim aviso">
          <Icone nome="alerta" /> Este ponto está fora do limite desenhado de {{ prop?.nome }}
        </div>

        <label for="c_obs">Observações</label>
        <textarea id="c_obs" v-model="obs" class="no-i18n" />

        <label for="c_foto">Foto do comedouro / ponto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <img v-else-if="fotoAtual" :src="fotoAtual" class="prev" alt="Foto atual">
        <input id="c_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar ceva' }}
        </button>
        <NuxtLink to="/espera" class="btn sec">Cancelar</NuxtLink>
      </div>

      <div v-if="prop?.temLimite" class="card">
        <h3>Onde a ceva vai ficar</h3>
        <div class="meta">O ponto precisa cair dentro da área verde.</div>
        <ClientOnly>
          <MapaPontos
            :limites="[{ nome: prop.nome, pontos: prop.limite }]"
            :pinos="lat && lng ? [{ lat: Number(lat), lng: Number(lng), titulo: nome || 'Ceva' }] : []"
          />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; }
.ruim { color: var(--danger); }
.aviso { margin: -4px 0 8px; }
.prev { max-width: 160px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
