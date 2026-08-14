<script setup lang="ts">
/**
 * ── PAINEL DA CEVA / ROTA ─────────────────────────────────────────────────
 *
 * Abre ao tocar no pino no mapa. Três camadas, na ordem em que a pergunta
 * aparece:
 *
 *   1. CONDIÇÕES AGORA — o índice 0–100 e por que ele deu isso
 *   2. LINHA DO TEMPO  — cada abate que saiu ali
 *   3. RESUMO          — os abates fatiados por dimensão
 *
 * É a seção 4.7 do dossiê, que ficou na fila desde o porte do HTML.
 *
 * ⚠️ O AVISO ANDA JUNTO DO NÚMERO, nunca no rodapé. O índice é frequência dos
 * abates registrados, não probabilidade: o app não sabe as esperas em que nada
 * apareceu. Um número grande e sozinho vira promessa, e alguém dirige 40 km
 * por causa dele.
 */
import {
  estatisticaDe, contarPor, ABAS_RESUMO, periodoDoDia
} from '~/composables/useEstatisticaCeva'
import type { Abate, Agora } from '~/composables/useEstatisticaCeva'
import { dataBR } from '~/composables/useMascaras'

const props = defineProps<{
  tipo: 'ceva' | 'rota'
  id: string
}>()

interface Resposta {
  ceva?: { id: string; nome?: string; tipo?: string }
  /* `lat`/`lng` da rota são o primeiro ponto do traçado — é ele que serve de
     referência para consultar o tempo. */
  rota?: { id: string; nome?: string; lat?: number | string; lng?: number | string }
  abates?: Abate[]
}
interface ClimaAgora extends Agora { ok?: boolean; erro?: string }

const { server } = useServer()

const abates = ref<Abate[] | null>(null)
const clima = ref<ClimaAgora | null>(null)
const erroClima = ref('')
const aba = ref<'nada' | 'tempo' | 'resumo'>('nada')
const dim = ref('sexo')

const cab = ref<{ nome: string; tipo: string }>({ nome: '', tipo: '' })

/** Primeiro ponto do traçado, usado como referência de tempo na rota. */
const pontoRota = ref<{ lat: number; lng: number } | null>(null)

const agora = computed<Agora | null>(() => {
  if (!clima.value) return null
  return { ...clima.value, quando: new Date() }
})

const est = computed(() => estatisticaDe(agora.value, abates.value || []))

const barras = computed(() => contarPor(abates.value || [], dim.value))
const maiorBarra = computed(() => Math.max(1, ...barras.value.map((b) => b.valor)))

const totalAnimais = computed(() =>
  (abates.value || []).reduce((s, a) => {
    const q = parseInt(String(a.quantidade || '1'), 10)
    return s + (isNaN(q) ? 1 : q)
  }, 0))

const ultimoAbate = computed(() => {
  const d = (abates.value || []).map((a) => String(a.dataHora || '')).filter(Boolean).sort()
  return d.length ? d[d.length - 1]! : ''
})

const FAIXA = (v: number) => (v >= 60 ? 'alta' : v >= 30 ? 'media' : 'baixa')

const CONFIANCA: Record<string, string> = {
  baixa: 'confiança baixa', media: 'confiança média', alta: 'confiança alta'
}

async function carregar() {
  try {
    const acao = props.tipo === 'ceva' ? 'apiAbatesDaCeva' : 'apiAbatesDaRota'
    const d = await server<Resposta>(acao, props.id)
    abates.value = d?.abates || []
    const alvo = d?.ceva || d?.rota
    cab.value = { nome: alvo?.nome || '', tipo: (d?.ceva?.tipo) || '' }
    const la = Number(d?.rota?.lat), ln = Number(d?.rota?.lng)
    pontoRota.value = isFinite(la) && isFinite(ln) && (la || ln) ? { lat: la, lng: ln } : null
  } catch {
    abates.value = []
  }
  /**
   * ⚠️ A ROTA TAMBÉM TEM ÍNDICE. Antes só a ceva tinha, porque só ela tem
   * coordenada própria e só existia o `apiClimaCeva`. Com o `apiClimaPonto`, a
   * rota consulta pelo PRIMEIRO ponto do traçado — que é onde a caçada
   * começa. É aproximação declarada: numa rota de 5 km o tempo do início não é
   * o do fim, mas para efeito de faixa (temperatura, chuva, vento) dá no mesmo.
   */
  try {
    let c: ClimaAgora | null = null
    if (props.tipo === 'ceva') {
      c = await server<ClimaAgora>('apiClimaCeva', props.id)
    } else if (pontoRota.value) {
      c = await server<ClimaAgora>('apiClimaPonto', pontoRota.value.lat, pontoRota.value.lng)
    } else {
      erroClima.value = 'Esta rota não tem traçado, então não dá para consultar o tempo'
      return
    }
    if (c?.ok) clima.value = c
    else erroClima.value = c?.erro || 'Não foi possível consultar o tempo agora'
  } catch {
    erroClima.value = 'Sem rede para consultar o tempo agora'
  }
}

