<script setup lang="ts">
/**
 * Termo de uso com trava de rolagem. Porte de blocoTermo/checouTermo.
 *
 * O aceite só aparece depois que a pessoa chega ao fim do texto — e se o texto
 * couber sem rolagem, libera sozinho (senão a caixa nunca dispara o evento e o
 * cadastro fica travado para sempre).
 */
const aceito = defineModel<boolean>('aceito', { default: false })
const versao = defineModel<string>('versao', { default: '' })

const { server } = useServer()

const texto = ref('Carregando…')
const leu = ref(false)
const caixa = ref<HTMLElement | null>(null)

function rolou() {
  const el = caixa.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) leu.value = true
}

onMounted(async () => {
  try {
    const t = await server<{ texto: string; versao: string }>('apiTermo')
    texto.value = t.texto
    versao.value = t.versao
    await nextTick()
    // Texto curto não gera rolagem: libera na hora.
    setTimeout(() => {
      const el = caixa.value
      if (el && el.scrollHeight <= el.clientHeight + 10) leu.value = true
    }, 60)
  } catch {
    texto.value = 'Não foi possível carregar os termos. Recarregue a página.'
  }
})
</script>

<template>
  <div class="card">
    <h3>Termos de uso e privacidade</h3>
    <div class="meta">Role o texto até o final para liberar o aceite.</div>

    <div ref="caixa" class="termo-box" @scroll="rolou">{{ texto }}</div>

    <div class="termo-fim" :class="{ ok: leu }">
      <template v-if="leu">✓ Você leu o termo — marque o aceite abaixo</template>
      <template v-else><Icone nome="baixar" /> role até o fim para continuar</template>
    </div>

    <label v-if="leu" class="aceite">
      <input v-model="aceito" type="checkbox">
      <span>
        Li e aceito os <b>Termos de Uso</b> e a <b>Política de Privacidade</b>,
        declaro ter 18 anos ou mais e possuir as autorizações legais exigidas.
      </span>
    </label>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 6px; }
.meta { margin-bottom: 8px; }
.termo-box {
  height: 220px; overflow-y: auto; white-space: pre-wrap;
  border: 1px solid var(--linha); border-radius: 12px;
  padding: 12px; font-size: 13px; line-height: 1.55; background: var(--carvao-3);
}
.termo-fim { font-size: 12.5px; color: var(--laranja-esc); text-align: center; margin-top: 8px; }
.termo-fim.ok { color: var(--ok); }
.aceite { display: flex; gap: 10px; align-items: flex-start; margin-top: 10px; font-size: 13.5px; }
.aceite input { width: auto; margin-top: 3px; flex: none; }
</style>
