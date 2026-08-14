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
import { estatisticaDe } from '~/composables/useEstatisticaCeva'
import type { Abate, Agora } from '~/composables/useEstatisticaCeva'
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
  cidade?: string; ramo?: string; vitrine?: string; bio?: string; cevaId?: string
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
const mapaRef = ref<{
  enquadrar: () => void
  projetar: (lat: number, lng: number) => { x: number; y: number } | null
  mapa: () => unknown
} | null>(null)

/**
 * ⚠️ O ÍNDICE NO PINO. É ele que faz o mapa responder "qual ceva hoje?" sem
 * abrir nada — e era o que a etiqueta da versão antiga mostrava.
 *
 * `apiClimaCevas` traz o tempo de TODAS as cevas numa chamada só (os termos do
 * MET pedem cache, e uma consulta por ceva estouraria isso). Os abates vêm do
 * `apiMapaDados`, que já está carregado — nenhuma chamada nova por ceva.
 */
const climaPorCeva = ref<Record<string, Agora>>({})

const indicePorCeva = computed<Record<string, number | null>>(() => {
  const out: Record<string, number | null> = {}
  const d = dados.value
  if (!d) return out
  for (const c of d.cevas || []) {
    const clima = climaPorCeva.value[c.id]
    if (!clima) { out[c.id] = null; continue }
    /* Os abates daquela ceva, do lote que o mapa já tem. */
    const meus = (d.abates || []).filter((a) => String(a.cevaId || '') === String(c.id)) as unknown as Abate[]
    if (!meus.length) { out[c.id] = null; continue }
    const e = estatisticaDe({ ...clima, quando: new Date() }, meus)
    out[c.id] = e.indice
  }
  return out
})

/**
 * ⚠️ ÍNDICE NAS ROTAS TAMBÉM. Faltava, e o pino da rota ficava sem etiqueta
 * enquanto o da ceva mostrava o número — o mapa dizia que só a ceva tinha
 * histórico, o que não é verdade.
 *
 * ⚠️ O clima usado é o da CEVA MAIS PRÓXIMA do começo da rota. O
 * `apiClimaCevas` traz o tempo de todas as cevas numa chamada só; pedir uma
 * consulta por rota multiplicaria as chamadas ao MET Norway, que pede cache.
 * Dentro de uma propriedade a diferença de tempo entre dois pontos não muda
 * de faixa — e quem quiser o número exato da rota abre o painel dela, que
 * consulta pelo ponto certo.
 */
const indicePorRota = computed<Record<string, number | null>>(() => {
  const out: Record<string, number | null> = {}
  const d = dados.value
  if (!d) return out
  const cevas = (d.cevas || []).filter((c) => temCoord(c) && climaPorCeva.value[c.id])
  for (const r of d.rotas || []) {
    const p0 = (r.pontos || [])[0]
    const meus = (d.abates || []).filter((a) => String(a.rotaId || '') === String(r.id)) as unknown as Abate[]
    if (!p0 || !meus.length || !cevas.length) { out[r.id] = null; continue }
    let melhor = cevas[0]!, dist = Infinity
    for (const c of cevas) {
      const dd = distM(p0.lat, p0.lng, num(c.lat)!, num(c.lng)!)
      if (dd < dist) { dist = dd; melhor = c }
    }
    const e = estatisticaDe({ ...climaPorCeva.value[melhor.id]!, quando: new Date() }, meus)
    out[r.id] = e.indice
  }
  return out
})
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
    return { nome: r.nome || 'Rota', pontos: r.pontos!, cor: '#2f6ea8', linhas,
      sel: { tipo: 'rota' as const, id: r.id } }
  })
)

/** Metros entre dois pontos. Plano local basta: aqui nada passa de km. */
function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * 110574
  const dLng = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * ⚠️ A contagem por CEVA saiu daqui. Ela existia para o balão do pino, e o
 * balão deu lugar ao painel completo — que busca os abates de verdade pelo
 * `apiAbatesDaCeva`, em vez de adivinhar por proximidade de coordenada.
 * Manter as duas contas seria manter duas verdades sobre o mesmo número.
 *
 * A da ROTA continua, porque o traçado ainda mostra um resumo no balão
 * quando a rota não é selecionável. Folga para o erro do GPS sem alcançar a
 * rota vizinha.
 */
const RAIO_M = 80

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


interface PinoMapa {
  lat: number; lng: number; titulo: string; cor: string
  linhas?: string[]; foto?: string; icone?: string
  acoes?: Array<{ rotulo: string; url: string }>
  sel?: { tipo: 'ceva' | 'rota'; id: string }
  /** Etiqueta 0–100 pendurada no pino. */
  indice?: number | null
}

