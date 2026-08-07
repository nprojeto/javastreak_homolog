<script setup lang="ts">
/**
 * Agenda. Porte de VIEWS.agenda + renderAgenda + agItemHtml + calendario
 * (index.html, 10550-10624).
 *
 * A exclusão de item ficou de fora nesta entrega: cada escopo apaga por uma
 * ação diferente (`saude`, `saudeTransp`, `documento`, `manutencao`) e o
 * legado já errou isso uma vez, mandando apagar manutenção com id de
 * documento. Entra junto com as telas donas de cada item.
 */
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface ItemAgenda {
  escopo: string
  id: string
  animalNome?: string
  tipo?: string
  descricao?: string
  data?: string
  proximaData?: string
  obs?: string
  fixo?: boolean
}

const { server } = useServer()

const itens = ref<ItemAgenda[] | null>(null)
const erro = ref('')
const mes = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const diaEscolhido = ref('')

const hoje = new Date().toISOString().slice(0, 10)
const dia10 = (v?: string) => String(v || '').slice(0, 10)

const lista = computed(() => itens.value || [])

const atrasadas = computed(() =>
  lista.value
    .filter((i) => i.proximaData && dia10(i.proximaData) < hoje)
    .sort((a, b) => dia10(a.proximaData).localeCompare(dia10(b.proximaData)))
)
const proximas = computed(() =>
  lista.value
    .filter((i) => i.proximaData && dia10(i.proximaData) >= hoje)
    .sort((a, b) => dia10(a.proximaData).localeCompare(dia10(b.proximaData)))
)
const semData = computed(() =>
  lista.value
    .filter((i) => !i.proximaData)
    .sort((a, b) => dia10(b.data).localeCompare(dia10(a.data)))
    .slice(0, 20)
)
const em30 = computed(
  () =>
    proximas.value.filter(
      (i) =>
        (new Date(dia10(i.proximaData)).getTime() - new Date(hoje).getTime()) / 864e5 <= 30
    ).length
)

const doDia = computed(() =>
  lista.value.filter(
    (i) => dia10(i.proximaData) === diaEscolhido.value || dia10(i.data) === diaEscolhido.value
  )
)

/** Dias do mês com algum evento, para pintar o calendário. */
const marcados = computed(() => {
  const m: Record<string, 'atrasada' | 'proxima'> = {}
  for (const i of lista.value) {
    const d = dia10(i.proximaData)
    if (!d) continue
    m[d] = d < hoje ? 'atrasada' : 'proxima'
  }
  return m
})

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const tituloMes = computed(
  () => MESES[mes.value.getMonth()] + ' de ' + mes.value.getFullYear()
)

/** Grade de 6 semanas começando no domingo. */
const grade = computed(() => {
  const ini = new Date(mes.value)
  const desloc = ini.getDay()
  const base = new Date(ini)
  base.setDate(1 - desloc)
  const dias: Array<{ iso: string; num: number; doMes: boolean }> = []
  for (let k = 0; k < 42; k++) {
    const d = new Date(base)
    d.setDate(base.getDate() + k)
    dias.push({
      iso: d.toISOString().slice(0, 10),
      num: d.getDate(),
      doMes: d.getMonth() === mes.value.getMonth()
    })
  }
  return dias
})

function mudarMes(delta: number) {
  mes.value = new Date(mes.value.getFullYear(), mes.value.getMonth() + delta, 1)
  diaEscolhido.value = ''
}

/** Escopo do item → ícone do sistema. */
function icone(escopo: string) {
  return escopo === 'cao' ? 'canil'
    : escopo === 'cavalo' ? 'ferradura'
      : escopo === 'documento' ? 'documentos' : 'transporte'
}

function situacao(prox?: string) {
  const d = dia10(prox)
  if (!d) return ''
  if (d < hoje) return 'atrasada'
  if (d === hoje) return 'hoje'
  return 'proxima'
}

onMounted(async () => {
  try {
    itens.value = await server<ItemAgenda[]>('apiAgenda')
  } catch (e) {
    /* Regra do dossiê: recusa do servidor aparece, não vira lista vazia. */
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a agenda'
  }
})
</script>

