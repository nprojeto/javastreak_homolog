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
import { useUi } from '~/stores/ui'
import { soDig } from '~/composables/useMascaras'
import type { Ponto } from '~/composables/useMapa'

definePageMeta({ layout: 'app' })

interface ItemMapa {
  id: string; nome?: string; tipo?: string
  lat?: number | string; lng?: number | string
  identificacao?: string; donoNome?: string; compartilhada?: boolean
  pontos?: Ponto[]; limite?: Ponto[]; descricao?: string; dataHora?: string
  rotaId?: string; status?: string
  fotoUrl?: string; sexo?: string; whatsapp?: string; telefone?: string
  cidade?: string; ramo?: string; vitrine?: string; bio?: string
}

/**
 * ⚠️ AVATAR POR SEXO. A regra já existia no perfil ("Sexo define seu avatar
 * padrão"), mas os arquivos nunca tinham sido colocados e o mapa não usava
 * nada. Masculino para masculino, feminino para feminino; sem informação,
 * cai no masculino, que é o padrão histórico do cadastro.
 *
 * ⚠️ Foto própria SEMPRE vence o avatar. O padrão é o recuo, não a regra.
 */
function avatarDe(m: ItemMapa): string {
  if (m.fotoUrl) return String(m.fotoUrl)
  const sx = String(m.sexo || '').trim().toLowerCase()
  const fem = sx.startsWith('f')   // 'Feminino', 'F', 'fêmea' de cadastro antigo
  return base + 'avatar/manejador-' + (fem ? 'f' : 'm') + '.png'
}

function logoDe(e: ItemMapa): string {
  return e.fotoUrl ? String(e.fotoUrl) : base + 'avatar/empresa.png'
}

/** Link do WhatsApp, só se houver número. */
function zap(n?: string): string {
  const d = soDig(n)
  return d.length >= 8 ? 'https://wa.me/' + (d.length <= 11 ? '55' + d : d) : ''
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
const ui = useUi()
const { server } = useServer()
/* Caminho dos avatares: respeita a subpasta do Pages. */
const base = useRuntimeConfig().app.baseURL

const dados = ref<MapaDados | null>(null)
const rede = ref<Rede | null>(null)
const props_ = ref<ItemMapa[]>([])
const erro = ref('')
const abertos = ref(true)
const mapaRef = ref<{ enquadrar: () => void; mapa: () => unknown } | null>(null)
const minhaPos = ref<{ lat: number; lng: number } | null>(null)

/**
 * ⚠️ Centralizar é BOTÃO, não comportamento. O mapa reenquadrava a cada
 * redesenho, e como os dados chegam em partes (mapa, propriedades, rede),
 * cada chegada arrastava a vista de volta enquanto a pessoa olhava outro
 * canto. Agora ele enquadra uma vez e depois obedece ao dedo.
 */
function centralizarEmMim() {
  if (!navigator.geolocation) { ui.avisar('Seu aparelho não oferece localização', 'erro'); return }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      minhaPos.value = { lat: p.coords.latitude, lng: p.coords.longitude }
      const m = mapaRef.value?.mapa() as { setView?: (c: [number, number], z: number) => void } | null
      m?.setView?.([p.coords.latitude, p.coords.longitude], 15)
    },
    () => ui.avisar('Não foi possível obter a localização', 'erro'),
    { enableHighAccuracy: true, timeout: 15000 }
  )
}

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

interface PinoMapa {
  lat: number; lng: number; titulo: string; cor: string
  linhas?: string[]; foto?: string; icone?: string
  acoes?: Array<{ rotulo: string; url: string }>
}

