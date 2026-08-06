<script setup lang="ts">
/**
 * Planos. Porte de VIEWS.planos + assinar + conferirPagamento
 * (index.html, 6175).
 *
 * ⚠️ Na HOMOLOGAÇÃO o `MP_ACCESS_TOKEN` foi deixado de fora de propósito, para
 * que nenhum teste vire cobrança de verdade. Assinar aqui vai falhar com
 * "Configure MP_ACCESS_TOKEN" — e esse é o comportamento desejado, não um bug.
 */
import { useCreditos } from '~/stores/creditos'
import { useSessaoApp } from '~/composables/useSessaoApp'
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Plano {
  plano: string
  nome: string
  empresa?: boolean
  limites: Record<string, number>
  rotulos?: Record<string, string>
  liga?: Record<string, number>
  precos: Record<string, number>
}
interface MeuPlano {
  plano: string; nome: string; ativo: boolean; semPlano?: boolean
  fim: string; diasRestantes: number | null
}

const LIMROTULO: Record<string, string> = {
  cevas: 'Cevas', rotas: 'Rotas', marcacoesPorRota: 'Pontos por rota', canis: 'Canis',
  caesPorCanil: 'Cães por canil', transportes: 'Meios de transporte', armadilhas: 'Armadilhas',
  abatesMes: 'Abates por mês', trofeusRanking: 'Troféus no ranking',
  compartilharRota: 'Compartilhar rota', fotoPerfil: 'Trocar foto de perfil',
  verManejadores: 'Ver manejadores na rede', filtrarPromos: 'Filtrar promoções',
  documentos: 'Documentação', propriedades: 'Propriedades',
  compartilharSala: 'Compartilhar sala de troféus'
}
/** Estes são interruptor, não quantidade: não mostram número. */
const LIGA = ['compartilharRota', 'fotoPerfil', 'verManejadores', 'filtrarPromos']

const { server } = useServer()
const ui = useUi()
const cred = useCreditos()
const { carregarCreditos } = useSessaoApp()

const lista = ref<Plano[] | null>(null)
const meu = ref<MeuPlano | null>(null)
const erro = ref('')
const periodo = ref<'MES' | 'SEM' | 'ANO'>('MES')
const assinando = ref('')
const conferindo = ref(false)

const ehEmpresa = computed(
  () => meu.value?.plano === 'empresa' || meu.value?.plano === 'empresapro'
)

function precoFmt(v?: number) {
  if (v == null) return ''
  const sufixo = periodo.value === 'MES' ? '/mês' : periodo.value === 'SEM' ? '/semestre' : '/ano'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',') + sufixo
}

function economia(p: Record<string, number>) {
  const m = Number(p?.MES) || 0
  if (!m) return ''
  if (periodo.value === 'SEM') {
    const s = Number(p.SEM) || 0
    const d = Math.round((1 - s / (m * 6)) * 100)
    return d > 0 ? `economize ${d}% · R$ ${(s / 6).toFixed(2).replace('.', ',')}/mês` : ''
  }
  if (periodo.value === 'ANO') {
    const a = Number(p.ANO) || 0
    const d = Math.round((1 - a / (m * 12)) * 100)
    return d > 0 ? `economize ${d}% · R$ ${(a / 12).toFixed(2).replace('.', ',')}/mês` : ''
  }
  return ''
}

function limTexto(v: number | undefined) {
  if (v === undefined || v === null) return '—'
  return v === -1 ? 'Ilimitado' : v === 0 ? '—' : String(v)
}

function itens(p: Plano) {
  const rot = p.rotulos || LIMROTULO
  const liga = p.liga || {}
  return Object.keys(rot).map((k) => {
    const v = p.limites?.[k]
    const sim = v !== 0
    const interruptor = p.rotulos ? !!liga[k] : LIGA.includes(k)
    return {
      k,
      sim,
      texto: (rot[k] || k) + (!interruptor && sim ? ' — ' + limTexto(v) : '')
    }
  })
}

async function carregar() {
  erro.value = ''
  try {
    const [l, m] = await Promise.all([
      server<Plano[]>('apiPlanosDisponiveis'),
      server<MeuPlano>('apiMeuPlano')
    ])
    lista.value = l
    meu.value = m
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os planos'
  }
}

async function assinar(plano: string) {
  assinando.value = plano
  try {
    const r = await server<{ checkoutUrl?: string }>('apiCriarPagamento', plano, periodo.value)
    if (r.checkoutUrl) {
      window.location.href = r.checkoutUrl
      return
    }
    ui.avisar('Não veio o link de pagamento', 'erro')
  } catch { /* o useServer já avisou */ } finally {
    assinando.value = ''
  }
}

