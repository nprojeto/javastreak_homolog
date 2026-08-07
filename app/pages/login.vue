<script setup lang="ts">
/**
 * Login. Porte de VIEWS.login + fazerLogin (index.html, linhas 5532 e 6308).
 *
 * Detalhe que veio junto de propósito: senha certa com e-mail ainda não
 * confirmado NÃO cai em "login inválido". O backend devolve
 * EMAIL_NAO_CONFIRMADO e a pessoa é levada para o código, com reenvio
 * automático — sem isso ela fica presa achando que errou a senha.
 */
import { useAuth } from '~/stores/auth'
import type { RespostaAuth } from '~/stores/auth'
import { ErroApi } from '~/composables/useServer'
import { useUi } from '~/stores/ui'

const { tk } = useTraducao()
const { server } = useServer()
const auth = useAuth()
const ui = useUi()
const router = useRouter()

const tipo = ref<'manejador' | 'empresa'>('manejador')
const email = ref('')
const senha = ref('')
const enviando = ref(false)

function normEmail(x: string) {
  return String(x || '').trim().toLowerCase()
}

async function entrar() {
  if (!email.value || !senha.value) {
    ui.avisar('Preencha login e senha', 'erro')
    return
  }
  enviando.value = true
  try {
    const r = await server<RespostaAuth>('apiLogin', email.value, senha.value)
    if (!auth.aplicarAuth(r)) {
      ui.avisar('Não foi possível entrar. Atualize a página e tente de novo.', 'erro')
      return
    }
    await router.push('/inicio')
  } catch (e) {
    if (e instanceof ErroApi && e.codigo === 'EMAIL_NAO_CONFIRMADO') {
      const alvo = normEmail(email.value)
      // Reenvia sem travar a navegação: se falhar, a própria tela tem o botão.
      server('apiReenviarCodigo', alvo).catch(() => {})
      ui.avisar('Confirme seu e-mail para entrar')
      await router.push({ path: '/confirmar-email', query: { email: alvo } })
      return
    }
    /* Demais erros já apareceram como aviso pelo useServer. */
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <TelaEntrada versao>
    <div class="segbar">
      <button :class="{ on: tipo === 'manejador' }" @click="tipo = 'manejador'">
        <Icone nome="manejador" /> {{ tk('manejador') }}
      </button>
      <button :class="{ on: tipo === 'empresa' }" @click="tipo = 'empresa'">
        <Icone nome="loja" /> {{ tk('empresa') }}
      </button>
    </div>

    <div class="card">
      <h3>
        {{ tk('entrar') }}
        {{ tipo === 'empresa' ? tk('lg_como_emp') : tk('lg_como_manej') }}
      </h3>
      <div class="meta">{{ tk('lg_acesse') }}</div>

      <label for="l_login">{{ tk('email') }}</label>
      <input
        id="l_login"
        v-model="email"
        type="email"
        autocomplete="username"
        placeholder="seu@email.com"
        @keydown.enter="entrar"
      >

      <label for="l_senha">{{ tk('senha') }}</label>
      <input
        id="l_senha"
        v-model="senha"
        type="password"
        autocomplete="current-password"
        placeholder="••••••"
        @keydown.enter="entrar"
      >

      <button class="btn" :disabled="enviando" @click="entrar">
        {{ enviando ? 'Entrando…' : tk('entrar') }}
      </button>

      <div class="esqueci">
        <NuxtLink to="/esqueci">{{ tk('esqueciSenha') }}</NuxtLink>
      </div>
    </div>

    <NuxtLink to="/" class="btn sec">{{ tk('voltar') }}</NuxtLink>
  </TelaEntrada>
</template>

<style scoped>
.card h3 { margin-bottom: 2px; }
.card .meta { margin-bottom: 6px; }
.esqueci { text-align: center; margin-top: 10px; }
.esqueci a { font-size: 13px; color: var(--laranja-esc); cursor: pointer; }
.btn.sec { margin-top: 10px; text-decoration: none; }
</style>
