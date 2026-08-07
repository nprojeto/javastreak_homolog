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
import { useMarca } from '~/composables/useMarca'
import { NAV_MANEJADOR, NAV_LOJISTA, TOP_KEYS } from '~/composables/useNavegacao'
import { NAV_SVG } from '~/composables/useIcones'

const auth = useAuth()
const route = useRoute()
const { carregarCreditos, carregarBoot } = useSessaoApp()
const marca = useMarca()
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
      <!-- Só a marca. O nome do usuário fica no menu lateral, abaixo do logo:
           repetir no topo custava largura numa linha que já está disputada. -->
      <div class="titulo">
        <img :src="marca.simbolo" :alt="marca.nome" class="tb-marca">
      </div>

      <!-- A faixa vive DENTRO do cabeçalho. Em tela estreita ela quebra para
           a linha de baixo, ocupando a largura toda — por isso o `order` alto
           e o `flex-basis: 100%`. -->
      <div class="faixa-slot"><FaixaCreditos /></div>

      <SinoAvisos />
      <MenuConta />
    </header>

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
  /* ⚠️ UMA LINHA SÓ, sempre. Com `wrap`, ao estreitar a tela a faixa descia e
     o cabeçalho ganhava uma segunda linha — mudando de altura conforme a
     largura. Sem quebra, ela vira uma tira rolável e a altura é fixa. */
  flex-wrap: nowrap;
  padding: 8px 12px; color: var(--osso);
  position: sticky; top: 0; z-index: 50;
  /* ⚠️ A cor vem do tema, não daqui. O estilo com `scoped` ganha do arquivo
     global, então deixar `background` fixo aqui fazia a faixa verde do tema
     antigo sobreviver ao tema novo. */
  background: var(--carvao-3);
  box-shadow: inset 0 -2px 0 var(--laranja);
}
.btn-menu {
  background: none; border: 0; color: #fff; cursor: pointer;
  display: flex; align-items: center; padding: 4px; flex: none;
}
.btn-menu :deep(.ic-svg) { stroke: var(--osso); }
.titulo { line-height: 1.15; order: 1; flex: none; }
.btn-menu { order: 0; }
:deep(.sino-wrap) { order: 3; }
:deep(.conta-wrap) { order: 4; }

/**
 * A faixa fica entre a marca e os botões, e é ELA que encolhe: `flex: 1 1 0`
 * com `min-width: 0` deixa o item menor que o conteúdo, o que é o que permite
 * a rolagem interna. Sem o `min-width: 0`, um item flex se recusa a encolher
 * abaixo do conteúdo e empurra os botões para fora da tela.
 */
.faixa-slot { order: 2; flex: 1 1 0; min-width: 0; overflow: hidden; }
@media (max-width: 880px) {
  /* Apertado: alinhada à esquerda. Centralizar com espaço curto deixava o
     primeiro cartão meio escondido atrás da marca. */
  .faixa-slot :deep(.topstrip) { justify-content: flex-start; }
}
.tb-marca { display: block; height: 26px; width: auto; }


.atalhos {
  display: flex; gap: 6px; overflow-x: auto;
  padding: 8px 10px; border-bottom: 1px solid var(--linha);
  /* `safe center` centra quando cabe e volta a alinhar à esquerda quando não
     cabe — sem ele, no celular o primeiro atalho ficaria cortado fora da tela. */
  justify-content: safe center;
}
.atalho {
  display: flex; align-items: center; gap: 6px; flex: none;
  padding: 7px 12px; border-radius: 999px; border: 1px solid var(--linha);
  font-size: 12.5px; color: var(--txt); text-decoration: none; background: transparent;
}
.atalho.on { border-color: var(--laranja); background: var(--carvao-3); color: var(--laranja-cl); font-weight: 700; }

.miolo { max-width: 720px; margin: 0 auto; padding: 12px 14px 24px; }
</style>
