<script setup lang="ts">
/**
 * ── GUIAMENTO ─────────────────────────────────────────────────────────────
 *
 * Seguir a rota da caçada no campo. Responde a três perguntas, nessa ordem:
 * onde estou, estou no caminho, e o que vem pela frente.
 *
 * ⚠️ O GPS fica LIGADO enquanto a tela está aberta (`watchPosition`), e é
 * desligado no `onBeforeUnmount`. Esquecer de limpar o observador drena a
 * bateria de quem só fechou a aba — no mato isso não é detalhe.
 *
 * ⚠️ Sair do limite AVISA, não bloqueia. Divisa com sinal ruim é rotina, e
 * uma tela que trava quem já está andando não ajuda ninguém. Mesma escolha
 * da caçada livre, que grava o percurso avisando.
 *
 * ⚠️ O ABATE NÃO É GRAVADO AQUI. Ele leva para a tela própria, com a
 * coordenada já preenchida. Registrar abate por um segundo caminho, mais
 * curto, criaria duas portas para o dado que vai ao relatório do IBAMA — e a
 * curta pularia o clima em tempo real, o teto do plano, peso, sexo, método e
 * amostra. O mapa da rota já tem um pino chamado "Abate": aquilo é
 * referência visual, não registro legal, e os dois não podem se confundir.
 *
 * ⚠️ O que se grava aqui é MARCAÇÃO — inclusive avistamento. É a mesma
 * entidade que a tela da rota cria, então o que for marcado no campo aparece
 * lá também.
 */
import { useUi } from '~/stores/ui'
import { distanciaM, distanciaARota, maisPertoNaRota, rumo, difRumo, fmtDist, pontoDentro } from '~/composables/useMapa'
import { useBussola } from '~/composables/useBussola'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Ponto } from '~/composables/useMapa'
import type { LimiteGuia, RotaGuia, CevaGuia, MarcaGuia } from '~/components/MapaGuia.vue'

definePageMeta({ layout: 'app' })

interface Guia {
  id: string; nome?: string; tipo?: string; propriedadeId?: string
  limites: LimiteGuia[]; rotas: RotaGuia[]; cevas: CevaGuia[]; marcacoes: MarcaGuia[]
  souDono?: boolean
}

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()
/* Desestruturado de propósito: ref dentro de objeto simples NÃO é
   desembrulhada no template, e `bussola.graus` renderizaria [object Object].
   Com nomes locais, o template lê o valor direto e a intenção fica clara. */
const {
  graus: rumoAparelho, fonte: fonteRumo, precisaPermissao,
  erro: erroBussola, iniciar: iniciarBussola, pedirPermissao, daPosicao: rumoDoGps
} = useBussola()

const id = computed(() => String(route.query.manejo || route.query.id || ''))
const g = ref<Guia | null>(null)
const erro = ref('')
const eu = ref<{ lat: number; lng: number; precisao?: number } | null>(null)
const erroGps = ref('')
/**
 * ⚠️ O mapa SEGUE A POSIÇÃO sempre — não há mais botão para ligar e desligar.
 * Ele existia junto com "ver o caminho todo", e os dois eram controles de
 * mapa numa tela que se usa andando, com o celular na mão: quem está no mato
 * quer ver onde está, não administrar enquadramento.
 *
 * A única exceção continua sendo escolher ponto no mapa, quando seguir
 * brigaria com o dedo — aí `seguir` desliga sozinho.
 */
const seguir = ref(true)

let observador: number | null = null
let travaTela: WakeLockSentinel | null = null

/* ── percurso da caça livre ─────────────────────────────────────────────── */

/**
 * ⚠️ A CAÇA LIVRE GRAVA O PERCURSO — e até agora não gravava. O backend já
 * estava pronto: `apiCriarRota` com `origem: 'gps'` AVISA quando o traçado
 * sai do limite em vez de recusar, justamente para não perder o caminho de
 * quem andou na divisa com sinal ruim. Faltava a tela juntar os pontos e
 * oferecer o botão.
 *
 * ⚠️ Ponto novo só entra a cada 15 m. Sem esse filtro, o GPS parado gera
 * dezenas de pontos no mesmo lugar — o traçado vira um borrão e o payload
 * cresce sem necessidade.
 */
const DIST_MIN_M = 15

