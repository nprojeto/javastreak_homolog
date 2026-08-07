<script setup lang="ts">
/**
 * Admin — parâmetros gerais, campanhas e patrocínios.
 * Porte de apiListarParametros / apiSalvarParametros / apiListarCampanhas /
 * apiAdminPatrocinios (index.html, 7250-7480).
 *
 * ⚠️ Os parâmetros vêm do `PARAMS_DEF` do servidor, com grupo, tipo e ajuda —
 * a tela não conhece a lista, ela desenha o que chegar. Parâmetro novo no
 * backend aparece aqui sozinho, sem tocar no frontend.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

interface Param {
  chave: string; nome: string; ajuda?: string; tipo: string
  grupo: string; valor: string
}
interface Campanha {
  id: string; titulo?: string; texto?: string; link?: string
  inicio?: string; fim?: string; status?: string; ativa?: boolean
}
interface Patrocinio {
  id: string; empresaNome?: string; tipo?: string; status?: string
  inicio?: string; fim?: string; valor?: number; obs?: string
}

const { server } = useServer()
const ui = useUi()

const params = ref<Param[] | null>(null)
const campanhas = ref<Campanha[] | null>(null)
const patrocinios = ref<Patrocinio[] | null>(null)
const filtroPat = ref('fila')
const salvando = ref(false)

/** Agrupa por `grupo`, mantendo a ordem em que o servidor mandou. */
const grupos = computed(() => {
  const g: Record<string, Param[]> = {}
  for (const p of params.value || []) (g[p.grupo] ||= []).push(p)
  return g
})

async function carregar() {
  const [p, c] = await Promise.all([
    server<Param[]>('apiListarParametros').catch(() => [] as Param[]),
    server<Campanha[]>('apiListarCampanhas').catch(() => [] as Campanha[])
  ])
  params.value = p || []
  campanhas.value = c || []
  await carregarPatrocinios()
}

async function carregarPatrocinios() {
  patrocinios.value = await server<Patrocinio[]>('apiAdminPatrocinios', filtroPat.value)
    .catch(() => [] as Patrocinio[])
}

watch(filtroPat, carregarPatrocinios)

