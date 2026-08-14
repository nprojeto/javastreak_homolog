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
import { useUi } from '~/stores/ui'

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
const ui = useUi()
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

/* ── encerrar ─────────────────────────────────────────────────────────────
   ⚠️ O FECHAMENTO DO IBAMA VEM AQUI, logo depois de encerrar. É a hora em que
   a prestação de contas faz sentido: a caçada acabou, os abates estão
   registrados, e o relatório é o passo seguinte. Antes ele era um botão solto
   no fim da tela da caçada, desligado de qualquer momento. */
const encerrandoM = ref<Manejo | null>(null)
const avistamentos = ref('0')
const salvandoEnc = ref(false)
const encerrada = ref<Manejo | null>(null)

function abrirEncerrar(m: Manejo) {
  encerrandoM.value = m
  avistamentos.value = String(m.avistamentos ?? 0)
  encerrada.value = null
}

async function confirmarEncerrar() {
  const m = encerrandoM.value
  if (!m) return
  salvandoEnc.value = true
  try {
    await server('apiEncerrarManejo', m.id, avistamentos.value)
    ui.avisar('Caçada encerrada')
    /* Guarda a encerrada para oferecer o fechamento do IBAMA em seguida. */
    encerrada.value = m
    encerrandoM.value = null
    await carregar()
  } catch { /* já avisado */ } finally {
    salvandoEnc.value = false
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
    <TituloTela titulo="Caçadas" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div v-if="cred.dados && !cred.dados.ctfEmDia" class="card ctf">
        <div class="meta">
          <Icone nome="bloqueio" /> Seu CTF está vencido ou não foi cadastrado. Sem ele não dá para
          abrir caçada nem entrar na de ninguém.
        </div>
        <NuxtLink to="/ctf" class="btn sec">Cadastrar CTF</NuxtLink>
      </div>

      <template v-if="convites.length">
        <h3 class="sec"><Icone nome="email" /> Convites recebidos</h3>
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

      <!-- ENCERRAR: confirma, pergunta os avistamentos e leva ao IBAMA -->
      <div v-if="encerrandoM" class="card enc">
        <h3>Encerrar "<span class="no-i18n">{{ encerrandoM.nome || 'Caçada' }}</span>"</h3>
        <div class="meta">
          Encerrar é o único jeito de sair. <b>Não dá para reabrir depois.</b>
        </div>
        <label for="enc_av">Quantos javalis você avistou?</label>
        <input id="enc_av" v-model="avistamentos" inputmode="numeric">
        <div class="meta">
          Conte também os que você viu e não abateu — é esse número que mostra
          a pressão de javali na área.
        </div>
        <div class="acoes-enc">
          <button class="btn danger" :disabled="salvandoEnc" @click="confirmarEncerrar">
            {{ salvandoEnc ? 'Encerrando…' : 'Encerrar caçada' }}
          </button>
          <button class="btn sec" :disabled="salvandoEnc" @click="encerrandoM = null">Cancelar</button>
        </div>
      </div>

      <!--
        ⚠️ O FECHAMENTO DO IBAMA VEM AQUI, logo depois de encerrar. É a hora em
        que a prestação de contas faz sentido: a caçada acabou e os abates
        estão registrados. Antes era um botão solto no fim da tela da caçada,
        desligado de qualquer momento.
      -->
      <div v-if="encerrada" class="card pos-enc">
        <h3><Icone nome="confirmar" /> Caçada encerrada</h3>
        <div class="meta">
          Os abates dela entram no fechamento do IBAMA da propriedade
          <b class="no-i18n">{{ encerrada.propriedade?.nome || '' }}</b>.
        </div>
        <NuxtLink to="/ibama" class="btn">
          <Icone nome="arquivo" /> Abrir o fechamento IBAMA
        </NuxtLink>
        <button class="btn sec" @click="encerrada = null">Agora não</button>
      </div>

      <h3 class="sec"><Icone nome="alerta" /> Abertas</h3>
      <div v-if="!abertas.length" class="card">
        <div class="meta">Nenhuma caçada aberta.</div>
      </div>
      <!--
        ⚠️ O cartão é um NuxtLink inteiro, então um segundo link DENTRO dele
        seria link aninhado — HTML inválido, e o toque cai no de fora. Por
        isso as ações ficam num invólucro, ao lado do cartão, e não dentro.
      -->
      <div v-for="m in abertas" :key="m.id" class="bloco-aberta">
        <NuxtLink
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
        <!--
          ⚠️ ENTRAR e ENCERRAR, lado a lado. Encerrar era decisão tomada no fim
          da tela da caçada, no meio da operação; aqui ela se toma olhando a
          lista, que é quando a pessoa realmente decide. E o guiamento saiu:
          virou o próprio mapa dentro da caçada.
        -->
        <div class="acoes-aberta">
          <NuxtLink :to="{ path: '/cacada', query: { id: m.id } }" class="ac entrar">
            <Icone nome="avancar" :px="16" /> Entrar
          </NuxtLink>
          <button v-if="m.souDono" class="ac encerrar" @click="abrirEncerrar(m)">
            <Icone nome="confirmar" :px="16" /> Encerrar
          </button>
        </div>
      </div>

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

/* O atalho encosta no cartão de cima: os cantos de baixo do cartão e os de
   cima do atalho ficam retos, e os dois lidos como uma peça só. */
.bloco-aberta { margin-bottom: 10px; }
.bloco-aberta .cacada { margin-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.acoes-aberta { display: flex; }
.ac {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px; text-decoration: none; cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 700;
  background: var(--carvao-3); border: 1px solid var(--linha); border-top: 0;
}
.ac.entrar { color: var(--laranja-cl); border-radius: 0 0 0 12px; }
.ac.encerrar { color: var(--danger); border-left: 0; border-radius: 0 0 12px 0; }
.ac:only-child { border-radius: 0 0 12px 12px; }
.ac:active { background: var(--linha); }

.enc { border-left: 5px solid var(--danger); margin-bottom: 12px; }
.enc h3 { margin: 0 0 4px; }
.acoes-enc { display: flex; gap: 8px; margin-top: 12px; }
.acoes-enc .btn { flex: 1; margin: 0; }
.pos-enc { border-left: 5px solid var(--verde); margin-bottom: 12px; }
.pos-enc h3 { margin: 0 0 4px; }
.pos-enc .btn { margin-top: 10px; text-decoration: none; }
.cacada .grow { flex: 1; min-width: 0; }
.cacada .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.chev { font-size: 22px; color: var(--linha); }
</style>
