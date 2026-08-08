<script setup lang="ts">
/**
 * Nova rota. Porte de VIEWS.rotaForm + comecarDesenho + salvarDesenho
 * (index.html, 8592 / 9112 / 9176).
 *
 * O legado separava em duas telas — dados e depois mapa — com o estado
 * atravessando as duas num `DRAW` global. Aqui é uma tela só: os dados ficam
 * em cima e o mapa aparece quando a propriedade escolhida é válida.
 *
 * ⚠️ As marcações são criadas UMA A UMA depois da rota, em sequência. Não é
 * capricho: cada `apiCriarMarcacao` é uma gravação, e o backend exige que
 * toda leitura de uma função aconteça antes da primeira gravação dela.
 */
import { useUi } from '~/stores/ui'
import type { Ponto } from '~/composables/useMapa'
import type { Marca } from '~/components/MapaRota.vue'
import type { Propriedade } from '~/pages/propriedades.vue'
import { useCreditos } from '~/stores/creditos'

definePageMeta({ layout: 'app' })

interface Transporte { id: string; tipo: string; identificacao?: string; meio?: string }

const router = useRouter()
const { server } = useServer()
const ui = useUi()
const cred = useCreditos()

/** Teto de marcações do plano. `undefined` enquanto os créditos não chegam. */
const limiteMarcas = computed(() => cred.dados?.limites?.marcacoesPorRota)

const props_ = ref<Propriedade[]>([])
const transportes = ref<Transporte[]>([])
const erro = ref('')
const pronto = ref(false)

const nome = ref('')
const propId = ref('')
const transporte = ref('')
const pontos = ref<Ponto[]>([])
const marcas = ref<Marca[]>([])
const salvando = ref(false)

const prop = computed(() => props_.value.find((p) => p.id === propId.value) || null)

const avisoProp = computed(() => {
  const p = prop.value
  if (!p) return { texto: '', ok: false }
  if (!p.temLimite) {
    return { texto: 'Esta propriedade não tem limite desenhado e não pode receber rota.', ok: false }
  }
  if (!p.regular) {
    return { texto: 'Esta propriedade está irregular (autorização vencida ou faltando) e não pode receber rota.', ok: false }
  }
  return { texto: 'A rota inteira precisa ficar dentro do limite desenhado desta propriedade.', ok: true }
})

const podeDesenhar = computed(() => !!prop.value && avisoProp.value.ok)

const opcoesTransporte = computed(() => {
  const f = transportes.value.filter((t) => String(t.meio || 'terrestre') !== 'maritimo')
  const nomes = f.map((t) => t.tipo + (t.identificacao ? ' - ' + t.identificacao : ''))
  /* Sempre cabe ir a pé: sem isto, quem não tem veículo não criava rota. */
  return nomes.concat(['A pé', 'Outros'])
})

const distancia = computed(() => {
  let d = 0
  for (let i = 1; i < pontos.value.length; i++) {
    const a = pontos.value[i - 1]!, b = pontos.value[i]!
    const dLat = (b.lat - a.lat) * 110574
    const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180)
    d += Math.sqrt(dLat * dLat + dLng * dLng)
  }
  return Math.round(d)
})

onMounted(async () => {
  try {
    const [p, t] = await Promise.all([
      server<Propriedade[]>('apiListarPropriedades'),
      server<Transporte[]>('apiListarTransportes').catch(() => [] as Transporte[])
    ])
    props_.value = p || []
    transportes.value = t || []
    pronto.value = true
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o formulário'
  }
})

async function salvar() {
  if (!nome.value) { ui.avisar('Informe o nome da rota', 'erro'); return }
  if (!prop.value) { ui.avisar('Escolha a propriedade onde fica esta rota', 'erro'); return }
  if (!avisoProp.value.ok) { ui.avisar(avisoProp.value.texto, 'erro'); return }
  if (pontos.value.length < 2) { ui.avisar('Marque ao menos 2 pontos no traçado', 'erro'); return }

  salvando.value = true
  try {
    const rota = await server<{ id: string }>('apiCriarRota', {
      origem: 'manual', nome: nome.value, propriedadeId: prop.value.id,
      tipoTransporte: transporte.value, modalidade: 'manejo',
      pontos: pontos.value, distancia: distancia.value
    })
    /* ⚠️ A rota JÁ ESTÁ SALVA neste ponto. Se uma marcação falhar, não dá
       para fingir que nada aconteceu nem para desfazer — o certo é contar o
       que entrou e o que não entrou. Antes o erro abortava tudo, e nem o aviso
       de sucesso aparecia: parecia que a rota não tinha sido salva. */
    let falharam = 0
    for (const m of marcas.value) {
      try {
        await server('apiCriarMarcacao', {
          rotaId: rota.id, tipo: m.tipo, lat: m.lat, lng: m.lng,
          descricao: m.descricao || '', subtipo: m.subtipo || '', status: m.status || ''
        })
      } catch {
        falharam++
      }
    }
    ui.avisar(
      falharam
        ? 'Rota salva, mas ' + falharam + ' marcação(ões) não entraram'
        : 'Rota salva ✔',
      falharam ? 'erro' : 'info'
    )
    await router.push('/rotas')
  } catch { /* o useServer já avisou, traduzido */ } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <TituloTela titulo="Nova rota" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!pronto" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3>Criar nova rota</h3>

        <label for="r_nome">Nome da rota *</label>
        <input id="r_nome" v-model="nome" class="no-i18n" placeholder="Ex: Contorno da mata">

        <label for="r_prop">Propriedade *</label>
        <select id="r_prop" v-model="propId">
          <option value="">— escolha a propriedade —</option>
          <option v-for="p in props_" :key="p.id" :value="p.id">
            {{ p.nome }}{{ p.regular ? '' : (p.temLimite ? ' (irregular)' : ' (sem limite)') }}
          </option>
        </select>
        <div
          v-if="avisoProp.texto"
          class="meta aviso"
          :class="avisoProp.ok ? 'bom' : 'ruim'"
        >
          <template v-if="avisoProp.ok">✔</template>
          <Icone v-else nome="alerta" />
          {{ avisoProp.texto }}
        </div>

        <label for="r_transp">Tipo de transporte</label>
        <select id="r_transp" v-model="transporte">
          <option value="">— selecione —</option>
          <option v-for="t in opcoesTransporte" :key="t">{{ t }}</option>
        </select>
      </div>

      <div v-if="podeDesenhar && prop" class="card">
        <h3><Icone nome="mapa" /> Marcar no mapa</h3>
        <ClientOnly>
          <MapaRota
            v-model:pontos="pontos"
            v-model:marcas="marcas"
            :limite="prop.limite"
            :nome-prop="prop.nome"
            :limite-marcas="limiteMarcas"
          />
        </ClientOnly>
      </div>

      <div class="card">
        <button class="btn" :disabled="salvando" @click="salvar">
          <template v-if="salvando">Salvando…</template>
          <template v-else><Icone nome="salvar" /> Salvar rota</template>
        </button>
        <NuxtLink to="/rotas" class="btn sec">Cancelar</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 8px; }
.ruim { color: var(--danger); }
.bom { color: var(--ok); }
.aviso { margin: -4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
