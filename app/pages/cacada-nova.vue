<script setup lang="ts">
/**
 * Abrir caçada. Porte de VIEWS.manejoForm + salvarManejo (index.html, 9640).
 *
 * ⚠️ A PROPRIEDADE MANDA EM TUDO. Dela saem o prazo do ciclo (o vencimento da
 * primeira das duas autorizações), os documentos que o amigo convidado
 * enxerga, e as cevas e rotas que aparecem para escolher.
 *
 * ⚠️ Caçada LIVRE é exclusiva: marcar livre desmarca ceva e rota, porque nela
 * o percurso é gravado na hora. O servidor recusa com `LIVRE_EXCLUSIVO`.
 *
 * ⚠️ O TIPO AGORA É PERGUNTADO, mas a regra que o define NÃO mudou. O que
 * vai para o servidor continua sendo derivado exatamente como antes:
 *
 *     livre marcado → 'livre'; senão ceva escolhida → 'ceva'; senão 'rota'
 *
 * A escolha do modo só decide QUAIS CAMPOS APARECEM e liga o mesmo `livre`
 * que já existia. Nada foi acrescentado ao payload.
 *
 * ⚠️ SÃO TRÊS MODOS, não dois. `MANEJO_TIPOS` no servidor tem ceva, rota e
 * livre, e a espera na ceva é a única em que o abate consegue clima em tempo
 * real (o servidor busca pela coordenada da ceva). Esconder a ceva atrás de
 * "livre ou seguir rota" tiraria isso do alcance de quem caça na espera.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'
import type { Rota } from '~/pages/rotas.vue'

definePageMeta({ layout: 'app' })

const router = useRouter()
const { server, serverOpc } = useServer()
const ui = useUi()

const props_ = ref<Propriedade[]>([])
const cevas = ref<Ceva[]>([])
const rotas = ref<Rota[]>([])
const erro = ref('')
const pronto = ref(false)

/**
 * Modo escolhido na tela. É só apresentação: `salvar()` continua derivando o
 * tipo do estado dos campos, igual a antes.
 */
type Modo = '' | 'ceva' | 'rota' | 'livre'
const modo = ref<Modo>('')

const nome = ref('')
const propId = ref('')
const obs = ref('')
const livre = ref(false)
const cevasSel = ref<string[]>([])
const rotasSel = ref<string[]>([])
const salvando = ref(false)

const prop = computed(() => props_.value.find((p) => p.id === propId.value) || null)

/** Teto do ciclo: vence junto com a primeira das duas autorizações. */
const teto = computed(() => {
  const p = prop.value
  const a = p?.autManejo?.vencimento || ''
  const b = p?.autIbama?.vencimento || ''
  if (!a && !b) return ''
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
})

const avisoProp = computed(() => {
  const p = prop.value
  if (!p) return { texto: 'Escolha a propriedade para ver as cevas e rotas dela.', ok: false }
  if (!p.regular) {
    return { texto: 'Esta propriedade está irregular e não pode abrir ciclo de caça.', ok: false }
  }
  if (!teto.value) return { texto: 'Faltam as autorizações desta propriedade.', ok: false }
  return { texto: 'Esta caçada encerra sozinha em ' + dataBR(teto.value) + '.', ok: true }
})

const cevasDaProp = computed(() =>
  cevas.value.filter((c) => String(c.propriedadeId || '') === propId.value)
)
const rotasDaProp = computed(() =>
  rotas.value.filter((r) => String(r.propriedadeId || '') === propId.value)
)

/* Marcar livre limpa as seleções — a exclusividade fica visível antes do
   servidor recusar. */
watch(livre, (v) => { if (v) { cevasSel.value = []; rotasSel.value = [] } })
watch(propId, () => { cevasSel.value = []; rotasSel.value = []; modo.value = '' })

/**
 * O modo liga o MESMO `livre` de antes e limpa o que não pertence a ele.
 * Nenhuma trava nova: escolher "rota" sem rota cadastrada continua caindo na
 * mesma recusa do servidor que já existia.
 */