/**
 * Ceva ou rota tocada no mapa. É aqui que o painel de condições vive agora —
 * a pergunta "vale a pena ir nesta hoje?" nasce olhando o mapa, não dentro da
 * ficha da ceva, que ninguém abre no meio do mato.
 */
const selecionado = ref<{ tipo: 'ceva' | 'rota'; id: string; nome: string; lat: number; lng: number } | null>(null)

/**
 * ── BALÃO ANCORADO AO PINO ──
 *
 * ⚠️ Sai DO PINO, não do rodapé. A folha que subia de baixo cobria o mapa
 * inteiro e não dizia a que pino pertencia — num mapa com três cevas, era
 * preciso lembrar em qual se tinha tocado.
 *
 * ⚠️ A posição é recalculada a cada movimento do mapa, para o balão seguir o
 * pino no arrasto e no zoom. Sem isso ele ficaria parado enquanto o terreno
 * anda por baixo.
 */
const ancora = ref<{ x: number; y: number } | null>(null)
const alturaMapa = 62   // vh, o mesmo do MapaPontos abaixo
/* O elemento do palco, para medir a caixa REAL do mapa. */
const mapaEl = ref<HTMLElement | null>(null)

function recalcularAncora() {
  const sel = selecionado.value
  if (!sel) { ancora.value = null; return }
  ancora.value = mapaRef.value?.projetar(sel.lat, sel.lng) ?? null
}

/**
 * Onde desenhar o balão, em pixels dentro do mapa.
 *
 * ⚠️ Abre PARA CIMA quando há espaço, e para baixo quando o pino está no
 * topo — senão o balão nasceria fora da tela. E é preso nas laterais para não
 * vazar: num pino junto da borda, ele desliza em vez de sumir.
 */
/**
 * ⚠️ O estilo é montado NO SCRIPT, não no template. Expressão de CSS no
 * template vira texto solto para o conferidor de traduções, que passa a
 * cobrar tradução de `calc(100% -`.
 */
const estiloBalao = computed(() => {
  const p = posBalao.value
  if (!p) return {}
  return {
    left: p.x + 'px',
    width: p.larg + 'px',
    top: p.paraCima ? 'auto' : (p.topo + 26) + 'px',
    bottom: p.paraCima ? `calc(100% - ${p.topo - 26}px)` : 'auto',
    maxHeight: p.alt + 'px',
    '--seta': p.seta + 'px'
  } as Record<string, string>
})

const posBalao = computed(() => {
  const a = ancora.value
  if (!a) return null
  /**
   * ⚠️ A largura de referência é a do MAPA, não a da janela. O mapa vive
   * dentro do conteúdo, que tem margem — usar a janela fazia o balão vazar
   * pela direita exatamente a largura dessa margem.
   */
  const cx = mapaEl.value?.getBoundingClientRect()
  const alturaPx = cx?.height || (typeof window !== 'undefined' ? window.innerHeight * alturaMapa / 100 : 500)
  const larguraPx = cx?.width || 360
  const LARG = Math.min(320, larguraPx - 16)
  const paraCima = a.y > alturaPx * 0.45
  const x = Math.max(8, Math.min(a.x - LARG / 2, larguraPx - LARG - 8))
  /**
   * ⚠️ ALTURA LIMITADA AO ESPAÇO QUE SOBRA acima ou abaixo do pino. Sem isso
   * o balão passava do topo do mapa e ficava cortado pela barra do app — e o
   * cabeçalho dele, com o nome e o botão de fechar, sumia junto.
   */
  const folga = 12
  const alt = paraCima
    ? Math.max(140, a.y - 26 - folga)
    : Math.max(140, alturaPx - a.y - 26 - folga)
  return { x, larg: LARG, paraCima, topo: a.y, seta: a.x - x, alt }
})

