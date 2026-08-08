<script setup lang="ts">
/**
 * Cartão de módulo — o padrão que se repete em CAÇAR, Saúde animal e
 * Manutenção. Porte de `moduloCard` (index.html).
 *
 * ⚠️ Existe para os três portais ficarem IGUAIS. Antes cada um montava o
 * próprio cartão à mão, e nenhum ficava igual ao outro: o botão nascia num
 * lugar diferente, a seta às vezes sumia, o ícone mudava de tamanho.
 *
 * Duas formas: `coluna` (grade de vários) e larga (um por linha).
 */
defineProps<{
  icone: string
  titulo: string
  descricao?: string
  para: string
  /** Selo curto no canto, tipo "SEM CTF". */
  selo?: string
  seloTipo?: 'ok' | 'alerta' | 'danger'
  /** Empilha em grade em vez de ocupar a linha inteira. */
  coluna?: boolean
  /**
   * Motivo do bloqueio. Preenchido, o cartão não abre o destino: leva ao
   * `paraDestravar` e diz por quê.
   */
  travado?: string
  paraDestravar?: string
}>()
</script>

<template>
  <!--
    ⚠️ Cartão travado NÃO é cartão desabilitado. Ele continua clicável, mas
    leva para onde se resolve o problema. Um cartão morto deixa a pessoa
    batendo nele sem saber o que fazer; este responde a pergunta.
  -->
  <NuxtLink
    :to="travado ? (paraDestravar || para) : para"
    class="card mod"
    :class="{ col: coluna, bloq: !!travado }"
  >
    <span class="mod-ic"><Icone :nome="travado ? 'bloqueio' : icone" :px="26" /></span>

    <div class="mod-txt">
      <h3>{{ titulo }}</h3>
      <p v-if="travado">{{ travado }}</p>
      <p v-else-if="descricao">{{ descricao }}</p>
      <span v-if="selo" class="mod-selo" :class="seloTipo || 'alerta'">{{ selo }}</span>
    </div>

    <span class="btn sm sec mod-btn">{{ travado ? 'Resolver' : 'Abrir' }}</span>
    <span class="mod-chev" :class="{ 'so-estreito': coluna }">›</span>
  </NuxtLink>
</template>

<style scoped>
.mod {
  display: flex; align-items: center; gap: 12px;
  text-decoration: none; color: var(--txt);
}
.mod-ic {
  display: flex; align-items: center; justify-content: center; flex: none;
  width: 46px; height: 46px; border-radius: 12px; background: var(--carvao-3);
}
.mod-txt { flex: 1; min-width: 0; }
.mod-txt h3 { margin: 0; font-size: 15px; }
.mod-txt p { margin: 2px 0 0; font-size: 12.5px; color: var(--osso-2); }
.mod-selo {
  display: inline-block; margin-top: 6px;
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  padding: 3px 9px; border-radius: 999px;
}
.mod-selo.alerta { background: #3A2E13; color: var(--alerta); }
.mod-selo.danger { background: #3A1E1C; color: var(--danger); }
.mod-selo.ok { background: var(--verde-claro); color: var(--verde-esc); }
.mod-btn { flex: none; width: auto; margin: 0; }
.mod-chev { flex: none; font-size: 20px; color: var(--linha); }
/* A seta só faz sentido quando o cartão é uma linha. */
@media (min-width: 520px) { .mod-chev.so-estreito { display: none; } }

/* Travado: o cartão apaga, mas continua legível e clicável. */
.mod.bloq { border-left: 3px solid var(--alerta); }
.mod.bloq .mod-ic { background: transparent; border: 1px dashed var(--linha); }
.mod.bloq h3 { color: var(--osso-2); }
.mod.bloq .mod-ic :deep(.ic-svg) { stroke: var(--alerta); }

/**
 * Em grade, o cartão vira uma coluna — mas SÓ quando há largura para ele ser
 * estreito de verdade.
 *
 * ⚠️ Abaixo de 520px a grade já é de uma coluna só, e empilhar ali colocava o
 * ícone sozinho em cima de um cartão da largura da tela: uma pilha alta, com
 * o botão ocupando a linha inteira. Nessa faixa o cartão volta a ser linha,
 * igual aos dos outros portais — que é justamente a padronização que o resto
 * do app segue.
 */
@media (min-width: 520px) {
  .mod.col {
    flex-direction: column; align-items: stretch; text-align: left; gap: 10px;
  }
  .mod.col .mod-btn { width: 100%; margin-top: auto; }
}
/* Estreito: mesma linha dos demais cartões, com a seta de volta. */
@media (max-width: 519px) {
  .mod.col .mod-chev { display: inline; }
}
</style>
