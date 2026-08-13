<script setup lang="ts">
/**
 * ── CONDIÇÕES DE HOJE × CONDIÇÕES DOS ABATES ──────────────────────────────
 *
 * Compara o clima de agora naquele ponto com o clima gravado nos abates que
 * já aconteceram ali.
 *
 * ⚠️ O ROSTO IMPORTA TANTO QUANTO A CONTA. Um número grande e sozinho é lido
 * como previsão — e não é. Por isso a tela sempre mostra, junto: quantos
 * abates entraram, que é semelhança com o passado, e as sete dimensões abertas
 * para conferência. Quem discorda do número consegue ver por quê.
 *
 * ⚠️ Com menos de três abates NÃO há número, só a lista dos registros. É a
 * hora em que seria mais fácil impressionar e mais fácil enganar.
 *
 * ⚠️ Duas ações que já existiam e não tinham tela: `apiAbatesDaCeva` e
 * `apiAbatesDaRota` estavam no backend sem nenhum chamador.
 */
import { compararClima, AMOSTRA_MINIMA } from '~/composables/useSemelhancaClima'
import type { Clima } from '~/composables/useSemelhancaClima'
import { dataBR } from '~/composables/useMascaras'

const props = defineProps<{
  /** 'ceva' ou 'rota' — decide qual ação buscar. */
  tipo: 'ceva' | 'rota'
  id: string
}>()

interface Abate extends Clima {
  id: string; dataHora?: string; quantidade?: string; sexo?: string
}
interface Resposta { abates?: Abate[] }
interface ClimaAgora extends Clima { ok?: boolean; erro?: string }

const { server } = useServer()

const abates = ref<Abate[] | null>(null)
const agora = ref<ClimaAgora | null>(null)
const erroClima = ref('')
const aberto = ref(false)

const r = computed(() => compararClima(agora.value, abates.value || []))

const COR: Record<string, string> = { alta: 'alta', media: 'media', baixa: 'baixa' }
const TEXTO: Record<string, string> = {
  alta: 'Condições parecidas com as dos seus abates aqui',
  media: 'Condições em parte parecidas',
  baixa: 'Condições pouco parecidas com as dos seus abates aqui'
}

async function carregar() {
  try {
    const acao = props.tipo === 'ceva' ? 'apiAbatesDaCeva' : 'apiAbatesDaRota'
    const d = await server<Resposta>(acao, props.id)
    abates.value = d?.abates || []
  } catch {
    abates.value = []
  }
  /* O clima de agora só existe para ceva: é a coordenada dela que o servidor
     consulta. Para rota, comparamos só o que já foi medido nos abates. */
  if (props.tipo !== 'ceva') return
  try {
    const c = await server<ClimaAgora>('apiClimaCeva', props.id)
    if (c?.ok) agora.value = c
    else erroClima.value = c?.erro || 'Não foi possível consultar o tempo agora'
  } catch {
    erroClima.value = 'Sem rede para consultar o tempo agora'
  }
}

onMounted(carregar)
</script>

