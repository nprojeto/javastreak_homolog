<script setup lang="ts">
/**
 * Detalhe da propriedade — a tela que mostra a área inteira num lugar só.
 * Porte da seção 1.7 do dossiê de propriedade.
 *
 * ⚠️ O que define o pertencimento é a GEOMETRIA, não um campo. Ceva e
 * armadilha não guardam `propriedadeId` — só coordenada. Quem decide se estão
 * dentro é o `pontoDentro`, rodando contra o polígono.
 *
 * A rota é a exceção: ela TEM `propriedadeId`, e esse vínculo explícito vale
 * mesmo que parte do traçado saia da área.
 *
 * ⚠️ Consequência disso: propriedade sem limite desenhado não mostra ceva nem
 * armadilha, porque não há como saber. A tela diz isso e oferece o botão de
 * desenhar — em vez de mostrar uma lista vazia sem explicação.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { pontoDentro, areaPoligono, fmtArea } from '~/composables/useMapa'
import { statusVencimento } from '~/composables/useArquivo'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'
import type { Rota } from '~/pages/rotas.vue'

definePageMeta({ layout: 'app' })

interface Marcacao {
  id: string; rotaId?: string; tipo: string; descricao?: string
  lat?: number | string; lng?: number | string
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const p = ref<Propriedade | null>(null)
const cevas = ref<Ceva[]>([])
const rotas = ref<Rota[]>([])
const armadilhas = ref<Marcacao[]>([])
const erro = ref('')
const carregando = ref(true)
const abrindo = ref('')

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? null : n
}

/** Ceva pertence à área se o ponto cai dentro do polígono. */
const cevasDentro = computed(() => {
  const lim = p.value?.limite || []
  if (lim.length < 3) return []
  return cevas.value.filter((c) => {
    const la = num(c.lat), ln = num(c.lng)
    return la !== null && ln !== null && pontoDentro({ lat: la, lng: ln }, lim)
  })
})

const armadilhasDentro = computed(() => {
  const lim = p.value?.limite || []
  if (lim.length < 3) return []
  return armadilhas.value.filter((a) => {
    const la = num(a.lat), ln = num(a.lng)
    return la !== null && ln !== null && pontoDentro({ lat: la, lng: ln }, lim)
  })
})

const area = computed(() =>
  (p.value?.limite?.length || 0) >= 3 ? fmtArea(areaPoligono(p.value!.limite)) : '—'
)

const pinos = computed(() => [
  ...cevasDentro.value.map((c) => ({
    lat: num(c.lat)!, lng: num(c.lng)!, titulo: c.nome || 'Ceva', cor: '#b8863b'
  })),
  ...armadilhasDentro.value.map((a) => ({
    lat: num(a.lat)!, lng: num(a.lng)!,
    titulo: 'Armadilha' + (a.descricao ? ' — ' + a.descricao : ''), cor: '#b23b3b'
  }))
])

async function abrirAnexo(docId?: string) {
  if (!docId) return
  abrindo.value = docId
  try {
    const r = await server<{ url?: string }>('apiAbrirDocumento', docId)
    if (r?.url) window.open(r.url, '_blank')
    else ui.avisar('Não foi possível abrir', 'erro')
  } catch { /* já avisado */ } finally {
    abrindo.value = ''
  }
}

onMounted(async () => {
  try {
    const ps = await server<Propriedade[]>('apiListarPropriedades')
    p.value = (ps || []).find((x) => x.id === id.value) || null
    if (!p.value) { erro.value = 'Propriedade não encontrada'; return }

    const [cs, rs] = await Promise.all([
      server<Ceva[]>('apiListarCevas').catch(() => [] as Ceva[]),
      server<Rota[]>('apiListarRotas').catch(() => [] as Rota[])
    ])
    cevas.value = cs || []
    rotas.value = (rs || []).filter((r) => String(r.propriedadeId || '') === id.value)

    /* Armadilha deixou de ser entidade: é marcação de rota. Só as rotas desta
       propriedade importam aqui. */
    const listas = await Promise.all(
      rotas.value.map((r) =>
        server<Marcacao[]>('apiListarMarcacoes', r.id).catch(() => [] as Marcacao[])
      )
    )
    armadilhas.value = listas.flat().filter((m) => m.tipo === 'Armadilha')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a propriedade'
  } finally {
    carregando.value = false
  }
})
</script>

