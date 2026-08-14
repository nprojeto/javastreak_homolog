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
const erro = ref('')
const pronto = ref(false)

const cevaId = ref('')
const rotaId = ref('')
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

/**
 * ⚠️ O TEMPO REAL NÃO DEPENDE MAIS DA CEVA. Antes o bloco de condições só
 * aparecia com ceva escolhida, e o abate de caçada livre ou de rota nem via a
 * opção — caía calado no preenchimento à mão, com `condFonte: 'manual'` num
 * registro que podia ter sido medido. Agora basta haver COORDENADA: o
 * `apiClimaPonto` consulta o MET Norway por lat/lng.
 */
const temPonto = computed(() => !!(Number(lat.value) || Number(lng.value)))

/** Nome da ceva escolhida, para o rodapé do clima dizer de onde ele veio. */
const nomeDaCeva = computed(() =>
  (m.value?.cevas || []).find((c) => String(c.id) === cevaId.value)?.nome || 'ceva escolhida')
const podeTempoReal = computed(() => !!cevaId.value || temPonto.value)

/**
 * ── ONDE O ABATE ENTRA ──
 *
 * Uma pergunta só, no lugar de dois seletores (ceva e rota) que podiam ser
 * preenchidos ao mesmo tempo sem que nada avisasse. As opções são as da
 * propriedade daquela caçada, mais o percurso em gravação quando houver.
 */
const onde = ref('')

const opcoesOnde = computed(() => {
  const o: Array<{ valor: string; rotulo: string }> = []
  if (route.query.percurso === '1') {
    o.push({ valor: 'p', rotulo: 'No percurso que estou gravando' })
  }
  for (const c of m.value?.cevas || []) o.push({ valor: 'c:' + c.id, rotulo: 'Ceva: ' + (c.nome || 'ceva') })
  for (const r of m.value?.rotas || []) o.push({ valor: 'r:' + r.id, rotulo: 'Rota: ' + (r.nome || 'rota') })
  o.push({ valor: '', rotulo: 'Solto na propriedade' })
  return o
})

/**
 * ⚠️ `onde` MANDA em `cevaId` e `rotaId`, e não o contrário. Deixar os três
 * livres permitiria gravar um abate com ceva E rota ao mesmo tempo, o que o
 * relatório do IBAMA não sabe representar.
 */
watch(onde, (v) => {
  cevaId.value = v.startsWith('c:') ? v.slice(2) : ''
  rotaId.value = v.startsWith('r:') ? v.slice(2) : ''
  if (modo.value === 'tempoReal') verClima()
})

function agoraLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/**
 * ⚠️ RECUO PARA O MANUAL. A consulta é TENTADA; se ela não vier — sem rede,
 * MET Norway fora do ar, `MET_UA` faltando —, a tela abre os campos de lua e
 * condição para preencher à mão em vez de barrar o registro.
 *
 * O que NÃO muda: o registro sai marcado com `condFonte: 'manual'`, e é isso
 * que separa um dado medido de um dado lembrado. O relatório do IBAMA guarda
 * os dois, e quem for auditar consegue distinguir.
 *
 * Enquanto o clima do passado não existir, este é o recuo. Depois dele, o
 * servidor busca o tempo do instante do abate na hora da sincronização e o
 * manual deixa de ser necessário.
 */
const climaFalhou = ref(false)
const motivoClima = ref('')

/**
 * ⚠️ CONSULTA POR CEVA **OU POR COORDENADA**. Antes só havia o caminho da
 * ceva, então um abate de caçada livre ou de rota caía sempre no
 * preenchimento à mão — e o registro saía marcado como `manual` num caso em
 * que o tempo podia ter sido medido. O relatório do IBAMA guarda essa
 * diferença, então ela importa.
 */
async function verClima() {
  const temPonto = !!(Number(lat.value) || Number(lng.value))
  if (!cevaId.value && !temPonto) return
  buscandoClima.value = true
  clima.value = null
  climaFalhou.value = false
  motivoClima.value = ''
  try {
    clima.value = cevaId.value
      ? await server<Clima>('apiClimaCeva', cevaId.value)
      : await server<Clima>('apiClimaPonto', lat.value, lng.value)
    if (!clima.value?.ok) {
      climaFalhou.value = true
      motivoClima.value = clima.value?.erro || 'Não foi possível consultar o tempo'
      modo.value = 'passado'
    }
  } catch (e) {
    clima.value = null
    climaFalhou.value = true
    motivoClima.value = e instanceof Error && e.message
      ? 'Sem rede para consultar o tempo agora.'
      : 'Não foi possível consultar o tempo'
    /* Cai para o preenchimento à mão em vez de deixar a pessoa presa. */
    modo.value = 'passado'
  } finally {
    buscandoClima.value = false
  }
}

