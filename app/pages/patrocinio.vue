<script setup lang="ts">
/**
 * Patrocínio — a empresa propõe, o administrador decide.
 * Porte de apiCriarPatrocinio / apiMeusPatrocinios / apiCancelarPatrocinio.
 *
 * ⚠️ O tempo no ar NÃO é escolhido pela empresa: quem define é o
 * administrador na hora de publicar. A tela diz isso, para a proposta não
 * chegar com uma expectativa que o servidor não cumpre.
 *
 * ⚠️ Dois tipos, e cada um exige um campo diferente: destaque exige o produto,
 * prêmio do ranking exige o prêmio. O servidor recusa sem eles.
 */
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Patrocinio {
  id: string; tipo: string; titulo?: string; produto?: string; premio?: string
  descricao?: string; status: string; criadoEm?: string; fim?: string
  obs?: string; fotoUrl?: string
}

const STATUS: Record<string, string> = {
  fila: 'Na fila', no_ar: 'No ar', encerrado: 'Encerrado', recusado: 'Recusado'
}

const auth = useAuth()
const ui = useUi()
const { server } = useServer()

const lista = ref<Patrocinio[] | null>(null)
const erro = ref('')

const form = ref(false)
const tipo = ref<'destaque' | 'ranking'>('destaque')
const titulo = ref('')
const produto = ref('')
const premio = ref('')
const descricao = ref('')
const foto = ref('')
const enviando = ref(false)

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Patrocinio[]>('apiMeusPatrocinios')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os patrocínios'
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

async function enviar() {
  if (!titulo.value) { ui.avisar('Informe o título que vai aparecer no destaque', 'erro'); return }
  if (tipo.value === 'destaque' && !produto.value) {
    ui.avisar('Informe o produto ou serviço que será destacado', 'erro'); return
  }
  if (tipo.value === 'ranking' && !premio.value) {
    ui.avisar('Informe qual prêmio você quer oferecer ao 1º do ranking', 'erro'); return
  }
  enviando.value = true
  try {
    await server('apiCriarPatrocinio', {
      tipo: tipo.value, titulo: titulo.value, produto: produto.value,
      premio: premio.value, descricao: descricao.value, foto: foto.value
    })
    ui.avisar('Proposta enviada ✔ O administrador vai avaliar.')
    form.value = false
    titulo.value = ''; produto.value = ''; premio.value = ''; descricao.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    enviando.value = false
  }
}

async function cancelar(p: Patrocinio) {
  if (!confirm('Cancelar esta proposta?')) return
  try {
    await server('apiCancelarPatrocinio', p.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="auth.tipo !== 'empresa'" class="card">
      <div class="meta"><Icone nome="bloqueio" /> Patrocínio é para contas de empresa.</div>
    </div>

    <template v-else>
      <div class="card hero">
        <h2>Patrocínio</h2>
        <div class="meta">
          Apareça no cartão de destaque da plataforma ou premie o 1º do ranking
          de troféus. Você propõe; o administrador avalia e decide por quantos
          dias fica no ar.
        </div>
      </div>

      <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>

      <div v-if="form" class="card">
        <label for="pt_tipo">O que você quer patrocinar *</label>
        <select id="pt_tipo" v-model="tipo">
          <option value="destaque">Destaque na lateral</option>
          <option value="ranking">Prêmio do ranking</option>
        </select>

        <label for="pt_tit">Título do destaque *</label>
        <input id="pt_tit" v-model="titulo" class="no-i18n" placeholder="O que aparece em letra grande">

        <template v-if="tipo === 'destaque'">
          <label for="pt_prod">Produto ou serviço destacado *</label>
          <input id="pt_prod" v-model="produto" class="no-i18n">
        </template>
        <template v-else>
          <label for="pt_prem">Prêmio para o 1º do ranking *</label>
          <input id="pt_prem" v-model="premio" class="no-i18n" placeholder="Ex: uma faca de caça">
        </template>

        <label for="pt_desc">Descrição</label>
        <textarea id="pt_desc" v-model="descricao" class="no-i18n" />

        <label for="pt_foto">Imagem</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="pt_foto" type="file" accept="image/*" @change="escolheuFoto">

        <div class="meta">
          O tempo no ar é definido pelo administrador ao publicar.
        </div>

        <button class="btn" :disabled="enviando" @click="enviar">
          {{ enviando ? 'Enviando…' : 'Enviar proposta' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <div v-if="lista === null" class="card"><div class="meta">Carregando…</div></div>
      <div v-else-if="!lista.length && !form" class="card vazio">
        <div class="big"><Icone nome="patrocinio" /></div>
        Nenhuma proposta enviada ainda.
      </div>

      <div v-for="p in lista || []" :key="p.id" class="card prop">
        <div class="topo">
          <b class="no-i18n">{{ p.titulo }}</b>
          <span class="pill" :class="p.status === 'no_ar' ? 'ok' : (p.status === 'recusado' ? 'dan' : 'warn')">
            {{ STATUS[p.status] || p.status }}
          </span>
        </div>
        <div class="meta">
          {{ p.tipo === 'ranking' ? 'Prêmio do ranking' : 'Destaque na lateral' }}
          · {{ dataBR(p.criadoEm) }}
        </div>
        <div v-if="p.premio" class="meta no-i18n">{{ p.premio }}</div>
        <div v-if="p.produto" class="meta no-i18n">{{ p.produto }}</div>
        <div v-if="p.fim" class="meta">no ar até {{ dataBR(p.fim) }}</div>
        <div v-if="p.obs" class="meta ruim no-i18n">{{ p.obs }}</div>

        <button v-if="p.status === 'fila'" class="btn sm sec" @click="cancelar(p)">
          Cancelar proposta
        </button>
      </div>

      <button v-if="!form" class="btn" @click="form = true">＋ Propor patrocínio</button>
      <NuxtLink to="/empresa" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.hero { border-left: 3px solid var(--laranja); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big :deep(.ic-svg) { width: 42px; height: 42px; }
.topo { display: flex; align-items: center; gap: 8px; }
.topo b { flex: 1; }
.prop .meta { margin: 3px 0 0; }
.pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; }
.prev { max-width: 160px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.prop .btn { width: auto; margin-top: 10px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
