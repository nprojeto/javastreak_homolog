<script setup lang="ts">
/**
 * Faixa acima do menu: plano, cortesia, indicação e a chave.
 * Porte de pintarTopStrip (index.html, 4820).
 *
 * Uma chamada só (`apiMeusCreditos`) alimenta tudo — inclusive as travas dos
 * botões de criar, que leem a mesma store.
 */
import { useAuth } from '~/stores/auth'
import { useCreditos } from '~/stores/creditos'
import { useUi } from '~/stores/ui'

const auth = useAuth()
const cred = useCreditos()
const ui = useUi()

const c = computed(() => cred.dados)

const diasTexto = computed(() => {
  const d = c.value?.diasPlano
  if (d === null || d === undefined) return 'sem prazo'
  return d + (d === 1 ? ' dia' : ' dias')
})

async function copiarChave() {
  const k = c.value?.chave
  if (!k) return
  try {
    await navigator.clipboard.writeText(k)
    ui.avisar('Chave copiada ✔')
  } catch {
    ui.avisar('Copie manualmente: ' + k)
  }
}
</script>

<template>
  <div v-if="auth.token && auth.tipo !== 'empresa' && c" class="topstrip">
    <NuxtLink to="/planos" class="ts-card" title="Seu plano">
      <Icone nome="planos" :px="16" />
      <span><span class="rot">{{ c.planoNome || '—' }}</span><br><b>{{ diasTexto }}</b></span>
    </NuxtLink>

    <div class="ts-card" title="Dias de cortesia">
      <Icone nome="favorito" :px="16" />
      <span><span class="rot">Cortesia</span><br><b>{{ c.cortesiaDias || 0 }} dias</b></span>
    </div>

    <div class="ts-card" title="Saldo ganho por indicação">
      <Icone nome="compartilhar" :px="16" />
      <span><span class="rot">Indicação</span><br><b>{{ c.indicacaoDias || 0 }} dias</b></span>
    </div>

    <button v-if="c.chave" class="ts-card chave" title="Copiar sua chave" @click="copiarChave">
      <Icone nome="link" :px="16" />
      <span><span class="rot">Sua chave</span><br><b>{{ c.chave }}</b></span>
    </button>

    <NuxtLink to="/perfil" class="ts-card" title="Meu perfil">
      <Icone nome="engrenagem" :px="16" />
      <span><span class="rot">Conta</span><br><b>perfil</b></span>
    </NuxtLink>
  </div>
</template>

<style scoped>
.topstrip {
  display: flex; gap: 6px; overflow-x: auto; padding: 8px 10px;
  background: var(--areia); border-bottom: 1px solid var(--linha);
}
.ts-card {
  display: flex; align-items: center; gap: 6px; flex: none;
  background: var(--card); border: 1px solid var(--linha); border-radius: 10px;
  padding: 6px 10px; font-size: 12px; color: var(--txt);
  text-decoration: none; cursor: pointer; line-height: 1.25;
}
.ts-card .rot { color: var(--osso-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; }
.ts-card b { font-size: 12.5px; }
.chave b { font-family: monospace; letter-spacing: .5px; }
</style>
