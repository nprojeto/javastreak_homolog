<script setup lang="ts">
/**
 * ── PAINEL DE CAMPO ───────────────────────────────────────────────────────
 *
 * O mapa da caçada aberta, dentro da própria caçada: limite da propriedade,
 * rotas, cevas, avisos já marcados e a sua posição ao vivo.
 *
 * ⚠️ ABSORVEU O GUIAMENTO. Havia uma tela separada só para isto, e ela era
 * redundante: quem entra numa caçada aberta já está no campo, e ver o caminho
 * é o motivo de entrar. Uma tela a menos entre a pessoa e o mapa.
 *
 * ⚠️ O GPS fica ligado enquanto o painel existe, e é desligado no
 * `onBeforeUnmount`. Esquecer o observador drena a bateria de quem só fechou
 * a aba — no mato isso não é detalhe.
 *
 * ⚠️ ABATE NÃO É GRAVADO AQUI. Escolher "Abate" leva à tela própria, com a
 * coordenada preenchida: peso, sexo, método, amostra e o tempo consultado na
 * hora não cabem num balão, e o registro vai ao relatório do IBAMA.
 */
import { useUi } from '~/stores/ui'
import { distanciaM, fmtDist, pontoDentro } from '~/composables/useMapa'
import { useBussola } from '~/composables/useBussola'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Ponto } from '~/composables/useMapa'
import type { LimiteGuia, RotaGuia, CevaGuia, MarcaGuia } from '~/components/MapaGuia.vue'

const props = defineProps<{
  /** Id da caçada. */
  manejoId: string
  /** Só o dono grava percurso e registra evento. */
  souDono?: boolean
}>()

interface Guia {
  id: string; nome?: string; tipo?: string; propriedadeId?: string
  limites: LimiteGuia[]
  /* `atribuida` separa a rota DESTA caçada das outras da propriedade. */
  rotas: Array<RotaGuia & { atribuida?: boolean }>
  cevas: Array<CevaGuia & { atribuida?: boolean }>
  marcacoes: MarcaGuia[]
}

const { server } = useServer()
const ui = useUi()
const {
  graus: rumoAparelho, erro: erroBussola,
  iniciar: iniciarBussola, pedirPermissao, daPosicao: rumoDoGps
} = useBussola()

/**
 * ── PERMISSÕES ANTES DO MAPA ──
 *
 * ⚠️ Entrar na caçada PEDE localização e bússola de uma vez, numa tela só. O
 * botão "ativar bússola" espalhado pelo caminho era pior de duas formas:
 * aparecia no meio da operação, e no iOS a permissão de orientação **só pode
 * ser pedida dentro de um gesto do usuário** — pedir sozinho é recusado em
 * silêncio, e o app parecia sem bússola.
 *
 * ⚠️ NÃO É BLOQUEIO. Quem recusar, ou estiver num aparelho sem sensor, segue
 * com o mapa: ele continua mostrando limite, rotas e cevas. O que se perde é
 * a própria posição e a seta — e a tela diz isso em vez de travar.
 */
const permissoesOk = ref(false)
const pedindo = ref(false)

async function autorizar() {
  pedindo.value = true
  try {
    /* A bússola primeiro: no iOS ela exige o gesto, e o diálogo do GPS
       logo em seguida não atrapalha. */
    await pedirPermissao()
    await new Promise<void>((resolve) => {
      if (!navigator.geolocation) { erroGps.value = 'Seu aparelho não oferece localização.'; resolve(); return }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          eu.value = { lat: p.coords.latitude, lng: p.coords.longitude,
            precisao: p.coords.accuracy ? Math.round(p.coords.accuracy) : undefined }
          resolve()
        },
        (e) => {
          erroGps.value = e.code === e.PERMISSION_DENIED
            ? 'Permissão de localização negada. Você segue vendo o mapa, mas não a sua posição.'
            : 'Sem sinal de GPS no momento. O mapa continua servindo.'
          resolve()
        },
        { enableHighAccuracy: true, timeout: 15000 }
      )
    })
  } finally {
    pedindo.value = false
    permissoesOk.value = true
    ligarGps()
    travarTela()
  }
}

