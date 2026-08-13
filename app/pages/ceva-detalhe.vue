<script setup lang="ts">
/**
 * Detalhe da ceva: mapa, alimento e nível do tratadouro.
 * Porte de VIEWS.cevaDetail + renderAlimentos + renderNiveis + os dois
 * formulários (index.html, 8295-8340).
 *
 * Os formulários ficam na própria tela, abrindo e fechando, em vez de virarem
 * rota — são quatro campos cada, e o legado só os separou porque navegava por
 * pilha de telas.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'

definePageMeta({ layout: 'app' })

const TIPOS_ALIM = ['Milho', 'Fubá', 'Farelo', 'Soja', 'Ração', 'Sal mineral', 'Melaço', 'Outro']
const UNIDADES = ['kg', 'saco(s)', 'litro(s)', 'lata(s)']

interface Alimento {
  id: string; tipo: string; quantidade?: string; unidade?: string
  data?: string; obs?: string
}
interface Nivel { id: string; percentual: string; data?: string; obs?: string }

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const ceva = ref<Ceva | null>(null)
const prop = ref<Propriedade | null>(null)
const erro = ref('')

const aba = ref<'alimento' | 'nivel'>('alimento')
const alimentos = ref<Alimento[] | null>(null)
const niveis = ref<Nivel[] | null>(null)

const hoje = new Date().toISOString().slice(0, 10)

/* formulário de alimento */
const fAlim = ref(false)
const aTipo = ref(TIPOS_ALIM[0]!)
const aQtd = ref('')
const aUni = ref(UNIDADES[0]!)
const aData = ref(hoje)
const aObs = ref('')

/* formulário de nível */
const fNivel = ref(false)
const nPerc = ref(50)
const nData = ref(hoje)
const nObs = ref('')

const salvando = ref(false)

const nivelAtual = computed(() => {
  const n = niveis.value?.[0]
  return n ? Math.max(0, Math.min(100, parseFloat(n.percentual) || 0)) : null
})

async function carregar() {
  erro.value = ''
  try {
    const l = await server<Ceva[]>('apiListarCevas')
    const c = (l || []).find((x) => x.id === id.value) || null
    if (!c) { erro.value = 'Ceva não encontrada'; return }
    ceva.value = c
    if (c.propriedadeId) {
      const ps = await server<Propriedade[]>('apiListarPropriedades')
      prop.value = (ps || []).find((p) => p.id === c.propriedadeId) || null
    }
    await Promise.all([carregarAlimentos(), carregarNiveis()])
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a ceva'
  }
}

async function carregarAlimentos() {
  alimentos.value = await server<Alimento[]>('apiListarAlimentos', id.value)
}
async function carregarNiveis() {
  niveis.value = await server<Nivel[]>('apiListarNiveis', id.value)
}

