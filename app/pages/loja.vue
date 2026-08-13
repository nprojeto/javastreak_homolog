<script setup lang="ts">
/**
 * ── LOJA (vista pública) ──────────────────────────────────────────────────
 *
 * A vitrine de UMA empresa, vista por quem não é dono dela. Aberta pelo botão
 * "Ver loja" no pino do mapa da rede.
 *
 * ⚠️ Não confundir com `/vitrine`, que é a tela do LOJISTA gerenciando os
 * próprios produtos. Aqui é só leitura, e serve a manejador — que não teria
 * acesso àquela.
 *
 * ⚠️ `apiEmpresaPublica` é ação PÚBLICA e já devolve os produtos junto. Não
 * há segunda chamada para a vitrine, e nem deveria: o servidor decide o que é
 * público numa peneira só (`empresaPublico_`).
 */
import { useUi } from '~/stores/ui'
import { soDig } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Produto {
  id: string; nome: string; descricao?: string; preco?: string; fotoUrl?: string
}
interface Empresa {
  id: string; nome?: string; ramo?: string; segmento?: string; descricao?: string
  telefone?: string; whatsapp?: string; email?: string
  endereco?: string; cidade?: string; site?: string
  instagram?: string; facebook?: string; fotoUrl?: string
  produtos?: Produto[]
}

const route = useRoute()
const { server } = useServer()
const ui = useUi()
const base = useRuntimeConfig().app.baseURL

const id = computed(() => String(route.query.empresa || route.query.id || ''))
const e = ref<Empresa | null>(null)
const erro = ref('')

const logo = computed(() => e.value?.fotoUrl || base + 'avatar/empresa.png')

const zap = computed(() => {
  const d = soDig(e.value?.whatsapp || e.value?.telefone)
  return d.length >= 8 ? 'https://wa.me/' + (d.length <= 11 ? '55' + d : d) : ''
})

async function carregar() {
  if (!id.value) { erro.value = 'Loja não informada.'; return }
  try {
    e.value = await server<Empresa>('apiEmpresaPublica', id.value)
    if (!e.value) { erro.value = 'Esta loja não está disponível.'; return }
    /* Conta a visita. Acessório: falhar aqui não pode esconder a loja. */
    server('apiRegistrarVisita', 'empresa', id.value).catch(() => { /* segue */ })
  } catch (err) {
    erro.value = err instanceof Error ? err.message : 'Não foi possível abrir a loja'
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Loja" descricao="Contato e vitrine desta loja." />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!e" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card capa">
        <img :src="logo" class="logo" alt="">
        <div class="grow">
          <h2 class="no-i18n">{{ e.nome }}</h2>
          <div v-if="e.ramo || e.segmento" class="meta no-i18n">
            {{ [e.ramo, e.segmento].filter(Boolean).join(' · ') }}
          </div>
          <div v-if="e.cidade" class="meta no-i18n">{{ e.cidade }}</div>
        </div>
      </div>

      <div class="contatos">
        <a v-if="zap" :href="zap" target="_blank" rel="noopener" class="btn">
          <Icone nome="whatsapp" /> WhatsApp
        </a>
        <a v-if="e.site" :href="e.site" target="_blank" rel="noopener" class="btn sec">
          <Icone nome="global" /> Site
        </a>
        <a v-if="e.instagram" :href="e.instagram" target="_blank" rel="noopener" class="btn sec">
          <Icone nome="camera" /> Instagram
        </a>
      </div>

      <div v-if="e.descricao" class="card">
        <p class="no-i18n">{{ e.descricao }}</p>
      </div>

      <div v-if="e.endereco" class="card">
        <b>Endereço</b>
        <div class="meta no-i18n">{{ e.endereco }}</div>
      </div>

      <h3 class="sub">Vitrine</h3>
      <div v-if="!(e.produtos || []).length" class="card vazio">
        <div class="big"><Icone nome="carrinho" /></div>
        Esta loja ainda não cadastrou produtos.
      </div>

      <div class="grade3">
        <div v-for="p in e.produtos || []" :key="p.id" class="card lad">
          <div class="lad-link">
            <img v-if="p.fotoUrl" :src="String(p.fotoUrl)" class="lad-foto" alt="">
            <span v-else class="lad-ic"><Icone nome="carrinho" :px="28" /></span>
            <b class="no-i18n">{{ p.nome }}</b>
            <div v-if="p.preco" class="meta preco no-i18n">{{ p.preco }}</div>
          </div>
        </div>
      </div>

      <NuxtLink to="/mapa" class="btn sec">Voltar ao mapa</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.capa { display: flex; align-items: center; gap: 12px; }
.capa .logo {
  width: 68px; height: 68px; border-radius: 50%; object-fit: cover;
  flex: none; border: 2px solid var(--laranja);
}
.capa .grow { flex: 1; min-width: 0; }
.capa h2 { margin: 0; font-size: 18px; }
.capa .meta { margin: 2px 0 0; }

.contatos { display: flex; gap: 8px; margin: 10px 0; }
.contatos .btn { flex: 1; margin: 0; text-decoration: none; }

.sub { margin: 16px 4px 8px; font-size: 15px; }
.vazio { text-align: center; padding: 24px; }
.vazio .big :deep(.ic-svg) { width: 42px; height: 42px; }
.preco { color: var(--laranja-cl); font-weight: 700; }
.btn.sec { margin-top: 12px; text-decoration: none; }
</style>
