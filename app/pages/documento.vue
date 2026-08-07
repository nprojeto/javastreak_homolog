<script setup lang="ts">
/**
 * Novo documento / editar. Porte de VIEWS.docForm + salvarDoc
 * (index.html, 5880).
 *
 * A categoria e o id vêm pela URL, e não por variável global como no legado
 * (`DOCCAT` / `DOCEDIT`) — assim recarregar a página não perde o contexto.
 *
 * ⚠️ Ao editar, o anexo antigo permanece se nenhum novo for escolhido. É o
 * que permite corrigir uma data sem reenviar o arquivo.
 */
import { useUi } from '~/stores/ui'

definePageMeta({ layout: 'app' })

interface Doc {
  id: string; categoria: string; tipo: string; numero?: string
  emissao?: string; vencimento?: string; obs?: string
  transporteId?: string; arquivoNome?: string; temArquivo?: boolean
}
interface Transporte { id: string; tipo: string; identificacao?: string }

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const cat = computed(() => String(route.query.cat || 'pessoal'))
const id = computed(() => String(route.query.id || ''))

const tipos = ref<string[]>([])
const transportes = ref<Transporte[]>([])
const atual = ref<Doc | null>(null)
const erro = ref('')
const pronto = ref(false)

const tipo = ref('')
const numero = ref('')
const emissao = ref('')
const vencimento = ref('')
const obs = ref('')
const transporteId = ref('')
const arq = ref('')
const arqNome = ref('')
const salvando = ref(false)

const titulo = computed(() => (id.value ? 'Editar documento' : 'Novo documento'))

onMounted(async () => {
  try {
    const [t, tr] = await Promise.all([
      server<Record<string, string[]>>('apiTiposDocumento'),
      cat.value === 'veiculo'
        ? server<Transporte[]>('apiListarTransportes').catch(() => [] as Transporte[])
        : Promise.resolve([] as Transporte[])
    ])
    tipos.value = t?.[cat.value] || []
    transportes.value = tr

    if (id.value) {
      const lista = await server<Doc[]>('apiListarDocumentos')
      const d = (lista || []).find((x) => x.id === id.value) || null
      if (!d) { erro.value = 'Documento não encontrado'; return }
      atual.value = d
      tipo.value = d.tipo
      numero.value = d.numero || ''
      emissao.value = String(d.emissao || '').slice(0, 10)
      vencimento.value = String(d.vencimento || '').slice(0, 10)
      obs.value = d.obs || ''
      transporteId.value = d.transporteId || ''
    } else {
      tipo.value = tipos.value[0] || ''
    }
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o formulário'
  }
})

async function salvar() {
  if (!tipo.value) { ui.avisar('Selecione o tipo', 'erro'); return }
  salvando.value = true
  try {
    const d: Record<string, unknown> = {
      categoria: cat.value, tipo: tipo.value, numero: numero.value,
      emissao: emissao.value, vencimento: vencimento.value, obs: obs.value,
      transporteId: transporteId.value
    }
    if (arq.value) { d.arquivo = arq.value; d.arquivoNome = arqNome.value }
    if (id.value) d.id = id.value
    await server('apiSalvarDocumento', d)
    ui.avisar('Documento salvo ✔')
    await router.push('/documentacao')
  } catch { /* o useServer já avisou */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!pronto" class="card"><div class="meta">Carregando…</div></div>

    <div v-else class="card">
      <h3>{{ titulo }}</h3>

      <label for="d_tipo">Tipo de documento *</label>
      <select id="d_tipo" v-model="tipo">
        <option v-for="t in tipos" :key="t">{{ t }}</option>
      </select>

      <template v-if="cat === 'veiculo'">
        <label for="d_transp">Veículo / embarcação</label>
        <select id="d_transp" v-model="transporteId">
          <option value="">— nenhum —</option>
          <option v-for="t in transportes" :key="t.id" :value="t.id">
            {{ t.tipo }}{{ t.identificacao ? ' · ' + t.identificacao : '' }}
          </option>
        </select>
      </template>

      <label for="d_num">Número / registro</label>
      <input id="d_num" v-model="numero" class="no-i18n">

      <div class="two">
        <div><CampoData v-model="emissao" label="Emissão" /></div>
        <div><CampoData v-model="vencimento" label="Vencimento" /></div>
      </div>
      <div class="meta dica">
        Com vencimento preenchido, o documento aparece na sua Agenda.
      </div>

      <CampoArquivo
        v-model:dados="arq"
        v-model:nome="arqNome"
        :doc-id="atual?.id"
        :tem-arquivo="atual?.temArquivo"
        :arquivo-nome="atual?.arquivoNome"
      />

      <label for="d_obs">Observações</label>
      <textarea id="d_obs" v-model="obs" />

      <button class="btn" :disabled="salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : (id ? 'Salvar alterações' : 'Adicionar') }}
      </button>
      <NuxtLink to="/documentacao" class="btn sec">Cancelar</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; }
.ruim { color: var(--danger); }
.dica { margin: -4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
