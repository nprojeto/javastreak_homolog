<script setup lang="ts">
/**
 * Vitrine de produtos da empresa. Porte de VIEWS.vitrine + produtoForm
 * (index.html, 7000).
 *
 * O limite de produtos vem do plano: Empresa 10, Empresa Pro 30. O servidor
 * recusa acima disso.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Produto {
  id: string; nome: string; descricao?: string; preco?: string; fotoUrl?: string
}
interface Resposta {
  produtos: Produto[]; limite: number; plano?: string; nomePlano?: string
}

const { server } = useServer()
const ui = useUi()

const dados = ref<Resposta | null>(null)
const erro = ref('')

const form = ref(false)
const editId = ref('')
const nome = ref('')
const descricao = ref('')
const preco = ref('')
const foto = ref('')
const salvando = ref(false)

const cheio = computed(
  () => !!dados.value && dados.value.produtos.length >= dados.value.limite
)

async function carregar() {
  erro.value = ''
  try {
    dados.value = await server<Resposta>('apiMeusProdutos')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a vitrine'
  }
}

function abrir(p?: Produto) {
  editId.value = p?.id || ''
  nome.value = p?.nome || ''
  descricao.value = p?.descricao || ''
  preco.value = p?.preco || ''
  foto.value = ''
  form.value = true
}

async function escolheuFoto(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
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
  if (!nome.value) { ui.avisar('Informe o nome do produto', 'erro'); return }
  salvando.value = true
  try {
    const d: Record<string, unknown> = {
      nome: nome.value, descricao: descricao.value, preco: preco.value, foto: foto.value
    }
    if (editId.value) d.id = editId.value
    await server('apiSalvarProduto', d)
    ui.avisar('Produto salvo ✔')
    form.value = false
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(p: Produto) {
  if (!confirm('Excluir este produto?')) return
  try {
    await server('apiExcluirProduto', p.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!dados" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <TituloTela titulo="Minha vitrine" />
      <div class="meta contagem">
        {{ dados.produtos.length }} de {{ dados.limite }} produto(s)
        <template v-if="dados.nomePlano"> · plano {{ dados.nomePlano }}</template>
      </div>

      <div v-if="form" class="card">
        <label for="v_nome">Nome do produto *</label>
        <input id="v_nome" v-model="nome" class="no-i18n">
        <label for="v_desc">Descrição</label>
        <textarea id="v_desc" v-model="descricao" class="no-i18n" />
        <label for="v_preco">Preço</label>
        <input id="v_preco" v-model="preco" class="no-i18n" placeholder="Ex: 129,90">
        <label for="v_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="v_foto" type="file" accept="image/*" @change="escolheuFoto">
        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar produto' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <div v-if="!dados.produtos.length && !form" class="card vazio">
        <div class="big"><Icone nome="carrinho" /></div>
        Nenhum produto na vitrine.
      </div>

      <div v-for="p in dados.produtos" :key="p.id" class="card prod">
        <img v-if="p.fotoUrl" :src="String(p.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone nome="carrinho" /></div>
        <div class="grow">
          <b class="no-i18n">{{ p.nome }}</b>
          <div v-if="p.preco" class="meta no-i18n">R$ {{ p.preco }}</div>
          <div v-if="p.descricao" class="meta no-i18n">{{ p.descricao }}</div>
        </div>
        <button class="ib" title="Editar" @click="abrir(p)"><Icone nome="editar" /></button>
        <button class="ib" title="Excluir" @click="excluir(p)"><Icone nome="excluir" /></button>
      </div>

      <div v-if="cheio && !form" class="card travado">
        <div class="meta">
          <Icone nome="bloqueio" /> Você chegou ao limite de {{ dados.limite }} produtos do seu plano.
        </div>
        <NuxtLink to="/planos" class="btn sec">Ver planos</NuxtLink>
      </div>
      <button v-else-if="!form" class="btn" @click="abrir()">＋ Novo produto</button>

      <NuxtLink to="/empresa" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.contagem { margin: -8px 2px 12px; }
.travado { border-left: 5px solid var(--alerta); }
.travado .btn { margin-top: 8px; text-decoration: none; }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.prod { display: flex; align-items: center; gap: 10px; }
.thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; }
.ic { width: 58px; height: 58px; border-radius: 10px; background: var(--areia); display: flex; align-items: center; justify-content: center; font-size: 25px; flex: none; }
.prod .grow { flex: 1; min-width: 0; }
.prod .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.prev { max-width: 150px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
