<script setup lang="ts">
/**
 * Saúde animal — o portal do legado (VIEWS.saudeAnimal, index.html 8360).
 *
 * ⚠️ Existe por uma razão de organização, não de tela: para quem usa,
 * **animal é saúde e veículo é manutenção**. O cavalo viajar pela mesma tabela
 * `transportes` do carro é detalhe de implementação — quem cuida do cavalo
 * procura aqui, ao lado do cão.
 */
definePageMeta({ layout: 'app' })

interface Canil { id: string; qtdCaes?: number }
interface Transporte { id: string; tipo?: string }

const { server } = useServer()
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
    <CartaoModulo
      icone="canil"
      titulo="CANIL"
      descricao="Cães: matilha, saúde e vacinas"
      para="/canis"
      :selo="carregando ? undefined : totalCaes + ' cão(es)'"
      selo-tipo="ok"
    />
    <CartaoModulo
      icone="ferradura"
      titulo="HARAS"
      descricao="Cavalos: saúde, vacinas e casqueamento"
      para="/haras"
      :selo="carregando ? undefined : cavalos.length + ' cavalo(s)'"
      selo-tipo="ok"
    />
  </div>
</template>
