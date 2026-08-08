<script setup lang="ts">
/**
 * Saúde animal — o portal do legado (VIEWS.saudeAnimal, index.html 8360).
 * Dois cartões: CANIL e HARAS.
 *
 * ⚠️ Existe por uma razão de organização, não de tela: para quem usa,
 * **animal é saúde e veículo é manutenção**. O cavalo viajar pela mesma tabela
 * `transportes` do carro é detalhe de implementação — e foi por seguir esse
 * detalhe que eu tinha jogado o haras dentro da Manutenção, ao lado de barco e
 * quadriciclo. Quem cuida do cavalo procura em Saúde animal.
 */
import { useCreditos } from '~/stores/creditos'

definePageMeta({ layout: 'app' })

interface Canil { id: string; qtdCaes?: number }
interface Transporte { id: string; tipo?: string }

const { server } = useServer()
const cred = useCreditos()

const canis = ref<Canil[]>([])
const cavalos = ref<Transporte[]>([])
const carregando = ref(true)

const totalCaes = computed(() =>
  canis.value.reduce((s, k) => s + (Number(k.qtdCaes) || 0), 0)
)

onMounted(async () => {
  const [k, t] = await Promise.all([
    server<Canil[]>('apiListarCanis').catch(() => [] as Canil[]),
    server<Transporte[]>('apiListarTransportes').catch(() => [] as Transporte[])
  ])
  canis.value = k || []
  cavalos.value = (t || []).filter((x) => String(x.tipo) === 'Cavalo')
  carregando.value = false
})
</script>

<template>
  <div>
    <div class="card hero">
      <h2>Saúde animal</h2>
      <div class="meta">
        Cães e cavalos, com vacinas, retornos e vencimentos entrando na Agenda.
      </div>
    </div>

    <NuxtLink to="/canis" class="card menu-card">
      <span class="ic"><Icone nome="canil" :px="34" /></span>
      <div class="txt">
        <h3>Canil</h3>
        <p>Cães: matilha, saúde e vacinas</p>
        <div v-if="!carregando" class="meta">
          {{ canis.length }} canil(is) · {{ totalCaes }} cão(es)
        </div>
      </div>
      <div class="chev">›</div>
    </NuxtLink>

    <NuxtLink to="/haras" class="card menu-card">
      <span class="ic"><Icone nome="ferradura" :px="34" /></span>
      <div class="txt">
        <h3>Haras</h3>
        <p>Cavalos: saúde, vacinas e casqueamento</p>
        <div v-if="!carregando" class="meta">{{ cavalos.length }} cavalo(s)</div>
      </div>
      <div class="chev">›</div>
    </NuxtLink>

    <div v-if="cred.dados && cred.dados.limites?.canis === 0" class="card travado">
      <div class="meta">
        <Icone nome="bloqueio" /> Seu plano não inclui canil. O haras continua
        disponível.
      </div>
      <NuxtLink to="/planos" class="btn sec">Ver planos</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.hero { border-left: 3px solid var(--laranja); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.menu-card { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--txt); }
.menu-card .ic { display: flex; flex: none; }
.menu-card .txt { flex: 1; min-width: 0; }
.menu-card h3 { margin: 0 0 2px; font-size: 15px; }
.menu-card p { margin: 0; font-size: 12.5px; color: var(--osso-2); }
.menu-card .meta { margin-top: 4px; }
.chev { font-size: 22px; color: var(--linha); }
.travado { border-left: 3px solid var(--alerta); }
.travado .btn { margin-top: 8px; text-decoration: none; }
</style>