/**
 * ⚠️ Sem PAUSAR e sem DESCARTAR. Os dois eram jeitos de estragar a gravação
 * sem querer: pausar e esquecer perde o meio do caminho, e descartar apaga o
 * que não tem volta com um toque. Quem quiser se livrar do percurso apaga a
 * rota depois, em Rotas — onde a decisão é deliberada e reversível até o
 * último passo.
 */
const gravando = ref(false)
const percurso = ref<Ponto[]>([])
const salvandoPercurso = ref(false)

const ehLivre = computed(() => g.value?.tipo === 'livre')

const distanciaPercurso = computed(() => {
  let m = 0
  for (let i = 1; i < percurso.value.length; i++) {
    m += distanciaM(percurso.value[i - 1]!, percurso.value[i]!)
  }
  return m
})

function pontoDoPercurso(p: { lat: number; lng: number }) {
  if (!gravando.value) return
  const ultimo = percurso.value[percurso.value.length - 1]
  if (ultimo && distanciaM(ultimo, p) < DIST_MIN_M) return
  percurso.value = [...percurso.value, { lat: p.lat, lng: p.lng }]
}

async function salvarPercurso() {
  if (percurso.value.length < 2) {
    ui.avisar('Ande um pouco antes de salvar — o percurso ainda não tem traçado', 'erro')
    return
  }
  const nome = prompt('Nome do percurso:', 'Percurso de ' + new Date().toLocaleDateString())
  if (nome === null) return
  salvandoPercurso.value = true
  try {
    /* ⚠️ `origem: 'gps'` é o que faz o servidor AVISAR em vez de recusar
       quando o traçado sai do limite. Sem isso, um passo na divisa jogaria
       fora a caminhada inteira. */
    const r = await server<{ foraDoLimite?: boolean }>('apiCriarRota', {
      nome: nome || 'Percurso',
      propriedadeId: g.value?.propriedadeId || '',
      pontos: percurso.value,
      origem: 'gps',
      modalidade: 'manejo',
      distancia: Math.round(distanciaPercurso.value)
    })
    gravando.value = false
    if (r?.foraDoLimite) {
      ui.avisar('Percurso salvo ✔ — parte dele saiu do limite da propriedade')
    } else {
      ui.avisar('Percurso salvo como rota ✔')
    }
    percurso.value = []
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    salvandoPercurso.value = false
  }
}

/* ── registro de evento ─────────────────────────────────────────────────── */

/**
 * O que se registra andando. `Abate` está na lista, mas NÃO vira marcação:
 * escolher abate leva à tela própria, com a coordenada preenchida.
 *
 * ⚠️ Isso não afrouxa a regra. O abate continua tendo uma porta só — peso,
 * sexo, método, amostra e o tempo consultado na hora. O que mudou é que ele
 * deixou de estar escondido atrás de um botão separado no fim do painel:
 * quem acabou de abater procura "abate" na lista do que aconteceu.
 */
const ABATE = 'Abate'
const TIPOS = [ABATE, 'Avistamento', 'Rastro', 'Perigo', 'Armadilha', 'Água',
  'Comida/isca', 'Referência', 'Foto/registro', 'Aviso', 'Outro']

const painel = ref(false)
const escolhendo = ref(false)
const pontoNovo = ref<Ponto | null>(null)
const tipoNovo = ref('Avistamento')
const ehAbate = computed(() => tipoNovo.value === ABATE)
const descNovo = ref('')
const statusNovo = ref<'Ativa' | 'Inativa'>('Ativa')
const fotoNova = ref('')
const salvando = ref(false)

/** Rota a que a marcação se prende, quando a caçada tem exatamente uma. */
const rotaAlvo = computed(() => {
  const rs = g.value?.rotas || []
  return rs.length === 1 ? rs[0]!.id : ''
})

const pontoForaDoLimite = computed(() => {
  const p = pontoNovo.value
  const ls = (g.value?.limites || []).filter((l) => (l.limite || []).length >= 3)
  if (!p || !ls.length) return false
  return !ls.some((l) => pontoDentro(p, l.limite))
})

/**
 * UM botão. Antes eram dois — "Registrar aqui" e "Marcar no mapa" — e a
 * escolha vinha ANTES de saber o que se ia registrar, que é a ordem errada:
 * quem viu um javali quer dizer isso primeiro, não decidir de onde tira a
 * coordenada. O painel abre já com a posição do GPS, e trocar o ponto virou
 * um botão dentro dele, para quem precisar.
 */
