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
import { usePercurso } from '~/composables/usePercurso'
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
  graus: rumoAparelho, fonte: fonteBussola, precisaPermissao, erro: erroBussola,
  iniciar: iniciarBussola, pedirPermissao, daPosicao: rumoDoGps
} = useBussola()

/**
 * ── PERMISSÕES ──
 *
 * ⚠️ SEM TELA DE AUTORIZAÇÃO. Quem pede é o navegador, com o pop-up dele:
 * `getCurrentPosition` na abertura dispara o diálogo nativo de localização
 * sem precisar de botão nenhum.
 *
 * ⚠️ A BÚSSOLA NO iOS é o caso difícil, e não dá para contornar:
 * `requestPermission()` só funciona dentro de um gesto do usuário — chamada
 * na abertura, é recusada em silêncio. A saída é pendurá-la no PRIMEIRO
 * TOQUE da pessoa na tela, qualquer que seja ele: rolar, tocar no mapa,
 * abrir o filtro. O pop-up nativo aparece nesse instante, e nenhum botão
 * precisou existir para isso.
 */
/**
 * ⚠️ O TOQUE-INVISÍVEL NÃO BASTOU. Pendurar `requestPermission()` no primeiro
 * toque da tela parecia elegante, mas falhava calado: o Safari só aceita o
 * pedido em alguns tipos de gesto, e um toque para rolar costuma não valer —
 * a pessoa ficava sem bússola sem saber por quê, e sem nada para tocar.
 *
 * Agora há um botão de verdade, flutuando sobre o mapa. Ele SOME assim que a
 * bússola responde, então não estorva quem já autorizou.
 */
const pedindoBussola = ref(false)

const precisaAtivarBussola = computed(() =>
  /* Some quando o sensor responde — mesmo que a permissão nunca tenha sido
     pedida, que é o caso do Android. */
  fonteBussola.value !== 'sensor' && (precisaPermissao.value || rumoAparelho.value === null))

async function ativarBussola() {
  pedindoBussola.value = true
  try {
    await pedirPermissao()
  } catch {
    /* Recusou ou o aparelho não tem sensor: o mapa continua servindo. */
  } finally {
    pedindoBussola.value = false
  }
}

const mapaRef = ref<{ centralizar: (z?: number) => void; enquadrar: () => void } | null>(null)

/**
 * ⚠️ Centralizar faz DUAS coisas: religa o seguimento e aproxima em ~20 m.
 * Só religar deixava o mapa no zoom em que a pessoa tinha parado, que costuma
 * ser longe — e o botão parecia não ter funcionado.
 */
function centralizar() {
  seguir.value = true
  mapaRef.value?.centralizar(19)
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
const {
  atual: guardado, daCacada, comecar, acrescentar, limpar: limparPercurso,
  marcarInterrompido
} = usePercurso()

/* O percurso desta caçada — outro guardado, de outra caçada, não conta. */
const meuPercurso = computed(() => daCacada(props.manejoId))
const gravando = computed(() => !!meuPercurso.value)
const percurso = computed<Ponto[]>(() => meuPercurso.value?.pontos || [])
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
  acrescentar(p, distanciaM)
}

/**
 * ⚠️ SÓ COMEÇA DENTRO DO LIMITE. O percurso vira uma rota da propriedade, e
 * rota que nasce fora dela não é rota daquela propriedade — é caminhada de
 * chegada, estrada, o percurso do carro até a porteira. Deixar gravar de
 * qualquer lugar encheria as Rotas de traçados que não servem a ninguém.
 *
 * ⚠️ O que já está gravando NÃO é interrompido ao sair do limite: divisa com
 * sinal ruim é rotina, e cortar a gravação no meio perderia a caminhada. É a
 * mesma escolha do salvamento, que avisa e salva em vez de recusar.
 */
