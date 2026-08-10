<script setup lang="ts">
/**
 * Haras — os cavalos. Vive sob Saúde animal, não sob Manutenção.
 *
 * ⚠️ O cavalo continua sendo uma linha em `transportes`, distinguido pelo
 * tipo. Isso é modelo de banco, e mudar exigiria migração sem ganho nenhum.
 * O que a pessoa vê é que ele está com os cães, junto do que se vacina — e é
 * isso que precisa estar certo.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Transporte } from '~/composables/useTransportes'

definePageMeta({ layout: 'app' })

const { server } = useServer()
const ui = useUi()

const lista = ref<Transporte[] | null>(null)
const erro = ref('')

const form = ref(false)
const identificacao = ref('')
const nasc = ref('')
const obs = ref('')
const foto = ref('')
const salvando = ref(false)

const cavalos = computed(() =>
  (lista.value || []).filter((t) => String(t.tipo) === 'Cavalo')
)

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Transporte[]>('apiListarTransportes')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os cavalos'
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
  if (!identificacao.value) { ui.avisar('Informe o nome do cavalo', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarTransporte', {
      tipo: 'Cavalo', identificacao: identificacao.value,
      dataNascimento: nasc.value, obs: obs.value, foto: foto.value, meio: 'aras'
    })
    ui.avisar('Cavalo salvo ✔')
    form.value = false
    identificacao.value = ''; nasc.value = ''; obs.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(t: Transporte) {
  if (!confirm('Excluir este cavalo?')) return
  try {
    await server('apiExcluir', 'transporte', t.id)
    await carregar()
  } catch { /* já avisado */ }
}

function idade(iso?: string) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const anos = Math.floor((Date.now() - d.getTime()) / 31557600000)
  return anos ? anos + ' ano(s)' : 'menos de 1 ano'
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <TituloTela titulo="Haras" descricao="Cavalos: saúde, vacinas e casqueamento." />


      <div v-if="!cavalos.length && !form" class="card vazio">
        <div class="big"><Icone nome="ferradura" /></div>
        Nenhum cavalo cadastrado.
      </div>

      <div v-for="t in cavalos" :key="t.id" class="card item">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone nome="ferradura" :px="26" /></div>
        <NuxtLink :to="{ path: '/transporte', query: { id: t.id } }" class="grow">
          <b class="no-i18n">{{ t.identificacao || 'Cavalo' }}</b>
          <div v-if="idade(t.dataNascimento)" class="meta">{{ idade(t.dataNascimento) }}</div>
          <div v-if="t.obs" class="meta no-i18n">{{ t.obs }}</div>
        </NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(t)">
          <Icone nome="excluir" />
        </button>
      </div>

      <!-- Fica AQUI, junto do botão que o abre: declarado antes da lista,
           ele abria fora da tela em qualquer lista com alguns itens. -->
      <div v-if="form" class="card form-novo">
        <h3>Novo cavalo</h3>
        <label for="h_nome">Nome do cavalo *</label>
        <input id="h_nome" v-model="identificacao" class="no-i18n">
        <CampoData v-model="nasc" label="Data de nascimento" />
        <label for="h_obs">Observações</label>
        <textarea id="h_obs" v-model="obs" class="no-i18n" />
        <label for="h_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="h_foto" type="file" accept="image/*" @change="escolheuFoto">
        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar cavalo' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Novo cavalo"
        chave="transportes"
        :quantidade="(lista || []).length"
        @criar="form = true"
      />
      <NuxtLink to="/saude-animal" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
/* O formulário de cadastro, agora ao pé da lista. */
.form-novo { border-left: 4px solid var(--laranja); }
.form-novo h3 { margin: 0 0 10px; font-size: 15px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big :deep(.ic-svg) { width: 42px; height: 42px; }
.item { display: flex; align-items: center; gap: 10px; }
.thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; }
.ic { width: 58px; height: 58px; border-radius: 10px; background: var(--carvao-3); display: flex; align-items: center; justify-content: center; flex: none; }
.item .grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.item .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; cursor: pointer; padding: 4px; flex: none; }
.prev { max-width: 140px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
