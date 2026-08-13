<script setup lang="ts">
/**
 * Mapa geral. Porte de VIEWS.mapaGeral + chipsFiltro + desenharMapa
 * (index.html, 10695).
 *
 * ⚠️ Fica de fora, de propósito, o EIXO CLIMA e a ESTATÍSTICA por ceva — a
 * linha do tempo com dez dimensões da seção 4.7 do dossiê. É uma tela inteira
 * por si só, e misturá-la aqui esconderia os dois riscos num só.
 *
 * ⚠️ Os dados são zerados ANTES de buscar. No legado o `MAPDATA` era global e
 * sobrevivia à troca de usuário: o mapa desenhava os pinos da sessão anterior
 * e eles sumiam quando a resposta nova chegava — a "piscada". Pior, podia
 * mostrar a rede de outra conta.
 */
import { useAuth } from '~/stores/auth'
import type { Ponto } from '~/composables/useMapa'

definePageMeta({ layout: 'app' })

interface ItemMapa {
  id: string; nome?: string; tipo?: string
  lat?: number | string; lng?: number | string
  identificacao?: string; donoNome?: string; compartilhada?: boolean
  pontos?: Ponto[]; limite?: Ponto[]; descricao?: string; dataHora?: string
  rotaId?: string; status?: string
}
interface MapaDados {
  cevas: ItemMapa[]; abates: ItemMapa[]; armadilhas: ItemMapa[]
  canis: ItemMapa[]; rotas: ItemMapa[]; marcacoes: ItemMapa[]
  cevasCompart: ItemMapa[]; propriedadesCompart: ItemMapa[]
}
interface Rede {
  empresas: ItemMapa[]; manejadores: ItemMapa[]
  propriedades: ItemMapa[]; verManejadores: boolean
}

/**
 * ⚠️ QUATRO filtros, não seis. Abates e Marcações tinham botão próprio, e o
 * resultado era um mapa cheio de pinos soltos que ninguém sabia a que
 * pertenciam — um abate longe de tudo não diz nada. Eles agora aparecem
 * DENTRO da ceva e da rota a que se ligam: toque no pino e o balão conta o
 * que aconteceu ali. Menos botão, e cada número com o seu dono.
 */
const FILTROS = [
  { k: 'espera', rot: 'Cevas', cor: '#b8863b', ic: 'ceva' },
  { k: 'rotas', rot: 'Rotas', cor: '#3b6ea5', ic: 'rotas' },
  { k: 'propriedade', rot: 'Propriedades', cor: '#2e6b3a', ic: 'areas' },
  { k: 'rede', rot: 'Rede', cor: '#e8552b', ic: 'global' }
] as const

type Chave = (typeof FILTROS)[number]['k']

const auth = useAuth()
const { server } = useServer()

const dados = ref<MapaDados | null>(null)
const rede = ref<Rede | null>(null)
const props_ = ref<ItemMapa[]>([])
const erro = ref('')
const abertos = ref(true)

/* Rede LIGADA por padrão: o mapa da rede é metade da razão de existir desta
   tela, e nascer desligado fazia parecer que as lojas não estavam lá. */
const ligados = reactive<Record<Chave, boolean>>({
  espera: true, rotas: true, propriedade: true, rede: true
})

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? null : n
}
const temCoord = (i: ItemMapa) => num(i.lat) !== null && num(i.lng) !== null

const limites = computed(() => {
  if (!ligados.propriedade) return []
  const meus = props_.value
    .filter((p) => (p.limite || []).length >= 3)
    .map((p) => ({ nome: p.nome || 'Propriedade', pontos: p.limite! }))
  const deAmigos = (dados.value?.propriedadesCompart || [])
    .filter((p) => (p.limite || []).length >= 3)
    .map((p) => ({ nome: (p.nome || '') + ' · ' + (p.donoNome || ''), pontos: p.limite! }))
  return [...meus, ...deAmigos]
})

const tracados = computed(() =>
  ligados.rotas
    ? (dados.value?.rotas || []).filter((r) => (r.pontos || []).length > 1)
    : []
)

/** Cada rota com o seu traçado e o balão do que aconteceu nela. */
const rotasNoMapa = computed(() =>
  tracados.value.map((r) => {
    const e = eventosDaRota(r)
    const linhas: string[] = []
    linhas.push(e.marcacoes ? e.marcacoes + ' marcação(ões) nesta rota' : 'Nenhuma marcação nesta rota')
    linhas.push(e.abates ? e.abates + ' abate(s) ao longo dela' : 'Nenhum abate ao longo dela')
    return { nome: r.nome || 'Rota', pontos: r.pontos!, cor: '#2f6ea8', linhas }
  })
)

/** Metros entre dois pontos. Plano local basta: aqui nada passa de km. */
function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * 110574
  const dLng = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * O que aconteceu em cada ceva. Um abate é atribuído à ceva quando foi
 * registrado NELA (o servidor grava a coordenada da ceva nesse caso), e o
 * empate é resolvido pela mais próxima dentro de 80 m — folga para o erro do
 * GPS sem alcançar a ceva vizinha.
 */
const RAIO_M = 80

function eventosDaCeva(c: ItemMapa) {
  const d = dados.value
  const cl = num(c.lat), cg = num(c.lng)
  if (!d || cl === null || cg === null) return { abates: 0 }
  let abates = 0
  for (const a of d.abates || []) {
    const al = num(a.lat), ag = num(a.lng)
    if (al === null || ag === null) continue
    if (distM(cl, cg, al, ag) <= RAIO_M) abates++
  }
  return { abates }
}