/**
 * Trocar de ceva refaz a consulta. Sem ceva, o clima vem da coordenada — e
 * ela costuma vir preenchida do mapa da caçada.
 */
watch(cevaId, () => {
  if (modo.value === 'tempoReal') verClima()
})

/**
 * ⚠️ Com coordenada vinda do mapa da caçada, JÁ ENTRA em tempo real. O abate
 * registrado ali acabou de acontecer: pedir para a pessoa escolher "aconteceu
 * agora" seria um toque a mais para dizer o óbvio.
 */
onMounted(() => {
  if (route.query.lat && route.query.lng) {
    modo.value = 'tempoReal'
    verClima()
  }
})

/**
 * O que veio do mapa da caçada, aplicado quando as listas já existem.
 *
 * ⚠️ Escreve em `onde`, não em `cevaId`: é `onde` que manda nos dois campos, e
 * mexer neles por fora deixaria o seletor mostrando uma coisa e o registro
 * gravando outra.
 */
watch(m, (v) => {
  if (!v || onde.value) return
  const ceva = String(route.query.ceva || '')
  const rota = String(route.query.rota || '')
  if (ceva && (v.cevas || []).some((c) => String(c.id) === ceva)) { onde.value = 'c:' + ceva; return }
  if (rota && (v.rotas || []).some((r) => String(r.id) === rota)) { onde.value = 'r:' + rota; return }
  if (route.query.percurso === '1') { onde.value = 'p'; return }
  /* Um item só na propriedade: escolher por ela poupa um toque e não esconde
     nada — o seletor continua à vista, mostrando o que foi escolhido. */
  const cs = v.cevas || [], rs = v.rotas || []
  if (cs.length === 1 && !rs.length) onde.value = 'c:' + cs[0]!.id
  else if (rs.length === 1 && !cs.length) onde.value = 'r:' + rs[0]!.id
}, { immediate: true })
watch(modo, (v) => { if (v === 'tempoReal') verClima() })

/**
 * ⚠️ TROCAR A COORDENADA REFAZ A CONSULTA. Sem isto, quem abrisse em tempo
 * real e depois movesse o ponto no mapa continuaria vendo — e gravando — o
 * tempo do lugar anterior, sem nada avisar. Erra em silêncio, e o número vai
 * ao relatório do IBAMA.
 *
 * ⚠️ Com `debounce`: arrastar a mira no mapa muda lat/lng dezenas de vezes, e
 * uma chamada por passo estouraria o limite de uso do MET Norway.
 */
let relogioClima: ReturnType<typeof setTimeout> | null = null
watch([lat, lng], () => {
  /* Com ceva escolhida quem manda é a coordenada dela — o servidor
     sobrescreve o ponto do abate pelo da ceva, e os dois têm que concordar. */
  if (cevaId.value || modo.value !== 'tempoReal') return
  if (relogioClima) clearTimeout(relogioClima)
  relogioClima = setTimeout(() => verClima(), 700)
})