const g = ref<Guia | null>(null)
const erro = ref('')
const eu = ref<{ lat: number; lng: number; precisao?: number } | null>(null)
const erroGps = ref('')
const seguir = ref(true)

let observador: number | null = null
let travaTela: WakeLockSentinel | null = null

/* ── filtros do mapa ───────────────────────────────────────────────────── */

/**
 * ⚠️ Tudo LIGADO por padrão. O filtro serve para tirar o que atrapalha, não
 * para obrigar a montar o mapa toda vez que se entra na caçada.
 */
const ver = reactive({ limite: true, rotas: true, cevas: true, avisos: true })
const filtros = ref(false)

const limitesVis = computed(() => (ver.limite ? g.value?.limites || [] : []))
/**
 * A rota da caçada em azul cheio; as outras da propriedade em azul apagado.
 * Sem essa diferença, a pessoa confunde o caminho que escolheu com o que
 * simplesmente existe no terreno.
 */
const rotasVis = computed(() => (ver.rotas ? g.value?.rotas || [] : [])
  .map((r) => ({ ...r, cor: r.atribuida === false ? '#4a6b8a' : '#2f6ea8' })))
const cevasVis = computed(() => (ver.cevas ? g.value?.cevas || [] : []))
const marcasVis = computed(() => (ver.avisos ? g.value?.marcacoes || [] : []))

const ehLivre = computed(() => g.value?.tipo === 'livre')
const temRota = computed(() => (g.value?.rotas || []).some((r) => (r.pontos || []).length > 1))

const dentro = computed(() => {
  const p = eu.value
  const ls = (g.value?.limites || []).filter((l) => (l.limite || []).length >= 3)
  if (!p || !ls.length) return null
  return ls.some((l) => pontoDentro(p, l.limite))
})

/* ── percurso ──────────────────────────────────────────────────────────── */

/**
 * ⚠️ Ponto novo só a cada 15 m. Sem esse filtro, o GPS parado gera dezenas de
 * pontos no mesmo lugar: o traçado vira um borrão e o payload cresce à toa.
 */
const DIST_MIN_M = 15

const gravando = ref(false)
const percurso = ref<Ponto[]>([])
const salvandoPercurso = ref(false)

const distanciaPercurso = computed(() => {
  let m = 0
  for (let i = 1; i < percurso.value.length; i++) {
    m += distanciaM(percurso.value[i - 1]!, percurso.value[i]!)
  }
  return m
})

/** As rotas da caçada mais o percurso em gravação, para ver o já feito. */
const rotasNoMapa = computed(() => {
  const base = rotasVis.value
  if (!gravando.value || percurso.value.length < 2) return base
  return [...base, { id: '__percurso', nome: 'Percurso de agora', pontos: percurso.value }]
})

function pontoDoPercurso(p: { lat: number; lng: number }) {
  if (!gravando.value) return
  const u = percurso.value[percurso.value.length - 1]
  if (u && distanciaM(u, p) < DIST_MIN_M) return
  percurso.value = [...percurso.value, { lat: p.lat, lng: p.lng }]
}

function comecarPercurso() {
  percurso.value = []
  gravando.value = true
  ui.avisar('Gravando o percurso — ele vira uma rota ao concluir')
}