/** Marcações e abates ligados a uma rota. A marcação já traz `rotaId`. */
function eventosDaRota(r: ItemMapa) {
  const d = dados.value
  if (!d) return { marcacoes: 0, abates: 0 }
  const marcacoes = (d.marcacoes || []).filter((m) => String(m.rotaId || '') === String(r.id)).length
  let abates = 0
  for (const a of d.abates || []) {
    const al = num(a.lat), ag = num(a.lng)
    if (al === null || ag === null) continue
    if ((r.pontos || []).some((p) => distM(p.lat, p.lng, al, ag) <= RAIO_M)) abates++
  }
  return { marcacoes, abates }
}

function balaoCeva(c: ItemMapa) {
  const e = eventosDaCeva(c)
  const linhas = [(c.nome || 'Ceva')]
  linhas.push(e.abates ? e.abates + ' abate(s) registrado(s) aqui' : 'Nenhum abate registrado aqui')
  return linhas
}

const pinos = computed(() => {
  const d = dados.value
  const out: Array<{ lat: number; lng: number; titulo: string; cor: string; linhas?: string[] }> = []
  if (!d) return out

  const add = (
    l: ItemMapa[], cor: string,
    rot: (i: ItemMapa) => string,
    detalhe?: (i: ItemMapa) => string[]
  ) => {
    for (const i of l) {
      if (!temCoord(i)) continue
      out.push({
        lat: num(i.lat)!, lng: num(i.lng)!, titulo: rot(i), cor,
        linhas: detalhe ? detalhe(i) : undefined
      })
    }
  }

  if (ligados.espera) {
    add(d.cevas || [], '#b8863b', (c) => (c.nome || 'Ceva'), (c) => balaoCeva(c).slice(1))
    add(d.cevasCompart || [], '#c8a35c', (c) => (c.nome || 'Ceva') + ' · ' + (c.donoNome || ''))
  }

  if (ligados.rede && rede.value) {
    add(rede.value.empresas || [], '#e8552b', (e) => (e.nome || 'Empresa'))
    add(rede.value.manejadores || [], '#2f7d3a', (m) => (m.nome || 'Manejador'))
  }
  return out
})

const total = computed(() => pinos.value.length + tracados.value.length + limites.value.length)

async function carregar() {
  erro.value = ''
  /* Zera antes de buscar — ver o aviso no topo do arquivo. */
  dados.value = null; rede.value = null; props_.value = []
  try {
    const [d, p] = await Promise.all([
      server<MapaDados>('apiMapaDados'),
      server<ItemMapa[]>('apiListarPropriedades').catch(() => [] as ItemMapa[])
    ])
    dados.value = d
    props_.value = p || []
    /* A rede chega separada e pode falhar sem derrubar o mapa. */
    rede.value = await server<Rede>('apiNetworkMapa').catch(() => null)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o mapa'
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Rede" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!dados" class="card"><div class="meta">Carregando mapa…</div></div>

    <template v-else>
      <div class="card barra">
        <div class="topo">
          <b>{{ total }} item(ns) no mapa</b>
          <button class="btn sm sec" @click="abertos = !abertos">
            {{ abertos ? 'Ocultar filtros' : 'Filtros' }}
          </button>
        </div>

        <div v-if="abertos" class="chips">
          <button
            v-for="f in FILTROS"
            :key="f.k"
            class="chip"
            :class="{ on: ligados[f.k] }"
            @click="ligados[f.k] = !ligados[f.k]"
          >
            <i :style="{ background: f.cor }" />
            <Icone :nome="f.ic" :px="15" />
            <span>{{ f.rot }}</span>
          </button>
        </div>

        <div v-if="ligados.rede && rede && !rede.verManejadores" class="meta aviso">
          <Icone nome="alerta" /> Você só vê os outros manejadores se o seu próprio perfil estiver
          visível na rede. Lojistas você vê sempre.
        </div>
        <div
          v-if="ligados.rede && rede && !(rede.empresas || []).length"
          class="meta aviso"
        >
          ℹ️ Nenhuma loja no mapa. Empresa só aparece na rede com plano ativo —
          é regra do servidor, não falta de cadastro.
        </div>
      </div>

      <ClientOnly>
        <MapaPontos
          :limites="limites"
          :pinos="pinos"
          :rotas="rotasNoMapa"
          altura="62vh"
        />
      </ClientOnly>

      <div v-if="tracados.length" class="card">
        <div class="meta">
          Toque numa rota ou numa ceva no mapa para ver o que aconteceu ali.
        </div>
        <NuxtLink
          v-for="r in tracados"
          :key="r.id"
          :to="{ path: '/rota-detalhe', query: { id: r.id } }"
          class="linha-rota no-i18n"
        ><Icone nome="rotas" /> {{ r.nome || 'Rota' }} ›</NuxtLink>
      </div>

      <div v-if="!total" class="card vazio">
        <div class="big"><Icone nome="mapa" /></div>
        Nada para mostrar ainda.
        <div class="meta">
          Cadastre uma propriedade, uma ceva ou uma rota — elas aparecem aqui.
        </div>
      </div>

      <div v-if="auth.tipo !== 'empresa'" class="meta rodape">
        Mapa © OpenStreetMap · Imagens © Esri
      </div>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.barra .topo { display: flex; align-items: center; gap: 8px; }
.barra .topo b { flex: 1; font-size: 14px; }
.barra .btn { width: auto; margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 11px; border-radius: 999px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-size: 12.5px; color: var(--txt);
}
.chip.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); font-weight: 600; }
.chip i { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.aviso { color: var(--laranja-esc); margin-top: 8px; }
.linha-rota {
  display: block; padding: 8px 0; border-top: 1px solid var(--linha);
  text-decoration: none; color: var(--txt); font-size: 14px;
}
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.rodape { text-align: center; margin-top: 10px; font-size: 11px; }
</style>
