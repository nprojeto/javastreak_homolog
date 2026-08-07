<script setup lang="ts">
/**
 * Admin — assinaturas, pagamentos e limites por plano.
 * Porte de apiListarAssinaturas / apiAdminPagamentos / apiListarLimites
 * (index.html, 7200-7360).
 *
 * ⚠️ A lista de assinaturas é onde as CORTESIAS aparecem: `origem` diz de onde
 * veio cada uma (cortesia, pagamento, indicação). Sem esta tela, dar cortesia
 * era um tiro no escuro.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

interface Assinatura {
  id: string; login: string; plano: string; nomePlano: string
  fim?: string; origem?: string; status?: string; vigente?: boolean; obs?: string
}
interface Pagamento {
  id: string; login: string; plano: string; periodo: string
  valor: number; status: string; criadoEm?: string; pagoEm?: string
}
interface Limites {
  recursos: Array<{ chave: string; rotulo: string; tipo: string }>
  planos: Array<{ plano: string; nome: string; valores: Record<string, number> }>
  recursosEmpresa: Array<{ chave: string; rotulo: string; tipo: string }>
  planosEmpresa: Array<{ plano: string; nome: string; valores: Record<string, number> }>
}

const { server } = useServer()
const ui = useUi()

const assinaturas = ref<Assinatura[] | null>(null)
const pagamentos = ref<{ lista: Pagamento[]; resumo: Record<string, number> } | null>(null)
const limites = ref<Limites | null>(null)
const soVigentes = ref(true)
const salvandoLim = ref(false)

const visiveis = computed(() =>
  (assinaturas.value || []).filter((a) => !soVigentes.value || a.vigente)
)

function moeda(v: number) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')
}

async function carregar() {
  const [a, p, l] = await Promise.all([
    server<Assinatura[]>('apiListarAssinaturas').catch(() => [] as Assinatura[]),
    server<{ lista: Pagamento[]; resumo: Record<string, number> }>('apiAdminPagamentos', '')
      .catch(() => null),
    server<Limites>('apiListarLimites').catch(() => null)
  ])
  assinaturas.value = a || []
  pagamentos.value = p
  limites.value = l
}

async function encerrar(a: Assinatura) {
  if (!confirm('Encerrar a assinatura de ' + a.login + '?')) return
  try {
    await server('apiEncerrarAssinatura', a.id)
    ui.avisar('Assinatura encerrada')
    assinaturas.value = await server<Assinatura[]>('apiListarAssinaturas')
  } catch { /* já avisado */ }
}

async function salvarLimites() {
  if (!limites.value) return
  salvandoLim.value = true
  try {
    const mapa: Record<string, Record<string, number>> = {}
    for (const p of limites.value.planos) mapa[p.plano] = p.valores
    for (const p of limites.value.planosEmpresa) mapa[p.plano] = p.valores
    const r = await server<{ salvos: number }>('apiSalvarLimites', mapa)
    ui.avisar(r.salvos + ' limite(s) salvos ✔')
  } catch { /* já avisado */ } finally {
    salvandoLim.value = false
  }
}

