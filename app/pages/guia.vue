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
 * ⚠️ Esta tela NÃO grava nada. É leitura pura sobre `apiManejoGuia`. Marcar
 * aviso novo continua sendo na tela da rota.
 */
import { useUi } from '~/stores/ui'
import { distanciaM, distanciaARota, fmtDist, pontoDentro } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'
import type { LimiteGuia, RotaGuia, CevaGuia, MarcaGuia } from '~/components/MapaGuia.vue'

definePageMeta({ layout: 'app' })

interface Guia {
  id: string; nome?: string; tipo?: string
  limites: LimiteGuia[]; rotas: RotaGuia[]; cevas: CevaGuia[]; marcacoes: MarcaGuia[]
  souDono?: boolean
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.manejo || route.query.id || ''))
const g = ref<Guia | null>(null)
const erro = ref('')
const eu = ref<{ lat: number; lng: number; precisao?: number } | null>(null)
const erroGps = ref('')
const seguir = ref(true)
const mapa = ref<{ enquadrar: () => void } | null>(null)

let observador: number | null = null
let travaTela: WakeLockSentinel | null = null

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

function centralizar() {
  if (!eu.value) { ui.avisar('Ainda sem posição do GPS', 'erro'); return }
  seguir.value = true
}

onMounted(() => {
  if (!id.value) { erro.value = 'Caçada não informada.'; return }
  carregar()
  ligarGps()
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

      <ClientOnly>
        <MapaGuia
          ref="mapa"
          :limites="g.limites || []"
          :rotas="g.rotas || []"
          :cevas="g.cevas || []"
          :marcacoes="g.marcacoes || []"
          :eu="eu"
          :seguir="seguir"
          altura="56vh"
        />
      </ClientOnly>

      <div class="barra">
        <button class="btn" :class="{ sec: !seguir }" @click="centralizar">
          <Icone nome="pino" /> Seguir minha posição
        </button>
        <button class="btn sec" @click="seguir = false; mapa?.enquadrar()">
          <Icone nome="mapa" /> Ver o caminho todo
        </button>
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

.barra { display: flex; gap: 8px; margin-top: 10px; }
.barra .btn { flex: 1; margin: 0; }

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