async function salvarPercurso() {
  if (percurso.value.length < 2) {
    ui.avisar('Ande um pouco antes de salvar — o percurso ainda não tem traçado', 'erro')
    return
  }
  if (!g.value?.propriedadeId) {
    ui.avisar('Não consegui identificar a propriedade desta caçada. Recarregue a tela e tente de novo.', 'erro')
    return
  }
  const nome = prompt('Nome da rota:', 'Percurso de ' + new Date().toLocaleDateString())
  if (nome === null) return
  salvandoPercurso.value = true
  try {
    /* ⚠️ `origem: 'gps'` é o que faz o servidor AVISAR em vez de recusar
       quando o traçado sai do limite. Sem isso, um passo na divisa jogaria
       fora a caminhada inteira. */
    const r = await server<{ foraDoLimite?: boolean }>('apiCriarRota', {
      nome: nome || 'Percurso',
      propriedadeId: g.value.propriedadeId,
      pontos: percurso.value,
      origem: 'gps',
      modalidade: 'manejo',
      distancia: Math.round(distanciaPercurso.value)
    })
    gravando.value = false
    percurso.value = []
    ui.avisar(r?.foraDoLimite
      ? 'Rota salva ✔ — parte do percurso saiu do limite da propriedade'
      : 'Rota salva ✔')
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    salvandoPercurso.value = false
  }
}

/* ── registrar evento ──────────────────────────────────────────────────── */

const ABATE = 'Abate'
/**
 * O vocabulário do servidor (`TIPOS_MARCACAO`), com `Abate` na frente porque é
 * o que se procura primeiro depois de acontecer.
 */
const TIPOS = [ABATE, 'Avistamento', 'Rastro', 'Perigo', 'Armadilha', 'Água',
  'Comida/isca', 'Referência', 'Foto/registro', 'Aviso', 'Outro']

const painel = ref(false)
const escolhendo = ref(false)
const pontoNovo = ref<Ponto | null>(null)
const tipoNovo = ref('Avistamento')
const descNovo = ref('')
const statusNovo = ref<'Ativa' | 'Inativa'>('Ativa')
const fotoNova = ref('')
const salvando = ref(false)

const ehAbate = computed(() => tipoNovo.value === ABATE)

/**
 * ── ONDE O EVENTO ENTRA ──
 *
 * Com uma rota só, ele vai nela sem perguntar. Com mais de uma — ou com cevas
 * também —, a pergunta é obrigatória: um aviso pendurado na rota errada é pior
 * que um aviso solto, porque ninguém desconfia dele depois.
 *
 * Gravando percurso, a primeira opção é o percurso de agora: é onde a pessoa
 * está, e é o que ela quer marcar.
 */
const ondeNovo = ref('')

const opcoesOnde = computed(() => {
  const o: Array<{ valor: string; rotulo: string }> = []
  if (gravando.value) o.push({ valor: '__percurso', rotulo: 'No percurso que estou gravando' })
  for (const r of g.value?.rotas || []) o.push({ valor: 'r:' + r.id, rotulo: 'Rota: ' + (r.nome || 'rota') })
  for (const c of g.value?.cevas || []) o.push({ valor: 'c:' + c.id, rotulo: 'Ceva: ' + (c.nome || 'ceva') })
  o.push({ valor: '', rotulo: 'Solto no mapa' })
  return o
})

/** Só pergunta quando há mais de uma escolha de verdade. */
const precisaEscolherOnde = computed(() => opcoesOnde.value.length > 2)

const pontoForaDoLimite = computed(() => {
  const p = pontoNovo.value
  const ls = (g.value?.limites || []).filter((l) => (l.limite || []).length >= 3)
  if (!p || !ls.length) return false
  return !ls.some((l) => pontoDentro(p, l.limite))
})

function abrirPainel() {
  pontoNovo.value = eu.value ? { lat: eu.value.lat, lng: eu.value.lng } : null
  escolhendo.value = !eu.value
  ondeNovo.value = opcoesOnde.value[0]?.valor ?? ''
  painel.value = true
  seguir.value = false
}

function fecharPainel() {
  painel.value = false
  escolhendo.value = false
  pontoNovo.value = null
  descNovo.value = ''
  fotoNova.value = ''
  tipoNovo.value = 'Avistamento'
  statusNovo.value = 'Ativa'
  seguir.value = true
}

function trocarPonto() {
  escolhendo.value = true
  pontoNovo.value = null
}

function escolheuNoMapa(p: Ponto) {
  pontoNovo.value = p
  escolhendo.value = false
}

