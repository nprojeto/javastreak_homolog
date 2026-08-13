<script setup lang="ts">
/**
 * Matilha de um canil. Porte de VIEWS.canilDetail + matilha + caoForm
 * (index.html, 9209).
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'
import type { Canil } from '~/pages/canis.vue'

definePageMeta({ layout: 'app' })

const FUNCOES = ['Rastreio', 'Busca', 'Agarro', 'Faro', 'Cerco', 'Misto', 'Outro']

export interface Cao {
  id: string; canilId: string; nome?: string; funcao?: string; raca?: string
  sexo?: string; dataNascimento?: string; fotoUrl?: string; obs?: string
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const canil = ref<Canil | null>(null)
const caes = ref<Cao[] | null>(null)
const erro = ref('')

const form = ref(false)
const nome = ref('')
const funcao = ref(FUNCOES[0]!)
const raca = ref('')
const sexo = ref('Macho')
const nasc = ref('')
const obs = ref('')
const foto = ref('')
const salvando = ref(false)

function idade(iso?: string) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const meses = Math.floor((Date.now() - d.getTime()) / 2629800000)
  if (meses < 24) return meses + ' mes(es)'
  return Math.floor(meses / 12) + ' ano(s)'
}

async function carregar() {
  erro.value = ''
  try {
    const ks = await server<Canil[]>('apiListarCanis')
    canil.value = (ks || []).find((k) => k.id === id.value) || null
    if (!canil.value) { erro.value = 'Canil não encontrado'; return }
    caes.value = await server<Cao[]>('apiListarCaes', id.value)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir o canil'
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
  if (!nome.value) { ui.avisar('Informe o nome do cão', 'erro'); return }
  salvando.value = true
  try {
    await server('apiCriarCao', {
      canilId: id.value, nome: nome.value, funcao: funcao.value, raca: raca.value,
      sexo: sexo.value, dataNascimento: nasc.value, obs: obs.value, foto: foto.value
    })
    ui.avisar('Cão salvo ✔')
    form.value = false
    nome.value = ''; raca.value = ''; nasc.value = ''; obs.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    salvando.value = false
  }
}

async function excluir(c: Cao) {
  if (!confirm('Excluir este cão?')) return
  try {
    await server('apiExcluir', 'cao', c.id)
    ui.avisar('Excluído')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Canil" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!canil" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3 class="no-i18n"><Icone nome="canil" /> {{ canil.nome || 'Canil' }}</h3>
        <div class="meta">{{ (caes || []).length }} cão(es) na matilha</div>
        <div v-if="canil.obs" class="meta no-i18n">{{ canil.obs }}</div>
      </div>


      <div v-if="caes === null" class="card"><div class="meta">Carregando…</div></div>
      <div v-else-if="!caes.length && !form" class="card vazio">
        <div class="big"><Icone nome="canil" /></div>
        Nenhum cão neste canil.
      </div>

      <div class="grade3">
        <div v-for="c in caes || []" :key="c.id" class="card lad">
          <NuxtLink :to="{ path: '/cao', query: { id: c.id, canil: id } }" class="lad-link">
            <img v-if="c.fotoUrl" :src="String(c.fotoUrl)" class="lad-foto" alt="">
            <span v-else class="lad-ic"><Icone nome="canil" :px="28" /></span>
            <b class="no-i18n">{{ c.nome }}</b>
            <div class="meta"><span class="pill">{{ c.funcao || '—' }}</span></div>
            <div class="meta no-i18n">
              {{ c.sexo }}<template v-if="idade(c.dataNascimento)"> · {{ idade(c.dataNascimento) }}</template>
            </div>
          </NuxtLink>
          <button class="lad-x" title="Excluir" @click="excluir(c)"><Icone nome="excluir" /></button>
        </div>
      </div>

      <!-- Fica AQUI, junto do botão que o abre: declarado antes da lista,
           ele abria fora da tela em qualquer lista com alguns itens. -->
      <div v-if="form" class="card form-novo">
        <h3>Novo cão</h3>
        <label for="c_nome">Nome do cão *</label>
        <input id="c_nome" v-model="nome" class="no-i18n">

        <div class="two">
          <div>
            <label for="c_func">Função</label>
            <select id="c_func" v-model="funcao">
              <option v-for="f in FUNCOES" :key="f">{{ f }}</option>
            </select>
          </div>
          <div>
            <label for="c_sexo">Sexo</label>
            <select id="c_sexo" v-model="sexo">
              <option>Macho</option>
              <option>Fêmea</option>
            </select>
          </div>
        </div>

        <label for="c_raca">Raça</label>
        <input id="c_raca" v-model="raca" class="no-i18n">

        <CampoData v-model="nasc" label="Data de nascimento" />

        <label for="c_obs">Observações</label>
        <textarea id="c_obs" v-model="obs" class="no-i18n" />

        <label for="c_foto">Foto</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="c_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar cão' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Novo cão"
        chave="caesPorCanil"
        :quantidade="(caes || []).length"
        @criar="form = true"
      />
      <NuxtLink to="/canis" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
/* O formulário de cadastro, agora ao pé da lista. */
.form-novo { border-left: 4px solid var(--laranja); }
.form-novo h3 { margin: 0 0 10px; font-size: 15px; }
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.prev { max-width: 140px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
