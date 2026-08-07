<script setup lang="ts">
/**
 * Menu da conta, no botão ao lado do sino.
 *
 * ⚠️ Reúne o que estava espalhado: o cartão "CONTA / perfil" da faixa de
 * créditos e o atalho de ajustes. Três caminhos para o mesmo lugar ocupavam
 * espaço no topo e não davam nada em troca.
 */
import { useAuth } from '~/stores/auth'
import { useCreditos } from '~/stores/creditos'
import { useUi } from '~/stores/ui'

const auth = useAuth()
const cred = useCreditos()
const ui = useUi()
const { server } = useServer()
const router = useRouter()
const route = useRoute()

const aberto = ref(false)
const caixa = ref<HTMLElement | null>(null)

/* Trocar de tela fecha o menu — senão ele fica pairando sobre a tela nova. */
watch(() => route.path, () => { aberto.value = false })

function foraDaqui(e: MouseEvent) {
  if (aberto.value && caixa.value && !caixa.value.contains(e.target as Node)) {
    aberto.value = false
  }
}
onMounted(() => document.addEventListener('click', foraDaqui))
onBeforeUnmount(() => document.removeEventListener('click', foraDaqui))

async function sair() {
  aberto.value = false
  try {
    await server('apiLogout')
  } catch { /* a sessão local morre de qualquer jeito */ }
  auth.encerrar()
  auth.reconhecerExpiracao()
  cred.limpar()
  ui.avisar('Você saiu')
  await router.push('/')
}
</script>

<template>
  <div ref="caixa" class="conta-wrap">
    <button class="conta-btn" title="Minha conta" @click.stop="aberto = !aberto">
      <Icone nome="usuario" :px="24" />
    </button>

    <div v-if="aberto" class="painel">
      <div class="cab">
        <b class="no-i18n">{{ auth.nome || auth.login }}</b>
        <div v-if="cred.dados" class="meta no-i18n">{{ cred.dados.planoNome }}</div>
      </div>

      <NuxtLink to="/perfil" class="item">
        <Icone nome="usuario" :px="18" /><span>Meu perfil</span>
      </NuxtLink>
      <NuxtLink to="/planos" class="item">
        <Icone nome="planos" :px="18" /><span>Planos</span>
      </NuxtLink>
      <NuxtLink to="/compras" class="item">
        <Icone nome="pagamentos" :px="18" /><span>Minhas compras</span>
      </NuxtLink>
      <NuxtLink to="/suporte" class="item">
        <Icone nome="suporte" :px="18" /><span>Suporte</span>
      </NuxtLink>
      <NuxtLink v-if="auth.admin" to="/admin" class="item">
        <Icone nome="ajustes" :px="18" /><span>Administração</span>
      </NuxtLink>

      <button class="item sair" @click="sair">
        <Icone nome="voltar" :px="18" /><span>Sair</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.conta-wrap { position: relative; flex: none; }
.conta-btn {
  background: none; border: 0; cursor: pointer;
  display: flex; align-items: center; padding: 4px;
}
.painel {
  position: absolute; top: 38px; right: 0; width: min(80vw, 240px);
  background: var(--carvao-3); border: 1px solid var(--linha);
  border-radius: 12px; box-shadow: var(--sombra); z-index: 80; overflow: hidden;
}
.cab { padding: 11px 13px; border-bottom: 1px solid var(--linha); }
.cab .meta { margin: 2px 0 0; }
.item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 11px 13px; border: 0; background: none; cursor: pointer;
  color: var(--osso); text-decoration: none; font-size: 14px; text-align: left;
}
.item:hover { background: rgba(255, 255, 255, .05); color: var(--laranja-cl); }
.item.sair { border-top: 1px solid var(--linha); color: var(--osso-2); }
</style>