async function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { fotoNova.value = ''; return }
  try {
    const a = await lerArquivo(f, { tipos: ['image/jpeg', 'image/png', 'image/webp'], maxMb: FOTO_MAX_MB })
    fotoNova.value = a.dados
  } catch (err) {
    fotoNova.value = ''
    ui.avisar(err instanceof Error ? err.message : 'Imagem inválida', 'erro')
  }
}

async function salvarEvento() {
  const p = pontoNovo.value
  if (!p) { ui.avisar('Escolha o ponto no mapa ou use a sua posição', 'erro'); return }
  salvando.value = true
  try {
    /* O percurso ainda não tem id — a marcação nasce solta e o traçado
       guarda o lugar. Amarrar a uma rota que não existe seria mentira. */
    const onde = ondeNovo.value
    const rotaId = onde.startsWith('r:') ? onde.slice(2) : ''
    const criada = await server<MarcaGuia>('apiCriarMarcacao', {
      rotaId,
      tipo: tipoNovo.value,
      lat: p.lat,
      lng: p.lng,
      descricao: descNovo.value,
      status: tipoNovo.value === 'Armadilha' ? statusNovo.value : '',
      foto: fotoNova.value || ''
    })
    if (g.value) g.value.marcacoes = [...(g.value.marcacoes || []), criada]
    ui.avisar(tipoNovo.value + ' registrado ✔')
    fecharPainel()
  } catch { /* já avisado, traduzido */ } finally {
    salvando.value = false
  }
}

/** Leva ao registro de abate com a coordenada e a ceva já escolhidas. */
function irParaAbate() {
  const p = pontoNovo.value || eu.value
  const q: Record<string, string> = { manejo: props.manejoId }
  if (p) { q.lat = p.lat.toFixed(6); q.lng = p.lng.toFixed(6) }
  if (ondeNovo.value.startsWith('c:')) q.ceva = ondeNovo.value.slice(2)
  navigateTo({ path: '/abate', query: q })
}

/* ── ciclo de vida ─────────────────────────────────────────────────────── */

async function carregar() {
  erro.value = ''
  try {
    g.value = await server<Guia>('apiManejoGuia', props.manejoId)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o mapa da caçada'
  }
}

function ligarGps() {
  if (!navigator.geolocation) { erroGps.value = 'Seu aparelho não oferece localização.'; return }
  observador = navigator.geolocation.watchPosition(
    (p) => {
      erroGps.value = ''
      eu.value = {
        lat: p.coords.latitude, lng: p.coords.longitude,
        precisao: p.coords.accuracy ? Math.round(p.coords.accuracy) : undefined
      }
      rumoDoGps(p.coords.heading)
      pontoDoPercurso({ lat: p.coords.latitude, lng: p.coords.longitude })
    },
    (e) => {
      erroGps.value = e.code === e.PERMISSION_DENIED
        ? 'Permissão de localização negada. Libere no navegador para se ver no mapa.'
        : 'Sem sinal de GPS no momento. O mapa continua servindo.'
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 }
  )
}

/** Sem isto o celular apaga no meio da caminhada. Nem todo navegador tem. */
async function travarTela() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }
    if (nav.wakeLock) travaTela = await nav.wakeLock.request('screen')
  } catch { /* negado ou sem suporte */ }
}

onMounted(() => {
  carregar()
  /* `iniciar` só PREPARA: no iOS ele marca que falta permissão, e quem pede
     é o botão — dentro do gesto, que é a única forma que funciona lá. */
  iniciarBussola()
})

onBeforeUnmount(() => {
  if (observador !== null) navigator.geolocation.clearWatch(observador)
  observador = null
  travaTela?.release().catch(() => { /* já solta */ })
  travaTela = null
})
</script>