function abrirPainel() {
  pontoNovo.value = eu.value ? { lat: eu.value.lat, lng: eu.value.lng } : null
  escolhendo.value = !eu.value      // sem GPS, já entra escolhendo no mapa
  painel.value = true
  /* Seguir a posição brigaria com escolher o ponto: o mapa fugiria do dedo. */
  seguir.value = false
}

/** Troca o ponto pelo toque no mapa, sem fechar o painel. */
function trocarPonto() {
  escolhendo.value = true
  pontoNovo.value = null
}

function fecharPainel() {
  painel.value = false
  escolhendo.value = false
  /* Sem botão para religar, o mapa precisa voltar a seguir sozinho. */
  seguir.value = true
  pontoNovo.value = null
  descNovo.value = ''
  fotoNova.value = ''
  tipoNovo.value = 'Avistamento'
  statusNovo.value = 'Ativa'
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
    const criada = await server<MarcaGuia>('apiCriarMarcacao', {
      rotaId: rotaAlvo.value,
      tipo: tipoNovo.value,
      lat: p.lat,
      lng: p.lng,
      descricao: descNovo.value,
      status: tipoNovo.value === 'Armadilha' ? statusNovo.value : '',
      foto: fotoNova.value || ''
    })
    /* Entra no mapa na hora. Recarregar a tela inteira no meio do mato, com
       sinal ruim, seria pagar caro para ver o que já se sabe. */
    if (g.value) g.value.marcacoes = [...(g.value.marcacoes || []), criada]
    ui.avisar(tipoNovo.value + ' registrado ✔')
    fecharPainel()
  } catch { /* já avisado, traduzido */ } finally {
    salvando.value = false
  }
}

/** Leva ao registro de abate com a coordenada já preenchida. */
function irParaAbate() {
  const p = pontoNovo.value || eu.value
  const q: Record<string, string> = { manejo: id.value }
  if (p) { q.lat = p.lat.toFixed(6); q.lng = p.lng.toFixed(6) }
  router.push({ path: '/abate', query: q })
}

/**
 * As rotas da caçada mais o percurso em gravação, para quem anda ver o
 * caminho já feito. O percurso NÃO entra no cálculo de desvio: ele é o que
 * está sendo criado, não o que se deve seguir.
 */
const rotasComPercurso = computed(() => {
  const base = g.value?.rotas || []
  if (!ehLivre.value || percurso.value.length < 2) return base
  return [...base, { id: '__percurso', nome: 'Percurso de agora', pontos: percurso.value }]
})

/** Todos os pontos do traçado, de todas as rotas atribuídas. */
const traco = computed<Ponto[]>(() => (g.value?.rotas || []).flatMap((r) => r.pontos || []))
const temRota = computed(() => (g.value?.rotas || []).some((r) => (r.pontos || []).length > 1))

/** Dentro de algum limite? Sem limite desenhado, a pergunta não se aplica. */
const dentro = computed(() => {
  const p = eu.value
  const ls = (g.value?.limites || []).filter((l) => (l.limite || []).length >= 3)
  if (!p || !ls.length) return null
  return ls.some((l) => pontoDentro(p, l.limite))
})

/** Distância até o traçado mais próximo. */
const desvio = computed(() => {
  const p = eu.value
  if (!p || !temRota.value) return null
  let melhor = Infinity
  for (const r of g.value?.rotas || []) {
    if ((r.pontos || []).length < 2) continue
    melhor = Math.min(melhor, distanciaARota(p, r.pontos))
  }
  return isFinite(melhor) ? melhor : null
})

/**
 * "No caminho" tolera 25 m. Abaixo disso é erro de GPS de celular, não desvio
 * — apertar mais faria a tela acusar desvio de quem está pisando na trilha.
 */
const noCaminho = computed(() => desvio.value !== null && desvio.value <= 25)

/**
 * Ponto da rota a alcançar. Some quando já se está nela: manter uma seta
 * apontando para trás e para frente enquanto a pessoa caminha em cima do
 * traçado só confunde.
 */
const alvo = computed(() => {
  const p = eu.value
  if (!p || !temRota.value || noCaminho.value) return null
  let melhor: { ponto: { lat: number; lng: number }; dist: number } | null = null
  for (const r of g.value?.rotas || []) {
    if ((r.pontos || []).length < 2) continue
    const c = maisPertoNaRota(p, r.pontos)
    if (c && (!melhor || c.dist < melhor.dist)) melhor = c
  }
  return melhor ? melhor.ponto : null
})

