<script setup lang="ts">
/**
 * Moldura do app autenticado: cabeçalho, faixa de créditos, menu lateral e a
 * barra de atalhos. Substitui o que o legado montava em `render()` +
 * `updateHeader()` + `buildSidebar()` a cada troca de tela.
 *
 * Aqui a moldura é desenhada UMA vez e só o miolo troca — é o ganho mais
 * visível da migração: no legado, cada navegação repintava o menu inteiro.
 */
import { useAuth } from '~/stores/auth'
import { useSessaoApp } from '~/composables/useSessaoApp'
import { useUi } from '~/stores/ui'
import { NAV_MANEJADOR, NAV_LOJISTA, TOP_KEYS } from '~/composables/useNavegacao'
import { NAV_SVG } from '~/composables/useIcones'

const auth = useAuth()
const route = useRoute()
const { carregarCreditos, carregarBoot } = useSessaoApp()
const ui = useUi()

const menuAberto = ref(false)

const atalhos = computed(() => {
  const base = auth.tipo === 'empresa' ? NAV_LOJISTA : NAV_MANEJADOR
  return base.filter((n) => TOP_KEYS.includes(n.chave))
})

onMounted(async () => {
  /* Ordem importa: o boot repõe a ficha, e só então a faixa faz sentido. */
  try {
    await carregarBoot()
  } catch {
    ui.avisar('Não foi possível recarregar seu perfil', 'erro')
  }
  carregarCreditos()
})

/* Trocar de tela fecha o menu — no celular ele fica por cima do conteúdo. */
watch(() => route.path, () => { menuAberto.value = false })
</script>

<template>
  <div class="app-shell">
    <IconeSprite />

    <header class="topo">
      <button class="btn-menu" aria-label="Menu" @click="menuAberto = true">
        <Icone nome="menu" :px="26" />
      </button>
      <div class="titulo">
        <b>JavaStreak</b>
        <small>{{ auth.nome || '' }}</small>
      </div>
      <NuxtLink to="/perfil" class="btn-menu" aria-label="Meu perfil">
        <Icone nome="usuario" :px="24" />
      </NuxtLink>
    </header>

    <FaixaCreditos />

    <nav class="atalhos">
      <NuxtLink
        v-for="a in atalhos"
        :key="a.chave"
        :to="a.rota"
        class="atalho"
        :class="{ on: route.path === a.rota }"
      >
        <Icone :nome="NAV_SVG[a.icon] || 'painel'" :px="20" />
        <span>{{ a.label }}</span>
      </NuxtLink>
    </nav>

    <MenuLateral v-model:aberto="menuAberto" />

    <main class="miolo">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; padding-bottom: 30px; }

.topo {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: var(--verde-esc); color: #fff;
  position: sticky; top: 0; z-index: 50;
}
.btn-menu {
  background: none; border: 0; color: #fff; cursor: pointer;
  display: flex; align-items: center; padding: 4px; flex: none;
}
.btn-menu :deep(.ic-svg) { stroke: #fff; }
.titulo { flex: 1; line-height: 1.15; min-width: 0; }
.titulo b { display: block; font-size: 16px; }
.titulo small { display: block; font-size: 12px; opacity: .82; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.atalhos {
  display: flex; gap: 6px; overflow-x: auto;
  padding: 8px 10px; background: #fff; border-bottom: 1px solid var(--linha);
}
.atalho {
  display: flex; align-items: center; gap: 6px; flex: none;
  padding: 7px 12px; border-radius: 999px; border: 1px solid var(--linha);
  font-size: 12.5px; color: var(--txt); text-decoration: none; background: #fff;
}
.atalho.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); font-weight: 700; }

.miolo { max-width: 720px; margin: 0 auto; padding: 12px 14px 24px; }
</style>
