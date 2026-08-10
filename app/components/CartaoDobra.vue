<script setup lang="ts">
/**
 * ── CARTÃO DOBRÁVEL ───────────────────────────────────────────────────────
 *
 * Lista de documentos que nasce fechada: só o título, o estado e um resumo.
 * Toca e abre. Existe porque três CRAFs abertos ao mesmo tempo dão uma tela
 * de rolagem infinita no celular, e quem entra para conferir uma validade
 * precisa passar por todos os campos dos outros dois.
 *
 * ⚠️ NÃO desmonta o conteúdo ao fechar — usa `v-show`, não `v-if`. É
 * deliberado e é a decisão mais importante aqui: estes cartões guardam
 * FORMULÁRIO EM EDIÇÃO, e o acervo salva em LOTE, numa chamada só. Com
 * `v-if`, fechar um cartão destruiria os campos e o que foi digitado se
 * perderia sem aviso — o usuário salvaria achando que mandou tudo. Também
 * quebraria a validação do navegador, que não alcança campo desmontado.
 *
 * ⚠️ O primeiro cartão de uma lista pode nascer aberto (`abertoInicial`),
 * porque quem chega para cadastrar o primeiro documento não deveria ter de
 * descobrir que precisa tocar em algo.
 */
const props = defineProps<{
  /** Título curto: "CRAF 1", "Autorização de Acesso". */
  titulo: string
  /** Linha de resumo visível fechado: número, validade. */
  resumo?: string
  /** Selo de estado: "vence em 12 dias", "sem validade". */
  selo?: string
  /** Classe do selo, vinda do `statusVencimento`. */
  seloClasse?: string
  /** Nasce aberto. */
  abertoInicial?: boolean
  /** Chama a atenção quando falta algo dentro. */
  alerta?: boolean
}>()

const aberto = ref(!!props.abertoInicial)

/**
 * Aberto de fora, quando o pai precisa revelar o cartão — por exemplo ao
 * apontar o campo que impediu de salvar. Fechado, o erro ficaria invisível.
 */
function abrir() { aberto.value = true }
defineExpose({ abrir, aberto })
</script>

<template>
  <div class="dobra" :class="{ on: aberto, alerta: props.alerta }">
    <button
      type="button"
      class="cab"
      :aria-expanded="aberto"
      @click="aberto = !aberto"
    >
      <span class="txt">
        <b class="no-i18n">{{ titulo }}</b>
        <span v-if="selo" class="doc-tag" :class="seloClasse || 'venc'">{{ selo }}</span>
        <span v-if="resumo && !aberto" class="meta no-i18n">{{ resumo }}</span>
      </span>
      <!-- Ações do cabeçalho (excluir, abrir anexo) ficam fora do botão:
           dentro, o toque nelas alternaria a dobra também. -->
      <span class="seta" aria-hidden="true">›</span>
    </button>

    <div v-if="$slots.acoes" class="acoes-cab">
      <slot name="acoes" />
    </div>

    <div v-show="aberto" class="corpo">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dobra {
  background: var(--card); border: 1px solid var(--linha);
  border-radius: 12px; margin-bottom: 10px; position: relative;
}
.dobra.on { border-color: var(--laranja); }
.dobra.alerta { border-left: 4px solid var(--alerta); }

.cab {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: none; border: 0; color: var(--txt); font: inherit;
  text-align: left; padding: 13px 14px; cursor: pointer; margin: 0;
  /* Alvo de toque confortável no celular, que é onde isto é usado. */
  min-height: 52px;
}
.txt { flex: 1; min-width: 0; }
.txt b { font-size: 15px; }
.txt .meta { display: block; margin: 3px 0 0; font-size: 12px; }

.seta {
  flex: none; font-size: 22px; color: var(--osso-2);
  transition: transform .18s ease;
}
.dobra.on .seta { transform: rotate(90deg); color: var(--laranja-cl); }

/* As ações vivem sobre o cabeçalho, à direita da seta. */
.acoes-cab { position: absolute; top: 10px; right: 42px; display: flex; gap: 4px; }

.corpo { padding: 0 14px 14px; border-top: 1px solid var(--linha); margin-top: 0; }
.corpo :deep(label:first-child) { margin-top: 12px; }
</style>