watch(modo, (m) => {
  livre.value = m === 'livre'
  if (m === 'ceva') rotasSel.value = []
  if (m === 'rota') cevasSel.value = []
})

/** Disponibilidade de cada modo NA PROPRIEDADE ESCOLHIDA. */
const modos = computed(() => [
  {
    chave: 'ceva' as const, icone: 'ceva', titulo: 'Espera na ceva',
    resumo: 'Fique na espera numa ceva cadastrada. É o único modo em que o abate busca o tempo na hora.',
    disponivel: cevasDaProp.value.length > 0,
    motivo: 'Cadastre uma ceva nesta propriedade para usar este modo.',
    para: '/espera'
  },
  {
    chave: 'rota' as const, icone: 'rotas', titulo: 'Seguir uma rota',
    resumo: 'Percorra um trajeto já desenhado. O guiamento mostra o caminho e a sua posição.',
    disponivel: rotasDaProp.value.length > 0,
    motivo: 'Você precisa cadastrar uma rota nesta propriedade antes de usar esta opção.',
    para: '/rotas'
  },
  {
    chave: 'livre' as const, icone: 'mapa', titulo: 'Caça livre',
    resumo: 'Ande livremente dentro da propriedade. Não precisa de rota: o percurso é gravado por GPS.',
    /* ⚠️ Livre não depende de ceva nem de rota. O servidor exige apenas
       propriedade com limite desenhado, e a lista já vem filtrada por
       `temLimite` no `onMounted`. */
    disponivel: true,
    motivo: '',
    para: ''
  }
])

onMounted(async () => {
  try {
    const [c, r, p] = await Promise.all([
      serverOpc<Ceva[]>('apiListarCevas'),
      serverOpc<Rota[]>('apiListarRotas'),
      serverOpc<Propriedade[]>('apiListarPropriedades')
    ])
    cevas.value = (c as Ceva[]) || []
    rotas.value = (r as Rota[]) || []
    props_.value = ((p as Propriedade[]) || []).filter((x) => x.temLimite)
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as opções'
  }
})

