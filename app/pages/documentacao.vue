<script setup lang="ts">
/**
 * Documentação. Porte de VIEWS.documentacao + pintarDocs + corpoDocumentos +
 * corpoAcervoSub (index.html, 5613-5860).
 *
 * Três abas: Acervo, Veículos e Pessoal.
 *
 * ⚠️ O CTF NÃO aparece na lista, nem para editar. Ele tem tela própria em
 * CAÇAR, e o backend recusa o tipo reservado nas portas genéricas. A aba
 * Pessoal traz só um atalho, porque é lá que a pessoa vai procurar.
 *
 * ⚠️ O Acervo (CRAF, CR, GT) salva em LOTE, numa chamada só. Não é enfeite:
 * o backend exige que toda leitura aconteça antes da primeira gravação, e uma
 * chamada por linha reexecutaria a função e duplicaria documento.
 */
import { useUi } from '~/stores/ui'
import { useCreditos } from '~/stores/creditos'
import { statusVencimento } from '~/composables/useArquivo'
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Doc {
  id: string; categoria: string; tipo: string; numero?: string
  emissao?: string; vencimento?: string; obs?: string
  transporteId?: string; arquivoNome?: string; temArquivo?: boolean
}
interface Transporte { id: string; tipo: string; identificacao?: string }

const ROTULO: Record<string, string> = {
  acervo: 'Acervo', veiculo: 'Veículos', pessoal: 'Pessoal'
}
const ICONE: Record<string, string> = {
  acervo: 'arquivo', veiculo: 'transporte', pessoal: 'usuario'
}
const ACERVO_SUB = ['CRAF', 'CR', 'GT'] as const
const ACERVO_AJUDA: Record<string, string> = {
  CRAF: 'Certificado de Registro de Arma de Fogo. Um por arma.',
  CR: 'Certificado de Registro do Exército.',
  GT: 'Guia de Tráfego. O número é longo — o campo acompanha.'
}
const CTF_TIPO = 'CTF — Cadastro Técnico Federal (IBAMA)'

const { server } = useServer()
const ui = useUi()
const cred = useCreditos()

const docs = ref<Doc[] | null>(null)
const transportes = ref<Transporte[]>([])
const erro = ref('')
const cat = ref<'acervo' | 'veiculo' | 'pessoal'>('acervo')
const sub = ref<(typeof ACERVO_SUB)[number]>('CRAF')

/* ---- linhas do acervo (edição em lote) ---- */
interface Linha {
  id: string; numero: string; emissao: string; vencimento: string
  obs: string; arquivo: string; arquivoNome: string
  temArquivo: boolean; nomeAtual: string
}
const linhas = ref<Linha[]>([])
const remover = ref<string[]>([])
const salvandoAcervo = ref(false)

function contar(c: string) {
  return (docs.value || []).filter(
    (d) => d.categoria === c && d.tipo !== CTF_TIPO
  ).length
}

const doCtf = computed(() => (docs.value || []).find((d) => d.tipo === CTF_TIPO) || null)

const listaCategoria = computed(() =>
  (docs.value || []).filter((d) => {
    if (d.categoria !== cat.value) return false
    if (d.tipo === CTF_TIPO) return false
    /* Os três do acervo têm subaba própria: não se repetem na lista geral. */
    if (cat.value === 'acervo') return false
    return true
  })
)

function vazio(): Linha {
  return {
    id: '', numero: '', emissao: '', vencimento: '', obs: '',
    arquivo: '', arquivoNome: '', temArquivo: false, nomeAtual: ''
  }
}

function montarLinhas() {
  const l = (docs.value || [])
    .filter((d) => d.categoria === 'acervo' && d.tipo === sub.value)
    .map<Linha>((d) => ({
      id: d.id,
      numero: d.numero || '',
      emissao: String(d.emissao || '').slice(0, 10),
      vencimento: String(d.vencimento || '').slice(0, 10),
      obs: d.obs || '',
      arquivo: '', arquivoNome: '',
      temArquivo: !!d.temArquivo,
      nomeAtual: d.arquivoNome || ''
    }))
  linhas.value = l.length ? l : [vazio()]
  remover.value = []
}

