<script setup lang="ts">
/**
 * Confirmação de conta por código. Porte de VIEWS.confirmarEmail e das funções
 * confirmarEmailAgora / reenviarCodigo (index.html, linha 5505).
 *
 * O e-mail vem pela URL (?email=), e não por variável global como no legado
 * (`CONF_EMAIL`) — assim recarregar a página não perde o alvo.
 *
 * Confirmar É o primeiro acesso: o backend devolve a sessão pronta, então
 * daqui se entra direto, sem passar pelo login.
 */
import { useAuth } from '~/stores/auth'
import type { RespostaAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const auth = useAuth()
const ui = useUi()

const alvo = computed(() => String(route.query.email || ''))
const codigo = ref('')
const confirmando = ref(false)
const reenviando = ref(false)

async function confirmar() {
  if (codigo.value.replace(/\D/g, '').length !== 6) {
    ui.avisar('Digite o código de 6 dígitos', 'erro')
    return
  }
  confirmando.value = true
  try {
    const r = await server<RespostaAuth>('apiConfirmarEmail', alvo.value, codigo.value)
    if (!auth.aplicarAuth(r)) {
      ui.avisar('Não foi possível entrar. Atualize a página e tente de novo.', 'erro')
      return
    }
    ui.avisar('Conta confirmada ✔ Bem-vindo!')
    await router.push('/inicio')
  } catch {
    /* O useServer já avisou. Deixa a pessoa tentar outro código. */
  } finally {
    confirmando.value = false
  }
}

async function reenviar() {
  reenviando.value = true
  try {
    await server('apiReenviarCodigo', alvo.value)
    ui.avisar('Código reenviado ✔')
  } catch {
    /* idem */
  } finally {
    reenviando.value = false
  }
}
</script>

<template>
  <TelaEntrada>
    <div class="card">
      <h3>📧 Confirme seu e-mail</h3>
      <div class="meta">
        Enviamos um código de 6 dígitos para <b>{{ alvo }}</b>. Ele vale por 24 horas.
      </div>

      <label for="cf_cod">Código *</label>
      <input
        id="cf_cod"
        v-model="codigo"
        inputmode="numeric"
        maxlength="6"
        placeholder="000000"
        class="codigo"
        @keydown.enter="confirmar"
      >

      <button class="btn" :disabled="confirmando" @click="confirmar">
        {{ confirmando ? 'Confirmando…' : 'Confirmar e entrar' }}
      </button>

      <div class="two">
        <button class="btn sec" :disabled="reenviando" @click="reenviar">
          {{ reenviando ? 'Enviando…' : 'Reenviar código' }}
        </button>
        <NuxtLink to="/" class="btn sec">Voltar</NuxtLink>
      </div>

      <div class="meta rodape">Não achou? Procure no spam e na aba Promoções.</div>
    </div>
  </TelaEntrada>
</template>

<style scoped>
.card h3 { margin: 0 0 6px; }
.card .meta { margin-bottom: 10px; }
.codigo { text-align: center; letter-spacing: 8px; font-size: 22px; }
.two { margin-top: 8px; }
.two .btn { text-decoration: none; }
.rodape { margin-top: 10px; margin-bottom: 0; }
</style>
