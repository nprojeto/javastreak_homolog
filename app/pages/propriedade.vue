<script setup lang="ts">
/**
 * Nova propriedade / editar. Porte de VIEWS.propForm + propLimite +
 * salvarProp (index.html, 5922 / 5975 / 6038).
 *
 * ⚠️ Diferença deliberada em relação ao legado: lá o limite era desenhado numa
 * TELA À PARTE e salvo separado. Aqui o desenho fica no próprio formulário e
 * vai na mesma chamada, porque o `apiSalvarPropriedade` já aceita o campo
 * `limite` junto. Uma gravação em vez de duas, e sem estado global entre
 * telas — que era de onde vinha o `LIM_DRAW`.
 *
 * ⚠️ Nada é salvo pela metade: o servidor recusa antes de gravar se faltar o
 * desenho (`PROP_SEM_DESENHO`) ou qualquer das duas autorizações
 * (`AUT_SEM_VALIDADE`, `AUT_SEM_ANEXO`). A conferência aqui só evita a
 * viagem perdida.
 */
import { useUi } from '~/stores/ui'
import type { Ponto } from '~/composables/useMapa'
import type { Propriedade } from '~/pages/propriedades.vue'

definePageMeta({ layout: 'app' })

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const atual = ref<Propriedade | null>(null)
const erro = ref('')
const pronto = ref(false)

const nome = ref('')
const dono = ref('')
const documentoDono = ref('')
const car = ref('')
const obs = ref('')
const limite = ref<Ponto[]>([])
const desenhando = ref(false)

const mNumero = ref(''); const mValidade = ref('')
const mArq = ref(''); const mArqNome = ref('')
const iNumero = ref(''); const iValidade = ref('')
const iArq = ref(''); const iArqNome = ref('')

const salvando = ref(false)

const titulo = computed(() => (id.value ? 'Editar propriedade' : 'Nova propriedade'))

onMounted(async () => {
  if (!id.value) { pronto.value = true; desenhando.value = true; return }
  try {
    const l = await server<Propriedade[]>('apiListarPropriedades')
    const p = (l || []).find((x) => x.id === id.value) || null
    if (!p) { erro.value = 'Propriedade não encontrada'; return }
    atual.value = p
    nome.value = p.nome || ''
    dono.value = p.dono || ''
    documentoDono.value = String((p as unknown as { documentoDono?: string }).documentoDono || '')
    car.value = p.car || ''
    obs.value = p.obs || ''
    limite.value = Array.isArray(p.limite) ? [...p.limite] : []
    mNumero.value = p.autManejo?.numero || ''
    mValidade.value = String(p.autManejo?.vencimento || '').slice(0, 10)
    iNumero.value = p.autIbama?.numero || ''
    iValidade.value = String(p.autIbama?.vencimento || '').slice(0, 10)
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a propriedade'
  }
})

function autOk(validade: string, arq: string, atualAut?: { temArquivo?: boolean } | null) {
  if (!validade) return 'validade'
  if (!arq && !atualAut?.temArquivo) return 'anexo'
  return ''
}

async function salvar() {
  if (!nome.value) { ui.avisar('Informe o nome', 'erro'); return }
  if (limite.value.length < 3) {
    ui.avisar('Desenhe o limite da propriedade antes de salvar', 'erro'); return
  }
  const fm = autOk(mValidade.value, mArq.value, atual.value?.autManejo)
  if (fm) {
    ui.avisar(fm === 'validade'
      ? 'Informe a validade da Autorização de Acesso'
      : 'Anexe o arquivo da Autorização de Acesso', 'erro')
    return
  }
  const fi = autOk(iValidade.value, iArq.value, atual.value?.autIbama)
  if (fi) {
    ui.avisar(fi === 'validade'
      ? 'Informe a validade da Autorização IBAMA'
      : 'Anexe o arquivo da Autorização IBAMA', 'erro')
    return
  }

  salvando.value = true
  try {
    const d: Record<string, unknown> = {
      nome: nome.value, dono: dono.value, documentoDono: documentoDono.value,
      car: car.value, obs: obs.value,
      limite: limite.value,
      autManejo: {
        numero: mNumero.value, validade: mValidade.value,
        arquivo: mArq.value, arquivoNome: mArqNome.value
      },
      autIbama: {
        numero: iNumero.value, validade: iValidade.value,
        arquivo: iArq.value, arquivoNome: iArqNome.value
      }
    }
    if (id.value) d.id = id.value
    await server('apiSalvarPropriedade', d)
    ui.avisar('Propriedade salva ✔')
    await router.push('/propriedades')
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!pronto" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3>{{ titulo }}</h3>

        <label for="p_nome">Nome da propriedade *</label>
        <input id="p_nome" v-model="nome" class="no-i18n" placeholder="Ex: Fazenda Boa Vista">

        <label for="p_dono">Proprietário</label>
        <input id="p_dono" v-model="dono" class="no-i18n" placeholder="Nome do dono">

        <label for="p_docdono">CPF/CNPJ do proprietário</label>
        <input id="p_docdono" v-model="documentoDono" class="no-i18n">

        <label for="p_car">Número do CAR</label>
        <input id="p_car" v-model="car" class="no-i18n" placeholder="Cadastro Ambiental Rural">

        <label for="p_obs">Observações</label>
        <textarea id="p_obs" v-model="obs" class="no-i18n" />
      </div>

      <div class="card">
        <h3><Icone nome="mapa" /> Limite da propriedade</h3>
        <div class="meta">
          {{ limite.length >= 3
            ? 'Desenhado com ' + limite.length + ' pontos.'
            : 'Ainda não desenhado. Sem ele a propriedade não salva.' }}
        </div>

        <button
          v-if="!desenhando"
          type="button"
          class="btn sec"
          @click="desenhando = true"
        >{{ limite.length >= 3 ? 'Redesenhar no mapa' : 'Desenhar no mapa' }}</button>

        <ClientOnly v-if="desenhando">
          <MapaLimite
            v-model="limite"
            :centro-inicial="{ lat: atual?.lat, lng: atual?.lng }"
          />
        </ClientOnly>
      </div>

      <div class="card">
        <h3>Autorizações</h3>
        <div class="meta">
          As duas são obrigatórias. Validade e anexo são o que comprovam — o
          número só o IBAMA usa.
        </div>

        <BlocoAutorizacao
          label="Autorização de Acesso"
          :atual="atual?.autManejo"
          v-model:numero="mNumero"
          v-model:validade="mValidade"
          v-model:arquivo="mArq"
          v-model:arquivo-nome="mArqNome"
        />

        <BlocoAutorizacao
          label="Autorização do IBAMA"
          :atual="atual?.autIbama"
          v-model:numero="iNumero"
          v-model:validade="iValidade"
          v-model:arquivo="iArq"
          v-model:arquivo-nome="iArqNome"
        />
      </div>

      <div class="card">
        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : (id ? 'Salvar alterações' : 'Adicionar') }}
        </button>
        <NuxtLink to="/propriedades" class="btn sec">Cancelar</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 6px; }
.card > .meta { margin-bottom: 8px; }
.ruim { color: var(--danger); }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