<template>
  <div>
    <TituloTela titulo="Propriedade" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="carregando || !p" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab">
        <div class="topo">
          <h2 class="no-i18n">{{ p.nome }}</h2>
          <span class="doc-tag" :class="p.regular ? 'ok' : 'venc'">
            {{ p.regular ? 'regular' : 'irregular' }}
          </span>
        </div>
        <div v-if="p.regular" class="meta">
          Regular para receber ceva, rota e caçada.
        </div>
      </div>

      <!-- ───── MAPA ───── -->
      <div v-if="p.temLimite" class="card mapa-card">
        <ClientOnly>
          <MapaPontos
            :limites="[{ nome: p.nome, pontos: p.limite }]"
            :pinos="pinos"
            :tracado="rotas.length === 1 ? (rotas[0]!.pontos || []) : []"
            altura="46vh"
          />
        </ClientOnly>
        <div class="legenda">
          <span><i style="background:#2f7d3a" />limite</span>
          <span><i style="background:#b8863b" />ceva</span>
          <span><i style="background:#b23b3b" />armadilha</span>
          <span v-if="rotas.length"><i style="background:#2f6ea8" />rota</span>
        </div>
      </div>

      <div v-else class="card sem-limite">
        <div class="meta">
          <Icone nome="alerta" /> Sem o limite desenhado não dá para saber o que
          fica dentro desta área — nem cevas, nem armadilhas.
        </div>
        <NuxtLink :to="{ path: '/propriedade', query: { id } }" class="btn">
          Desenhar o limite
        </NuxtLink>
      </div>

      <!-- ───── FICHA ───── -->
      <div class="card">
        <h3>Ficha</h3>
        <div v-if="p.dono" class="linha"><span>Proprietário</span><b class="no-i18n">{{ p.dono }}</b></div>
        <div v-if="p.car" class="linha"><span>CAR</span><b class="no-i18n">{{ p.car }}</b></div>
        <div class="linha"><span>Área</span><b>{{ area }}</b></div>
        <div class="linha"><span>Pontos do limite</span><b>{{ (p.limite || []).length }}</b></div>
        <div v-if="p.obs" class="meta no-i18n">{{ p.obs }}</div>
      </div>

      <!-- ───── AUTORIZAÇÕES ───── -->
      <div class="card">
        <h3>Autorizações</h3>

        <div
          v-for="a in [
            { rot: 'Autorização de Acesso', d: p.autManejo },
            { rot: 'Autorização do IBAMA', d: p.autIbama }
          ]"
          :key="a.rot"
          class="aut"
          :class="{ falta: !a.d || a.d.vencido }"
        >
          <div class="topo">
            <b>{{ a.rot }}</b>
            <span
              v-if="a.d && statusVencimento(a.d.vencimento)"
              class="doc-tag"
              :class="statusVencimento(a.d.vencimento)!.classe"
            >{{ statusVencimento(a.d.vencimento)!.texto }}</span>
            <span v-else class="doc-tag venc">não cadastrada</span>
          </div>
          <div v-if="a.d" class="meta no-i18n">
            nº {{ a.d.numero || '—' }}
            <template v-if="a.d.vencimento"> · vence {{ dataBR(a.d.vencimento) }}</template>
          </div>
          <button
            v-if="a.d?.temArquivo"
            class="btn sm sec"
            :disabled="abrindo === a.d.id"
            @click="abrirAnexo(a.d.id)"
          >
            <Icone nome="link" /> {{ abrindo === a.d.id ? 'Abrindo…' : 'Abrir anexo' }}
          </button>
        </div>
      </div>

      <!-- ───── O QUE ESTÁ DENTRO ───── -->
      <div class="card">
        <h3>Nesta área</h3>

        <div class="dash">
          <div class="kpi"><b>{{ cevasDentro.length }}</b><span>cevas</span></div>
          <div class="kpi"><b>{{ rotas.length }}</b><span>rotas</span></div>
          <div class="kpi"><b>{{ armadilhasDentro.length }}</b><span>armadilhas</span></div>
        </div>

        <template v-if="cevasDentro.length">
          <h4 class="sub">Cevas</h4>
          <NuxtLink
            v-for="c in cevasDentro"
            :key="c.id"
            :to="{ path: '/ceva-detalhe', query: { id: c.id } }"
            class="item"
          >
            <Icone nome="ceva" />
            <span class="grow no-i18n">{{ c.nome || 'Ceva' }}</span>
            <span class="chev">›</span>
          </NuxtLink>
        </template>

        <template v-if="rotas.length">
          <h4 class="sub">Rotas</h4>
          <NuxtLink
            v-for="r in rotas"
            :key="r.id"
            :to="{ path: '/rota-detalhe', query: { id: r.id } }"
            class="item"
          >
            <Icone nome="rotas" />
            <span class="grow no-i18n">{{ r.nome || 'Rota' }}</span>
            <span class="chev">›</span>
          </NuxtLink>
        </template>

        <template v-if="armadilhasDentro.length">
          <h4 class="sub">Armadilhas</h4>
          <NuxtLink
            v-for="a in armadilhasDentro"
            :key="a.id"
            :to="{ path: '/rota-detalhe', query: { id: a.rotaId } }"
            class="item"
          >
            <Icone nome="armadilha" />
            <span class="grow no-i18n">{{ a.descricao || 'Armadilha' }}</span>
            <span class="chev">›</span>
          </NuxtLink>
        </template>

        <div v-if="p.temLimite && !cevasDentro.length && !rotas.length && !armadilhasDentro.length" class="meta">
          Nada cadastrado nesta área ainda.
        </div>
      </div>

      <NuxtLink :to="{ path: '/propriedade', query: { id } }" class="btn sec">
        <Icone nome="editar" /> Editar propriedade
      </NuxtLink>
      <NuxtLink to="/propriedades" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
