<script setup lang="ts">
/**
 * Minha empresa. Porte de VIEWS.empresa + empresaForm (index.html, 6900).
 */
import { useUi } from '~/stores/ui'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

const SEGMENTOS = ['Agricultor', 'Despachante', 'Clube de tiro',
  'Loja de artigos de caça', 'Veterinário', 'Canil', 'Outro']

interface Empresa {
  id?: string; nome?: string; segmento?: string; descricao?: string
  telefone?: string; whatsapp?: string; email?: string; endereco?: string
  cidade?: string; lat?: string; lng?: string; instagram?: string
  facebook?: string; site?: string; fotoUrl?: string; cnpj?: string
  status?: string; bloqueado?: string; visitas?: number
}

const { server } = useServer()
const ui = useUi()

const e = ref<Empresa | null>(null)
const erro = ref('')
const salvando = ref(false)
const foto = ref('')

async function carregar() {
  erro.value = ''
  try {
    e.value = (await server<Empresa | null>('apiMinhaEmpresa')) || {}
  } catch (err) {
    erro.value = err instanceof Error ? err.message : 'Não foi possível carregar a empresa'
  }
}

async function escolheuFoto(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
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
  if (!e.value?.nome) { ui.avisar('Informe o nome da empresa', 'erro'); return }
  salvando.value = true
  try {
    const r = await server<Empresa>('apiSalvarEmpresa', { ...e.value, foto: foto.value })
    e.value = r || e.value
    foto.value = ''
    ui.avisar('Empresa salva ✔')
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!e" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div v-if="e.bloqueado === 'Sim'" class="card bloqueado">
        <div class="meta">
          <Icone nome="denuncia" /> Sua empresa está bloqueada por denúncias e está em análise.
        </div>
      </div>

      <div class="card">
        <h3>Minha empresa</h3>
        <div v-if="e.visitas" class="meta"><Icone nome="ver" /> {{ e.visitas }} visita(s) ao seu perfil</div>

        <label for="e_nome">Nome da empresa *</label>
        <input id="e_nome" v-model="e.nome" class="no-i18n">

        <label for="e_seg">Segmento</label>
        <select id="e_seg" v-model="e.segmento">
          <option v-for="s in SEGMENTOS" :key="s">{{ s }}</option>
        </select>

        <label for="e_cnpj">CNPJ</label>
        <input id="e_cnpj" v-model="e.cnpj" class="no-i18n">

        <label for="e_desc">Descrição</label>
        <textarea id="e_desc" v-model="e.descricao" class="no-i18n" />

        <label for="e_tel">Telefone</label>
        <input id="e_tel" v-model="e.telefone" class="no-i18n">
        <label for="e_wa">WhatsApp</label>
        <input id="e_wa" v-model="e.whatsapp" class="no-i18n">
        <label for="e_mail">E-mail</label>
        <input id="e_mail" v-model="e.email" type="email" class="no-i18n">

        <label for="e_cid">Cidade</label>
        <input id="e_cid" v-model="e.cidade" class="no-i18n">
        <label for="e_end">Endereço</label>
        <input id="e_end" v-model="e.endereco" class="no-i18n">

        <BotaoGps v-model:lat="e.lat" v-model:lng="e.lng" :endereco="[e.endereco, e.cidade]" />

        <label for="e_insta">Instagram</label>
        <input id="e_insta" v-model="e.instagram" class="no-i18n">
        <label for="e_face">Facebook</label>
        <input id="e_face" v-model="e.facebook" class="no-i18n">
        <label for="e_site">Site</label>
        <input id="e_site" v-model="e.site" class="no-i18n">

        <label for="e_foto">Logo</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <img v-else-if="e.fotoUrl" :src="String(e.fotoUrl)" class="prev" alt="Logo atual">
        <input id="e_foto" type="file" accept="image/*" @change="escolheuFoto">

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar empresa' }}
        </button>
      </div>

      <NuxtLink to="/vitrine" class="card menu-card">
        <Icone nome="carrinho" :px="30" />
        <div class="txt">
          <h3>Minha vitrine</h3>
          <p>Produtos e serviços exibidos no seu perfil</p>
        </div>
        <div class="chev">›</div>
      </NuxtLink>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 6px; }
.ruim { color: var(--danger); }
.bloqueado { border-left: 5px solid #8a3a2c; }
.prev { max-width: 150px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.menu-card { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--txt); }
.menu-card .txt { flex: 1; }
.menu-card h3 { margin: 0 0 2px; font-size: 15px; }
.menu-card p { margin: 0; font-size: 12.5px; color: var(--osso-2); }
.chev { font-size: 22px; color: var(--linha); }
</style>
