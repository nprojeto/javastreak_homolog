<script setup lang="ts">
/**
 * Compras. Porte de VIEWS.compras (index.html, 6057): pagamentos e
 * assinaturas do usuário, com o resumo do que já foi pago.
 */
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Pagamento {
  id: string; plano: string; periodo: string; valor: number
  status: string; criadoEm: string; pagoEm: string; refExterna: string
}
interface Assinatura {
  id: string; plano: string; inicio: string; fim: string
  origem: string; status: string; vigente: boolean; obs: string
}
interface Resposta {
  pagamentos: Pagamento[]
  assinaturas: Assinatura[]
  resumo: { totalPago: number; compras: number; pendentes: number }
}

const { server } = useServer()
const dados = ref<Resposta | null>(null)
const erro = ref('')

function moeda(v: number) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')
}

onMounted(async () => {
  try {
    dados.value = await server<Resposta>('apiMeusPagamentos')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar suas compras'
  }
})
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!dados" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="dash">
        <div class="kpi"><b>{{ moeda(dados.resumo.totalPago) }}</b><span>total pago</span></div>
        <div class="kpi"><b>{{ dados.resumo.compras }}</b><span>compras</span></div>
        <div class="kpi"><b>{{ dados.resumo.pendentes }}</b><span>pendentes</span></div>
      </div>

      <h3 class="sec"><Icone nome="pagamentos" /> Pagamentos</h3>
      <div v-if="!dados.pagamentos.length" class="card">
        <div class="meta">Nenhum pagamento registrado ainda.</div>
      </div>
      <div v-for="p in dados.pagamentos" :key="p.id" class="card linha">
        <div class="txt">
          <b>{{ p.plano }} · {{ p.periodo }}</b>
          <div class="meta">
            {{ dataBR(p.criadoEm) }}
            <span v-if="p.pagoEm"> · pago em {{ dataBR(p.pagoEm) }}</span>
          </div>
        </div>
        <div class="dir">
          <div class="valor">{{ moeda(p.valor) }}</div>
          <span class="pill" :class="p.status">{{ p.status }}</span>
        </div>
      </div>

      <h3 class="sec"><Icone nome="arquivo" /> Assinaturas</h3>
      <div v-if="!dados.assinaturas.length" class="card">
        <div class="meta">Nenhuma assinatura registrada.</div>
      </div>
      <div v-for="a in dados.assinaturas" :key="a.id" class="card linha">
        <div class="txt">
          <b>{{ a.plano }}</b>
          <div class="meta">
            {{ dataBR(a.inicio) }} → {{ a.fim ? dataBR(a.fim) : 'sem prazo' }}
            <span v-if="a.origem"> · {{ a.origem }}</span>
          </div>
          <div v-if="a.obs" class="meta">{{ a.obs }}</div>
        </div>
        <span class="pill" :class="a.vigente ? 'pago' : ''">
          {{ a.vigente ? 'vigente' : a.status }}
        </span>
      </div>

      <NuxtLink to="/planos" class="btn sec voltar">Ver planos</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.dash { display: flex; gap: 8px; margin-bottom: 10px; }
.kpi { flex: 1; background: var(--card); border: 1px solid var(--linha); border-radius: 12px; padding: 10px; text-align: center; }
.kpi b { display: block; font-size: 16px; }
.kpi span { font-size: 11px; color: var(--osso-2); }
.sec { margin: 14px 4px 6px; font-size: 15px; }
.linha { display: flex; align-items: center; gap: 10px; }
.txt { flex: 1; min-width: 0; }
.txt .meta { margin: 2px 0 0; }
.dir { text-align: right; flex: none; }
.valor { font-weight: 700; font-size: 14px; }
.pill { display: inline-block; font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--linha); }
.pill.pago { background: var(--verde-claro); color: var(--verde-esc); }
.pill.pendente { background: #3A2E13; color: var(--alerta); }
.voltar { margin-top: 14px; text-decoration: none; }
</style>