watch(sub, montarLinhas)

function nomeTransporte(id?: string) {
  const t = transportes.value.find((x) => x.id === id)
  return t ? t.tipo + (t.identificacao ? ' · ' + t.identificacao : '') : ''
}

async function carregar() {
  erro.value = ''
  try {
    const [d, t] = await Promise.all([
      server<Doc[]>('apiListarDocumentos'),
      /* Veículo é opcional aqui: sem ele a aba ainda funciona, só não mostra
         o vínculo. Falha nesta lista não pode derrubar a tela toda. */
      server<Transporte[]>('apiListarTransportes').catch(() => [] as Transporte[])
    ])
    docs.value = d || []
    transportes.value = t || []
    montarLinhas()
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a documentação'
  }
}

async function salvarAcervo() {
  const itens = linhas.value
    .filter((l) => l.numero || l.emissao || l.vencimento || l.obs || l.arquivo)
    .map((l) => ({
      id: l.id, numero: l.numero, emissao: l.emissao,
      vencimento: l.vencimento, obs: l.obs,
      arquivo: l.arquivo, arquivoNome: l.arquivoNome
    }))
  if (!itens.length && !remover.value.length) {
    ui.avisar('Nada para salvar', 'erro'); return
  }
  salvandoAcervo.value = true
  try {
    await server('apiSalvarAcervoLote', sub.value, itens, remover.value)
    ui.avisar('Acervo salvo ✔')
    await carregar()
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvandoAcervo.value = false
  }
}

function apagarLinha(i: number) {
  const l = linhas.value[i]
  if (l?.id) remover.value.push(l.id)
  linhas.value.splice(i, 1)
  if (!linhas.value.length) linhas.value.push(vazio())
}