async function salvarAlimento() {
  salvando.value = true
  try {
    await server('apiCriarAlimento', {
      cevaId: id.value, tipo: aTipo.value, quantidade: aQtd.value,
      unidade: aUni.value, data: aData.value, obs: aObs.value
    })
    ui.avisar('Salvo ✔')
    fAlim.value = false; aQtd.value = ''; aObs.value = ''
    await carregarAlimentos()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function salvarNivel() {
  salvando.value = true
  try {
    await server('apiRegistrarNivel', {
      cevaId: id.value, percentual: String(nPerc.value),
      data: nData.value, obs: nObs.value
    })
    ui.avisar('Nível salvo ✔')
    fNivel.value = false; nObs.value = ''
    await carregarNiveis()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(entidade: 'alimento' | 'nivel', regId: string) {
  if (!confirm('Excluir este registro?')) return
  try {
    await server('apiExcluir', entidade, regId)
    ui.avisar('Excluído')
    if (entidade === 'alimento') await carregarAlimentos()
    else await carregarNiveis()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Ceva" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!ceva" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab">
        <img v-if="ceva.fotoUrl" :src="String(ceva.fotoUrl)" class="thumb" alt="">
        <div class="grow">
          <h3 class="no-i18n"><Icone nome="ceva" /> {{ ceva.nome || 'Ceva' }}</h3>
          <div class="meta"><span class="pill">{{ ceva.tipo }}</span></div>
        </div>
        <NuxtLink :to="{ path: '/ceva', query: { id } }" class="ib" title="Editar"><Icone nome="editar" /></NuxtLink>
      </div>

      <ClientOnly>
        <MapaPontos
          :limites="prop?.temLimite ? [{ nome: prop.nome, pontos: prop.limite }] : []"
          :pinos="ceva.lat && ceva.lng
            ? [{ lat: Number(ceva.lat), lng: Number(ceva.lng), titulo: ceva.nome || 'Ceva' }]
            : []"
        />
      </ClientOnly>

      <div v-if="!prop" class="card">
        <div class="meta">Esta ceva não está ligada a nenhuma propriedade.</div>
      </div>

      <div class="tabs">
        <button :class="{ on: aba === 'alimento' }" @click="aba = 'alimento'"><Icone nome="ceva" /> Alimento</button>
        <button :class="{ on: aba === 'nivel' }" @click="aba = 'nivel'"><Icone nome="grafico" /> Nível</button>
      </div>

      <!-- ───────── ALIMENTO ───────── -->
      <template v-if="aba === 'alimento'">
        <div v-if="fAlim" class="card">
          <label for="a_tipo">Tipo *</label>
          <select id="a_tipo" v-model="aTipo">
            <option v-for="t in TIPOS_ALIM" :key="t">{{ t }}</option>
          </select>

          <div class="two">
            <div>
              <label for="a_qtd">Quantidade</label>
              <input id="a_qtd" v-model="aQtd" inputmode="decimal">
            </div>
            <div>
              <label for="a_uni">Unidade</label>
              <select id="a_uni" v-model="aUni">
                <option v-for="u in UNIDADES" :key="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <CampoData v-model="aData" label="Data" />

          <label for="a_obs">Observações</label>
          <textarea id="a_obs" v-model="aObs" class="no-i18n" />

          <button class="btn" :disabled="salvando" @click="salvarAlimento">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
          <button class="btn sec" @click="fAlim = false">Cancelar</button>
        </div>

        <div v-if="alimentos === null" class="card"><div class="meta">Carregando…</div></div>
        <div v-else-if="!alimentos.length" class="card">
          <div class="meta">Nenhum alimento registrado.</div>
        </div>
        <div v-for="a in alimentos || []" :key="a.id" class="card linha">
          <div class="grow">
            <b>{{ a.tipo }}</b>
            <div class="meta no-i18n">
              {{ a.quantidade }} {{ a.unidade }} · {{ dataBR(a.data) }}
              <template v-if="a.obs"> · {{ a.obs }}</template>
            </div>
          </div>
          <button class="ib" title="Excluir" @click="excluir('alimento', a.id)"><Icone nome="excluir" /></button>
        </div>

        <button v-if="!fAlim" class="btn" @click="fAlim = true">＋ Registrar alimento</button>
      </template>

      <!-- ───────── NÍVEL ───────── -->
      <template v-else>
        <div v-if="nivelAtual !== null" class="card">
          <h3>Nível atual: {{ nivelAtual }}%</h3>
          <div class="barra-prog"><span :style="{ width: nivelAtual + '%' }" /></div>
          <div class="meta">Atualizado em {{ dataBR(niveis?.[0]?.data) }}</div>
        </div>

        <div v-if="fNivel" class="card">
          <label for="n_perc">Percentual no tratadouro *</label>
          <input id="n_perc" v-model.number="nPerc" type="range" min="0" max="100">
          <div class="perc">{{ nPerc }}%</div>

          <CampoData v-model="nData" label="Data" />

          <label for="n_obs">Observações</label>
          <textarea id="n_obs" v-model="nObs" class="no-i18n" />

          <button class="btn" :disabled="salvando" @click="salvarNivel">
            {{ salvando ? 'Salvando…' : 'Salvar leitura' }}
          </button>
          <button class="btn sec" @click="fNivel = false">Cancelar</button>
        </div>

        <div v-if="niveis === null" class="card"><div class="meta">Carregando…</div></div>
        <div v-else-if="!niveis.length" class="card">
          <div class="meta">Nenhuma leitura ainda.</div>
        </div>
        <div v-for="n in niveis || []" :key="n.id" class="card linha">
          <div class="grow meta no-i18n">
            {{ dataBR(n.data) }} — <b>{{ n.percentual }}%</b>
            <template v-if="n.obs"> · {{ n.obs }}</template>
          </div>
          <button class="ib" title="Excluir" @click="excluir('nivel', n.id)"><Icone nome="excluir" /></button>
        </div>

        <button v-if="!fNivel" class="btn" @click="fNivel = true">＋ Registrar nível</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.cab { display: flex; align-items: center; gap: 10px; }
.thumb { width: 70px; height: 70px; border-radius: 10px; object-fit: cover; flex: none; }
.cab .grow { flex: 1; min-width: 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; text-decoration: none; flex: none; }
.tabs { display: flex; gap: 6px; margin: 10px 0; }
.tabs button {
  flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-weight: 600; font-size: 13.5px; color: var(--txt);
}
.tabs button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.linha { display: flex; align-items: center; gap: 8px; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 2px 0 0; }
.barra-prog { height: 14px; background: var(--linha); border-radius: 999px; overflow: hidden; margin: 6px 0; }
.barra-prog span { display: block; height: 100%; background: var(--verde); }
.perc { text-align: center; font-size: 30px; font-weight: 700; color: var(--verde); }
.btn.sec { margin-top: 8px; }
</style>