onBeforeUnmount(() => { if (relogioClima) clearTimeout(relogioClima) })

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
  /**
   * ⚠️ Coordenada vinda do guiamento. Ela só sobrevive se NÃO houver ceva:
   * com ceva escolhida, o servidor grava o ponto da ceva por cima — é regra
   * dele, e está certa. Preencher aqui serve à caçada de rota e à livre, que
   * é justamente quando a pessoa está andando e marcou onde aconteceu.
   */
  if (route.query.lat && route.query.lng) {
    lat.value = String(route.query.lat)
    lng.value = String(route.query.lng)
  }
  /**
   * ⚠️ A ceva escolhida no mapa da caçada chega pela URL. É aplicada DEPOIS
   * de carregar o manejo (mais abaixo), senão a lista de cevas ainda não
   * existe e o valor seria descartado em silêncio.
   */
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
  /* ⚠️ A exigência de rota vale só quando a caçada É de rota e existe rota
     para escolher — numa caçada livre o abate pode ser solto na propriedade. */
  if (m.value.tipo === 'rota' && (m.value.rotas || []).length && !rotaId.value) {
    ui.avisar('Escolha a rota do abate', 'erro'); return
  }

  const d: Record<string, unknown> = {
    manejoId: m.value.id, cevaId: cevaId.value, rotaId: rotaId.value,
    abatidoPor: quem.value,
    dataHora: dataHora.value, quantidade: quantidade.value, sexo: sexo.value,
    pesoAprox: peso.value, metodoAbate: metodo.value, desenvolvimento: desenv.value,
    comprimento: comprimento.value, obs: obs.value, foto: foto.value,
    amostraColetada: amostra.value ? 'Sim' : 'Não', codigoFrasco: frasco.value
  }

  if (cevaId.value && modo.value === 'tempoReal') {
    if (!clima.value?.ok) {
      ui.avisar('Aguarde a consulta do tempo ou preencha à mão', 'erro')
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

        <!--
          ⚠️ UMA pergunta, não duas. Ceva e rota eram seletores separados e
          nada impedia preencher os dois — um abate com ceva E rota, que o
          relatório do IBAMA não sabe representar.
        -->
        <label for="ab_onde">Onde foi o abate *</label>
        <select id="ab_onde" v-model="onde">
          <option v-for="o in opcoesOnde" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
        </select>
        <div v-if="onde === 'p'" class="meta">
          O percurso ainda está sendo gravado, então o abate fica solto na
          propriedade e guarda a coordenada de onde você está.
        </div>

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
            <Icone nome="calendario" /> Aconteceu antes
          </button>
          <button :class="{ on: modo === 'tempoReal' }" @click="modo = 'tempoReal'">
            <Icone nome="relogio" /> Agora (tempo real)
          </button>
        </div>

        <template v-if="modo === 'tempoReal'">
          <div v-if="buscandoClima" class="meta">Consultando o tempo na propriedade…</div>
          <div v-else-if="clima?.ok" class="clima">
            <div><b>{{ clima.condicaoTempo }}</b> · {{ clima.luaFase }}</div>
            <div class="meta no-i18n">
              {{ clima.temp }}°C · {{ clima.umidade }}% ·
              vento {{ clima.vento }} km/h {{ clima.ventoDir }} ·
              chuva {{ clima.chuvaProb }}%
            </div>
            <!-- ⚠️ Dizer DE ONDE veio: sem isso não há como saber se o tempo
                 é do ponto do abate ou de outro lugar. -->
            <div class="meta no-i18n">
              <Icone nome="pino" :px="14" />
              {{ cevaId ? nomeDaCeva : Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5) }}
            </div>
            <div class="meta">
              Data, hora, lua e clima são gravados pelo servidor, medidos neste
              ponto. Fonte: MET Norway.
            </div>
          </div>
          <div v-else class="meta ruim">
            <Icone nome="alerta" /> Não foi possível consultar o tempo.
            <button class="btn sm sec" @click="verClima">Tentar de novo</button>
          </div>
        </template>

        <template v-else>
          <!-- Recuo automático: a consulta foi tentada e não veio, então os
               campos abrem em vez de barrar o registro. -->
          <div v-if="climaFalhou" class="recuo">
            <b><Icone nome="alerta" /> {{ motivoClima }}</b>
            <div class="meta">
              Preencha o tempo à mão para não perder o registro. Ele fica
              marcado como informado por você, e não medido.
            </div>
            <button class="btn sm sec" @click="modo = 'tempoReal'; verClima()">
              Tentar consultar de novo
            </button>
          </div>
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
          <!--
            ⚠️ O LIMITE VAI AO MAPA. Sem ele o "indicar no mapa" abria no
            Brasil inteiro, e nada avisava quando o ponto caía fora da divisa
            da propriedade daquela caçada.
          -->
          <BotaoGps
            v-model:lat="lat"
            v-model:lng="lng"
            :limite="m.propriedade?.limite || []"
            :nome-limite="m.propriedade?.nome"
          />
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
.recuo { border-left: 4px solid var(--alerta); background: var(--carvao-3); border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.recuo .meta { margin: 4px 0 0; }
.recuo .btn { margin-top: 8px; }
.clima { border-left: 4px solid var(--verde); padding: 8px 10px; background: var(--carvao-3); border-radius: 8px; }
.clima .meta { margin: 3px 0 0; }
.clima .btn { width: auto; margin-top: 6px; }
.local { margin: 8px 0; }
.check { display: flex; align-items: center; gap: 8px; margin: 12px 0 0; font-weight: 400; }
.check input { width: auto; flex: none; }
.prev { max-width: 160px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