async function conferirPagamento() {
  conferindo.value = true
  try {
    const r = await server<{ aprovados: number }>('apiSincronizarPagamentos')
    if (r.aprovados > 0) {
      ui.avisar('Pagamento confirmado! Seu plano foi ativado ✔')
      await Promise.all([carregar(), carregarCreditos(true)])
    } else {
      ui.avisar('Nenhum pagamento novo encontrado')
    }
  } catch { /* já avisado */ } finally {
    conferindo.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!lista || !meu" class="card"><div class="meta">Carregando planos…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Escolha seu plano</h2>
        <div class="meta">Comece grátis e evolua quando precisar de mais.</div>
      </div>

      <div
        v-if="meu.plano !== 'free' && meu.diasRestantes !== null && meu.diasRestantes <= 15"
        class="card venc"
      >
        <b>⏳ {{ meu.diasRestantes <= 0 ? 'Seu plano venceu' : 'Seu plano vence em ' + meu.diasRestantes + (meu.diasRestantes === 1 ? ' dia' : ' dias') }}</b>
        <div class="meta">
          {{ meu.diasRestantes <= 0
            ? 'Renove para voltar a ter acesso completo.'
            : 'Renove para não perder o acesso — o período novo soma ao que resta.' }}
        </div>
      </div>

      <div class="pl-per">
        <button
          v-for="p in [['MES','Mensal'],['SEM','Semestral'],['ANO','Anual']]"
          :key="p[0]"
          :class="{ on: periodo === p[0] }"
          @click="periodo = p[0] as 'MES' | 'SEM' | 'ANO'"
        >{{ p[1] }}</button>
      </div>

      <div class="pl-grade">
        <div
          v-for="p in lista"
          :key="p.plano"
          class="plano"
          :class="{ atual: p.plano === meu.plano, destaque: p.plano === 'n2' || p.plano === 'empresapro' }"
        >
          <div class="plano-top">
            <div class="plano-nome">{{ p.nome }}</div>
            <span v-if="p.plano === meu.plano" class="plano-badge">seu plano</span>
          </div>

          <div class="plano-preco">
            {{ p.plano === 'free' ? 'Grátis' : precoFmt(p.precos?.[periodo]) }}
          </div>
          <div class="plano-eco">
            {{ p.plano === 'free' ? 'para sempre' : economia(p.precos) }}
          </div>

          <ul class="plano-lista">
            <li v-for="i in itens(p)" :key="i.k" :class="i.sim ? 'sim' : 'nao'">
              <span>{{ i.sim ? '✓' : '✕' }}</span>{{ i.texto }}
            </li>
          </ul>

          <div v-if="p.plano === meu.plano" class="plano-ativo">
            {{ meu.fim ? 'Ativo até ' + dataBR(meu.fim) : 'Plano atual' }}
          </div>
          <div v-else-if="p.plano === 'free'" class="plano-ativo">Plano de entrada</div>
          <button
            v-else
            class="plano-btn"
            :disabled="assinando === p.plano"
            @click="assinar(p.plano)"
          >{{ assinando === p.plano ? 'Abrindo…' : 'Assinar ' + p.nome }}</button>
        </div>
      </div>

      <div class="card rodape">
        <div class="meta">
          Pagamento por cartão, boleto ou PIX. Cancele quando quiser.<br>
          <b>PIX e cartão liberam na hora. Boleto leva de 1 a 3 dias úteis.</b><br>
          Na tela do Mercado Pago, preencha todos os campos — inclusive e-mail e
          CPF — para o botão Pagar funcionar.
        </div>
        <div class="acoes">
          <button class="btn sec" :disabled="conferindo" @click="conferirPagamento">
            🔄 {{ conferindo ? 'Verificando…' : 'Já paguei — atualizar' }}
          </button>
          <NuxtLink to="/compras" class="btn sec">🧾 Minhas compras</NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.venc { border-left: 5px solid var(--alerta); }
.ruim { color: var(--danger); }

.pl-per { display: flex; gap: 6px; margin: 10px 0; }
.pl-per button {
  flex: 1; padding: 9px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: #fff; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--txt);
}
.pl-per button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }

.pl-grade { display: grid; gap: 12px; }
.plano { background: #fff; border: 1.5px solid var(--linha); border-radius: 16px; padding: 16px; }
.plano.destaque { border-color: var(--laranja); }
.plano.atual { border-color: var(--verde); }
.plano-top { display: flex; align-items: center; gap: 8px; }
.plano-nome { font-size: 18px; font-weight: 800; flex: 1; }
.plano-badge { font-size: 11px; background: var(--verde); color: #fff; padding: 3px 9px; border-radius: 999px; }
.plano-preco { font-size: 22px; font-weight: 800; margin-top: 6px; color: var(--verde-esc); }
.plano-eco { font-size: 12px; color: var(--laranja-esc); min-height: 16px; }
.plano-lista { list-style: none; padding: 0; margin: 12px 0; }
.plano-lista li { display: flex; gap: 8px; font-size: 13.5px; padding: 4px 0; }
.plano-lista li.nao { opacity: .45; }
.plano-lista li span { flex: none; width: 14px; }
.plano-btn {
  width: 100%; padding: 12px; border-radius: 12px; border: 0;
  background: var(--laranja); color: #fff; font-weight: 700; cursor: pointer; font-size: 15px;
}
.plano-ativo { text-align: center; font-size: 13px; color: var(--verde-esc); font-weight: 600; padding: 10px 0; }
.rodape .acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.rodape .btn { width: auto; margin: 0; text-decoration: none; }
</style>
