<script setup lang="ts">
/**
 * Promoções relâmpago. Porte de VIEWS.promocoes (index.html, 7050).
 *
 * Manejador vê as ofertas por perto; empresa vê as suas e lança novas.
 * O alcance e a quantidade por dia vêm do plano da empresa.
 */
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Promo {
  id: string; autorId?: string; autorNome?: string; fotoUrl?: string
  descricao?: string; precoAtual?: string; precoPromo?: string
  expiraEm?: string; criadoEm?: string; distKm?: number | null
}
interface PodeLancar {
  pode: boolean; motivo?: string; restantes?: number; raioMax?: number; semPlano?: boolean
}

const auth = useAuth()
const ui = useUi()
const { server } = useServer()

const recebe = ref(true)
const promos = ref<Promo[] | null>(null)
const minhas = ref<Promo[]>([])
const pode = ref<PodeLancar | null>(null)
const erro = ref('')

const form = ref(false)
const descricao = ref('')
const precoAtual = ref('')
const precoPromo = ref('')
const raio = ref(50)
const foto = ref('')
const salvando = ref(false)

const ehEmpresa = computed(() => auth.tipo === 'empresa')

function restam(iso?: string) {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'encerrada'
  const h = Math.floor(ms / 3600000)
  return h >= 1 ? 'acaba em ' + h + 'h' : 'acaba em ' + Math.ceil(ms / 60000) + 'min'
}

async function carregar() {
  erro.value = ''
  try {
    const r = await server<{ recebe: boolean; promos: Promo[] }>('apiPromocoes')
    recebe.value = r.recebe
    promos.value = r.promos || []
    if (ehEmpresa.value) {
      minhas.value = await server<Promo[]>('apiMinhasPromocoes').catch(() => [])
      pode.value = await server<PodeLancar>('apiPodeLancarPromo').catch(() => null)
      if (pode.value?.raioMax) raio.value = Math.min(raio.value, pode.value.raioMax)
    }
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as promoções'
  }
}

async function alternarRecebe() {
  try {
    await server('apiSetRecebePromos', !recebe.value)
    recebe.value = !recebe.value
    await carregar()
  } catch { /* já avisado */ }
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

async function lancar() {
  if (!descricao.value) { ui.avisar('Descreva a oferta', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarPromocao', {
      descricao: descricao.value, precoAtual: precoAtual.value,
      precoPromo: precoPromo.value, raioKm: String(raio.value),
      alvoPerfil: 'Todos', foto: foto.value
    })
    ui.avisar('Promoção no ar ✔')
    form.value = false; descricao.value = ''; precoAtual.value = ''; precoPromo.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(p: Promo) {
  if (!confirm('Encerrar esta promoção?')) return
  try {
    await server('apiExcluirPromocao', p.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="promos === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Promoções relâmpago</h2>
        <div class="meta">
          Ofertas com validade curta das lojas parceiras da sua região.
        </div>
      </div>

      <!-- ───── EMPRESA ───── -->
      <template v-if="ehEmpresa">
        <div v-if="pode && !pode.pode" class="card travado">
          <div class="meta">🔒 {{ pode.motivo }}</div>
          <NuxtLink v-if="pode.semPlano" to="/planos" class="btn sec">Ver planos</NuxtLink>
        </div>

        <div v-if="form" class="card">
          <label for="p_desc">O que está em oferta *</label>
          <textarea id="p_desc" v-model="descricao" class="no-i18n" placeholder="Ex: Ração X, 20 kg" />

          <div class="two">
            <div>
              <label for="p_de">Preço normal</label>
              <input id="p_de" v-model="precoAtual" inputmode="decimal">
            </div>
            <div>
              <label for="p_por">Preço promocional</label>
              <input id="p_por" v-model="precoPromo" inputmode="decimal">
            </div>
          </div>

          <label for="p_raio">Alcance: {{ raio }} km</label>
          <input
            id="p_raio"
            v-model.number="raio"
            type="range"
            min="1"
            :max="pode?.raioMax || 200"
          >

          <label for="p_foto">Foto</label>
          <img v-if="foto" :src="foto" class="prev" alt="Prévia">
          <input id="p_foto" type="file" accept="image/*" @change="escolheuFoto">

          <button class="btn" :disabled="salvando" @click="lancar">
            {{ salvando ? 'Publicando…' : 'Publicar promoção' }}
          </button>
          <button class="btn sec" @click="form = false">Cancelar</button>
        </div>

        <button v-else-if="pode?.pode" class="btn" @click="form = true">
          ⚡ Lançar promoção
          <template v-if="pode.restantes"> ({{ pode.restantes }} hoje)</template>
        </button>

        <template v-if="minhas.length">
          <h3 class="sec">No ar agora</h3>
          <div v-for="p in minhas" :key="p.id" class="card promo">
            <img v-if="p.fotoUrl" :src="String(p.fotoUrl)" class="foto" alt="">
            <div class="corpo">
              <div class="no-i18n">{{ p.descricao }}</div>
              <div class="meta">{{ restam(p.expiraEm) }}</div>
              <button class="btn sm sec" @click="excluir(p)">Encerrar</button>
            </div>
          </div>
        </template>
      </template>

      <!-- ───── MANEJADOR ───── -->
      <template v-else>
        <div class="card">
          <div class="meta">
            {{ recebe ? 'Você está recebendo promoções.' : 'Você desligou as promoções.' }}
          </div>
          <button class="btn sec" @click="alternarRecebe">
            {{ recebe ? 'Não quero receber' : 'Quero receber' }}
          </button>
        </div>
      </template>

      <template v-if="recebe">
        <h3 v-if="ehEmpresa" class="sec">De outras lojas</h3>
        <div v-if="!promos.length" class="card vazio">
          <div class="big">⚡</div>
          Nenhuma promoção no ar agora.
        </div>

        <div v-for="p in promos" :key="p.id" class="card promo">
          <img v-if="p.fotoUrl" :src="String(p.fotoUrl)" class="foto" alt="">
          <div class="corpo">
            <b class="no-i18n">{{ p.autorNome }}</b>
            <div class="no-i18n desc">{{ p.descricao }}</div>
            <div v-if="p.precoPromo" class="precos no-i18n">
              <s v-if="p.precoAtual">R$ {{ p.precoAtual }}</s>
              <b>R$ {{ p.precoPromo }}</b>
            </div>
            <div class="meta">
              {{ restam(p.expiraEm) }}
              <template v-if="p.distKm != null">
                · {{ p.distKm.toFixed(0) }} km de você
              </template>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--laranja); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.travado { border-left: 5px solid var(--alerta); }
.travado .btn { margin-top: 8px; text-decoration: none; }
.sec { margin: 14px 4px 6px; font-size: 15px; }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.promo { padding: 0; overflow: hidden; }
.foto { width: 100%; display: block; max-height: 200px; object-fit: cover; }
.corpo { padding: 12px 14px; }
.desc { font-size: 14px; margin: 4px 0; }
.precos { margin: 6px 0; }
.precos s { color: #8a8577; margin-right: 8px; }
.precos b { color: var(--laranja); font-size: 18px; }
.corpo .btn { width: auto; margin-top: 8px; }
.prev { max-width: 160px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; }
</style>
