<script setup lang="ts">
/**
 * Relatório de fechamento do IBAMA. Porte de VIEWS.ibamaRelatorio +
 * pintarRelIbama + baixarRelIbamaCsv + fecharAutorizacaoIbama
 * (index.html, 9917-10015).
 *
 * ⚠️ FECHAR NÃO TEM VOLTA, e não é só um carimbo: a autorização fechada
 * passa a contar como vencida (`docVencido_` olha o `encerradoEm`), então a
 * propriedade fica PARADA — sem ceva nova, sem rota nova, sem ciclo novo —
 * até entrar a autorização seguinte. Por isso a dupla confirmação.
 *
 * ⚠️ O CSV sai com ponto e vírgula e BOM. O destino provável é o Excel em
 * português, que abre errado sem os dois.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface AbateRel {
  id: string; dataHora?: string; quantidade?: string; sexo?: string
  desenvolvimento?: string; metodoAbate?: string; pesoAprox?: string
  comprimento?: string; amostraColetada?: string; codigoFrasco?: string
  lat?: string; lng?: string; obs?: string; origem?: string; abatidoPor?: string
}
interface Relatorio {
  geradoEm?: string; gerodoEm?: string
  manejador: { nome?: string; cpf?: string; cr?: string }
  autorizacao: { id: string; numero?: string; emissao?: string; vencimento?: string; encerradoEm?: string }
  propriedade: {
    id?: string; nome?: string; dono?: string; documentoDono?: string
    car?: string; lat?: string; lng?: string
    autorizacaoAcesso?: { numero?: string; vencimento?: string } | null
  }
  abates: AbateRel[]
}

const COLUNAS = ['#', 'Data e hora', 'Qtd', 'Sexo', 'Desenvolvimento', 'Método',
  'Peso (kg)', 'Compr. (cm)', 'Amostra', 'Frasco', 'Origem', 'Abatido por',
  'Coordenada', 'Observações']

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const r = ref<Relatorio | null>(null)
const erro = ref('')
const fechando = ref(false)

const fechada = computed(() => !!r.value?.autorizacao.encerradoEm)
const totalAnimais = computed(() =>
  (r.value?.abates || []).reduce((s, a) => s + (parseInt(String(a.quantidade), 10) || 1), 0)
)

const cel = (v: unknown) => (v === '' || v == null ? '—' : String(v))

async function carregar() {
  erro.value = ''
  try {
    r.value = await server<Relatorio>('apiRelatorioIbama', id.value)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível gerar o relatório'
  }
}

/** `window.print()` não pode ser chamado direto do template: o `window` não
    existe no escopo do componente. */
function imprimir() { window.print() }

