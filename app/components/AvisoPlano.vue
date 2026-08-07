<script setup lang="ts">
/**
 * Recusa por plano. Porte de abrirUpgrade.
 *
 * ⚠️ Existe porque faltava: o `useServer` guardava o pedido de upgrade na
 * store e nada o desenhava. Resultado — `PLANO_NECESSARIO` era o ÚNICO erro do
 * servidor que não aparecia na tela. O sintoma foi cruel: metade das
 * marcações salvava, o resto sumia, e nenhum aviso.
 */
import { useUi } from '~/stores/ui'
import { useCreditos } from '~/stores/creditos'

const ui = useUi()
const cred = useCreditos()

const NOME: Record<string, string> = {
  free: 'Novato', n1: 'Mateiro', n2: 'Veterano',
  empresa: 'Empresa', empresapro: 'Empresa Pro'
}
const ROTULO: Record<string, string> = {
  cevas: 'cevas', rotas: 'rotas', marcacoesPorRota: 'marcações por rota',
  canis: 'canis', caesPorCanil: 'cães por canil', transportes: 'transportes',
  armadilhas: 'armadilhas', abatesMes: 'abates por mês',
  trofeusRanking: 'troféus no ranking', documentos: 'documentos',
  propriedades: 'propriedades', compartilharRota: 'compartilhamento de rota',
  compartilharSala: 'compartilhamento de sala',
  cevasPorManejo: 'cevas por caçada', rotasPorManejo: 'rotas por caçada',
  amigosPorManejo: 'amigos por caçada'
}

const limiteAtual = computed(() => {
  const k = ui.upgrade?.chave
  if (!k) return null
  const v = cred.dados?.limites?.[k]
  return v === undefined ? null : v
})
</script>

<template>
  <div v-if="ui.upgrade" class="fundo" @click.self="ui.fecharUpgrade()">
    <div class="caixa">
      <div class="ic">🔒</div>
      <h3>Seu plano não cobre isso</h3>
      <p>
        <template v-if="limiteAtual !== null && limiteAtual > 0">
          O plano <b>{{ NOME[cred.dados?.plano || 'free'] }}</b> permite
          <b>{{ limiteAtual }}</b>
          {{ ROTULO[ui.upgrade.chave] || ui.upgrade.chave }}.
        </template>
        <template v-else>
          {{ ROTULO[ui.upgrade.chave] || ui.upgrade.chave }} não está incluído no
          plano <b>{{ NOME[cred.dados?.plano || 'free'] }}</b>.
        </template>
        <br>
        O plano <b>{{ NOME[ui.upgrade.precisa] || ui.upgrade.precisa }}</b> libera mais.
      </p>
      <NuxtLink to="/planos" class="btn" @click="ui.fecharUpgrade()">Ver planos</NuxtLink>
      <button class="btn sec" @click="ui.fecharUpgrade()">Agora não</button>
    </div>
  </div>
</template>

<style scoped>
.fundo {
  position: fixed; inset: 0; background: rgba(20,26,20,.5);
  display: flex; align-items: center; justify-content: center; z-index: 90; padding: 18px;
}
.caixa {
  background: #fff; border-radius: 16px; padding: 22px 18px;
  max-width: 380px; width: 100%; text-align: center; box-shadow: var(--sombra);
}
.ic { font-size: 38px; margin-bottom: 6px; }
h3 { margin: 0 0 8px; }
p { font-size: 14px; line-height: 1.6; margin: 0 0 14px; }
.btn { text-decoration: none; }
.btn.sec { margin-top: 8px; }
</style>
