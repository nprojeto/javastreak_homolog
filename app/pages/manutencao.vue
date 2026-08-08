<script setup lang="ts">
/**
 * Manutenção — os meios de transporte, em três casas.
 * Porte de VIEWS.manutencaoHub + transportes + transpForm
 * (index.html, 8342-8394).
 *
 * ⚠️ As três casas não são estética: GARAGEM, MARINA e HARAS têm documentos e
 * cuidados diferentes. O cavalo saiu da garagem justamente porque revisão e
 * IPVA não se aplicam a ele — o que ele tem é saúde e casqueamento.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

export interface Transporte {
  id: string; tipo?: string; identificacao?: string; fotoUrl?: string
  obs?: string; meio?: string; mesLicenciamento?: string; mesIpva?: string
  kmAtual?: string; ultimaRevisao?: string; proximaRevisao?: string
  correiaDentada?: string; trocaPneus?: string; proximaTrocaOleo?: string
  dataNascimento?: string
}

/**
 * ⚠️ DUAS casas, não três. O haras saiu daqui e vive em Saúde animal.
 *
 * O critério não é onde o bicho ou a máquina fica — é O QUE SE REGISTRA.
 * Manutenção é o que quebra, desgasta e precisa de revisão: óleo, pneu,
 * correia, licenciamento, quilometragem. Cavalo não tem nada disso; tem
 * vacina e casqueamento, que é a mesma natureza do cão.
 */
const CASAS = [
  { k: 'garagem', rot: 'Garagem', ic: 'garagem' },
  { k: 'marina', rot: 'Marina', ic: 'marina' }
] as const
type Casa = (typeof CASAS)[number]['k']

const TIPOS: Record<Casa, string[]> = {
  garagem: ['Carro', 'Moto', 'Quadriciclo', 'Caminhonete', 'Outro'],
  marina: ['Barco', 'Lancha', 'Bote', 'Caiaque', 'Canoa', 'Jet ski', 'Outra embarcação']
}
const TIPOS_HARAS = ['Cavalo']

function casaDe(tipo?: string): Casa | 'haras' {
  if (TIPOS_HARAS.includes(String(tipo))) return 'haras'
  if (TIPOS.marina.includes(String(tipo))) return 'marina'
  return 'garagem'
}

const { server } = useServer()
const ui = useUi()
const route = useRoute()

const lista = ref<Transporte[] | null>(null)
const erro = ref('')

/**
 * A casa pode vir pela URL. É assim que a Saúde animal abre o HARAS direto,
 * sem a pessoa cair na garagem e ter que procurar a aba.
 */
const casa = ref<Casa>(
  (['garagem', 'marina'] as const).includes(route.query.casa as Casa)
    ? (route.query.casa as Casa)
    : 'garagem'
)

const form = ref(false)
const tipo = ref('')
const identificacao = ref('')
const obs = ref('')
const foto = ref('')
const salvando = ref(false)

const daCasa = computed(() => (lista.value || []).filter((t) => casaDe(t.tipo) === casa.value))

watch(casa, () => { tipo.value = TIPOS[casa.value][0] || '' })

function conta(c: Casa) {
  return (lista.value || []).filter((t) => casaDe(t.tipo) === c).length
}

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Transporte[]>('apiListarTransportes')
    tipo.value = TIPOS[casa.value][0] || ''
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os transportes'
  }
}

async function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { foto.value = ''; return }
  try {
    const a = await lerArquivo(f, { tipos: ['image/jpeg', 'image/png', 'image/webp'], maxMb: FOTO_MAX_MB })
    foto.value = a.dados
  } catch (err) {
    foto.value = ''
    ui.avisar(err instanceof Error ? err.message : 'Imagem inválida', 'erro')
  }
}

async function salvar() {
  if (!tipo.value) { ui.avisar('Escolha o tipo', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarTransporte', {
      tipo: tipo.value, identificacao: identificacao.value, obs: obs.value,
      foto: foto.value, meio: casa.value === 'marina' ? 'maritimo' : 'terrestre'
    })
    ui.avisar('Salvo ✔')
    form.value = false; identificacao.value = ''; obs.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(t: Transporte) {
  if (!confirm('Excluir este item?')) return
  try {
    await server('apiExcluir', 'transporte', t.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Manutenção</h2>
        <div class="meta">
          Veículos e embarcações: revisão, peças, licenciamento e quilometragem.
          Cavalo fica em Saúde animal.
        </div>
      </div>

      <nav class="subnav">
        <button
          v-for="c in CASAS"
          :key="c.k"
          :class="{ active: casa === c.k }"
          @click="casa = c.k"
        >
          <Icone :nome="c.ic" :px="20" />
          <span>{{ c.rot }}</span>
          <span v-if="conta(c.k)" class="num">{{ conta(c.k) }}</span>
        </button>
      </nav>

      <div v-if="form" class="card">
        <label for="t_tipo">Tipo *</label>
        <select id="t_tipo" v-model="tipo">
          <option v-for="t in TIPOS[casa]" :key="t">{{ t }}</option>
        </select>

        <label for="t_id">Identificação</label>
        <input
          id="t_id"
          v-model="identificacao"
          class="no-i18n"
          placeholder="Placa, nome ou apelido"
        >

        <label for="t_obs">Observações</label>
        <textarea id="t_obs" v-model="obs" class="no-i18n" />

        <label for="t_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="t_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <div v-if="!daCasa.length && !form" class="card vazio">
        <div class="big"><Icone :nome="CASAS.find((c) => c.k === casa)?.ic || 'transporte'" :px="42" /></div>
        Nada cadastrado aqui ainda.
      </div>

      <div v-for="t in daCasa" :key="t.id" class="card item">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic">
          <Icone :nome="CASAS.find((c) => c.k === casa)?.ic || 'transporte'" :px="26" />
        </div>
        <NuxtLink :to="{ path: '/transporte', query: { id: t.id } }" class="grow">
          <b class="no-i18n">{{ t.identificacao || t.tipo }}</b>
          <div class="meta"><span class="pill">{{ t.tipo }}</span></div>
          <div v-if="t.obs" class="meta no-i18n">{{ t.obs }}</div>
        </NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(t)"><Icone nome="excluir" /></button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Adicionar"
        chave="transportes"
        :quantidade="(lista || []).length"
        @criar="form = true"
      />


    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.subnav { display: flex; gap: 6px; margin-bottom: 10px; }
.subnav button {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 6px; border-radius: 12px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-size: 12.5px; color: var(--txt);
}
.subnav button.active { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); font-weight: 700; }
.subnav .num { font-size: 10.5px; background: var(--verde); color: #fff; border-radius: 999px; padding: 0 6px; }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.item { display: flex; align-items: center; gap: 10px; }
.thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; }
.ic { width: 58px; height: 58px; border-radius: 10px; background: var(--areia); display: flex; align-items: center; justify-content: center; font-size: 25px; flex: none; }
.item .grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.item .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.prev { max-width: 140px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; }
</style>