<template>
  <div>
    <div v-if="erro" class="card">
      <div class="meta erro">{{ erro }}</div>
    </div>

    <div v-else-if="itens === null" class="card"><div class="meta">Carregando agenda…</div></div>

    <div v-else-if="!lista.length" class="card vazio">
      <div class="big"><Icone nome="calendario" /></div>
      Nada na agenda ainda.<br>
      <span class="meta">
        Registre vacinas e retornos nos cães e nos cavalos, e os vencimentos
        aparecem aqui sozinhos.
      </span>
    </div>

    <template v-else>
      <div class="card cal">
        <div class="cal-topo">
          <button class="ib" @click="mudarMes(-1)">‹</button>
          <b>{{ tituloMes }}</b>
          <button class="ib" @click="mudarMes(1)">›</button>
        </div>
        <div class="cal-sem">
          <span v-for="d in ['D','S','T','Q','Q','S','S']" :key="d">{{ d }}</span>
        </div>
        <div class="cal-grade">
          <button
            v-for="g in grade"
            :key="g.iso"
            class="cal-dia"
            :class="[
              marcados[g.iso],
              { fora: !g.doMes, hoje: g.iso === hoje, sel: g.iso === diaEscolhido }
            ]"
            @click="diaEscolhido = diaEscolhido === g.iso ? '' : g.iso"
          >{{ g.num }}</button>
        </div>
      </div>

      <div class="dash">
        <div class="kpi"><b class="dan">{{ atrasadas.length }}</b><span>atrasadas</span></div>
        <div class="kpi"><b>{{ em30 }}</b><span>próx. 30 dias</span></div>
        <div class="kpi"><b>{{ lista.length }}</b><span>registros</span></div>
      </div>

      <template v-if="diaEscolhido">
        <h3 class="sec"><Icone nome="calendario" /> {{ dataBR(diaEscolhido) }}</h3>
        <div v-if="!doDia.length" class="card"><div class="meta">Nenhum evento neste dia.</div></div>
        <div v-for="i in doDia" :key="i.id" class="card item">
          <span class="ic"><Icone :nome="icone(i.escopo)" :px="20" /></span>
          <div class="txt">
            <b>{{ i.tipo || 'Item' }}</b>
            <div class="meta">{{ i.animalNome }}{{ i.obs ? ' · ' + i.obs : '' }}</div>
          </div>
          <span v-if="situacao(i.proximaData)" class="pill" :class="situacao(i.proximaData)">
            {{ dataBR(i.proximaData) }}
          </span>
        </div>
      </template>

      <template v-else>
        <template v-if="atrasadas.length">
          <h3 class="sec dan"><Icone nome="alerta" /> Atrasadas</h3>
          <div v-for="i in atrasadas" :key="i.id" class="card item">
            <span class="ic"><Icone :nome="icone(i.escopo)" :px="20" /></span>
            <div class="txt">
              <b>{{ i.tipo || 'Item' }}</b>
              <div class="meta">{{ i.animalNome }}{{ i.obs ? ' · ' + i.obs : '' }}</div>
            </div>
            <span class="pill atrasada">{{ dataBR(i.proximaData) }}</span>
          </div>
        </template>

        <template v-if="proximas.length">
          <h3 class="sec"><Icone nome="pino" /> Próximas</h3>
          <div v-for="i in proximas" :key="i.id" class="card item">
            <span class="ic"><Icone :nome="icone(i.escopo)" :px="20" /></span>
            <div class="txt">
              <b>{{ i.tipo || 'Item' }}</b>
              <div class="meta">{{ i.animalNome }}{{ i.obs ? ' · ' + i.obs : '' }}</div>
            </div>
            <span class="pill" :class="situacao(i.proximaData)">{{ dataBR(i.proximaData) }}</span>
          </div>
        </template>

        <template v-if="semData.length">
          <h3 class="sec cinza">Histórico recente</h3>
          <div v-for="i in semData" :key="i.id" class="card item">
            <span class="ic"><Icone :nome="icone(i.escopo)" :px="20" /></span>
            <div class="txt">
              <b>{{ i.tipo || 'Item' }}</b>
              <div class="meta">{{ i.animalNome }}{{ i.descricao ? ' · ' + i.descricao : '' }}</div>
            </div>
            <span class="quando">{{ dataBR(i.data) }}</span>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.erro { color: var(--danger); }
.vazio { text-align: center; padding: 26px 16px; }
.vazio .big { font-size: 40px; margin-bottom: 8px; }

.cal-topo { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ib { border: 0; background: none; font-size: 22px; cursor: pointer; color: var(--verde); padding: 0 10px; }
.cal-sem, .cal-grade { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-sem span { text-align: center; font-size: 11px; color: var(--osso-2); padding-bottom: 4px; }
.cal-dia {
  aspect-ratio: 1; border: 0; background: none; border-radius: 9px;
  font-size: 12.5px; cursor: pointer; color: var(--txt);
}
.cal-dia.fora { opacity: .3; }
.cal-dia.hoje { outline: 1.5px solid var(--verde); }
.cal-dia.sel { background: var(--verde); color: #fff; font-weight: 700; }
.cal-dia.atrasada { background: #3A1E1C; font-weight: 700; }
.cal-dia.proxima { background: var(--verde-claro); font-weight: 700; }
.cal-dia.sel.atrasada, .cal-dia.sel.proxima { background: var(--verde); color: #fff; }

.dash { display: flex; gap: 8px; margin: 10px 0; }
.kpi { flex: 1; background: var(--card); border: 1px solid var(--linha); border-radius: 12px; padding: 10px; text-align: center; }
.kpi b { display: block; font-size: 20px; }
.kpi span { font-size: 11.5px; color: var(--osso-2); }
.dan { color: var(--danger); }

.sec { margin: 14px 4px 6px; font-size: 15px; }
.sec.cinza { color: var(--osso-2); }

.item { display: flex; align-items: center; gap: 10px; }
.item .ic { display: flex; flex: none; }
.item .txt { flex: 1; min-width: 0; }
.item .meta { margin: 2px 0 0; }
.pill { flex: none; font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--linha); }
.pill.atrasada { background: #3A1E1C; color: var(--danger); }
.pill.hoje { background: #3A2E13; color: var(--alerta); }
.pill.proxima { background: var(--verde-claro); color: var(--verde-esc); }
.quando { font-size: 11.5px; color: var(--osso-2); flex: none; }
</style>