async function salvar() {
  if (!prop.value) { ui.avisar('Escolha a propriedade deste ciclo', 'erro'); return }
  if (!avisoProp.value.ok) { ui.avisar(avisoProp.value.texto, 'erro'); return }

  /* ⚠️ A derivação do tipo é a MESMA de antes — o modo escolhido na tela só
     liga o `livre` e limpa o que não pertence a ele. Nada de novo no payload. */
  const tipo = livre.value ? 'livre' : (cevasSel.value.length ? 'ceva' : (rotasSel.value.length ? 'rota' : ''))
  if (!tipo) {
    ui.avisar(modo.value
      ? 'Escolha ao menos uma ceva ou rota para este modo'
      : 'Escolha como você vai caçar', 'erro')
    return
  }

  salvando.value = true
  try {
    const r = await server<{ id: string }>('apiCriarManejo', {
      nome: nome.value, tipo, obs: obs.value, canisIds: '',
      cevasIds: livre.value ? '' : cevasSel.value.join(','),
      rotasIds: livre.value ? '' : rotasSel.value.join(','),
      propriedadeId: prop.value.id
    })
    ui.avisar('Caçada iniciada ✔')
    await router.push({ path: '/cacada', query: { id: r.id } })
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <TituloTela titulo="Nova caçada" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!pronto" class="card"><div class="meta">Carregando opções…</div></div>

    <template v-else>
      <div class="card">
        <h3>Novo ciclo de caça</h3>

        <label for="m_nome">Nome da caçada</label>
        <input id="m_nome" v-model="nome" class="no-i18n" placeholder="Ex: Sábado no Sítio São Gabriel">

        <label for="m_prop">Propriedade *</label>
        <select id="m_prop" v-model="propId">
          <option value="">— escolha a propriedade —</option>
          <option v-for="p in props_" :key="p.id" :value="p.id">
            {{ p.nome }}{{ p.regular ? '' : ' (irregular)' }}
          </option>
        </select>
        <div class="meta aviso" :class="avisoProp.ok ? 'bom' : 'ruim'">
          <Icone :nome="avisoProp.ok ? 'relogio' : 'alerta'" /> {{ avisoProp.texto }}
        </div>

        <template v-if="prop && avisoProp.ok">
          <label class="pergunta">Como você vai caçar? *</label>
          <div class="modos">
            <!--
              Modo indisponível continua CLICÁVEL e explica o porquê, com o
              atalho para resolver. Botão morto deixa a pessoa batendo sem
              saber o que fazer — mesma escolha do CartaoModulo travado.
            -->
            <button
              v-for="op in modos"
              :key="op.chave"
              class="modo"
              :class="{ on: modo === op.chave, off: !op.disponivel }"
              @click="op.disponivel ? (modo = op.chave) : null"
            >
              <span class="mic"><Icone :nome="op.disponivel ? op.icone : 'bloqueio'" :px="22" /></span>
              <span class="mtxt">
                <b>{{ op.titulo }}</b>
                <span class="meta">{{ op.disponivel ? op.resumo : op.motivo }}</span>
                <NuxtLink v-if="!op.disponivel && op.para" :to="op.para" class="mlink">
                  Cadastrar agora
                </NuxtLink>
              </span>
            </button>
          </div>

          <template v-if="modo === 'ceva'">
            <label>Cevas desta propriedade *</label>
            <label v-for="c in cevasDaProp" :key="c.id" class="check">
              <input v-model="cevasSel" type="checkbox" :value="c.id">
              <span class="no-i18n">{{ c.nome }}</span>
            </label>
          </template>

          <template v-if="modo === 'rota'">
            <label>Rotas desta propriedade *</label>
            <label v-for="r in rotasDaProp" :key="r.id" class="check">
              <input v-model="rotasSel" type="checkbox" :value="r.id">
              <span class="no-i18n">{{ r.nome }}</span>
            </label>
          </template>

          <div v-if="modo === 'livre'" class="card livre">
            <div class="meta">
              <Icone nome="alerta" /> O percurso será gravado por GPS quando a caçada começar. O
              traçado que sair do limite aparece em vermelho, mas é salvo do
              mesmo jeito.
            </div>
          </div>
        </template>

        <label for="m_obs">Observações</label>
        <textarea id="m_obs" v-model="obs" class="no-i18n" />
        <div class="meta">Amigos são convidados depois, dentro do ciclo aberto.</div>

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Iniciar caçada' }}
        </button>
        <NuxtLink to="/cacadas" class="btn sec">Cancelar</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; }
.ruim { color: var(--danger); }
.bom { color: var(--verde); }
.aviso { margin: -4px 0 10px; }
.check { display: flex; align-items: center; gap: 8px; padding: 6px 0; margin: 0; font-weight: 400; }
.check input { width: auto; flex: none; }
.check.off { opacity: .4; }
.check.forte { font-weight: 600; }
.livre { border-left: 5px solid var(--terra); margin: 12px 0 0; }

.pergunta { font-size: 13px; }
.modos { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.modo {
  display: flex; align-items: flex-start; gap: 10px; text-align: left;
  width: 100%; padding: 11px; margin: 0;
  background: var(--carvao-3); color: var(--txt);
  border: 1px solid var(--linha); border-radius: 12px; cursor: pointer;
  font: inherit;
}
.modo.on { border-color: var(--laranja); box-shadow: 0 0 0 1px var(--laranja) inset; }
.modo.off { opacity: .75; border-style: dashed; cursor: default; }
.mic {
  flex: none; width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--carvao-2); color: var(--osso-2);
}
.modo.on .mic { background: var(--laranja); color: #fff; }
.modo.off .mic { color: var(--alerta); }
.mtxt { flex: 1; min-width: 0; }
.mtxt b { display: block; font-size: 14px; }
.mtxt .meta { margin: 3px 0 0; display: block; }
.modo.off .mtxt .meta { color: var(--alerta); }
.mlink { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--laranja-cl); }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
