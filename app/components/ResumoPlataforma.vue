<script setup lang="ts">
/**
 * Resumo do que a plataforma faz, no topo do cadastro. Porte de
 * resumoPlataforma.
 *
 * Usa o sprite do sistema. Chegou a ficar com emoji quando o sprite ainda não
 * tinha sido portado — e emoji não serve como ícone aqui: não herda a cor da
 * marca, não acompanha o tamanho definido no CSS e muda de desenho conforme o
 * sistema operacional de quem olha.
 */
const props = defineProps<{ tipo: 'manejador' | 'empresa' }>()

const ITENS = {
  manejador: [
    ['ceva', 'Cevas', 'Cadastre cevas, o alimento usado e acompanhe o nível do tratadouro.'],
    ['rotas', 'Rotas de caça', 'Grave por GPS suas rotas de aproximação e espreita, com marcações no caminho.'],
    ['canil', 'Cães e canil', 'Controle sua matilha por função, com saúde, vacinas e idade de cada cão.'],
    ['armadilha', 'Armadilhas', 'Registre suas armadilhas de captura com localização e tipo.'],
    ['trofeu', 'Abates e troféus', 'Registre abates, monte sua sala de troféus e dispute o ranking.'],
    ['mapa', 'Rede e mapa', 'Veja outros manejadores e as lojas parceiras no mapa da sua região.']
  ],
  empresa: [
    ['mapa', 'Apareça no mapa', 'Sua loja no mapa da rede, encontrada pelos manejadores da sua região.'],
    ['promocao', 'Promoções relâmpago', 'Publique ofertas com validade curta que chegam aos manejadores por perto.'],
    ['trofeu', 'Patrocine destaques', 'Apareça no card fixo da plataforma ou premie o 1º do ranking de troféus.'],
    ['carrinho', 'Sua vitrine', 'Descreva seus produtos e serviços; quem visita sua loja vê tudo reunido.'],
    ['grafico', 'Veja quem te procura', 'Acompanhe quantas visitas seu perfil recebe.']
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
      <span class="ic"><Icone :nome="i[0]" :px="22" /></span>
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
.ic { display: flex; flex: none; padding-top: 2px; }
</style>