async function restaurar() {
  if (!confirm('Restaurar todos os limites aos valores padrão?')) return
  try {
    await server('apiRestaurarLimites', '')
    ui.avisar('Limites restaurados')
    limites.value = await server<Limites>('apiListarLimites')
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <!-- ───── ASSINATURAS E CORTESIAS ───── -->
    <div class="card">
      <div class="topo">
        <h3>🎫 Assinaturas e cortesias</h3>
        <button class="ib" title="Atualizar" @click="carregar">🔄</button>
      </div>
      <label class="check">
        <input v-model="soVigentes" type="checkbox">
        <span>Mostrar só as vigentes</span>
      </label>

      <div v-if="assinaturas === null" class="meta">Carregando…</div>
      <div v-else-if="!visiveis.length" class="meta">Nenhuma assinatura por aqui.</div>

      <div v-for="a in visiveis" :key="a.id" class="linha">
        <div class="grow">
          <b class="no-i18n">{{ a.login }}</b>
          <span class="pill" :class="a.vigente ? 'ok' : ''">{{ a.nomePlano }}</span>
          <span v-if="a.origem" class="pill">{{ a.origem }}</span>
          <div class="meta no-i18n">
            {{ a.fim ? 'até ' + dataBR(a.fim) : 'sem prazo' }}
            <template v-if="a.obs"> · {{ a.obs }}</template>
          </div>
        </div>
        <button v-if="a.vigente" class="btn sm sec" @click="encerrar(a)">Encerrar</button>
      </div>
    </div>

    <!-- ───── PAGAMENTOS ───── -->
    <div class="card">
      <h3>💳 Pagamentos</h3>
      <div v-if="!pagamentos" class="meta">Carregando…</div>
      <template v-else>
        <div class="dash">
          <div class="kpi"><b>{{ pagamentos.resumo.total }}</b><span>total</span></div>
          <div class="kpi"><b>{{ pagamentos.resumo.pagos }}</b><span>pagos</span></div>
          <div class="kpi"><b>{{ pagamentos.resumo.pendentes }}</b><span>pendentes</span></div>
        </div>

        <div v-if="!pagamentos.lista.length" class="meta">
          Nenhum pagamento registrado.
        </div>
        <div v-for="p in pagamentos.lista.slice(0, 30)" :key="p.id" class="linha">
          <div class="grow">
            <b class="no-i18n">{{ p.login }}</b>
            <div class="meta no-i18n">
              {{ p.plano }} · {{ p.periodo }} · {{ dataBR(p.criadoEm) }}
            </div>
          </div>
          <div class="dir">
            <div class="valor">{{ moeda(p.valor) }}</div>
            <span class="pill" :class="p.status">{{ p.status }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- ───── LIMITES ───── -->
    <div class="card">
      <h3>⚙️ Limites por plano</h3>
      <div class="meta">
        −1 é ilimitado, 0 desliga o recurso. O valor vale a partir do próximo
        carregamento de cada usuário.
      </div>

      <div v-if="!limites" class="meta">Carregando…</div>
      <template v-else>
        <h4 class="sub">Manejador</h4>
        <div class="tab-scroll">
          <table class="lim">
            <thead>
              <tr>
                <th>Recurso</th>
                <th v-for="p in limites.planos" :key="p.plano">{{ p.nome }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in limites.recursos" :key="r.chave">
                <td class="rot">{{ r.rotulo }}</td>
                <td v-for="p in limites.planos" :key="p.plano">
                  <input v-model.number="p.valores[r.chave]" inputmode="numeric">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 class="sub">Empresa</h4>
        <div class="tab-scroll">
          <table class="lim">
            <thead>
              <tr>
                <th>Recurso</th>
                <th v-for="p in limites.planosEmpresa" :key="p.plano">{{ p.nome }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in limites.recursosEmpresa" :key="r.chave">
                <td class="rot">{{ r.rotulo }}</td>
                <td v-for="p in limites.planosEmpresa" :key="p.plano">
                  <input v-model.number="p.valores[r.chave]" inputmode="numeric">
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button class="btn" :disabled="salvandoLim" @click="salvarLimites">
          {{ salvandoLim ? 'Salvando…' : 'Salvar limites' }}
        </button>
        <button class="btn sec" @click="restaurar">Restaurar padrões</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.sub { margin: 14px 0 6px; font-size: 13px; color: var(--verde); }
.topo { display: flex; align-items: center; gap: 8px; }
.topo h3 { flex: 1; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; }
.check { display: flex; align-items: center; gap: 8px; margin: 6px 0 10px; font-weight: 400; }
.check input { width: auto; flex: none; }
.linha { display: flex; align-items: center; gap: 8px; padding: 9px 0; border-top: 1px solid var(--linha); }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 2px 0 0; }
.linha .btn { width: auto; margin: 0; }
.dir { text-align: right; flex: none; }
.valor { font-weight: 700; font-size: 13.5px; }
.pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.pill.ok, .pill.pago { background: var(--verde-claro); color: var(--verde-esc); }
.pill.pendente { background: #ffe9c7; color: #8a5a10; }
.dash { display: flex; gap: 8px; margin: 8px 0; }
.kpi { flex: 1; background: var(--areia); border-radius: 12px; padding: 9px; text-align: center; }
.kpi b { display: block; font-size: 17px; }
.kpi span { font-size: 10.5px; color: #7a7466; }
.tab-scroll { overflow-x: auto; }
.lim { border-collapse: collapse; font-size: 12px; width: 100%; }
.lim th, .lim td { border: 1px solid var(--linha); padding: 4px 6px; }
.lim th { background: var(--areia); text-align: left; }
.lim .rot { min-width: 150px; }
.lim input { width: 62px; padding: 5px; margin: 0; text-align: center; }
.btn.sec { margin-top: 8px; }
</style>