async function selecionar(x: { tipo: 'ceva' | 'rota'; id: string; nome: string; lat: number; lng: number }) {
  selecionado.value = x
  await nextTick()
  recalcularAncora()
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
      (c) => ({ icone: 'ceva', sel: { tipo: 'ceva' as const, id: c.id },
        indice: indicePorCeva.value[c.id] ?? null }))
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
      out.push({ lat: p.lat, lng: p.lng, titulo: r.nome || 'Rota', cor: '#3b6ea5',
        icone: 'rotas', sel: { tipo: 'rota' as const, id: r.id },
        indice: indicePorRota.value[r.id] ?? null })
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
    /* O clima é o último e o mais frágil: sem ele o mapa funciona, só fica
       sem a etiqueta do índice. */
    const cl = await server<{ ok?: boolean; cevas?: Record<string, Agora> }>('apiClimaCevas')
      .catch(() => null)
    if (cl?.ok && cl.cevas) climaPorCeva.value = cl.cevas
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

      <!--
        ⚠️ O painel abre SOBRE o mapa, não abaixo. Embaixo, o mapa continuava
        ocupando 62% da tela e a informação nascia fora do campo de visão —
        era preciso rolar para ver o que o toque tinha aberto, e no mato isso
        significa perder de vista onde se está.
      -->
      <div ref="mapaEl" class="palco">
        <ClientOnly>
          <MapaPontos
            ref="mapaRef"
            :limites="limites"
            :pinos="pinos"
            :rotas="rotasNoMapa"
            enquadrar-uma-vez
            altura="62vh"
            @selecionar="selecionar"
            @moveu="recalcularAncora"
          />
        </ClientOnly>

        <!-- Balão saindo do pino. -->
        <div
          v-if="selecionado && posBalao"
          class="folha"
          :class="posBalao.paraCima ? 'acima' : 'abaixo'"
          :style="estiloBalao"
        >
          <div class="folha-cab">
            <b class="no-i18n">{{ selecionado.nome }}</b>
            <NuxtLink
              :to="{ path: selecionado.tipo === 'ceva' ? '/ceva-detalhe' : '/rota-detalhe',
                     query: { id: selecionado.id } }"
              class="folha-ir"
            >Abrir ficha</NuxtLink>
            <button class="folha-x" aria-label="Fechar" @click="selecionado = null">×</button>
          </div>
          <div class="folha-corpo">
            <!-- `key` força recriar ao trocar de ceva: sem isso o painel
                 manteria os dados da anterior enquanto os novos não chegam. -->
            <PainelCeva
              :key="selecionado.tipo + selecionado.id"
              :tipo="selecionado.tipo"
              :id="selecionado.id"
            />
          </div>
        </div>
      </div>

      <div class="barra-mapa">
        <button class="btn" @click="centralizarEmMim">
          <Icone nome="pino" /> Onde estou
        </button>
        <button class="btn sec" @click="mapaRef?.enquadrar()">
          <Icone nome="mapa" /> Ver tudo
        </button>
      </div>

      <!--
        ⚠️ A LISTA DE ROTAS SAIU daqui. Ela repetia o que o mapa já mostra e
        empurrava o rodapé para longe — e o toque na rota, que era o único
        motivo dela existir, agora acontece no próprio traçado, abrindo a
        folha por cima do mapa.
      -->
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
/* ── balão ancorado ao pino ── */
.palco { position: relative; }
.folha {
  position: absolute; z-index: 600;
  display: flex; flex-direction: column;
  background: var(--card); border: 1px solid var(--linha);
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, .55);
  animation: surge .16s ease-out;
}
@keyframes surge { from { transform: scale(.96); opacity: 0 } to { transform: none; opacity: 1 } }

/* A ponta aponta para o pino, na horizontal em que ele está. */
.folha::after {
  content: ''; position: absolute; left: var(--seta, 50%);
  margin-left: -7px; width: 0; height: 0;
  border-left: 7px solid transparent; border-right: 7px solid transparent;
}
.folha.acima::after {
  top: 100%; border-top: 8px solid var(--card);
}
.folha.abaixo::after {
  bottom: 100%; border-bottom: 8px solid var(--card);
}

.folha-cab {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-bottom: 1px solid var(--linha); flex: none;
}
.folha-cab b { flex: 1; min-width: 0; font-size: 15px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folha-ir {
  flex: none; font-size: 11.5px; font-weight: 700; color: var(--laranja-cl);
  text-decoration: none; border: 1px solid var(--linha);
  border-radius: 999px; padding: 4px 10px;
}
.folha-x {
  flex: none; border: 0; background: none; color: var(--osso-2);
  font-size: 26px; line-height: 1; cursor: pointer; padding: 0 4px;
}
/* ⚠️ A rolagem é do CORPO, não da página: rolar a folha não pode arrastar o
   mapa por baixo nem mover a tela inteira. */
.folha-corpo { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.folha-corpo :deep(.card) { background: none; border-radius: 0; }
.barra-mapa { display: flex; gap: 8px; margin-top: 8px; }
.barra-mapa .btn { flex: 1; margin: 0; }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.rodape { text-align: center; margin-top: 10px; font-size: 11px; }
</style>
