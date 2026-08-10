<script setup lang="ts">
/**
 * Linha de requisito da preparação para caçar.
 *
 * ⚠️ Ela só APRESENTA. Quem decide se o requisito está cumprido é a tela, a
 * partir do que o servidor devolveu — e quem realmente bloqueia é o servidor.
 * Esta linha não tem regra de negócio dentro, de propósito: se ela tivesse,
 * passaria a existir uma segunda verdade sobre o que libera uma caçada.
 *
 * Três estados, e o terceiro é o que faltava na tela antiga:
 *   `ok`        — cumprido
 *   `pendente`  — falta, e sem isto não dá para caçar
 *   `opcional`  — falta, mas não impede: amplia as formas de caçar
 */
defineProps<{
  icone: string
  titulo: string
  /** Frase de estado: "1 propriedade pronta", "Cadastre uma propriedade". */
  texto: string
  estado: 'ok' | 'pendente' | 'opcional'
  /** Para onde vai resolver. Ausente, a linha não é clicável. */
  para?: string
  /** Rótulo do atalho. Padrão: "Resolver". */
  acao?: string
}>()
</script>

<template>
  <component
    :is="para ? 'NuxtLink' : 'div'"
    :to="para"
    class="req"
    :class="estado"
  >
    <span class="ic">
      <Icone :nome="estado === 'ok' ? 'confirmar' : icone" :px="20" />
    </span>
    <div class="txt">
      <b>{{ titulo }}</b>
      <span class="meta no-i18n">{{ texto }}</span>
    </div>
    <span v-if="para && estado !== 'ok'" class="ir">{{ acao || 'Resolver' }}</span>
    <span v-else-if="para" class="chev">›</span>
  </component>
</template>

<style scoped>
.req {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; text-decoration: none; color: var(--txt);
  border-top: 1px solid var(--linha);
}
.req:first-child { border-top: 0; }

.ic {
  flex: none; width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--carvao-3); color: var(--osso-2);
}
.req.ok .ic { background: var(--verde-claro); color: var(--verde-esc); }
.req.pendente .ic { background: #3A1E1C; color: var(--danger); }
.req.opcional .ic { background: #3A2E13; color: var(--alerta); }

.txt { flex: 1; min-width: 0; }
.txt b { display: block; font-size: 14px; }
.txt .meta { margin: 1px 0 0; font-size: 12px; }
.req.pendente .txt .meta { color: var(--danger); }
.req.opcional .txt .meta { color: var(--alerta); }

.ir {
  flex: none; font-size: 11.5px; font-weight: 700; color: var(--laranja-cl);
  border: 1px solid var(--linha); border-radius: 999px; padding: 5px 11px;
}
.chev { flex: none; font-size: 20px; color: var(--linha); }
</style>
