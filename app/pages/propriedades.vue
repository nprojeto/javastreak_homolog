<script setup lang="ts">
/**
 * Lista de propriedades. Porte de VIEWS.propriedades (index.html, 10242).
 *
 * ⚠️ "Regular" é o que libera o resto: limite desenhado MAIS as duas
 * autorizações válidas. Propriedade irregular não recebe ceva, nem rota, nem
 * ciclo — então o selo aqui não é enfeite, é o motivo pelo qual o botão de
 * criar vai estar travado lá na frente.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { fmtArea, areaPoligono } from '~/composables/useMapa'
import type { Ponto } from '~/composables/useMapa'

definePageMeta({ layout: 'app' })

interface Aut {
  id?: string; numero?: string; vencimento?: string
  arquivoNome?: string; temArquivo?: boolean; vencido?: boolean
}
export interface Propriedade {
  id: string; nome: string; dono?: string; car?: string; obs?: string
  lat?: number; lng?: number
  limite: Ponto[]; temLimite: boolean
  autManejo: Aut | null; autIbama: Aut | null
  regular: boolean
}

const { server } = useServer()
const ui = useUi()

const lista = ref<Propriedade[] | null>(null)
const erro = ref('')

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Propriedade[]>('apiListarPropriedades')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as propriedades'
  }
}

async function excluir(p: Propriedade) {
  if (!confirm('Excluir esta propriedade?')) return
  try {
    await server('apiExcluirPropriedade', p.id)
    ui.avisar('Excluída')
    await carregar()
  } catch { /* já avisado */ }
}

function faltas(p: Propriedade) {
  const f: string[] = []
  if (!p.temLimite) f.push('limite não desenhado')
  if (!p.autManejo || p.autManejo.vencido) f.push('Autorização de Acesso')
  if (!p.autIbama || p.autIbama.vencido) f.push('Autorização IBAMA')
  return f
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Propriedades</h2>
        <div class="meta">
          É a propriedade que libera o resto: sem limite desenhado e as duas
          autorizações válidas, ela não recebe ceva, rota nem caçada.
        </div>
      </div>

      <div v-if="!lista.length" class="card vazio">
        <div class="big">🏞️</div>
        Nenhuma propriedade cadastrada.
        <div class="meta">Comece cadastrando onde você maneja.</div>
      </div>

      <div v-for="p in lista" :key="p.id" class="card prop">
        <div class="cab">
          <b>{{ p.nome }}</b>
          <span class="doc-tag" :class="p.regular ? 'ok' : 'venc'">
            {{ p.regular ? 'regular' : 'irregular' }}
          </span>
        </div>

        <div v-if="p.dono" class="meta no-i18n">Proprietário: {{ p.dono }}</div>
        <div v-if="p.car" class="meta no-i18n">CAR: {{ p.car }}</div>
        <div class="meta">
          {{ p.temLimite
            ? p.limite.length + ' pontos · ' + fmtArea(areaPoligono(p.limite))
            : 'limite não desenhado' }}
        </div>

        <div v-if="!p.regular" class="meta ruim">
          ⚠️ Falta: {{ faltas(p).join(', ') }}
        </div>
        <div v-else class="meta">
          Acesso vence {{ dataBR(p.autManejo?.vencimento) }} ·
          IBAMA vence {{ dataBR(p.autIbama?.vencimento) }}
        </div>

        <div class="acoes">
          <NuxtLink :to="{ path: '/propriedade', query: { id: p.id } }" class="btn sm sec">
            ✏️ Editar
          </NuxtLink>
          <button class="btn sm sec" @click="excluir(p)">🗑️ Excluir</button>
        </div>
      </div>

      <NuxtLink to="/propriedade" class="btn">+ Nova propriedade</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px 16px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.prop .cab { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.prop .cab b { flex: 1; }
.doc-tag { font-size: 11px; padding: 2px 9px; border-radius: 999px; background: var(--linha); }
.doc-tag.ok { background: var(--verde-claro); color: var(--verde-esc); }
.doc-tag.venc { background: #ffdad3; color: #a33; }
.acoes { display: flex; gap: 8px; margin-top: 10px; }
.acoes .btn { width: auto; margin: 0; text-decoration: none; }
.btn { text-decoration: none; }
</style>
