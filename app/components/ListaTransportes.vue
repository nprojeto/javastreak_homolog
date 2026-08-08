<script setup lang="ts">
/**
 * Lista de uma casa (garagem ou marina), com o formulário de cadastro.
 *
 * ⚠️ Um componente para as duas, e não duas telas parecidas. Elas só diferem
 * nos tipos aceitos e no rótulo — duplicar seria garantir que uma receba um
 * conserto que a outra não recebe.
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import { TIPOS, CASAS, casaDe } from '~/composables/useTransportes'
import type { Casa, Transporte } from '~/composables/useTransportes'

const props = defineProps<{ casa: Casa }>()

const { server } = useServer()
const ui = useUi()

const lista = ref<Transporte[] | null>(null)
const erro = ref('')

const form = ref(false)
const tipo = ref(TIPOS[props.casa][0] || '')
const identificacao = ref('')
const obs = ref('')
const foto = ref('')
const salvando = ref(false)

const info = computed(() => CASAS.find((c) => c.k === props.casa)!)
const daCasa = computed(() => (lista.value || []).filter((t) => casaDe(t.tipo) === props.casa))

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Transporte[]>('apiListarTransportes')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a lista'
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
  if (!tipo.value) { ui.avisar('Escolha o tipo', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarTransporte', {
      tipo: tipo.value, identificacao: identificacao.value, obs: obs.value,
      foto: foto.value, meio: props.casa === 'marina' ? 'maritimo' : 'terrestre'
    })
    ui.avisar('Salvo ✔')
    form.value = false; identificacao.value = ''; obs.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(t: Transporte) {
  if (!confirm('Excluir este item?')) return
  try {
    await server('apiExcluir', 'transporte', t.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div v-if="form" class="card">
        <label for="t_tipo">Tipo *</label>
        <select id="t_tipo" v-model="tipo">
          <option v-for="t in TIPOS[props.casa]" :key="t">{{ t }}</option>
        </select>

        <label for="t_id">Identificação</label>
        <input id="t_id" v-model="identificacao" class="no-i18n" placeholder="Placa, nome ou apelido">

        <label for="t_obs">Observações</label>
        <textarea id="t_obs" v-model="obs" class="no-i18n" />

        <label for="t_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="t_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <div v-if="!daCasa.length && !form" class="card vazio">
        <div class="big"><Icone :nome="info.ic" /></div>
        Nada cadastrado aqui ainda.
      </div>

      <div v-for="t in daCasa" :key="t.id" class="card item">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone :nome="info.ic" :px="26" /></div>
        <NuxtLink :to="{ path: '/transporte', query: { id: t.id } }" class="grow">
          <b class="no-i18n">{{ t.identificacao || t.tipo }}</b>
          <div class="meta"><span class="pill">{{ t.tipo }}</span></div>
          <div v-if="t.obs" class="meta no-i18n">{{ t.obs }}</div>
        </NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(t)">
          <Icone nome="excluir" />
        </button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Adicionar"
        chave="transportes"
        :quantidade="(lista || []).length"
        @criar="form = true"
      />
      <NuxtLink to="/manutencao" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big :deep(.ic-svg) { width: 42px; height: 42px; }
.item { display: flex; align-items: center; gap: 10px; }
.thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; }
.ic { width: 58px; height: 58px; border-radius: 10px; background: var(--carvao-3); display: flex; align-items: center; justify-content: center; flex: none; }
.item .grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.item .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; }
.ib { border: 0; background: none; cursor: pointer; padding: 4px; flex: none; }
.prev { max-width: 140px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