/** Rumo absoluto até o alvo — é ele que a seta no mapa usa. */
const rumoAlvo = computed(() => {
  const p = eu.value, a = alvo.value
  return p && a ? rumo(p, a) : null
})

/**
 * A virada, em relação a para onde o aparelho aponta. É o que a bússola
 * acrescenta: sem ela dá para saber a direção no mapa, mas não se ela fica à
 * sua esquerda ou à sua direita sem girar o corpo até descobrir.
 *
 * ⚠️ `delta` é ASSINADO e é ele que gira a agulha — negativo à esquerda.
 * A versão anterior girava por `graus` (sempre positivo) e recuperava o sinal
 * a partir do rótulo; na meia-volta o rótulo não tem lado, o sinal sumia e a
 * agulha apontava para o lado errado exatamente quando mais importava.
 */
const virada = computed(() => {
  const r = rumoAlvo.value, h = rumoAparelho.value
  if (r === null || h === null) return null
  const d = difRumo(h, r)
  const g = Math.round(Math.abs(d))
  const delta = Math.round(d)
  if (g <= 15) return { texto: 'Siga em frente', lado: '', graus: g, delta }
  if (g >= 160) return { texto: 'Dê meia-volta', lado: '', graus: g, delta }
  return { texto: d > 0 ? 'Vire à direita' : 'Vire à esquerda', lado: d > 0 ? 'dir' : 'esq', graus: g, delta }
})

/** Onde o aparelho aponta, em nome de rosa dos ventos. */
const ROSA = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']
const pontoCardeal = computed(() => {
  const h = rumoAparelho.value
  return h === null ? '' : ROSA[Math.round(h / 45) % 8]!
})

