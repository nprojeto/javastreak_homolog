<script setup lang="ts">
/**
 * Ficha do cão e histórico de saúde. Porte de VIEWS.caoDetail + saudeForm
 * (index.html, 9243).
 *
 * Registro com `proximaData` entra sozinho na Agenda — é a mesma fonte.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Cao } from '~/pages/canis.vue'

definePageMeta({ layout: 'app' })

const TIPOS = ['Vacina', 'Vermífugo', 'Antipulgas', 'Consulta', 'Exame',
  'Medicação', 'Cirurgia', 'Outro']

interface Saude {
  id: string; tipo: string; descricao?: string
  data?: string; proximaData?: string; obs?: string
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
/* ⚠️ Sem `canil` na URL: o canil virou casa e a tela não o conhece mais.
   `apiListarCaes()` sem argumento devolve todos os meus cães, e é entre eles
   que este é encontrado. O parâmetro antigo ainda é aceito para não quebrar
   link guardado. */
const canilId = computed(() => String(route.query.canil || ''))
const cao = ref<Cao | null>(null)
const saude = ref<Saude[] | null>(null)
const erro = ref('')

const hoje = new Date().toISOString().slice(0, 10)
const form = ref(false)
const tipo = ref(TIPOS[0]!)
const descricao = ref('')
const data = ref(hoje)
const proxima = ref('')
const obs = ref('')
const salvando = ref(false)

function idade(iso?: string) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const meses = Math.floor((Date.now() - d.getTime()) / 2629800000)
  return meses < 24 ? meses + ' mes(es)' : Math.floor(meses / 12) + ' ano(s)'
}

async function carregar() {
  erro.value = ''
  try {
    const l = await server<Cao[]>('apiListarCaes', canilId.value || undefined)
    cao.value = (l || []).find((c) => c.id === id.value) || null
    if (!cao.value) { erro.value = 'Cão não encontrado'; return }
    saude.value = await server<Saude[]>('apiListarSaude', id.value)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a ficha'
  }
}

async function salvar() {
  salvando.value = true
  try {
    await server('apiRegistrarSaude', {
      caoId: id.value, tipo: tipo.value, descricao: descricao.value,
      data: data.value, proximaData: proxima.value, obs: obs.value
    })
    ui.avisar('Registro salvo ✔')
    form.value = false
    descricao.value = ''; proxima.value = ''; obs.value = ''
    saude.value = await server<Saude[]>('apiListarSaude', id.value)
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(s: Saude) {
  if (!confirm('Excluir este registro?')) return
  try {
    await server('apiExcluir', 'saude', s.id)
    saude.value = await server<Saude[]>('apiListarSaude', id.value)
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Cão" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!cao" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab">
        <img v-if="cao.fotoUrl" :src="String(cao.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone nome="canil" /></div>
        <div class="grow">
          <h3 class="no-i18n">{{ cao.nome }}</h3>
          <div class="meta">
            <span class="pill">{{ cao.funcao || '—' }}</span>
          </div>
          <div class="meta no-i18n">
            {{ cao.raca || '' }}<template v-if="cao.raca && cao.sexo"> · </template>{{ cao.sexo }}
            <template v-if="idade(cao.dataNascimento)"> · {{ idade(cao.dataNascimento) }}</template>
          </div>
          <div v-if="cao.obs" class="meta no-i18n">{{ cao.obs }}</div>
        </div>
      </div>

      <h3 class="sec"><Icone nome="saude" /> Saúde</h3>


      <div v-if="saude === null" class="card"><div class="meta">Carregando…</div></div>
      <div v-else-if="!saude.length && !form" class="card">
        <div class="meta">Nenhum registro de saúde ainda.</div>
      </div>

      <div v-for="s in saude || []" :key="s.id" class="card linha">
        <div class="grow">
          <b>{{ s.tipo }}</b>
          <div class="meta no-i18n">
            {{ dataBR(s.data) }}
            <template v-if="s.descricao"> · {{ s.descricao }}</template>
          </div>
          <div v-if="s.proximaData" class="meta">
            <Icone nome="calendario" /> próxima em {{ dataBR(s.proximaData) }}
          </div>
          <div v-if="s.obs" class="meta no-i18n">{{ s.obs }}</div>
        </div>
        <button class="ib" title="Excluir" @click="excluir(s)"><Icone nome="excluir" /></button>
      </div>

      <!-- Fica AQUI, junto do botão que o abre: declarado antes da lista,
           ele abria fora da tela em qualquer lista com alguns itens. -->
      <div v-if="form" class="card form-novo">
        <h3>Novo registro de saúde</h3>
        <label for="s_tipo">Tipo *</label>
        <select id="s_tipo" v-model="tipo">
          <option v-for="t in TIPOS" :key="t">{{ t }}</option>
        </select>

        <label for="s_desc">Descrição</label>
        <input id="s_desc" v-model="descricao" class="no-i18n" placeholder="Ex: V10, 2ª dose">

        <div class="two">
          <div><CampoData v-model="data" label="Data" /></div>
          <div><CampoData v-model="proxima" label="Próxima" /></div>
        </div>
        <div class="meta dica">
          Com a próxima data preenchida, o registro entra na sua Agenda.
        </div>

        <label for="s_obs">Observações</label>
        <textarea id="s_obs" v-model="obs" class="no-i18n" />

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar registro' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <button v-if="!form" class="btn" @click="form = true">＋ Registrar saúde</button>
      <NuxtLink to="/canis" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
/* O formulário de cadastro, agora ao pé da lista. */
.form-novo { border-left: 4px solid var(--laranja); }
.form-novo h3 { margin: 0 0 10px; font-size: 15px; }
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
.dica { margin: -4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