async function excluirDoc(d: Doc) {
  if (!confirm('Excluir este documento?')) return
  try {
    await server('apiExcluirDocumento', d.id)
    ui.avisar('Excluído')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="docs === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Documentação</h2>
        <div class="meta">
          Guarde seus documentos e acompanhe os vencimentos. Tudo entra na Agenda.
        </div>
        <div v-if="cred.dados" class="meta">
          {{ cred.dados.docsContados }} documento(s) contando para o seu plano.
        </div>
      </div>

      <nav class="subnav">
        <button
          v-for="(rot, c) in ROTULO"
          :key="c"
          :class="{ active: cat === c }"
          @click="cat = c as 'acervo' | 'veiculo' | 'pessoal'"
        >
          <Icone :nome="ICONE[c]" :px="20" />
          <span>{{ rot }}</span>
          <span v-if="contar(c)" class="num">{{ contar(c) }}</span>
        </button>
      </nav>

      <!-- ───────── ACERVO ───────── -->
      <template v-if="cat === 'acervo'">
        <div class="subsub">
          <button
            v-for="s in ACERVO_SUB"
            :key="s"
            :class="{ on: sub === s }"
            @click="sub = s"
          >{{ s }}</button>
        </div>

        <div class="card">
          <div class="meta">{{ ACERVO_AJUDA[sub] }}</div>
          <div class="meta">
            Este bloco é opcional. Os campos marcados com * só valem se você
            começar a preencher o documento.
          </div>
        </div>

        <div v-for="(l, i) in linhas" :key="i" class="card linha-acv">
          <div class="cab">
            <b>{{ sub }} {{ i + 1 }}</b>
            <button class="ib" title="Remover" @click="apagarLinha(i)">🗑️</button>
          </div>

          <label>Número</label>
          <input v-model="l.numero" class="no-i18n" placeholder="Número do documento">

          <div class="two">
            <div><CampoData v-model="l.emissao" label="Emissão" /></div>
            <div><CampoData v-model="l.vencimento" label="Vencimento" /></div>
          </div>

          <CampoArquivo
            v-model:dados="l.arquivo"
            v-model:nome="l.arquivoNome"
            :doc-id="l.id"
            :tem-arquivo="l.temArquivo"
            :arquivo-nome="l.nomeAtual"
          />

          <label>Observações</label>
          <input v-model="l.obs">
        </div>

        <button class="btn sec" @click="linhas.push(vazio())">+ Acrescentar {{ sub }}</button>
        <button class="btn" :disabled="salvandoAcervo" @click="salvarAcervo">
          {{ salvandoAcervo ? 'Salvando…' : 'Salvar ' + sub }}
        </button>
      </template>

      <!-- ───────── VEÍCULOS E PESSOAL ───────── -->
      <template v-else>
        <NuxtLink v-if="cat === 'pessoal'" to="/ctf" class="card doc-linha click">
          <div class="grow">
            <b>📄 CTF — Cadastro Técnico Federal</b>
            <span
              class="doc-tag"
              :class="doCtf && statusVencimento(doCtf.vencimento)?.classe || 'venc'"
            >{{ doCtf ? (statusVencimento(doCtf.vencimento)?.texto || 'sem validade') : 'sem CTF' }}</span>
            <div class="meta">
              Fica em CAÇAR, com tela própria — é ele que libera o manejo.
            </div>
          </div>
          <div class="chev">›</div>
        </NuxtLink>

        <div v-if="!listaCategoria.length" class="card">
          <div class="meta">Nenhum documento cadastrado nesta seção.</div>
        </div>

        <div v-for="d in listaCategoria" :key="d.id" class="card doc-linha">
          <div class="grow">
            <b>{{ d.tipo }}</b>
            <span v-if="statusVencimento(d.vencimento)" class="doc-tag" :class="statusVencimento(d.vencimento)!.classe">
              {{ statusVencimento(d.vencimento)!.texto }}
            </span>
            <div class="meta no-i18n">
              {{ d.numero ? 'nº ' + d.numero : 'sem número' }}
              <template v-if="d.emissao"> · emitido {{ dataBR(d.emissao) }}</template>
              <template v-if="d.vencimento"> · vence {{ dataBR(d.vencimento) }}</template>
            </div>
            <div v-if="d.transporteId && nomeTransporte(d.transporteId)" class="meta no-i18n">
              🚗 {{ nomeTransporte(d.transporteId) }}
            </div>
            <div v-if="d.obs" class="meta no-i18n">{{ d.obs }}</div>
          </div>
          <NuxtLink
            :to="{ path: '/documento', query: { cat, id: d.id } }"
            class="ib"
            title="Editar"
          >✏️</NuxtLink>
          <button class="ib" title="Excluir" @click="excluirDoc(d)">🗑️</button>
        </div>

        <NuxtLink :to="{ path: '/documento', query: { cat } }" class="btn">
          + Novo documento
        </NuxtLink>
      </template>
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
  background: #fff; cursor: pointer; font-size: 12.5px; color: var(--txt);
}
.subnav button.active { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); font-weight: 700; }
.subnav .num { font-size: 10.5px; background: var(--verde); color: #fff; border-radius: 999px; padding: 0 6px; }

.subsub { display: flex; gap: 6px; margin-bottom: 10px; }
.subsub button {
  flex: 1; padding: 8px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: #fff; cursor: pointer; font-weight: 700; font-size: 13px; color: var(--txt);
}
.subsub button.on { border-color: var(--laranja); background: #fff1e8; color: var(--laranja-esc); }

.linha-acv .cab { display: flex; align-items: center; margin-bottom: 6px; }
.linha-acv .cab b { flex: 1; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px 6px; text-decoration: none; }

.doc-linha { display: flex; align-items: flex-start; gap: 8px; text-decoration: none; color: var(--txt); }
.doc-linha .grow { flex: 1; min-width: 0; }
.doc-linha .meta { margin: 3px 0 0; }
.doc-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.doc-tag.ok { background: var(--verde-claro); color: var(--verde-esc); }
.doc-tag.perto { background: #ffe9c7; color: #8a5a10; }
.doc-tag.venc { background: #ffdad3; color: #a33; }
.chev { font-size: 22px; color: var(--linha); }
.btn { text-decoration: none; }
</style>