<template>
  <div class="campo">
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!g" class="card"><div class="meta">Carregando o mapa…</div></div>

    <!-- ⚠️ PORTA DE ENTRADA: pede as duas permissões de uma vez. -->
    <div v-else-if="!permissoesOk" class="card portao">
      <h3><Icone nome="pino" /> Antes de entrar no campo</h3>
      <!-- ⚠️ Uma frase inteira por nó de texto: o tradutor casa o texto do nó
           contra o dicionário, e um <b> no meio parte a frase em pedaços que
           nunca casam — a tela ficaria em português no modo inglês. -->
      <div class="meta">
        O mapa usa a sua localização para mostrar onde você está e gravar o
        percurso, e a bússola para saber para que lado você está virado.
      </div>
      <button class="btn" :disabled="pedindo" @click="autorizar">
        {{ pedindo ? 'Aguardando…' : 'Autorizar e abrir o mapa' }}
      </button>
      <button class="btn sec" :disabled="pedindo" @click="permissoesOk = true">
        Abrir sem localização
      </button>
      <div class="meta">
        Sem autorizar, o mapa continua mostrando o limite, as rotas e as cevas
        — mas não a sua posição.
      </div>
    </div>

    <template v-else>
      <!-- situação, antes do mapa -->
      <div class="situacao">
        <div class="bloco" :class="dentro === false ? 'ruim' : dentro ? 'bom' : ''">
          <span class="rot">Propriedade</span>
          <b v-if="dentro === null">—</b>
          <b v-else-if="dentro">Dentro do limite</b>
          <b v-else>Fora do limite</b>
        </div>
        <div class="bloco">
          <span class="rot">Precisão</span>
          <b>{{ eu?.precisao ? fmtDist(eu.precisao) : '—' }}</b>
        </div>
        <button class="bloco filtro" @click="filtros = !filtros">
          <span class="rot">Mostrar</span>
          <b><Icone nome="filtrar" :px="16" /> Filtros</b>
        </button>
      </div>

      <div v-if="filtros" class="card filtros">
        <label class="check"><input v-model="ver.limite" type="checkbox"> <span>Limite da propriedade</span></label>
        <label class="check"><input v-model="ver.rotas" type="checkbox"> <span>Rotas</span></label>
        <label class="check"><input v-model="ver.cevas" type="checkbox"> <span>Cevas</span></label>
        <label class="check"><input v-model="ver.avisos" type="checkbox"> <span>Avisos e marcações</span></label>
      </div>

      <div v-if="erroGps" class="card aviso-gps">
        <div class="meta"><Icone nome="alerta" /> {{ erroGps }}</div>
      </div>
      <div v-else-if="!eu" class="card aviso-gps">
        <div class="meta"><Icone nome="pino" /> Procurando o sinal do GPS…</div>
      </div>

      <div v-if="erroBussola" class="card aviso-gps">
        <div class="meta"><Icone nome="alerta" /> {{ erroBussola }}</div>
      </div>

      <div class="palco">
      <ClientOnly>
        <MapaGuia
          :limites="limitesVis"
          :rotas="rotasNoMapa"
          :cevas="cevasVis"
          :marcacoes="marcasVis"
          :eu="eu"
          :seguir="seguir"
          :escolhendo="escolhendo"
          :ponto-novo="pontoNovo"
          :rumo-aparelho="rumoAparelho"
          altura="50vh"
          @escolher="escolheuNoMapa"
          @arrastou="seguir = false"
        />
      </ClientOnly>

      <!--
        ⚠️ SOBRE o mapa e só quando ele foi arrastado para longe. Como botão
        fixo abaixo, ele ocupava espaço permanente para uma ação que quase
        nunca é necessária — o mapa segue a posição sozinho.
      -->
      <button v-if="!seguir && !escolhendo" class="centralizar" @click="seguir = true">
        <Icone nome="pino" :px="16" /> Centralizar
      </button>
      </div>

      <div v-if="escolhendo" class="card tocar">
        <div class="meta"><Icone nome="pino" /> Toque no mapa para marcar o ponto.</div>
        <button class="btn sec pequeno" @click="fecharPainel">Cancelar</button>
      </div>

      <!-- PERCURSO -->
      <template v-if="souDono">
        <div v-if="gravando" class="card percurso">
          <div class="linha">
            <span class="ponto-vivo" />
            <div class="grow">
              <b>Gravando o percurso</b>
              <div class="meta">
                <span class="no-i18n">{{ percurso.length }}</span> ponto(s) ·
                <span class="no-i18n">{{ fmtDist(distanciaPercurso) }}</span>
              </div>
            </div>
          </div>
          <button class="btn" :disabled="salvandoPercurso || percurso.length < 2" @click="salvarPercurso">
            <Icone nome="salvar" />
            {{ salvandoPercurso ? 'Salvando…' : 'Concluir e salvar rota' }}
          </button>
          <div class="meta">
            Ao concluir, o percurso vira uma rota. Para se livrar dela depois,
            apague em Rotas.
          </div>
        </div>

        <div v-if="!painel" class="acoes-campo">
          <button class="btn" @click="abrirPainel">
            <Icone nome="adicionar" /> Registrar evento
          </button>
          <button v-if="!gravando" class="btn sec" @click="comecarPercurso">
            <Icone nome="rotas" /> Gravar novo percurso
          </button>
        </div>
      </template>

      <!-- PAINEL DE EVENTO -->
      <div v-if="painel" class="card painel">
        <h3><Icone nome="adicionar" /> Registrar evento</h3>

        <label for="cp_tipo">O que aconteceu? *</label>
        <select id="cp_tipo" v-model="tipoNovo">
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>

        <template v-if="precisaEscolherOnde">
          <label for="cp_onde">Onde registrar *</label>
          <select id="cp_onde" v-model="ondeNovo">
            <option v-for="o in opcoesOnde" :key="o.valor" :value="o.valor">{{ o.rotulo }}</option>
          </select>
        </template>

        <div class="ponto" :class="{ falta: !pontoNovo }">
          <template v-if="pontoNovo">
            <b class="no-i18n">{{ pontoNovo.lat.toFixed(5) }}, {{ pontoNovo.lng.toFixed(5) }}</b>
            <div v-if="pontoForaDoLimite" class="meta alerta">
              <Icone nome="alerta" /> Este ponto está fora do limite da propriedade.
            </div>
          </template>
          <span v-else>Toque no mapa para marcar o ponto.</span>
          <button class="trocar" @click="trocarPonto">
            <Icone nome="pino" :px="14" /> {{ pontoNovo ? 'Trocar ponto' : 'Escolher no mapa' }}
          </button>
        </div>

        <!-- ABATE: sai daqui para a tela própria -->
        <div v-if="ehAbate" class="desvio">
          <div class="meta">
            O abate tem tela própria: precisa de peso, sexo, método e do tempo
            consultado na hora. A coordenada vai preenchida daqui.
          </div>
          <button class="btn" @click="irParaAbate">
            <img src="/marca/javali-branco.png" class="ic-javali" alt=""> Abrir o registro de abate
          </button>
          <button class="btn sec" @click="fecharPainel">Cancelar</button>
        </div>

        <template v-else>
          <template v-if="tipoNovo === 'Armadilha'">
            <label for="cp_st">Situação da armadilha</label>
            <select id="cp_st" v-model="statusNovo">
              <option value="Ativa">Ativa</option>
              <option value="Inativa">Inativa</option>
            </select>
          </template>

          <label for="cp_desc">Descrição</label>
          <input id="cp_desc" v-model="descNovo" class="no-i18n" placeholder="opcional">

          <label for="cp_foto">Foto</label>
          <input id="cp_foto" type="file" accept="image/*" capture="environment" @change="escolheuFoto">

          <div class="acoes">
            <button class="btn" :disabled="salvando || !pontoNovo" @click="salvarEvento">
              {{ salvando ? 'Salvando…' : 'Salvar' }}
            </button>
            <button class="btn sec" :disabled="salvando" @click="fecharPainel">Cancelar</button>
          </div>
        </template>
      </div>

      <div v-if="!temRota && !ehLivre" class="meta">
        Esta caçada não tem rota. O mapa mostra o limite e as cevas.
      </div>
    </template>
  </div>