onMounted(carregar)
</script>

<template>
  <div v-if="abates !== null" class="card painel">
    <!-- ─────────── 1. CONDIÇÕES AGORA ─────────── -->
    <template v-if="est.indice !== null">
      <div class="cond" :class="FAIXA(est.indice)">
        <div class="aro"><b class="no-i18n">{{ est.indice }}</b><span class="no-i18n">/100</span></div>
        <div class="grow">
          <b>Condições agora</b>
          <div class="meta">
            Base: <span class="no-i18n">{{ est.base }}</span> abate(s) ·
            {{ CONFIANCA[est.confianca || 'baixa'] }}
          </div>
        </div>
      </div>

      <div v-for="d in est.dimensoes.filter((x) => x.frequencia !== null)" :key="d.chave" class="dim">
        <span class="dl">{{ d.rotulo }}</span>
        <span class="da no-i18n">{{ d.agora }}</span>
        <span class="dv no-i18n">{{ Math.round((d.frequencia || 0) * 100) }}%</span>
      </div>
      <div class="meta explica">
        A porcentagem é quantos dos seus abates aqui saíram nessa mesma
        condição.
      </div>

      <div v-if="est.semHistorico.length" class="meta">
        Sem histórico para: <span class="no-i18n">{{ est.semHistorico.join(', ') }}</span>
      </div>

      <!-- ⚠️ Junto do número, não no rodapé. -->
      <div class="meta ressalva">
        <Icone nome="alerta" /> É frequência dos seus abates, não probabilidade:
        o app não sabe as esperas em que nada veio.
      </div>
    </template>

    <div v-else-if="!abates.length" class="meta">
      Nenhum abate registrado aqui ainda. Quando houver, esta caixa mostra em
      que condições eles saíram.
    </div>
    <div v-else class="meta">
      <span class="no-i18n">{{ abates.length }}</span> abate(s) registrado(s) aqui.
      <template v-if="erroClima">{{ erroClima }}.</template>
    </div>

    <!-- ─────────── botão que abre as camadas de baixo ─────────── -->
    <button v-if="abates.length" class="btn abrir" @click="aba = aba === 'nada' ? 'tempo' : 'nada'">
      <Icone nome="grafico" />
      {{ aba === 'nada' ? 'Linha do tempo' : 'Fechar' }}
    </button>

    <template v-if="aba !== 'nada'">
      <div class="abas">
        <button :class="{ on: aba === 'tempo' }" @click="aba = 'tempo'">
          <Icone nome="relogio" /> Linha do tempo
        </button>
        <button :class="{ on: aba === 'resumo' }" @click="aba = 'resumo'">
          <Icone nome="grafico" /> Resumo
        </button>
      </div>

      <!-- ─────────── 2. LINHA DO TEMPO ─────────── -->
      <div v-if="aba === 'tempo'" class="tempo">
        <div v-for="a in abates" :key="a.id" class="ev">
          <span class="bolha" />
          <div class="cartao">
            <img v-if="a.fotoUrl" :src="String(a.fotoUrl)" class="foto" alt="">
            <div class="cnt">
              <b class="no-i18n">{{ dataBR(a.dataHora) }} {{ String(a.dataHora || '').slice(11, 16) }}</b>
              <div class="meta no-i18n">
                {{ a.quantidade || 1 }} animal(is)
                <template v-if="a.sexo"> · {{ a.sexo }}</template>
                <template v-if="a.pesoAprox"> · ~{{ a.pesoAprox }} kg</template>
              </div>
              <div class="meta no-i18n">
                {{ [a.condicaoTempo, a.luaFase, periodoDoDia(a.dataHora)].filter(Boolean).join(' · ') }}
              </div>
              <div v-if="a.obs" class="meta no-i18n">{{ a.obs }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─────────── 3. RESUMO ─────────── -->
      <div v-else class="resumo">
        <div class="kpis">
          <div class="kpi">
            <b class="no-i18n">{{ totalAnimais }}</b>
            <span>animais abatidos</span>
          </div>
          <div class="kpi">
            <b class="no-i18n">{{ dataBR(ultimoAbate) || '—' }}</b>
            <span>último abate</span>
          </div>
        </div>

        <div class="chips">
          <button
            v-for="x in ABAS_RESUMO"
            :key="x.chave"
            class="chip"
            :class="{ on: dim === x.chave }"
            @click="dim = x.chave"
          >{{ x.rotulo }}</button>
        </div>

        <div v-if="!barras.length" class="meta">
          Nenhum abate tem este dado preenchido.
        </div>
        <div v-for="b in barras" :key="b.rotulo" class="barra">
          <span class="bl no-i18n">{{ b.rotulo }}</span>
          <span class="bb"><i :style="{ width: (b.valor / maiorBarra * 100) + '%' }" /></span>
          <span class="bv no-i18n">{{ b.valor }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.painel { padding: 12px; }

/* ── condições agora ── */
.cond { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.aro {
  flex: none; width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: baseline; justify-content: center; gap: 1px;
  border: 3px solid var(--linha); background: var(--carvao-3);
}
.aro b { font-size: 22px; }
.aro span { font-size: 10px; color: var(--osso-2); }
.cond.alta .aro { border-color: var(--verde); color: var(--verde-esc); }
.cond.media .aro { border-color: var(--alerta); color: var(--alerta); }
.cond.baixa .aro { border-color: var(--osso-2); color: var(--osso-2); }
.cond .grow { flex: 1; min-width: 0; }
.cond .grow b { font-size: 15px; }
.cond .meta { margin: 2px 0 0; }

.dim { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; font-size: 12.5px; }
.dim .dl { color: var(--osso-2); flex: none; min-width: 92px; }
.dim .da { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dim .dv { flex: none; font-weight: 700; }

.explica { margin-top: 6px; }
.ressalva { margin-top: 8px; color: var(--alerta); }

.abrir { margin-top: 12px; }

/* ── abas ── */
.abas { display: flex; gap: 6px; margin-top: 12px; }
.abas button {
  flex: 1; margin: 0; padding: 8px; font: inherit; font-size: 12.5px; font-weight: 700;
  border: 1px solid var(--linha); background: var(--carvao-3); color: var(--osso-2);
  border-radius: 10px; cursor: pointer;
}
.abas button.on { background: var(--verde-claro); border-color: var(--verde); color: var(--verde-esc); }

/* ── linha do tempo ── */
.tempo { margin-top: 12px; padding-left: 14px; border-left: 2px solid var(--linha); }
.ev { position: relative; margin-bottom: 10px; }
.bolha {
  position: absolute; left: -21px; top: 14px;
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--laranja); border: 2px solid var(--card);
}
.cartao {
  display: flex; gap: 10px; background: var(--carvao-3);
  border-radius: 10px; padding: 10px;
}
.cartao .foto { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex: none; }
.cartao .cnt { flex: 1; min-width: 0; }
.cartao b { font-size: 13px; color: var(--verde-esc); }
.cartao .meta { margin: 2px 0 0; font-size: 11.5px; }

/* ── resumo ── */
.resumo { margin-top: 12px; }
.kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kpi { background: var(--carvao-3); border-radius: 10px; padding: 10px; }
.kpi b { display: block; font-size: 20px; color: var(--laranja-cl); }
.kpi span { font-size: 10.5px; color: var(--osso-2); }

.chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 12px 0; }
.chip {
  border: 1px solid var(--linha); background: none; color: var(--osso-2);
  font: inherit; font-size: 11.5px; padding: 5px 11px; border-radius: 999px; cursor: pointer;
}
.chip.on { background: var(--verde-claro); border-color: var(--verde); color: var(--verde-esc); font-weight: 700; }

.barra { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
.barra .bl { flex: none; width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.barra .bb { flex: 1; height: 14px; background: var(--linha); border-radius: 4px; overflow: hidden; }
.barra .bb i { display: block; height: 100%; background: var(--verde); }
.barra .bv { flex: none; font-weight: 700; min-width: 18px; text-align: right; }
</style>
