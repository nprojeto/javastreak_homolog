<script setup lang="ts">
/**
 * Registrar abate. Porte de VIEWS.abateForm + salvarAbate + renderCondCeva
 * (index.html, 10413 / 10516).
 *
 * ⚠️ O abate NASCE DE DENTRO DE UMA CAÇADA. Não existe "o" ciclo aberto —
 * podem ser vários —, então a caçada vem pela URL. Sem ela, a tela manda
 * escolher em qual registrar.
 *
 * ⚠️ Vocabulário FECHADO em método, desenvolvimento e sexo. O servidor
 * peneira: qualquer valor fora da lista vira vazio, senão o campo virava texto
 * livre e o relatório do IBAMA perdia o sentido.
 *
 * ⚠️ Em TEMPO REAL o cliente não manda lua nem condição: quem decide é o
 * servidor, que consulta o MET Norway antes de gravar. Se a consulta falhar,
 * NADA é gravado — falha fechado, de propósito. Por isso o botão só libera
 * depois de a prévia voltar.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Manejo } from '~/pages/cacadas.vue'

definePageMeta({ layout: 'app' })

const METODOS = ['', 'Arma branca', 'Arma de fogo', 'Outros']
const DESENV = ['', 'Juvenil', 'Adulto']
const LUAS = ['', 'Lua nova', 'Crescente inicial', 'Quarto crescente', 'Crescente final',
  'Lua cheia', 'Minguante inicial', 'Quarto minguante', 'Minguante final']
const TEMPOS = ['', 'Aberto', 'Parcialmente nublado', 'Nublado', 'Neblina',
  'Garoa', 'Chuva', 'Tempestade']

interface Alimento { id: string; tipo: string; data?: string }
interface Clima {
  ok?: boolean; erro?: string; luaFase?: string; condicaoTempo?: string
  temp?: number | string; umidade?: number | string; vento?: number | string
  ventoDir?: string; chuvaProb?: number | string
}

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const manejoId = computed(() => String(route.query.manejo || ''))
const m = ref<Manejo | null>(null)
const alimentos = ref<Alimento[]>([])
const erro = ref('')
const pronto = ref(false)

const cevaId = ref('')
const rotaId = ref('')
const alimentoId = ref('')
const quem = ref('')
const dataHora = ref('')
const quantidade = ref('1')
const sexo = ref('Macho')
const peso = ref('')
const metodo = ref('')
const desenv = ref('')
const comprimento = ref('')
const lat = ref('')
const lng = ref('')
const amostra = ref(false)
const frasco = ref('')
const obs = ref('')
const foto = ref('')

const modo = ref<'passado' | 'tempoReal'>('passado')
const lua = ref('')
const tempo = ref('')
const clima = ref<Clima | null>(null)
const buscandoClima = ref(false)
const salvando = ref(false)

/* Com ceva escolhida, o local do abate é o da ceva — o servidor sobrescreve. */
const mostraLocal = computed(() => !cevaId.value)
const podeTempoReal = computed(() => !!cevaId.value)

function agoraLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

async function carregarAlimentos() {
  alimentoId.value = ''
  alimentos.value = []
  if (!cevaId.value) return
  alimentos.value = await server<Alimento[]>('apiListarAlimentos', cevaId.value).catch(() => [])
}

async function verClima() {
  if (!cevaId.value) return
  buscandoClima.value = true
  clima.value = null
  try {
    clima.value = await server<Clima>('apiClimaCeva', cevaId.value)
    if (!clima.value?.ok) {
      ui.avisar(clima.value?.erro || 'Não foi possível consultar o tempo', 'erro')
    }
  } catch {
    clima.value = null
  } finally {
    buscandoClima.value = false
  }
}

watch(cevaId, async () => {
  await carregarAlimentos()
  if (!cevaId.value) modo.value = 'passado'
})
watch(modo, (v) => { if (v === 'tempoReal') verClima() })

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
  dataHora.value = agoraLocal()
  if (!manejoId.value) { pronto.value = true; return }
  try {
    const man = await server<Manejo>('apiManejo', manejoId.value)
    m.value = man
    const cevas = man.cevas || []
    const rotas = man.rotas || []
    if (man.tipo === 'ceva' && cevas.length === 1) cevaId.value = cevas[0]!.id
    if (man.tipo === 'rota' && rotas.length === 1) rotaId.value = rotas[0]!.id
    quem.value = (man.participantes || [])[0]?.id || ''
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a caçada'
  }
})