</template>

<style scoped>
.campo { margin-bottom: 12px; }
.ruim { color: var(--danger); }

.situacao { display: flex; gap: 8px; margin-bottom: 10px; }
.bloco {
  flex: 1; background: var(--card); border: 1px solid var(--linha);
  border-left: 4px solid var(--linha); border-radius: 12px; padding: 8px 10px;
  text-align: left; color: var(--txt); font: inherit; cursor: default;
}
.bloco.filtro { cursor: pointer; }
.bloco .rot { display: block; font-size: 10.5px; color: var(--osso-2); text-transform: uppercase; letter-spacing: .04em; }
.bloco b { font-size: 14px; }
.bloco.bom { border-left-color: var(--verde); }
.bloco.ruim { border-left-color: var(--danger); }
.bloco.ruim b { color: var(--danger); }

.filtros { margin-bottom: 10px; }
.filtros .check { display: flex; align-items: center; gap: 8px; padding: 5px 0; }

.aviso-gps { border-left: 4px solid var(--alerta); margin-bottom: 10px; }
.aviso-gps .meta { margin: 0; }
.pequeno { width: auto; margin: 8px 0 0; padding: 6px 12px; font-size: 12px; }

.tocar { display: flex; align-items: center; gap: 10px; margin-top: 10px; border-left: 4px solid var(--laranja-cl); }
.tocar .meta { margin: 0; flex: 1; }