function baixarCsv() {
  const rel = r.value
  if (!rel) return
  const cab = ['#', 'Data e hora', 'Quantidade', 'Sexo', 'Desenvolvimento', 'Metodo',
    'Peso (kg)', 'Comprimento (cm)', 'Amostra coletada', 'Codigo do frasco',
    'Origem', 'Abatido por', 'Latitude', 'Longitude', 'Observacoes']
  const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const linhas = [cab.map(q).join(';')]
  ;(rel.abates || []).forEach((a, i) => {
    linhas.push([i + 1, a.dataHora, a.quantidade, a.sexo, a.desenvolvimento,
      a.metodoAbate, a.pesoAprox, a.comprimento, a.amostraColetada, a.codigoFrasco,
      a.origem, a.abatidoPor, a.lat, a.lng, a.obs].map(q).join(';'))
  })
  const nome = 'fechamento-ibama-' +
    String(rel.autorizacao.numero || 'sem-numero').replace(/[^A-Za-z0-9-]/g, '') + '.csv'
  /* BOM + ponto e vírgula: é o que o Excel em português entende. */
  const blob = new Blob(['\ufeff' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

async function fechar() {
  const rel = r.value
  if (!rel) return
  if (!confirm(
    'Fechar esta autorização?\n\n' +
    'A propriedade ' + (rel.propriedade.nome || '') +
    ' fica bloqueada, esperando a nova autorização.\n' +
    'Não há como desfazer pelo aplicativo.'
  )) return
  if (!confirm('Tem certeza? Esta ação não tem volta.')) return

  fechando.value = true
  try {
    await server('apiEncerrarAutorizacaoIbama', id.value)
    ui.avisar('Autorização fechada ✔')
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    fechando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!r" class="card"><div class="meta">Gerando relatório…</div></div>

    <template v-else>
      <div class="card impresso">
        <h2>Relatório de fechamento — IBAMA</h2>
        <div class="meta">Gerado em {{ dataBR(r.geradoEm || r.gerodoEm) }}</div>

        <div class="bloco">
          <h3>Manejador</h3>
          <div class="meta no-i18n">
            {{ r.manejador.nome || '—' }}
            <template v-if="r.manejador.cpf"> · CPF {{ r.manejador.cpf }}</template>
            <template v-if="r.manejador.cr"> · CR {{ r.manejador.cr }}</template>
          </div>
        </div>

        <div class="bloco">
          <h3>Propriedade</h3>
          <div class="meta no-i18n">
            {{ r.propriedade.nome || '—' }}
            <template v-if="r.propriedade.dono"> · {{ r.propriedade.dono }}</template>
            <template v-if="r.propriedade.documentoDono"> · {{ r.propriedade.documentoDono }}</template>
          </div>
          <div v-if="r.propriedade.car" class="meta no-i18n">CAR: {{ r.propriedade.car }}</div>
          <div v-if="r.propriedade.lat" class="meta no-i18n">
            {{ r.propriedade.lat }}, {{ r.propriedade.lng }}
          </div>
          <div v-if="r.propriedade.autorizacaoAcesso" class="meta no-i18n">
            Autorização de Acesso nº {{ r.propriedade.autorizacaoAcesso.numero || '—' }} ·
            vence {{ dataBR(r.propriedade.autorizacaoAcesso.vencimento) }}
          </div>
        </div>

        <div class="bloco">
          <h3>Autorização do IBAMA</h3>
          <div class="meta no-i18n">
            nº {{ r.autorizacao.numero || '—' }} ·
            {{ r.autorizacao.emissao ? dataBR(r.autorizacao.emissao) + ' → ' : '' }}
            {{ dataBR(r.autorizacao.vencimento) }}
          </div>
          <div v-if="fechada" class="meta">
            🔒 Fechada em {{ dataBR(r.autorizacao.encerradoEm) }}
          </div>
        </div>

        <div class="dash">
          <div class="kpi"><b>{{ (r.abates || []).length }}</b><span>registros</span></div>
          <div class="kpi"><b>{{ totalAnimais }}</b><span>animais</span></div>
        </div>

        <div v-if="!(r.abates || []).length" class="meta">
          Nenhum abate no período desta autorização.
        </div>
        <div v-else class="rel-scroll">
          <table class="rel-tab">
            <thead>
              <tr><th v-for="c in COLUNAS" :key="c">{{ c }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(a, i) in r.abates" :key="a.id" class="no-i18n">
                <td>{{ i + 1 }}</td>
                <td>{{ dataBR(a.dataHora) }}</td>
                <td>{{ cel(a.quantidade) }}</td>
                <td>{{ cel(a.sexo) }}</td>
                <td>{{ cel(a.desenvolvimento) }}</td>
                <td>{{ cel(a.metodoAbate) }}</td>
                <td>{{ cel(a.pesoAprox) }}</td>
                <td>{{ cel(a.comprimento) }}</td>
                <td>{{ cel(a.amostraColetada) }}</td>
                <td>{{ cel(a.codigoFrasco) }}</td>
                <td>{{ cel(a.origem) }}</td>
                <td>{{ cel(a.abatidoPor) }}</td>
                <td>{{ a.lat && a.lng ? a.lat + ', ' + a.lng : '—' }}</td>
                <td>{{ cel(a.obs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card sem-impressao">
        <button class="btn sec" @click="imprimir">🖨️ Imprimir / salvar PDF</button>
        <button class="btn sec" @click="baixarCsv">📊 Baixar CSV</button>

        <template v-if="!fechada">
          <div class="meta aviso">
            ⚠️ Fechar esta autorização <b>bloqueia a propriedade</b> até entrar
            a autorização nova — sem ceva nova, sem rota nova, sem caçada nova.
            Não há como desfazer.
          </div>
          <button class="btn danger" :disabled="fechando" @click="fechar">
            {{ fechando ? 'Fechando…' : '🔒 Gerar relatório e fechar autorização' }}
          </button>
        </template>

        <NuxtLink to="/ibama" class="btn sec">Voltar</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 4px; font-size: 19px; }
h3 { margin: 0 0 4px; font-size: 14px; color: var(--verde); }
.ruim { color: var(--danger); }
.bloco { margin-top: 14px; }
.dash { display: flex; gap: 8px; margin: 14px 0; }
.kpi { flex: 1; background: var(--areia); border-radius: 12px; padding: 10px; text-align: center; }
.kpi b { display: block; font-size: 20px; }
.kpi span { font-size: 11px; color: #7a7466; }
.rel-scroll { overflow-x: auto; margin-top: 8px; }
.rel-tab { border-collapse: collapse; font-size: 11.5px; width: 100%; }
.rel-tab th, .rel-tab td { border: 1px solid var(--linha); padding: 5px 7px; white-space: nowrap; }
.rel-tab th { background: var(--areia); text-align: left; font-weight: 700; }
.aviso { color: var(--danger); margin: 12px 0 8px; }
.btn { margin-top: 8px; text-decoration: none; }
.btn.danger { background: var(--danger); }

@media print {
  .sem-impressao { display: none; }
  .impresso { border: 0; box-shadow: none; }
  .rel-tab { font-size: 9px; }
  .rel-tab th, .rel-tab td { white-space: normal; }
}
</style>
