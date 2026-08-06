<script setup lang="ts">
/**
 * Recuperar senha, etapa 1. Porte de VIEWS.esqueci + pedirCodigo (linha 6328).
 *
 * O backend responde igual existindo ou não a conta (resposta neutra, para não
 * revelar quais e-mails têm cadastro). A tela segue adiante nos dois casos —
 * é o comportamento correto, não um bug.
 */
import { useUi } from '~/stores/ui'

const { server } = useServer()
const ui = useUi()
const router = useRouter()

const email = ref('')
const enviando = ref(false)

async function pedirCodigo() {
  if (!email.value || email.value.indexOf('@') < 0) {
    ui.avisar('Informe um e-mail válido', 'erro')
    return
  }
  enviando.value = true
  try {
    await server('apiSolicitarReset', email.value)
    await router.push({ path: '/nova-senha', query: { email: email.value.trim().toLowerCase() } })
  } catch {
    /* o useServer já avisou */
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <TelaEntrada>
    <div class="card">
      <h3>Esqueceu a senha?</h3>
      <div class="meta">
        Informe o e-mail cadastrado. Enviaremos um código de 6 dígitos.
      </div>

      <label for="rs_email">E-mail *</label>
      <input
        id="rs_email"
        v-model="email"
        type="email"
        placeholder="seu@email.com"
        @keydown.enter="pedirCodigo"
      >

      <button class="btn" :disabled="enviando" @click="pedirCodigo">
        {{ enviando ? 'Enviando…' : 'Enviar código' }}
      </button>
      <NuxtLink to="/login" class="btn sec">Voltar ao login</NuxtLink>
    </div>
  </TelaEntrada>
</template>

<style scoped>
.card h3 { margin: 0 0 4px; }
.card .meta { margin-bottom: 10px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
