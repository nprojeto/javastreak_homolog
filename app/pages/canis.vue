<script setup lang="ts">
/**
 * Canis. Porte de VIEWS.caes + canilForm (index.html, 9180).
 *
 * ⚠️ Coordenada é obrigatória e o servidor recusa (0,0): o zero é o que sobra
 * quando o campo vem vazio, e jogaria o pino no meio do Atlântico.
 */
import { useUi } from '~/stores/ui'

definePageMeta({ layout: 'app' })

export interface Canil {
  id: string; nome?: string; lat?: number | string; lng?: number | string
  obs?: string; qtdCaes?: number
}

const { server } = useServer()
const ui = useUi()

const lista = ref<Canil[] | null>(null)
const erro = ref('')
const form = ref(false)
const nome = ref('')
const lat = ref('')
const lng = ref('')
const obs = ref('')
const salvando = ref(false)

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Canil[]>('apiListarCanis')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar os canis'
  }
}

async function salvar() {
  if (!nome.value) { ui.avisar('Informe o nome do canil', 'erro'); return }
  if (!lat.value || !lng.value) { ui.avisar('Informe a localização do canil', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarCanil', { nome: nome.value, lat: lat.value, lng: lng.value, obs: obs.value })
    ui.avisar('Canil salvo ✔')
    form.value = false; nome.value = ''; lat.value = ''; lng.value = ''; obs.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function excluir(k: Canil) {
  if (!confirm('Excluir este canil?')) return
  try {
    await server('apiExcluir', 'canil', k.id)
    ui.avisar('Excluído')
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
      <TituloTela titulo="Cães" descricao="Seus canis e a matilha de cada um." />


      <div v-if="!lista.length && !form" class="card vazio">
        <div class="big"><Icone nome="canil" /></div>
        Nenhum canil cadastrado.
      </div>

      <div v-for="k in lista" :key="k.id" class="card canil">
        <NuxtLink :to="{ path: '/canil', query: { id: k.id } }" class="grow">
          <b class="no-i18n"><Icone nome="canil" /> {{ k.nome || 'Canil' }}</b>
          <div class="meta">{{ k.qtdCaes || 0 }} cão(es)</div>
          <div v-if="k.obs" class="meta no-i18n">{{ k.obs }}</div>
        </NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(k)"><Icone nome="excluir" /></button>
      </div>

      <!-- Fica AQUI, junto do botão que o abre: declarado antes da lista,
           ele abria fora da tela em qualquer lista com alguns itens. -->
      <div v-if="form" class="card form-novo">
        <h3>Novo canil</h3>
        <label for="k_nome">Nome do canil *</label>
        <input id="k_nome" v-model="nome" class="no-i18n" placeholder="Ex: Canil da sede">
        <BotaoGps v-model:lat="lat" v-model:lng="lng" />
        <label for="k_obs">Observações</label>
        <textarea id="k_obs" v-model="obs" class="no-i18n" />
        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar canil' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Novo canil"
        chave="canis"
        :quantidade="lista.length"
        @criar="form = true"
      />
    </template>
  </div>
</template>

<style scoped>
/* O formulário de cadastro, agora ao pé da lista. */
.form-novo { border-left: 4px solid var(--laranja); }
.form-novo h3 { margin: 0 0 10px; font-size: 15px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.canil { display: flex; align-items: center; gap: 8px; }
.canil .grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.canil .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.btn.sec { margin-top: 8px; }
</style>
