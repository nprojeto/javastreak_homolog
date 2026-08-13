<script setup lang="ts">
/**
 * CANIL — os cães, direto.
 *
 * ⚠️ O canil deixou de ser algo que se cadastra. Antes esta tela listava
 * canis, cada um com coordenada obrigatória e pino no mapa, e os cães ficavam
 * um nível abaixo. Agora vale a MESMA regra de garagem, marina e haras: a
 * casa simplesmente existe, e o que se cadastra é o que mora dentro dela.
 *
 * O vínculo `caes.canilId` continua no banco — o servidor resolve sozinho com
 * `apiMeuCanil()`, que cria o canil na primeira vez que alguém precisa. Quem
 * tinha vários canis antes não perde nada: `apiListarCaes()` sem argumento
 * devolve os cães de todos, e o cadastro novo entra no primeiro.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

const FUNCOES = ['Rastreio', 'Busca', 'Agarro', 'Faro', 'Cerco', 'Misto', 'Outro']

export interface Canil {
  id: string; nome?: string; obs?: string; qtdCaes?: number
}
export interface Cao {
  id: string; canilId: string; nome?: string; funcao?: string; raca?: string
  sexo?: string; dataNascimento?: string; fotoUrl?: string; obs?: string
}

const { server } = useServer()
const ui = useUi()

const caes = ref<Cao[] | null>(null)
const erro = ref('')

/**
 * `editando` guarda o id em edição. Vazio, o formulário cria; preenchido, ele
 * altera pelo `apiEditar`, que é o mesmo editor genérico já usado por ceva e
 * abate — nenhuma regra nova no servidor.
 */
const editando = ref('')
const form = ref(false)
const nome = ref('')
const funcao = ref(FUNCOES[0]!)
const raca = ref('')
const sexo = ref('Macho')
const nasc = ref('')
const obs = ref('')
const foto = ref('')
const salvando = ref(false)

function idade(iso?: string) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const meses = Math.floor((Date.now() - d.getTime()) / 2629800000)
  if (meses < 24) return meses + ' mes(es)'
  return Math.floor(meses / 12) + ' ano(s)'
}

async function carregar() {
  erro.value = ''
  try {
    /* Sem argumento: todos os meus cães, de todos os canis que existirem. */
    caes.value = await server<Cao[]>('apiListarCaes')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os cães'
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

function limpar() {
  editando.value = ''
  nome.value = ''; funcao.value = FUNCOES[0]!; raca.value = ''
  sexo.value = 'Macho'; nasc.value = ''; obs.value = ''; foto.value = ''
}

function editar(c: Cao) {
  editando.value = c.id
  nome.value = c.nome || ''
  funcao.value = c.funcao || FUNCOES[0]!
  raca.value = c.raca || ''
  sexo.value = c.sexo || 'Macho'
  nasc.value = String(c.dataNascimento || '').slice(0, 10)
  obs.value = c.obs || ''
  foto.value = ''
  form.value = true
}

function fechar() { form.value = false; limpar() }

async function salvar() {
  if (!nome.value) { ui.avisar('Informe o nome do cão', 'erro'); return }
  salvando.value = true
  const d = {
    nome: nome.value, funcao: funcao.value, raca: raca.value,
    sexo: sexo.value, dataNascimento: nasc.value, obs: obs.value, foto: foto.value
  }
  try {
    if (editando.value) {
      /* ⚠️ Sem foto nova, o campo vai VAZIO e o `apiEditar` não toca no
         `fotoUrl` — trocar uma raça não pode apagar a foto do cão. */
      await server('apiEditar', 'cao', editando.value, d)
      ui.avisar('Cão atualizado ✔')
    } else {
      /* Sem `canilId`: o servidor põe no meu canil, criando-o se for o primeiro. */
      await server('apiCriarCao', d)
      ui.avisar('Cão salvo ✔')
    }
    fechar()
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    salvando.value = false
  }
}

async function excluir(c: Cao) {
  if (!confirm('Excluir este cão?')) return
  try {
    await server('apiExcluir', 'cao', c.id)
    ui.avisar('Excluído')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Canil" descricao="Os cães da sua matilha." />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="caes === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div v-if="!caes.length && !form" class="card vazio">
        <div class="big"><Icone nome="canil" /></div>
        Nenhum cão cadastrado ainda.
      </div>

      <div class="grade3">
        <div v-for="c in caes" :key="c.id" class="card lad">
          <NuxtLink :to="{ path: '/cao', query: { id: c.id } }" class="lad-link">
            <img v-if="c.fotoUrl" :src="String(c.fotoUrl)" class="lad-foto" alt="">
            <span v-else class="lad-ic"><Icone nome="canil" :px="28" /></span>
            <b class="no-i18n">{{ c.nome }}</b>
            <div class="meta"><span class="pill">{{ c.funcao || '—' }}</span></div>
            <div class="meta no-i18n">
              {{ c.sexo }}<template v-if="idade(c.dataNascimento)"> · {{ idade(c.dataNascimento) }}</template>
            </div>
          </NuxtLink>
          <button class="lad-e" title="Editar" @click="editar(c)"><Icone nome="editar" /></button>
          <button class="lad-x" title="Excluir" @click="excluir(c)"><Icone nome="excluir" /></button>
        </div>
      </div>

      <div v-if="form" class="card form-novo">
        <h3>{{ editando ? 'Editar cão' : 'Novo cão' }}</h3>

        <label for="c_nome">Nome do cão *</label>
        <input id="c_nome" v-model="nome" class="no-i18n">

        <div class="two">
          <div>
            <label for="c_func">Função</label>
            <select id="c_func" v-model="funcao">
              <option v-for="f in FUNCOES" :key="f">{{ f }}</option>
            </select>
          </div>
          <div>
            <label for="c_sexo">Sexo</label>
            <select id="c_sexo" v-model="sexo">
              <option>Macho</option>
              <option>Fêmea</option>
            </select>
          </div>
        </div>

        <label for="c_raca">Raça</label>
        <input id="c_raca" v-model="raca" class="no-i18n">

        <CampoData v-model="nasc" label="Data de nascimento" />

        <label for="c_obs">Observações</label>
        <textarea id="c_obs" v-model="obs" class="no-i18n" />

        <label for="c_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="c_foto" type="file" accept="image/*" @change="escolheuFoto">
        <div v-if="editando" class="meta">
          Escolher uma foto substitui a atual. Deixando em branco, ela continua.
        </div>

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Salvar cão') }}
        </button>
        <button class="btn sec" @click="fechar">Cancelar</button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Novo cão"
        chave="caesPorCanil"
        :quantidade="caes.length"
        @criar="limpar(); form = true"
      />
      <NuxtLink to="/saude-animal" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
/* O formulário de cadastro, ao pé da lista. */
.form-novo { border-left: 4px solid var(--laranja); }
.form-novo h3 { margin: 0 0 10px; font-size: 15px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big :deep(.ic-svg) { width: 42px; height: 42px; }
.pill { background: var(--linha); }
.prev { max-width: 140px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
