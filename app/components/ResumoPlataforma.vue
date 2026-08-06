<script setup lang="ts">
/**
 * Resumo do que a plataforma faz, no topo do cadastro. Porte de
 * resumoPlataforma.
 *
 * O legado usava o sprite de ícones SVG (`ico()`); aqui vai emoji, porque o
 * sprite é um bloco à parte que só vale portar junto com as telas que o usam
 * de verdade. Visualmente equivalente, sem trazer um asset inteiro agora.
 */
const props = defineProps<{ tipo: 'manejador' | 'empresa' }>()

const ITENS = {
  manejador: [
    ['🌾', 'Espera com ceva', 'Cadastre cevas, o alimento usado e acompanhe o nível do tratadouro.'],
    ['🥾', 'Rotas de caça', 'Grave por GPS suas rotas de aproximação e espreita, com marcações no caminho.'],
    ['🐕', 'Cães e canil', 'Controle sua matilha por função, com saúde, vacinas e idade de cada cão.'],
    ['🪤', 'Armadilhas', 'Registre suas armadilhas de captura com localização e tipo.'],
    ['🏆', 'Abates e troféus', 'Registre abates, monte sua sala de troféus e dispute o ranking.'],
    ['🗺️', 'Rede e mapa', 'Veja outros manejadores e as lojas parceiras no mapa da sua região.']
  ],
  empresa: [
    ['🗺️', 'Apareça no mapa', 'Sua loja no mapa da rede, encontrada pelos manejadores da sua região.'],
    ['⚡', 'Promoções relâmpago', 'Publique ofertas com validade curta que chegam aos manejadores por perto.'],
    ['🏆', 'Patrocine destaques', 'Apareça no card fixo da plataforma ou premie o 1º do ranking de troféus.'],
    ['🛍️', 'Sua vitrine', 'Descreva seus produtos e serviços; quem visita sua loja vê tudo reunido.'],
    ['📊', 'Veja quem te procura', 'Acompanhe quantas visitas seu perfil recebe.']
  ]
} as const

const itens = computed(() => ITENS[props.tipo])
const titulo = computed(() =>
  props.tipo === 'empresa'
    ? 'Sua loja na rede do manejo'
    : 'Tudo o que você vai poder registrar'
)
</script>

<template>
  <div class="card resumo" :class="props.tipo">
    <h3>{{ titulo }}</h3>
    <div class="meta">Veja o que a conta libera antes de preencher.</div>
    <div v-for="i in itens" :key="i[1]" class="item">
      <span class="ic">{{ i[0] }}</span>
      <div><b>{{ i[1] }}</b><div class="meta">{{ i[2] }}</div></div>
    </div>
  </div>
</template>

<style scoped>
.resumo { border-top: 4px solid var(--verde); }
.resumo.empresa { border-top-color: #ee8a2e; }
h3 { margin: 0 0 2px; }
.meta { margin-bottom: 10px; }
.item { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.item .meta { margin: 2px 0 0; }
.ic { font-size: 20px; line-height: 1.2; flex: none; }
</style>