<template>
  <div v-if="abates !== null" class="card painel">
    <h3><Icone nome="nuvem" /> Condições de hoje</h3>

    <!-- Sem abate nenhum: nem promete nem esconde. -->
    <div v-if="!abates.length" class="meta">
      Nenhum abate registrado aqui ainda. Quando houver, esta caixa compara o
      tempo de agora com o dos dias em que você abateu.
    </div>

    <template v-else>
      <div v-if="r.indice === null" class="meta">
        <b class="no-i18n">{{ abates.length }}</b> abate(s) registrado(s) aqui.
        <template v-if="erroClima"> {{ erroClima }}.</template>
        <template v-else-if="abates.length < AMOSTRA_MINIMA">
          A partir de <b class="no-i18n">{{ AMOSTRA_MINIMA }}</b> abates dá para
          comparar as condições com alguma segurança.
        </template>
      </div>

      <template v-else>
        <div class="topo" :class="COR[r.faixa || 'baixa']">
          <div class="aro">
            <b class="no-i18n">{{ r.indice }}</b><span>%</span>
          </div>
          <div class="grow">
            <b>{{ TEXTO[r.faixa || 'baixa'] }}</b>
            <div class="meta">
              Comparado com <span class="no-i18n">{{ r.amostra }}</span> abate(s)
              registrado(s) neste ponto.
            </div>
          </div>
        </div>

        <!-- ⚠️ O aviso NÃO é rodapé escondido: fica junto do número. -->
        <div class="meta ressalva">
          <Icone nome="alerta" /> Isto é semelhança com o seu histórico, não
          previsão. O app não registra as esperas sem abate, então o número não
          diz a chance de caçar — diz o quanto o tempo de hoje se parece com o
          dos dias em que deu certo.
        </div>

        <button class="detalhe" @click="aberto = !aberto">
          {{ aberto ? 'Ocultar a comparação' : 'Ver a comparação' }}
        </button>

        <table v-if="aberto" class="dim">
          <thead>
            <tr><th>Item</th><th>Agora</th><th>Nos abates</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="d in r.dimensoes" :key="d.chave" :class="{ off: d.nota === null }">
              <td>{{ d.rotulo }}</td>
              <td class="no-i18n">{{ d.agora }}</td>
              <td class="no-i18n">{{ d.tipico }}</td>
              <td class="nt">
                <span v-if="d.nota === null" class="meta">—</span>
                <span v-else class="pnt" :style="{ '--p': Math.round(d.nota * 100) + '%' }" />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="aberto" class="meta">
          "Nos abates" é o valor típico — a mediana dos números e a condição
          mais repetida. Linha em cinza é dado que faltou e ficou fora da conta.
        </div>
      </template>

      <h4 class="sub">Abates aqui</h4>
      <div v-for="a in abates.slice(0, 6)" :key="a.id" class="linha">
        <span class="no-i18n">{{ dataBR(a.dataHora) }}</span>
        <span class="meta no-i18n">
          {{ [a.luaFase, a.condicaoTempo].filter(Boolean).join(' · ') || '—' }}
        </span>
      </div>
      <div v-if="abates.length > 6" class="meta">
        e mais <span class="no-i18n">{{ abates.length - 6 }}</span>.
      </div>
    </template>
  </div>
</template>

<style scoped>
.painel h3 { margin: 0 0 10px; font-size: 15px; }

.topo { display: flex; align-items: center; gap: 12px; }
.aro {
  flex: none; width: 62px; height: 62px; border-radius: 50%;
  display: flex; align-items: baseline; justify-content: center; gap: 1px;
  border: 3px solid var(--linha); background: var(--carvao-3);
}
.aro b { font-size: 21px; }
.aro span { font-size: 11px; color: var(--osso-2); }
.topo.alta .aro { border-color: var(--verde); color: var(--verde-esc); }
.topo.media .aro { border-color: var(--alerta); color: var(--alerta); }
.topo.baixa .aro { border-color: var(--osso-2); color: var(--osso-2); }
.topo .grow { flex: 1; min-width: 0; }
.topo .grow b { font-size: 14px; }
.topo .meta { margin: 2px 0 0; }

.ressalva { margin-top: 10px; color: var(--alerta); }

.detalhe {
  margin-top: 10px; border: 1px solid var(--linha); background: none;
  color: var(--laranja-cl); font: inherit; font-size: 12px;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
}

.dim { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
.dim th { text-align: left; font-size: 10.5px; text-transform: uppercase; color: var(--osso-2); padding: 4px 6px; }
.dim td { padding: 6px; border-top: 1px solid var(--linha); }
.dim tr.off { opacity: .5; }
.dim .nt { width: 54px; }
/* Barrinha da nota: quanto mais cheia, mais parecido. */
.pnt {
  display: block; height: 6px; border-radius: 999px;
  background: linear-gradient(to right, var(--verde) var(--p), var(--linha) var(--p));
}

.sub { margin: 14px 0 6px; font-size: 13px; }
.linha { display: flex; gap: 8px; padding: 5px 0; border-top: 1px solid var(--linha); font-size: 12.5px; }
.linha .meta { margin: 0; flex: 1; text-align: right; }
</style>
