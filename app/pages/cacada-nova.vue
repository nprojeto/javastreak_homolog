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
 * ⚠️ O tipo não é perguntado: livre marcado manda; senão quem tiver ceva é
 * ceva, quem tiver só rota é rota.
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
watch(propId, () => { cevasSel.value = []; rotasSel.value = [] })

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

  const tipo = livre.value ? 'livre' : (cevasSel.value.length ? 'ceva' : (rotasSel.value.length ? 'rota' : ''))
  if (!tipo) {
    ui.avisar('Escolha ao menos uma ceva ou rota, ou marque caçada livre', 'erro')
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
          {{ avisoProp.ok ? '⏱' : '⚠️' }} {{ avisoProp.texto }}
        </div>

        <template v-if="prop && avisoProp.ok">
          <label>Cevas desta propriedade</label>
          <div v-if="!cevasDaProp.length" class="meta">
            Nenhuma ceva cadastrada nesta propriedade.
          </div>
          <label v-for="c in cevasDaProp" :key="c.id" class="check" :class="{ off: livre }">
            <input v-model="cevasSel" type="checkbox" :value="c.id" :disabled="livre">
            <span class="no-i18n">{{ c.nome }}</span>
          </label>

          <label>Rotas desta propriedade</label>
          <div v-if="!rotasDaProp.length" class="meta">
            Nenhuma rota cadastrada nesta propriedade.
          </div>
          <label v-for="r in rotasDaProp" :key="r.id" class="check" :class="{ off: livre }">
            <input v-model="rotasSel" type="checkbox" :value="r.id" :disabled="livre">
            <span class="no-i18n">{{ r.nome }}</span>
          </label>

          <div class="card livre">
            <label class="check forte">
              <input v-model="livre" type="checkbox">
              <b>Caçada livre (grava o percurso)</b>
            </label>
            <div class="meta">
              <template v-if="livre">
                🔴 O percurso será gravado por GPS quando a caçada começar. O
                traçado que sair do limite aparece em vermelho, mas é salvo do
                mesmo jeito.
              </template>
              <template v-else>
                Sem ceva nem rota fixa. O app grava o caminho enquanto você anda.
              </template>
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
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