async function salvar() {
  if (!m.value) { ui.avisar('Sem caçada', 'erro'); return }
  if (!dataHora.value) { ui.avisar('Informe data e hora', 'erro'); return }
  if (m.value.tipo === 'ceva' && !cevaId.value) { ui.avisar('Escolha a ceva do abate', 'erro'); return }
  if (m.value.tipo === 'rota' && !rotaId.value) { ui.avisar('Escolha a rota do abate', 'erro'); return }

  const d: Record<string, unknown> = {
    manejoId: m.value.id, cevaId: cevaId.value, rotaId: rotaId.value,
    alimentoId: alimentoId.value, abatidoPor: quem.value,
    dataHora: dataHora.value, quantidade: quantidade.value, sexo: sexo.value,
    pesoAprox: peso.value, metodoAbate: metodo.value, desenvolvimento: desenv.value,
    comprimento: comprimento.value, obs: obs.value, foto: foto.value,
    amostraColetada: amostra.value ? 'Sim' : 'Não', codigoFrasco: frasco.value
  }

  if (cevaId.value && modo.value === 'tempoReal') {
    if (!clima.value?.ok) {
      ui.avisar('Aguarde a consulta do tempo ou use o modo Passado', 'erro')
      return
    }
    d.modo = 'tempoReal'
  } else if (cevaId.value) {
    d.luaFase = lua.value
    d.condicaoTempo = tempo.value
  } else {
    d.lat = lat.value
    d.lng = lng.value
  }

  salvando.value = true
  try {
    await server('apiCriarAbate', d)
    ui.avisar('Abate registrado ✔')
    await router.push({ path: '/cacada', query: { id: m.value.id } })
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <TituloTela titulo="Registrar abate" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>

    <div v-else-if="!manejoId" class="card vazio">
      <div class="big"><Icone nome="pino" /></div>
      O abate pertence a uma caçada. Abra a caçada em que ele aconteceu e
      registre por lá.
      <NuxtLink to="/cacadas" class="btn">Ver minhas caçadas</NuxtLink>
    </div>

    <div v-else-if="!pronto || !m" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <div class="meta no-i18n">
          Caçada: <b>{{ m.nome }}</b> · {{ m.tipo }}
        </div>

        <template v-if="(m.cevas || []).length">
          <label for="ab_ceva">Ceva{{ m.tipo === 'ceva' ? ' *' : '' }}</label>
          <select id="ab_ceva" v-model="cevaId">
            <option value="">Selecione…</option>
            <option v-for="c in m.cevas" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>

          <template v-if="cevaId">
            <label for="ab_alim">Alimento na ceva</label>
            <select id="ab_alim" v-model="alimentoId">
              <option value="">—</option>
              <option v-for="a in alimentos" :key="a.id" :value="a.id">{{ a.tipo }}</option>
            </select>
          </template>
        </template>

        <template v-if="(m.rotas || []).length">
          <label for="ab_rota">Rota{{ m.tipo === 'rota' ? ' *' : '' }}</label>
          <select id="ab_rota" v-model="rotaId">
            <option value="">Selecione…</option>
            <option v-for="r in m.rotas" :key="r.id" :value="r.id">{{ r.nome }}</option>
          </select>
        </template>

        <label for="ab_quem">Quem abateu *</label>
        <select id="ab_quem" v-model="quem">
          <option v-for="g in m.participantes || []" :key="g.id" :value="g.id">
            {{ g.nome }}{{ g.dono ? ' (dono)' : '' }}
          </option>
        </select>
      </div>

      <!-- ───────── CONDIÇÕES ───────── -->
      <div v-if="podeTempoReal" class="card">
        <h3>Condições</h3>
        <div class="modos">
          <button :class="{ on: modo === 'passado' }" @click="modo = 'passado'">
            <Icone nome="calendario" />️ Aconteceu antes
          </button>
          <button :class="{ on: modo === 'tempoReal' }" @click="modo = 'tempoReal'">
            ⏱ Agora (tempo real)
          </button>
        </div>

        <template v-if="modo === 'tempoReal'">
          <div v-if="buscandoClima" class="meta">Consultando o tempo na ceva…</div>
          <div v-else-if="clima?.ok" class="clima">
            <div><b>{{ clima.condicaoTempo }}</b> · {{ clima.luaFase }}</div>
            <div class="meta no-i18n">
              {{ clima.temp }}°C · {{ clima.umidade }}% ·
              vento {{ clima.vento }} km/h {{ clima.ventoDir }} ·
              chuva {{ clima.chuvaProb }}%
            </div>
            <div class="meta">
              Data, hora, lua e clima são gravados pelo servidor. Fonte: MET Norway.
            </div>
          </div>
          <div v-else class="meta ruim">
            <Icone nome="alerta" /> Não foi possível consultar o tempo. Use o modo "Aconteceu antes"
            ou tente de novo.
            <button class="btn sm sec" @click="verClima">Tentar de novo</button>
          </div>
        </template>

        <template v-else>
          <div class="two">
            <div>
              <label for="ab_lua">Fase da lua</label>
              <select id="ab_lua" v-model="lua">
                <option v-for="l in LUAS" :key="l" :value="l">{{ l || '—' }}</option>
              </select>
            </div>
            <div>
              <label for="ab_tempo">Condição do tempo</label>
              <select id="ab_tempo" v-model="tempo">
                <option v-for="t in TEMPOS" :key="t" :value="t">{{ t || '—' }}</option>
              </select>
            </div>
          </div>
        </template>
      </div>

      <!-- ───────── O ANIMAL ───────── -->
      <div class="card">
        <h3>O animal</h3>

        <div class="two">
          <div>
            <label for="ab_dh">Data e hora *</label>
            <input id="ab_dh" v-model="dataHora" type="datetime-local" :disabled="modo === 'tempoReal'">
          </div>
          <div>
            <label for="ab_qtd">Quantidade</label>
            <input id="ab_qtd" v-model="quantidade" inputmode="numeric">
          </div>
        </div>

        <div class="two">
          <div>
            <label for="ab_sexo">Sexo *</label>
            <select id="ab_sexo" v-model="sexo">
              <option>Macho</option>
              <option>Fêmea</option>
            </select>
          </div>
          <div>
            <label for="ab_peso">Peso aprox. (kg)</label>
            <input id="ab_peso" v-model="peso" inputmode="decimal">
          </div>
        </div>

        <div class="two">
          <div>
            <label for="ab_met">Método de abate</label>
            <select id="ab_met" v-model="metodo">
              <option v-for="x in METODOS" :key="x" :value="x">{{ x || '—' }}</option>
            </select>
          </div>
          <div>
            <label for="ab_des">Desenvolvimento</label>
            <select id="ab_des" v-model="desenv">
              <option v-for="x in DESENV" :key="x" :value="x">{{ x || '—' }}</option>
            </select>
          </div>
        </div>

        <label for="ab_comp">Comprimento (cm)</label>
        <input id="ab_comp" v-model="comprimento" inputmode="decimal">

        <template v-if="mostraLocal">
          <BotaoGps v-model:lat="lat" v-model:lng="lng" />
        </template>
        <div v-else class="meta local"><Icone nome="pino" /> O local do abate é o da ceva escolhida.</div>

        <label class="check">
          <input v-model="amostra" type="checkbox">
          <span>Amostra coletada</span>
        </label>
        <template v-if="amostra">
          <label for="ab_frasco">Código do frasco</label>
          <input id="ab_frasco" v-model="frasco" class="no-i18n">
        </template>

        <label for="ab_obs">Observações</label>
        <textarea id="ab_obs" v-model="obs" class="no-i18n" />

        <label for="ab_foto">Foto (opcional)</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="ab_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Registrar abate' }}
        </button>
        <NuxtLink :to="{ path: '/cacada', query: { id: manejoId } }" class="btn sec">
          Cancelar
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 26px 18px; }
.vazio .big { font-size: 40px; margin-bottom: 8px; }
.vazio .btn { margin-top: 14px; text-decoration: none; }
.modos { display: flex; gap: 6px; margin-bottom: 10px; }
.modos button {
  flex: 1; padding: 9px 6px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--txt);
}
.modos button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.clima { border-left: 4px solid var(--verde); padding: 8px 10px; background: var(--carvao-3); border-radius: 8px; }
.clima .meta { margin: 3px 0 0; }
.clima .btn { width: auto; margin-top: 6px; }
.local { margin: 8px 0; }
.check { display: flex; align-items: center; gap: 8px; margin: 12px 0 0; font-weight: 400; }
.check input { width: auto; flex: none; }
.prev { max-width: 160px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