async function salvarParams() {
  salvando.value = true
  try {
    const mapa: Record<string, string> = {}
    for (const p of params.value || []) mapa[p.chave] = String(p.valor)
    const r = await server<{ salvos: string[] }>('apiSalvarParametros', mapa)
    ui.avisar((r.salvos?.length || 0) + ' ajuste(s) salvos ✔')
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function encerrarCampanha(c: Campanha) {
  if (!confirm('Encerrar esta campanha?')) return
  try {
    await server('apiEncerrarCampanha', c.id)
    campanhas.value = await server<Campanha[]>('apiListarCampanhas')
  } catch { /* já avisado */ }
}

async function acaoPatrocinio(p: Patrocinio, acao: 'aprovar' | 'recusar' | 'tirar' | 'republicar') {
  const chamada = acao === 'recusar' ? 'apiRecusarPatrocinio'
    : acao === 'tirar' ? 'apiTirarPatrocinioDoAr'
      : acao === 'republicar' ? 'apiRepublicarPatrocinio' : 'apiCancelarPatrocinio'
  if (!confirm('Confirmar esta ação?')) return
  try {
    await server(chamada, p.id)
    await carregarPatrocinios()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <!-- ───── PARÂMETROS ───── -->
    <div class="card">
      <h3>🎛️ Ajustes da plataforma</h3>
      <div class="meta">
        Estes valores mandam nas regras do app. Mudança vale a partir do
        próximo carregamento de cada usuário.
      </div>

      <div v-if="params === null" class="meta">Carregando…</div>
      <template v-else>
        <template v-for="(lista, grupo) in grupos" :key="grupo">
          <h4 class="sub">{{ grupo }}</h4>
          <div v-for="p in lista" :key="p.chave" class="param">
            <label :for="'pp_' + p.chave">{{ p.nome }}</label>
            <input
              v-if="p.tipo !== 'texto'"
              :id="'pp_' + p.chave"
              v-model="p.valor"
              :inputmode="p.tipo === 'numero' ? 'numeric' : undefined"
              class="no-i18n"
            >
            <textarea v-else :id="'pp_' + p.chave" v-model="p.valor" class="no-i18n" />
            <div v-if="p.ajuda" class="meta ajuda">{{ p.ajuda }}</div>
          </div>
        </template>

        <button class="btn" :disabled="salvando" @click="salvarParams">
          {{ salvando ? 'Salvando…' : 'Salvar ajustes' }}
        </button>
      </template>
    </div>

    <!-- ───── CAMPANHAS ───── -->
    <div class="card">
      <h3>📣 Campanhas</h3>
      <div v-if="campanhas === null" class="meta">Carregando…</div>
      <div v-else-if="!campanhas.length" class="meta">Nenhuma campanha cadastrada.</div>

      <div v-for="c in campanhas || []" :key="c.id" class="linha">
        <div class="grow">
          <b class="no-i18n">{{ c.titulo || 'Campanha' }}</b>
          <span class="pill" :class="c.ativa ? 'ok' : ''">{{ c.ativa ? 'no ar' : c.status }}</span>
          <div v-if="c.texto" class="meta no-i18n">{{ c.texto }}</div>
          <div class="meta">
            {{ dataBR(c.inicio) }} → {{ c.fim ? dataBR(c.fim) : 'sem prazo' }}
          </div>
        </div>
        <button v-if="c.ativa" class="btn sm sec" @click="encerrarCampanha(c)">Encerrar</button>
      </div>
    </div>

    <!-- ───── PATROCÍNIOS ───── -->
    <div class="card">
      <h3>🤝 Patrocínios</h3>
      <label for="pt_filtro">Mostrar</label>
      <select id="pt_filtro" v-model="filtroPat">
        <option value="fila">Na fila</option>
        <option value="ativos">No ar</option>
        <option value="todos">Todos</option>
      </select>

      <div v-if="patrocinios === null" class="meta">Carregando…</div>
      <div v-else-if="!patrocinios.length" class="meta">Nada por aqui.</div>

      <div v-for="p in patrocinios || []" :key="p.id" class="linha col">
        <div class="topo">
          <b class="no-i18n">{{ p.empresaNome || 'Empresa' }}</b>
          <span class="pill">{{ p.tipo }}</span>
          <span class="pill" :class="p.status === 'ativo' ? 'ok' : ''">{{ p.status }}</span>
        </div>
        <div class="meta">
          {{ dataBR(p.inicio) }} → {{ p.fim ? dataBR(p.fim) : 'sem prazo' }}
        </div>
        <div v-if="p.obs" class="meta no-i18n">{{ p.obs }}</div>

        <div class="acoes">
          <button
            v-if="p.status === 'ativo'"
            class="btn sm sec"
            @click="acaoPatrocinio(p, 'tirar')"
          >Tirar do ar</button>
          <button
            v-else
            class="btn sm sec"
            @click="acaoPatrocinio(p, 'republicar')"
          >Republicar</button>
          <button class="btn sm sec" @click="acaoPatrocinio(p, 'recusar')">Recusar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.sub { margin: 16px 0 6px; font-size: 13px; color: var(--verde); text-transform: capitalize; }
.param { margin-bottom: 6px; }
.ajuda { margin: -4px 0 8px; }
.linha { display: flex; align-items: flex-start; gap: 8px; padding: 10px 0; border-top: 1px solid var(--linha); }
.linha.col { display: block; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 3px 0 0; }
.linha .btn { width: auto; margin: 0; }
.topo { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.pill.ok { background: var(--verde-claro); color: var(--verde-esc); }
.acoes { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.acoes .btn { width: auto; margin: 0; }
</style>