const pinos = computed(() => {
  const d = dados.value
  const out: PinoMapa[] = []
  if (!d) return out

  const add = (
    l: ItemMapa[], cor: string,
    rot: (i: ItemMapa) => string,
    extra?: (i: ItemMapa) => Partial<PinoMapa>
  ) => {
    for (const i of l) {
      if (!temCoord(i)) continue
      out.push({ lat: num(i.lat)!, lng: num(i.lng)!, titulo: rot(i), cor, ...(extra ? extra(i) : {}) })
    }
  }

  /* ⚠️ Ceva ganhou ÍCONE. Uma bolinha de 8 px sobre imagem de satélite era
     invisível — o pino em gota, com o mesmo ícone do resto do app, se acha de
     relance e ainda diz o que é sem abrir o balão. */
  if (ligados.espera) {
    add(d.cevas || [], '#b8863b', (c) => (c.nome || 'Ceva'),
      (c) => ({ icone: 'ceva', linhas: balaoCeva(c).slice(1) }))
    add(d.cevasCompart || [], '#c8a35c', (c) => (c.nome || 'Ceva') + ' · ' + (c.donoNome || ''),
      () => ({ icone: 'ceva' }))
  }

  /* Um pino no centro de cada propriedade: o polígono verde some no verde da
     mata, e sem ele a área desenhada passa despercebida. */
  if (ligados.propriedade) {
    for (const p of props_.value) {
      const c = centroDe(p)
      if (!c) continue
      out.push({ ...c, titulo: p.nome || 'Propriedade', cor: '#2e6b3a', icone: 'areas' })
    }
  }

  if (ligados.rotas) {
    for (const r of tracados.value) {
      const p = (r.pontos || [])[0]
      if (!p) continue
      out.push({ lat: p.lat, lng: p.lng, titulo: r.nome || 'Rota', cor: '#3b6ea5', icone: 'rotas' })
    }
  }

  if (ligados.rede && rede.value) {
    add(rede.value.empresas || [], '#e8552b', (e) => (e.nome || 'Empresa'), (e) => ({
      foto: logoDe(e),
      linhas: [e.ramo || 'Loja', e.cidade || ''].filter(Boolean),
      acoes: acoesLoja(e)
    }))
    add(rede.value.manejadores || [], '#2f7d3a', (m) => (m.nome || 'Manejador'), (m) => ({
      foto: avatarDe(m),
      linhas: [m.cidade || '', m.bio || ''].filter(Boolean),
      acoes: zap(m.whatsapp || m.telefone)
        ? [{ rotulo: 'WhatsApp', url: zap(m.whatsapp || m.telefone) }]
        : []
    }))
  }
  return out
})

/**
 * Botões da loja: WhatsApp e a vitrine.
 *
 * ⚠️ O balão do Leaflet é HTML solto, fora do roteador do Nuxt — um link
 * interno ali recarregaria o app inteiro. Por isso a vitrine vai como URL
 * absoluta com o `baseURL` na frente, e abre normalmente.
 */
function acoesLoja(e: ItemMapa) {
  const a: Array<{ rotulo: string; url: string }> = []
  const w = zap(e.whatsapp || e.telefone)
  if (w) a.push({ rotulo: 'WhatsApp', url: w })
  a.push({ rotulo: 'Ver loja', url: base + 'loja?empresa=' + encodeURIComponent(e.id) })
  return a
}

/** Centro aproximado do limite, para pousar o pino da propriedade. */
function centroDe(p: ItemMapa): { lat: number; lng: number } | null {
  if (temCoord(p)) return { lat: num(p.lat)!, lng: num(p.lng)! }
  const l = p.limite || []
  if (l.length < 3) return null
  return {
    lat: l.reduce((s, x) => s + x.lat, 0) / l.length,
    lng: l.reduce((s, x) => s + x.lng, 0) / l.length
  }
}

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
          ref="mapaRef"
          :limites="limites"
          :pinos="pinos"
          :rotas="rotasNoMapa"
          enquadrar-uma-vez
          altura="62vh"
        />
      </ClientOnly>

      <div class="barra-mapa">
        <button class="btn" @click="centralizarEmMim">
          <Icone nome="pino" /> Onde estou
        </button>
        <button class="btn sec" @click="mapaRef?.enquadrar()">
          <Icone nome="mapa" /> Ver tudo
        </button>
      </div>

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
.barra-mapa { display: flex; gap: 8px; margin-top: 8px; }
.barra-mapa .btn { flex: 1; margin: 0; }
.linha-rota {
  display: block; padding: 8px 0; border-top: 1px solid var(--linha);
  text-decoration: none; color: var(--txt); font-size: 14px;
}
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.rodape { text-align: center; margin-top: 10px; font-size: 11px; }
</style>
