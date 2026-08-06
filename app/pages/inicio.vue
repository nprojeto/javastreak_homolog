<script setup lang="ts">
/**
 * Tela inicial. Porte de VIEWS.inicio + carregarBlog + o alerta da agenda
 * (index.html, 8053).
 *
 * ⚠️ Lista vazia aqui é estado NORMAL, não erro: a homologação nasceu sem
 * artigo nenhum. O que não pode é a falha do servidor virar lista vazia — por
 * isso cada bloco tem o próprio estado de erro, visível.
 */
import { useAuth } from '~/stores/auth'
import { useCreditos } from '~/stores/creditos'
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

const auth = useAuth()
const cred = useCreditos()
const { server } = useServer()

interface ItemAgenda { id: string; proximaData?: string }
interface Artigo {
  id: string; titulo: string; autor: string; data: string; curtidas: number
}

const atrasadas = ref(0)
const proximas = ref(0)
const artigos = ref<Artigo[] | null>(null)
const erroArtigos = ref('')

const primeiroNome = computed(() => (auth.nome || '').split(' ')[0] || '')

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

onMounted(async () => {
  const h = hoje()
  try {
    const itens = await server<ItemAgenda[]>('apiAgenda')
    const datas = (itens || [])
      .map((i) => String(i.proximaData || '').slice(0, 10))
      .filter(Boolean)
    atrasadas.value = datas.filter((d) => d < h).length
    proximas.value = datas.filter(
      (d) => d >= h && (new Date(d).getTime() - new Date(h).getTime()) / 864e5 <= 7
    ).length
  } catch {
    /* Sem agenda o resto da tela continua útil. */
  }

  try {
    artigos.value = await server<Artigo[]>('apiListarArtigos')
  } catch (e) {
    erroArtigos.value = e instanceof Error ? e.message : 'Erro ao carregar artigos'
  }
})
</script>

<template>
  <div>
    <div class="card hero">
      <h2>Bem-vindo{{ primeiroNome ? ', ' + primeiroNome : '' }}</h2>
      <div class="meta">Registre, acompanhe e comprove o seu manejo.</div>
    </div>

    <div
      v-if="atrasadas || proximas"
      class="card alerta"
      :class="{ vermelho: atrasadas > 0 }"
    >
      <h3>📅 Lembrete da agenda</h3>
      <div class="meta">
        <b v-if="atrasadas" class="atr">{{ atrasadas }} atrasada(s)</b>
        <span v-if="atrasadas && proximas"> · </span>
        <span v-if="proximas">{{ proximas }} nos próximos 7 dias</span>.
      </div>
      <NuxtLink to="/agenda" class="btn sm sec">Abrir agenda</NuxtLink>
    </div>

    <NuxtLink to="/agenda" class="card menu-card">
      <Icone nome="calendario" :px="34" />
      <div class="txt">
        <h3>Agenda</h3>
        <p>Saúde de cães e cavalos, manutenção e vencimento de documentos</p>
      </div>
      <div class="chev">›</div>
    </NuxtLink>

    <div v-if="cred.dados?.promoAtiva && cred.dados.chave" class="card indic">
      <h3>Indique e ganhe</h3>
      <div class="meta">
        A cada amigo que confirmar o e-mail com a sua chave, você ganha
        <b>{{ cred.dados.promoDias }} dias</b> do plano Mateiro.
      </div>
      <div class="chave">{{ cred.dados.chave }}</div>
    </div>

    <div class="card">
      <h3>📰 Artigos</h3>
      <div v-if="erroArtigos" class="meta erro">{{ erroArtigos }}</div>
      <div v-else-if="artigos === null" class="meta">Carregando…</div>
      <div v-else-if="!artigos.length" class="meta">
        Nenhum artigo publicado ainda. Em breve teremos leituras por aqui.
      </div>
      <template v-else>
        <div class="meta">Do mais recente para o mais antigo.</div>
        <div class="blog-lista">
          <div v-for="a in artigos" :key="a.id" class="blog-item">
            <div class="bi-tit">{{ a.titulo }}</div>
            <div class="bi-meta">
              <span>✍️ {{ a.autor || 'Redação' }}</span>
              <span>{{ dataBR(a.data) }}</span>
              <span v-if="a.curtidas">👍 {{ a.curtidas }}</span>
            </div>
          </div>
        </div>
        <div class="meta rodape">A leitura do artigo chega no lote 2b.</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.alerta { border-left: 5px solid var(--alerta); }
.alerta.vermelho { border-left-color: var(--danger); }
.alerta h3 { margin: 0 0 4px; }
.atr { color: var(--danger); }
.alerta .btn { margin-top: 8px; width: auto; text-decoration: none; }
.menu-card { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--txt); }
.menu-card .txt { flex: 1; }
.menu-card h3 { margin: 0 0 2px; }
.menu-card p { margin: 0; font-size: 12.5px; color: #7a7466; }
.chev { font-size: 22px; color: var(--linha); }
.indic { border-left: 5px solid var(--laranja); }
.indic h3 { margin: 0 0 4px; }
.chave { font-family: monospace; font-size: 18px; letter-spacing: 2px; color: var(--laranja-esc); margin-top: 8px; }
.blog-lista { margin-top: 6px; }
.blog-item { padding: 10px 0; border-top: 1px solid var(--linha); }
.bi-tit { font-weight: 600; font-size: 14.5px; }
.bi-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #7a7466; margin-top: 3px; }
.erro { color: var(--danger); }
.rodape { margin-top: 8px; }
</style>
