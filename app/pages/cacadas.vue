<script setup lang="ts">
/**
 * Caçadas — lista dos ciclos. Porte de VIEWS.manejoHub + manejoLista
 * (index.html, 9526 / 9787).
 *
 * ⚠️ PODEM EXISTIR VÁRIOS CICLOS ABERTOS ao mesmo tempo. A regra de "um por
 * vez" foi removida do backend: o que segurava a ambiguidade era saber em qual
 * ciclo o abate entrava, e hoje o abate é registrado de DENTRO da caçada, que
 * manda o próprio id.
 *
 * ⚠️ O ciclo vencido encerra sozinho, no servidor, quando a lista é pedida —
 * o teto é o vencimento da primeira das duas autorizações da propriedade.
 */
import { dataBR } from '~/composables/useMascaras'
import { useCreditos } from '~/stores/creditos'

definePageMeta({ layout: 'app' })

export interface Manejo {
  id: string; nome?: string; tipo?: string; status?: string
  criadoEm?: string; encerradoEm?: string; obs?: string
  avistamentos?: number | null; donoNome?: string; souDono?: boolean
  abates?: { registros: number; animais: number }
  participantes?: Array<{ id: string; nome: string; dono?: boolean }>
  cevas?: Array<{ id: string; nome: string }>
  rotas?: Array<{ id: string; nome: string }>
  propriedade?: { id: string; nome: string } | null
}
interface Convite {
  id: string; manejoNome?: string; tipo?: string; donoNome?: string; criadoEm?: string
}

const { server } = useServer()
const cred = useCreditos()

const lista = ref<Manejo[] | null>(null)
const convites = ref<Convite[]>([])
const erro = ref('')

const abertas = computed(() => (lista.value || []).filter((m) => m.status === 'aberto'))
const fechadas = computed(() => (lista.value || []).filter((m) => m.status !== 'aberto'))

const TIPO: Record<string, string> = {
  ceva: 'Ceva', rota: 'Rota', livre: 'Livre'
}

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Manejo[]>('apiListarManejos')
    convites.value = await server<Convite[]>('apiMeusConvitesManejo').catch(() => [])
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as caçadas'
  }
}

async function responder(c: Convite, resposta: 'aceito' | 'recusado') {
  try {
    await server('apiResponderConviteManejo', c.id, resposta)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div v-if="cred.dados && !cred.dados.ctfEmDia" class="card ctf">
        <div class="meta">
          🔒 Seu CTF está vencido ou não foi cadastrado. Sem ele não dá para
          abrir caçada nem entrar na de ninguém.
        </div>
        <NuxtLink to="/ctf" class="btn sec">Cadastrar CTF</NuxtLink>
      </div>

      <template v-if="convites.length">
        <h3 class="sec">✉️ Convites recebidos</h3>
        <div v-for="c in convites" :key="c.id" class="card convite">
          <div class="grow">
            <b class="no-i18n">{{ c.manejoNome || 'Caçada' }}</b>
            <div class="meta no-i18n">
              de {{ c.donoNome || 'manejador' }} · {{ dataBR(c.criadoEm) }}
            </div>
          </div>
          <button class="btn sm" @click="responder(c, 'aceito')">Aceitar</button>
          <button class="btn sm sec" @click="responder(c, 'recusado')">Recusar</button>
        </div>
      </template>

      <h3 class="sec">🔴 Abertas</h3>
      <div v-if="!abertas.length" class="card">
        <div class="meta">Nenhuma caçada aberta.</div>
      </div>
      <NuxtLink
        v-for="m in abertas"
        :key="m.id"
        :to="{ path: '/cacada', query: { id: m.id } }"
        class="card cacada aberta"
      >
        <div class="grow">
          <b class="no-i18n">{{ m.nome || 'Caçada' }}</b>
          <span class="pill">{{ TIPO[m.tipo || ''] || m.tipo }}</span>
          <span v-if="!m.souDono" class="pill">convidado</span>
          <div class="meta no-i18n">
            {{ m.propriedade?.nome || '—' }} · aberta em {{ dataBR(m.criadoEm) }}
          </div>
          <div class="meta">
            {{ m.abates?.animais || 0 }} animal(is) ·
            {{ (m.participantes || []).length }} participante(s)
          </div>
        </div>
        <div class="chev">›</div>
      </NuxtLink>

      <BotaoCriar
        rotulo="＋ Caçar agora"
        chave="ciclo"
        para="/cacada-nova"
      />

      <template v-if="fechadas.length">
        <h3 class="sec">Encerradas</h3>
        <NuxtLink
          v-for="m in fechadas"
          :key="m.id"
          :to="{ path: '/cacada', query: { id: m.id } }"
          class="card cacada"
        >
          <div class="grow">
            <b class="no-i18n">{{ m.nome || 'Caçada' }}</b>
            <div class="meta no-i18n">
              {{ m.propriedade?.nome || '—' }} · encerrada em {{ dataBR(m.encerradoEm) }}
            </div>
            <div class="meta">
              {{ m.abates?.animais || 0 }} animal(is)
              <template v-if="m.avistamentos != null">
                · {{ m.avistamentos }} avistamento(s)
              </template>
            </div>
          </div>
          <div class="chev">›</div>
        </NuxtLink>
      </template>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.ctf { border-left: 5px solid var(--danger); }
.ctf .btn { margin-top: 8px; text-decoration: none; }
.sec { margin: 14px 4px 6px; font-size: 15px; }
.convite { display: flex; align-items: center; gap: 8px; }
.convite .grow { flex: 1; min-width: 0; }
.convite .btn { width: auto; margin: 0; }
.cacada { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--txt); }
.cacada.aberta { border-left: 5px solid var(--danger); }
.cacada .grow { flex: 1; min-width: 0; }
.cacada .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.chev { font-size: 22px; color: var(--linha); }
</style>