const podeGravar = computed(() => {
  const ls = (g.value?.limites || []).filter((l) => (l.limite || []).length >= 3)
  /* Sem posição ou sem limite desenhado, não há como afirmar que está fora —
     e travar por falta de informação seria pior que não travar. */
  if (!eu.value || !ls.length) return true
  return ls.some((l) => pontoDentro(eu.value!, l.limite))
})

/**
 * ⚠️ O NOME É PEDIDO NA LARGADA, não no fim. Duas razões, e a segunda é a que
 * importa: perguntar no fim exige que a pessoa esteja com o celular na mão e
 * o app aberto naquele instante — e se o aparelho morrer no meio da
 * caminhada, o traçado fica sem nome e não há como salvá-lo sozinho depois.
 * Com o nome já escolhido, a recuperação é automática.
 */
function comecarPercurso() {
  if (!podeGravar.value) {
    ui.avisar('Você está fora do limite da propriedade. Entre nela para começar a gravar.', 'erro')
    return
  }
  if (!g.value?.propriedadeId) {
    ui.avisar('Não consegui identificar a propriedade desta caçada. Recarregue a tela e tente de novo.', 'erro')
    return
  }
  const nome = prompt(
    'Nome da rota que vai ser gravada:',
    'Percurso de ' + new Date().toLocaleDateString()
  )
  if (nome === null) return
  comecar(props.manejoId, g.value.propriedadeId, nome.trim() || 'Percurso')
  ui.avisar('Gravando o percurso — ele vira uma rota ao concluir')
}

/**
 * Cancela a gravação e joga fora o traçado.
 *
 * ⚠️ PEDE CONFIRMAÇÃO, e a frase diz o que se perde. É o único botão desta
 * tela que destrói trabalho: quem andou dois quilômetros não pode perder isso
 * por um toque errado com o celular na mão. Antes não existia cancelar
 * nenhum — a única saída era sair da tela, o que dava no mesmo sem avisar.
 */
function cancelarPercurso() {
  /* ⚠️ COM ABATE VINCULADO, não descarta. Um abate ligado a um traçado que
     nunca existiu vira registro órfão no relatório do IBAMA — e o abate não
     pode ser desfeito para acompanhar. Salvar é o único caminho. */
  if ((meuPercurso.value?.abates || 0) > 0) {
    ui.avisar(
      'Este percurso tem abate registrado. Conclua e salve — descartar deixaria o abate sem a rota.',
      'erro'
    )
    return
  }
  const n = percurso.value.length
  if (n > 1 && !confirm(
    'Cancelar a gravação?\n\n'
    + 'O percurso de ' + fmtDist(distanciaPercurso.value) + ' que você andou até aqui '
    + 'será descartado. Não dá para recuperar.'
  )) return
  limparPercurso()
  ui.avisar('Gravação cancelada')
}