/** Cevas e avisos por perto, do mais próximo ao mais distante. */
const perto = computed(() => {
  const p = eu.value
  if (!p || !g.value) return []
  const itens = [
    ...(g.value.cevas || []).map((c) => ({
      chave: 'c' + c.id, nome: c.nome || 'Ceva', tipo: 'Ceva', detalhe: '',
      lat: c.lat, lng: c.lng, alerta: false
    })),
    ...(g.value.marcacoes || []).map((k) => ({
      chave: 'm' + k.id, nome: k.tipo, tipo: k.tipo,
      detalhe: [k.subtipo, k.status, k.descricao].filter(Boolean).join(' · '),
      lat: k.lat, lng: k.lng,
      alerta: (k.tipo === 'Armadilha' || k.tipo === 'Perigo') && k.status !== 'Inativa'
    }))
  ]
  return itens
    .map((x) => ({ ...x, dist: distanciaM(p, { lat: x.lat, lng: x.lng }) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8)
})

async function carregar() {
  erro.value = ''
  try {
    g.value = await server<Guia>('apiManejoGuia', id.value)
    /* Caça livre grava desde a abertura: quem abriu o guiamento já está indo. */
    if (g.value?.tipo === 'livre' && !percurso.value.length) gravando.value = true
    if (!temRota.value && !(g.value?.limites || []).length) {
      erro.value = 'Esta caçada não tem rota nem limite desenhado para guiar.'
    }
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o guiamento'
  }
}

function ligarGps() {
  if (!navigator.geolocation) {
    erroGps.value = 'Seu aparelho não oferece localização.'
    return
  }
  observador = navigator.geolocation.watchPosition(
    (p) => {
      erroGps.value = ''
      eu.value = {
        lat: p.coords.latitude, lng: p.coords.longitude,
        precisao: p.coords.accuracy ? Math.round(p.coords.accuracy) : undefined
      }
      /* Reserva: só vale andando, e nunca sobrescreve o sensor. */
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

/**
 * Trava de tela: sem isto o celular apaga no meio da caminhada e a pessoa
 * destrava a cada minuto. Nem todo navegador tem — quando não tem, segue sem.
 */
async function travarTela() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }
    if (nav.wakeLock) travaTela = await nav.wakeLock.request('screen')
  } catch { /* negado ou sem suporte: não é motivo para atrapalhar */ }
}

onMounted(() => {
  if (!id.value) { erro.value = 'Caçada não informada.'; return }
  carregar()
  ligarGps()
  iniciarBussola()
  travarTela()
})

onBeforeUnmount(() => {
  if (observador !== null) navigator.geolocation.clearWatch(observador)
  observador = null
  travaTela?.release().catch(() => { /* já solta */ })
  travaTela = null
})
</script>

<template>
  <div>
    <TituloTela titulo="Guiamento" descricao="Siga a rota com a sua posição no mapa." />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!g" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <!-- SITUAÇÃO: a resposta rápida, antes do mapa -->
      <div class="situacao">
        <div class="bloco" :class="dentro === false ? 'ruim' : dentro ? 'bom' : ''">
          <span class="rot">Propriedade</span>
          <b v-if="dentro === null">—</b>
          <b v-else-if="dentro">Dentro do limite</b>
          <b v-else>Fora do limite</b>
        </div>
        <div v-if="temRota" class="bloco" :class="desvio === null ? '' : noCaminho ? 'bom' : 'atencao'">
          <span class="rot">Rota</span>
          <b v-if="desvio === null">—</b>
          <b v-else-if="noCaminho">No caminho</b>
          <b v-else>{{ fmtDist(desvio) }} fora</b>
        </div>
        <div class="bloco">
          <span class="rot">Precisão</span>
          <b>{{ eu?.precisao ? fmtDist(eu.precisao) : '—' }}</b>
        </div>
      </div>

      <div v-if="erroGps" class="card aviso-gps">
        <div class="meta"><Icone nome="alerta" /> {{ erroGps }}</div>
      </div>
      <div v-else-if="!eu" class="card aviso-gps">
        <div class="meta"><Icone nome="pino" /> Procurando o sinal do GPS…</div>
      </div>

      <!-- RUMO: a instrução que se lê de relance, sem parar de andar -->
      <div v-if="alvo" class="rumo" :class="virada?.lado">
        <!--
          ⚠️ A agulha é um SVG próprio, apontando para CIMA em zero grau.
          Antes usava o ícone `avancar` do sprite, que aponta para a DIREITA —
          então toda rotação saía 90° errada, e a agulha mandava para o lado
          errado. Rotação só faz sentido com o repouso do desenho conhecido.
        -->
        <div class="agulha" :style="{ transform: 'rotate(' + (virada ? virada.delta : 0) + 'deg)' }">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="currentColor" />
          </svg>
        </div>
        <div class="txt">
          <b v-if="virada">{{ virada.texto }}</b>
          <b v-else>Siga para a rota</b>
          <span class="meta">
            <template v-if="virada && virada.graus > 15"><span class="no-i18n">{{ virada.graus }}°</span> · </template>
            <span class="no-i18n">{{ fmtDist(desvio || 0) }}</span> até o traçado
          </span>
        </div>
        <div v-if="pontoCardeal" class="cardeal">
          <b class="no-i18n">{{ pontoCardeal }}</b>
          <span>{{ fonteRumo === 'gps' ? 'pelo GPS' : 'bússola' }}</span>
        </div>
      </div>

      <div v-if="precisaPermissao" class="card bussola-off">
        <div class="meta">
          <Icone nome="alerta" /> Ative a bússola para a seta saber para que lado
          você está virado.
        </div>
        <button class="btn pequeno" @click="pedirPermissao()">Ativar bússola</button>
      </div>
      <div v-else-if="erroBussola" class="card bussola-off">
        <div class="meta"><Icone nome="alerta" /> {{ erroBussola }}</div>
      </div>

      <!-- PERCURSO: só na caça livre, e sempre visível enquanto grava. -->
      <div v-if="ehLivre" class="card percurso" :class="{ ativo: gravando }">
        <div class="linha">
          <span class="ponto-vivo" :class="{ on: gravando }" />
          <div class="grow">
            <b>Gravando o percurso</b>
            <div class="meta">
              <span class="no-i18n">{{ percurso.length }}</span> ponto(s) ·
              <span class="no-i18n">{{ fmtDist(distanciaPercurso) }}</span>
            </div>
          </div>
        </div>
        <button
          class="btn"
          :disabled="salvandoPercurso || percurso.length < 2"
          @click="salvarPercurso"
        >
          <Icone nome="salvar" />
          {{ salvandoPercurso ? 'Salvando…' : 'Concluir e salvar percurso' }}
        </button>
        <div class="meta">
          Para se livrar deste percurso depois, apague a rota em Rotas.
        </div>
      </div>

      <ClientOnly>
        <MapaGuia
          :limites="g.limites || []"
          :rotas="rotasComPercurso"
          :cevas="g.cevas || []"
          :marcacoes="g.marcacoes || []"
          :eu="eu"
          :seguir="seguir"
          :escolhendo="escolhendo"
          :ponto-novo="pontoNovo"
          :rumo-aparelho="rumoAparelho"
          :alvo="alvo"
          altura="56vh"
          @escolher="escolheuNoMapa"
        />
      </ClientOnly>

      <div v-if="escolhendo" class="card tocar">
        <div class="meta"><Icone nome="pino" /> Toque no mapa para marcar o ponto.</div>
        <button class="btn sec pequeno" @click="fecharPainel">Cancelar</button>
      </div>

      <!-- UM botão: o que registrar se escolhe DENTRO, não antes. -->
      <button v-if="!painel" class="btn registrar" @click="abrirPainel">
        <Icone nome="adicionar" /> Registrar evento
      </button>

      <div v-if="painel" class="card painel">
        <h3><Icone nome="adicionar" /> Registrar evento</h3>

        <label for="g_tipo">O que aconteceu? *</label>
        <select id="g_tipo" v-model="tipoNovo">
          <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
        </select>

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

        <!-- ABATE: o painel dá lugar ao caminho da tela própria. -->
        <div v-if="ehAbate" class="desvio">
          <div class="meta">
            O abate tem tela própria: precisa de peso, sexo, método e do tempo
            consultado na hora. A coordenada vai preenchida daqui.
          </div>
          <button class="btn" @click="irParaAbate">
            <Icone nome="abate" /> Abrir o registro de abate
          </button>
          <button class="btn sec" @click="fecharPainel">Cancelar</button>
        </div>

        <template v-if="!ehAbate">
        <template v-if="tipoNovo === 'Armadilha'">
          <label for="g_st">Situação da armadilha</label>
          <select id="g_st" v-model="statusNovo">
            <option value="Ativa">Ativa</option>
            <option value="Inativa">Inativa</option>
          </select>
        </template>

        <label for="g_desc">Descrição</label>
        <input id="g_desc" v-model="descNovo" class="no-i18n" placeholder="opcional">

        <label for="g_foto">Foto</label>
        <input id="g_foto" type="file" accept="image/*" capture="environment" @change="escolheuFoto">

        <div class="acoes">
          <button class="btn" :disabled="salvando || !pontoNovo" @click="salvarEvento">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
          <button class="btn sec" :disabled="salvando" @click="fecharPainel">Cancelar</button>
        </div>

        </template>
      </div>

      <div class="card legenda">
        <span><i class="q rota" /> Rota</span>
        <span><i class="q area" /> Limite</span>
        <span><i class="q ceva" /> Ceva</span>
        <span><i class="q perigo" /> Armadilha / perigo</span>
        <span><i class="q eu" /> Você</span>
      </div>

      <!-- O QUE VEM PELA FRENTE -->
      <h3 class="sub">Por perto</h3>
      <div v-if="!eu" class="card">
        <div class="meta">A lista aparece assim que o GPS pegar a sua posição.</div>
      </div>
      <div v-else-if="!perto.length" class="card">
        <div class="meta">Nenhuma ceva nem aviso marcado nesta caçada.</div>
      </div>
      <div v-for="x in perto" :key="x.chave" class="card linha" :class="{ perigo: x.alerta }">
        <span class="ic">
          <Icone :nome="x.alerta ? 'alerta' : x.tipo === 'Ceva' ? 'ceva' : 'pino'" />
        </span>
        <div class="grow">
          <b class="no-i18n">{{ x.nome }}</b>
          <div v-if="x.detalhe" class="meta no-i18n">{{ x.detalhe }}</div>
        </div>
        <span class="dist no-i18n">{{ fmtDist(x.dist) }}</span>
      </div>

      <NuxtLink :to="{ path: '/cacada', query: { id } }" class="btn sec">Voltar para a caçada</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.sub { margin: 16px 0 8px; font-size: 15px; }

.situacao { display: flex; gap: 8px; margin-bottom: 10px; }
.bloco {
  flex: 1; background: var(--card); border: 1px solid var(--linha);
  border-left: 4px solid var(--linha); border-radius: 12px; padding: 8px 10px;
}
.bloco .rot { display: block; font-size: 10.5px; color: var(--osso-2); text-transform: uppercase; letter-spacing: .04em; }
.bloco b { font-size: 14px; }
.bloco.bom { border-left-color: var(--verde); }
.bloco.atencao { border-left-color: var(--alerta); }
.bloco.ruim { border-left-color: var(--danger); }
.bloco.ruim b { color: var(--danger); }

.aviso-gps { border-left: 4px solid var(--alerta); }
.aviso-gps .meta { margin: 0; }

/* Faixa de rumo: grande, alto contraste, legível de relance com o celular
   na mão e o sol batendo. A agulha gira pela VIRADA (rumo relativo), não
   pelo rumo absoluto: aqui a referência é o corpo de quem lê, não o norte. */
.rumo {
  display: flex; align-items: center; gap: 12px;
  background: var(--carvao-3); border: 1px solid var(--linha);
  border-left: 5px solid var(--laranja-cl);
  border-radius: 12px; padding: 10px 12px; margin-bottom: 10px;
}
.rumo .agulha {
  flex: none; width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--laranja); color: #fff;
  transition: transform .25s linear;
}
.rumo .txt { flex: 1; min-width: 0; }
.rumo .txt b { display: block; font-size: 15px; }
.rumo .txt .meta { margin: 2px 0 0; }
.rumo .cardeal { flex: none; text-align: center; }
.rumo .cardeal b { display: block; font-size: 17px; color: var(--laranja-cl); }
.rumo .cardeal span { font-size: 10px; color: var(--osso-2); }

.bussola-off { border-left: 4px solid var(--alerta); display: flex; align-items: center; gap: 10px; }
.bussola-off .meta { margin: 0; flex: 1; }


.tocar { display: flex; align-items: center; gap: 10px; margin-top: 10px; border-left: 4px solid var(--laranja-cl); }
.tocar .meta { margin: 0; flex: 1; }
.pequeno { width: auto; margin: 0; padding: 6px 12px; font-size: 12px; }

.painel { margin-top: 10px; border-left: 4px solid var(--laranja-cl); }
.painel h3 { margin: 0 0 8px; font-size: 15px; }
.ponto { background: var(--carvao-3); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; font-size: 13px; }
.ponto.falta { color: var(--osso-2); }
.ponto .meta { margin: 4px 0 0; }
.ponto .alerta { color: var(--alerta); }
.acoes { display: flex; gap: 8px; margin-top: 12px; }
.acoes .btn { flex: 1; margin: 0; }
.registrar { margin-top: 10px; }

.percurso { border-left: 4px solid var(--linha); margin-bottom: 10px; }
.percurso.ativo { border-left-color: var(--danger); }
.percurso .linha { display: flex; align-items: center; gap: 10px; }
.percurso .grow { flex: 1; min-width: 0; }
.percurso .grow b { font-size: 14px; }
.percurso .meta { margin: 2px 0 0; }
.percurso .btn { margin-top: 10px; }
.ponto-vivo {
  flex: none; width: 11px; height: 11px; border-radius: 50%;
  background: var(--osso-2);
}
/* Pisca só enquanto grava: é o sinal de que o GPS está sendo lido. */
.ponto-vivo.on { background: var(--danger); animation: pulsa 1.6s ease-in-out infinite; }
@keyframes pulsa { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
.desvio { margin-top: 10px; }
.desvio .btn { margin-top: 10px; }
.trocar {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
  border: 1px solid var(--linha); background: none; color: var(--laranja-cl);
  font: inherit; font-size: 11.5px; padding: 4px 10px; border-radius: 999px; cursor: pointer;
}

.legenda { display: flex; flex-wrap: wrap; gap: 10px 14px; font-size: 11.5px; color: var(--osso-2); }
.legenda span { display: flex; align-items: center; gap: 5px; }
.q { width: 11px; height: 11px; border-radius: 50%; display: inline-block; border: 1.5px solid #fff; }
.q.rota { background: #2f6ea8; border-radius: 2px; }
.q.area { background: #2f7d3a; border-radius: 2px; }
.q.ceva { background: #b8863b; }
.q.perigo { background: #c0392b; }
.q.eu { background: #e8552b; }

.linha { display: flex; align-items: center; gap: 10px; }
.linha.perigo { border-left: 4px solid var(--danger); }
.linha .ic { font-size: 19px; flex: none; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 2px 0 0; }
.dist { font-size: 13px; font-weight: 700; flex: none; }

.btn.sec { margin-top: 14px; text-decoration: none; }
</style>