h2 { margin: 0; font-size: 19px; }
h3 { margin: 0 0 8px; }
.sub { margin: 14px 0 4px; font-size: 12.5px; color: var(--laranja-cl); }
.ruim { color: var(--danger); }
.cab .topo, .aut .topo { display: flex; align-items: center; gap: 8px; }
.cab .topo h2, .aut .topo b { flex: 1; min-width: 0; }
.doc-tag { font-size: 11px; padding: 2px 9px; border-radius: 999px; }
.mapa-card { padding: 10px; }
.legenda { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 11.5px; color: var(--osso-2); }
.legenda span { display: flex; align-items: center; gap: 5px; }
.legenda i { width: 9px; height: 9px; border-radius: 50%; }
.sem-limite { border-left: 3px solid var(--alerta); }
.sem-limite .btn { margin-top: 10px; text-decoration: none; }
.linha { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--linha); font-size: 13.5px; }
.linha span { color: var(--osso-2); }
.aut + .aut { margin-top: 12px; }
.aut .meta { margin: 4px 0 0; }
.aut .btn { width: auto; margin-top: 8px; }
.dash { display: flex; gap: 8px; margin-bottom: 6px; }
.kpi { flex: 1; background: var(--carvao-3); border-radius: 12px; padding: 9px; text-align: center; }
.kpi b { display: block; font-size: 18px; }
.kpi span { font-size: 10.5px; color: var(--osso-2); }
.item { display: flex; align-items: center; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--linha); text-decoration: none; color: var(--txt); font-size: 14px; }
.item .grow { flex: 1; min-width: 0; }
.chev { color: var(--linha); font-size: 18px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