async function salvarPercurso(silencioso = false) {
  const cur = meuPercurso.value
  if (!cur) return
  if (cur.pontos.length < 2) {
    if (!silencioso) {
      ui.avisar('Ande um pouco antes de salvar — o percurso ainda não tem traçado', 'erro')
    }
    return
  }
  const nome = cur.nome
  salvandoPercurso.value = true
  try {
    /* ⚠️ `origem: 'gps'` é o que faz o servidor AVISAR em vez de recusar
       quando o traçado sai do limite. Sem isso, um passo na divisa jogaria
       fora a caminhada inteira. */
    const r = await server<{ foraDoLimite?: boolean }>('apiCriarRota', {
      nome: nome || 'Percurso',
      propriedadeId: cur.propriedadeId,
      pontos: cur.pontos,
      origem: 'gps',
      modalidade: 'manejo',
      distancia: Math.round(distanciaPercurso.value)
    })
    limparPercurso()
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
  if (gravando.value) o.push({ valor: '__percurso', rotulo: 'No percurso em gravação' })
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

/**
 * Atalho direto para o abate, sem passar pelo painel. É o caminho de quem
 * acabou de abater e não precisa escolher tipo de evento.
 */
function irDiretoAoAbate() {
  const q: Record<string, string> = { manejo: props.manejoId }
  if (eu.value) { q.lat = eu.value.lat.toFixed(6); q.lng = eu.value.lng.toFixed(6) }
  /**
   * ⚠️ Gravando percurso, isso vai junto — a tela do abate oferece "no
   * percurso que estou gravando" como opção. Sem o aviso, a pessoa teria de
   * lembrar sozinha que estava gravando.
   */
  if (gravando.value) q.percurso = '1'
  /* Com UM item só na propriedade, ele vai escolhido: poupa um toque e o
     clima em tempo real sai da coordenada certa. Com vários, quem escolhe é
     a tela do abate, que tem o seletor. */
  const cs = g.value?.cevas || [], rs = g.value?.rotas || []
  if (cs.length === 1 && !rs.length) q.ceva = String(cs[0]!.id)
  else if (rs.length === 1 && !cs.length) q.rota = String(rs[0]!.id)
  navigateTo({ path: '/abate', query: q })
}

/** Leva ao registro de abate com a coordenada e a ceva já escolhidas. */
function irParaAbate() {
  const p = pontoNovo.value || eu.value
  const q: Record<string, string> = { manejo: props.manejoId }
  if (p) { q.lat = p.lat.toFixed(6); q.lng = p.lng.toFixed(6) }
  /* O "onde" já escolhido no painel viaja junto — a tela do abate não repete
     a pergunta que a pessoa acabou de responder. */
  if (ondeNovo.value.startsWith('c:')) q.ceva = ondeNovo.value.slice(2)
  else if (ondeNovo.value.startsWith('r:')) q.rota = ondeNovo.value.slice(2)
  else if (ondeNovo.value === '__percurso') q.percurso = '1'
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

/**
 * ── RECUPERAÇÃO ──
 *
 * ⚠️ O app NÃO consegue salvar sozinho enquanto está fechado: sem JavaScript
 * rodando não há chamada de API, e `sendBeacon` não manda o cabeçalho de
 * autenticação que a Edge Function exige. O que dá para garantir é o traçado
 * sobreviver no aparelho e ser salvo na PRIMEIRA vez que a caçada reabrir —
 * que é o primeiro instante em que existe rede e sessão de novo.
 *
 * ⚠️ Salva SOZINHO porque o nome foi escolhido na largada. Sem ele, restaria
 * perguntar — e perguntar é o que falha quando a pessoa não está com o
 * aparelho na mão.
 */
async function recuperarPercurso() {
  const cur = meuPercurso.value
  if (!cur || !cur.interrompido) return
  if (cur.pontos.length < 2) {
    /* Nada andado: não vale virar rota, e guardar não serve para nada. */
    limparPercurso()
    return
  }
  ui.avisar('Recuperando o percurso interrompido…')
  await salvarPercurso(true)
}

/* Marca a interrupção enquanto ainda há JavaScript vivo. `pagehide` é o único
   evento em que o Safari do iOS ainda executa antes de matar a página. */
function aoSair() { marcarInterrompido() }

onMounted(() => {
  carregar()
  recuperarPercurso()
  window.addEventListener('pagehide', aoSair)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') marcarInterrompido()
  })
  iniciarBussola()
  /* O diálogo nativo do GPS aparece aqui, sem intermediário. */
  ligarGps()
  travarTela()
})

onBeforeUnmount(() => {
  window.removeEventListener('pagehide', aoSair)
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
          ref="mapaRef"
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
      <button v-if="!seguir && !escolhendo" class="centralizar" @click="centralizar">
        <Icone nome="pino" :px="16" /> Centralizar
      </button>

      <!-- ⚠️ Some sozinho quando a bússola responde. -->
      <button
        v-if="precisaAtivarBussola && !escolhendo"
        class="ativar-bussola"
        :disabled="pedindoBussola"
        @click="ativarBussola"
      >
        <Icone nome="global" :px="16" />
        {{ pedindoBussola ? 'Aguardando…' : 'Ativar bússola' }}
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
          <div class="acoes-perc">
            <button class="btn" :disabled="salvandoPercurso || percurso.length < 2" @click="salvarPercurso()">
              <Icone nome="salvar" />
              {{ salvandoPercurso ? 'Salvando…' : 'Concluir e salvar rota' }}
            </button>
            <button class="btn sec" :disabled="salvandoPercurso" @click="cancelarPercurso">
              Cancelar
            </button>
          </div>
          <div class="meta">
            Ao concluir, o percurso vira uma rota. Para se livrar dela depois,
            apague em Rotas.
          </div>
        </div>

        <!--
          ⚠️ TRÊS botões, um por ação, e nenhum repetido na tela. Antes havia
          "Registrar evento" aqui e outro igual no fim da aba Abates — dois
          botões idênticos na mesma tela, e nenhum jeito de saber que faziam a
          mesma coisa. O abate ganhou botão próprio porque é o registro que
          mais se procura depois que acontece.
        -->
        <div v-if="!podeGravar && !painel" class="meta fora-limite">
          <Icone nome="alerta" /> Você está fora do limite da propriedade —
          o percurso só começa lá dentro.
        </div>

        <div v-if="!painel" class="acoes-campo">
          <button class="btn sec" @click="abrirPainel">
            <Icone nome="adicionar" /> Registrar evento
          </button>
          <button class="btn" @click="irDiretoAoAbate">
            <img src="/marca/javali-branco.png" class="ic-javali" alt=""> Registrar abate
          </button>
          <button
            v-if="!gravando"
            class="btn sec"
            :class="{ off: !podeGravar }"
            @click="comecarPercurso"
          >
            <Icone :nome="podeGravar ? 'rotas' : 'bloqueio'" /> Gravar novo percurso
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
  background: rgba(32, 30, 23, .94); color: var(--osso);
  border: 1px solid var(--linha); border-radius: 999px;
  padding: 8px 16px; font: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer;
  /* ⚠️ SEM `backdrop-filter`. Ele deixava o botão mais bonito e é conhecido
     por causar artefato de repintura no Safari do iOS: o navegador recompõe a
     camada e o mapa aparece borrado por cima do que vem depois. Um fundo
     opaco custa nada e não tem esse risco. */
  box-shadow: 0 2px 8px rgba(0, 0, 0, .4);
}
.centralizar:active { background: rgba(32, 30, 23, .95); }

/* No topo, para não brigar com o Centralizar, que fica embaixo. */
.ativar-bussola {
  position: absolute; left: 50%; top: 12px; transform: translateX(-50%);
  z-index: 500; display: flex; align-items: center; gap: 6px;
  background: rgba(32, 30, 23, .94); color: var(--laranja-cl);
  border: 1px solid var(--laranja); border-radius: 999px;
  padding: 8px 16px; font: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, .4);
}
.ativar-bussola:active { background: rgba(32, 30, 23, 1); }

/* Três numa linha só num celular de 360 px: rótulo curto, duas linhas se
   precisar, e nada de ícone gigante. */
.acoes-campo { display: flex; gap: 6px; margin-top: 10px; }
.acoes-campo .btn {
  flex: 1; margin: 0; padding: 10px 6px; font-size: 11.5px; line-height: 1.25;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.ic-javali { width: 20px; height: 20px; object-fit: contain; }
/* Continua clicável: o toque explica o motivo em vez de não fazer nada. */
.acoes-campo .btn.off { opacity: .5; border-style: dashed; }
.fora-limite { margin: 10px 4px 0; color: var(--alerta); }

.percurso { margin-top: 10px; border-left: 4px solid var(--danger); }
.percurso .linha { display: flex; align-items: center; gap: 10px; }
.percurso .grow { flex: 1; min-width: 0; }
.percurso .meta { margin: 2px 0 0; }
.acoes-perc { display: flex; gap: 8px; margin-top: 10px; }
.acoes-perc .btn { flex: 1; margin: 0; }
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