.portao { border-left: 4px solid var(--laranja); }
.portao h3 { margin: 0 0 6px; font-size: 15px; }
.portao .btn { margin-top: 10px; }

/* Botão flutuante sobre o mapa: translúcido para não tapar o terreno. */
.palco { position: relative; }
.centralizar {
  position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  z-index: 500; display: flex; align-items: center; gap: 6px;
  background: rgba(32, 30, 23, .82); color: var(--osso);
  border: 1px solid var(--linha); border-radius: 999px;
  padding: 8px 16px; font: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer; backdrop-filter: blur(3px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .4);
}
.centralizar:active { background: rgba(32, 30, 23, .95); }

.acoes-campo { display: flex; gap: 8px; margin-top: 10px; }
.acoes-campo .btn { flex: 1; margin: 0; }

.percurso { margin-top: 10px; border-left: 4px solid var(--danger); }
.percurso .linha { display: flex; align-items: center; gap: 10px; }
.percurso .grow { flex: 1; min-width: 0; }
.percurso .meta { margin: 2px 0 0; }
.percurso .btn { margin-top: 10px; }
.ponto-vivo {
  flex: none; width: 11px; height: 11px; border-radius: 50%;
  background: var(--danger); animation: pulsa 1.6s ease-in-out infinite;
}
@keyframes pulsa { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }

.painel { margin-top: 10px; border-left: 4px solid var(--laranja-cl); }
.painel h3 { margin: 0 0 8px; font-size: 15px; }
.ponto { background: var(--carvao-3); border-radius: 8px; padding: 8px 10px; margin: 10px 0; font-size: 13px; }
.ponto.falta { color: var(--osso-2); }
.ponto .meta { margin: 4px 0 0; }
.ponto .alerta { color: var(--alerta); }
.trocar {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
  border: 1px solid var(--linha); background: none; color: var(--laranja-cl);
  font: inherit; font-size: 11.5px; padding: 4px 10px; border-radius: 999px; cursor: pointer;
}
.desvio { margin-top: 10px; }
.desvio .btn { margin-top: 10px; }
.acoes { display: flex; gap: 8px; margin-top: 12px; }
.acoes .btn { flex: 1; margin: 0; }

/* O javali da marca, em branco, dentro do botão laranja. */
.ic-javali { width: 20px; height: 20px; object-fit: contain; vertical-align: -4px; margin-right: 4px; }
</style>
