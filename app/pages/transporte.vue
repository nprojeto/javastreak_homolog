<script setup lang="ts">
/**
 * Ficha do transporte: manutenções (garagem e marina) ou saúde (haras).
 * Porte de VIEWS.transpDetail + manutForm + saudeForm do cavalo
 * (index.html, 8397-8470).
 *
 * ⚠️ A tela escolhe o que mostrar pelo TIPO, não por um campo separado:
 * cavalo tem saúde e casqueamento; carro e barco têm revisão e troca de peça.
 * O legado errou isso uma vez e mostrou "IPVA" para cavalo.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Transporte } from '~/pages/manutencao.vue'

definePageMeta({ layout: 'app' })

const TIPOS_MANUT = ['Revisão', 'Troca de óleo', 'Filtros', 'Pneus', 'Freios',
  'Correia dentada', 'Bateria', 'Motor', 'Hélice', 'Casco', 'Elétrica',
  'Suspensão', 'Lavagem', 'Outro']
const TIPOS_SAUDE_CAVALO = ['Vacina', 'Vermífugo', 'Ferrageamento', 'Casqueamento',
  'Consulta', 'Exame', 'Odontológico', 'Medicação', 'Outro']

interface Manutencao {
  id: string; tipo: string; data?: string; km?: string
  proximaData?: string; proximoKm?: string; obs?: string
}
interface SaudeT {
  id: string; tipo: string; descricao?: string
  data?: string; proximaData?: string; obs?: string
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const t = ref<Transporte | null>(null)
const manut = ref<Manutencao[] | null>(null)
const saude = ref<SaudeT[] | null>(null)
const erro = ref('')

const ehCavalo = computed(() => String(t.value?.tipo) === 'Cavalo')

const hoje = new Date().toISOString().slice(0, 10)
const form = ref(false)
const tipo = ref('')
const descricao = ref('')
const data = ref(hoje)
const km = ref('')
const proxima = ref('')
const proximoKm = ref('')
const obs = ref('')
const salvando = ref(false)

const tiposDisponiveis = computed(() => (ehCavalo.value ? TIPOS_SAUDE_CAVALO : TIPOS_MANUT))

async function carregar() {
  erro.value = ''
  try {
    const l = await server<Transporte[]>('apiListarTransportes')
    t.value = (l || []).find((x) => x.id === id.value) || null
    if (!t.value) { erro.value = 'Item não encontrado'; return }
    tipo.value = tiposDisponiveis.value[0] || ''
    if (ehCavalo.value) saude.value = await server<SaudeT[]>('apiListarSaudeTransp', id.value)
    else manut.value = await server<Manutencao[]>('apiListarManutencao', id.value)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a ficha'
  }
}

async function salvar() {
  salvando.value = true
  try {
    if (ehCavalo.value) {
      await server('apiCriarSaudeTransp', {
        transporteId: id.value, tipo: tipo.value, descricao: descricao.value,
        data: data.value, proximaData: proxima.value, obs: obs.value
      })
      saude.value = await server<SaudeT[]>('apiListarSaudeTransp', id.value)
    } else {
      await server('apiCriarManutencao', {
        transporteId: id.value, tipo: tipo.value, data: data.value, km: km.value,
        proximaData: proxima.value, proximoKm: proximoKm.value, obs: obs.value
      })
      manut.value = await server<Manutencao[]>('apiListarManutencao', id.value)
    }
    ui.avisar('Registro salvo ✔')
    form.value = false
    descricao.value = ''; km.value = ''; proxima.value = ''; proximoKm.value = ''; obs.value = ''
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(entidade: 'manutencao' | 'saudeTransp', regId: string) {
  if (!confirm('Excluir este registro?')) return
  try {
    await server('apiExcluir', entidade, regId)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!t" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone :nome="ehCavalo ? 'ferradura' : 'transporte'" :px="34" /></div>
        <div class="grow">
          <h3 class="no-i18n">{{ t.identificacao || t.tipo }}</h3>
          <div class="meta"><span class="pill">{{ t.tipo }}</span></div>
          <div v-if="t.obs" class="meta no-i18n">{{ t.obs }}</div>
        </div>
      </div>

      <h3 class="sec">
        <Icone :nome="ehCavalo ? 'saude' : 'ferramenta'" />
        {{ ehCavalo ? 'Saúde e casqueamento' : 'Manutenções' }}
      </h3>

      <div v-if="form" class="card">
        <label for="x_tipo">Tipo *</label>
        <select id="x_tipo" v-model="tipo">
          <option v-for="x in tiposDisponiveis" :key="x">{{ x }}</option>
        </select>

        <template v-if="ehCavalo">
          <label for="x_desc">Descrição</label>
          <input id="x_desc" v-model="descricao" class="no-i18n">
        </template>

        <div class="two">
          <div><CampoData v-model="data" label="Data" /></div>
          <div><CampoData v-model="proxima" label="Próxima" /></div>
        </div>

        <template v-if="!ehCavalo">
          <div class="two">
            <div>
              <label for="x_km">Km atual</label>
              <input id="x_km" v-model="km" inputmode="numeric">
            </div>
            <div>
              <label for="x_pkm">Próximo km</label>
              <input id="x_pkm" v-model="proximoKm" inputmode="numeric">
            </div>
          </div>
        </template>

        <div class="meta dica">
          Com a próxima data preenchida, o registro entra na sua Agenda.
        </div>

        <label for="x_obs">Observações</label>
        <textarea id="x_obs" v-model="obs" class="no-i18n" />

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar registro' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <!-- CAVALO -->
      <template v-if="ehCavalo">
        <div v-if="saude === null" class="card"><div class="meta">Carregando…</div></div>
        <div v-else-if="!saude.length && !form" class="card">
          <div class="meta">Nenhum registro de saúde ainda.</div>
        </div>
        <div v-for="s in saude || []" :key="s.id" class="card linha">
          <div class="grow">
            <b>{{ s.tipo }}</b>
            <div class="meta no-i18n">
              {{ dataBR(s.data) }}<template v-if="s.descricao"> · {{ s.descricao }}</template>
            </div>
            <div v-if="s.proximaData" class="meta"><Icone nome="calendario" /> próxima em {{ dataBR(s.proximaData) }}</div>
            <div v-if="s.obs" class="meta no-i18n">{{ s.obs }}</div>
          </div>
          <button class="ib" title="Excluir" @click="excluir('saudeTransp', s.id)"><Icone nome="excluir" /></button>
        </div>
      </template>

      <!-- VEÍCULO / EMBARCAÇÃO -->
      <template v-else>
        <div v-if="manut === null" class="card"><div class="meta">Carregando…</div></div>
        <div v-else-if="!manut.length && !form" class="card">
          <div class="meta">Nenhuma manutenção registrada.</div>
        </div>
        <div v-for="x in manut || []" :key="x.id" class="card linha">
          <div class="grow">
            <b>{{ x.tipo }}</b>
            <div class="meta no-i18n">
              {{ dataBR(x.data) }}<template v-if="x.km"> · {{ x.km }} km</template>
            </div>
            <div v-if="x.proximaData || x.proximoKm" class="meta no-i18n">
              <Icone nome="calendario" /> próxima
              <template v-if="x.proximaData"> em {{ dataBR(x.proximaData) }}</template>
              <template v-if="x.proximoKm"> ou aos {{ x.proximoKm }} km</template>
            </div>
            <div v-if="x.obs" class="meta no-i18n">{{ x.obs }}</div>
          </div>
          <button class="ib" title="Excluir" @click="excluir('manutencao', x.id)"><Icone nome="excluir" /></button>
        </div>
      </template>

      <button v-if="!form" class="btn" @click="form = true">＋ Registrar</button>

      <NuxtLink
        :to="{ path: '/documentacao', query: { cat: 'veiculo' } }"
        class="btn sec"
      ><Icone nome="documentos" /> Documentos deste item</NuxtLink>
      <NuxtLink
        :to="ehCavalo ? { path: '/manutencao', query: { casa: 'haras' } } : '/manutencao'"
        class="btn sec"
      >Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.cab { display: flex; align-items: flex-start; gap: 12px; }
.thumb { width: 84px; height: 84px; border-radius: 12px; object-fit: cover; flex: none; }
.ic { width: 84px; height: 84px; border-radius: 12px; background: var(--areia); display: flex; align-items: center; justify-content: center; font-size: 34px; flex: none; }
.cab .grow { flex: 1; min-width: 0; }
.cab .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.sec { margin: 14px 4px 6px; font-size: 15px; }
.linha { display: flex; align-items: flex-start; gap: 8px; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.dica { margin: -2px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
