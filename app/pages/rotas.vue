<script setup lang="ts">
/**
 * Rotas. Porte de VIEWS.rotas (index.html, 8566).
 *
 * ⚠️ A gravação por GPS NÃO está aqui, e não é esquecimento. O legado a
 * removeu do cadastro de rota — o `comecarGravacao` só é chamado por ele
 * mesmo, nenhum botão leva até ele. O motivo está escrito lá: um traçado de
 * GPS não tem como respeitar o limite da propriedade vértice a vértice.
 * A gravação por GPS sobrevive só dentro da caçada livre, e chega no lote 7.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Ponto } from '~/composables/useMapa'

definePageMeta({ layout: 'app' })

export interface Rota {
  id: string; nome?: string; propriedade?: string; propriedadeId?: string
  tipoTransporte?: string; pontos: Ponto[]; distancia?: number | string
  dataCadastro?: string; modalidade?: string
  permissao?: string; donoNome?: string
}

const { server } = useServer()
const ui = useUi()

const minhas = ref<Rota[] | null>(null)
const comigo = ref<Rota[]>([])
const erro = ref('')

function fmtDist(m: number) {
  if (!m) return '0 m'
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km'
}

async function carregar() {
  erro.value = ''
  try {
    const [r, c] = await Promise.all([
      server<Rota[]>('apiListarRotas'),
      server<Rota[]>('apiRotasCompartilhadasComigo').catch(() => [] as Rota[])
    ])
    minhas.value = (r || [])
      .filter((x) => String(x.modalidade || 'manejo') === 'manejo')
      .sort((a, b) => String(b.dataCadastro).localeCompare(String(a.dataCadastro)))
    comigo.value = c || []
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as rotas'
  }
}

async function excluir(r: Rota) {
  if (!confirm('Excluir esta rota?')) return
  try {
    await server('apiExcluir', 'rota', r.id)
    ui.avisar('Excluída')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="minhas === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Rotas</h2>
        <div class="meta">
          A rota inteira precisa ficar dentro do limite desenhado da propriedade.
        </div>
      </div>

      <div v-if="!minhas.length" class="card vazio">
        <div class="big"><Icone nome="rotas" /></div>
        Nenhuma rota cadastrada ainda.
      </div>

      <div v-for="r in minhas" :key="r.id" class="card rota">
        <NuxtLink :to="{ path: '/rota-detalhe', query: { id: r.id } }" class="grow">
          <b class="no-i18n"><Icone nome="rotas" /> {{ r.nome || 'Rota' }}</b>
          <div class="meta no-i18n">
            <template v-if="r.propriedade">{{ r.propriedade }} · </template>
            {{ r.tipoTransporte || '' }}
          </div>
          <div class="meta">
            {{ fmtDist(Number(r.distancia) || 0) }} ·
            {{ (r.pontos || []).length }} pontos ·
            {{ dataBR(r.dataCadastro) }}
          </div>
        </NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(r)"><Icone nome="excluir" /></button>
      </div>

      <BotaoCriar
        rotulo="＋ Criar nova rota"
        chave="rotas"
        :quantidade="minhas.length"
        para="/rota"
      />

      <template v-if="comigo.length">
        <h3 class="sec"><Icone nome="amigos" /> Compartilhadas comigo</h3>
        <div v-for="r in comigo" :key="r.id" class="card rota">
          <NuxtLink :to="{ path: '/rota-detalhe', query: { id: r.id } }" class="grow">
            <b class="no-i18n">
              <Icone nome="rotas" /> {{ r.nome || 'Rota' }}
              <span class="pill">{{ r.permissao === 'editar' ? 'Editar' : 'Seguir' }}</span>
            </b>
            <div class="meta no-i18n">
              de {{ r.donoNome || 'manejador' }} · {{ (r.pontos || []).length }} pontos
            </div>
          </NuxtLink>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.rota { display: flex; align-items: center; gap: 8px; }
.rota .grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.rota .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.sec { margin: 16px 4px 6px; font-size: 15px; }
</style>
