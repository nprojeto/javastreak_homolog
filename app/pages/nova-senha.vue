<script setup lang="ts">
/**
 * Recuperar senha, etapa 2. Porte de VIEWS.novaSenha + salvarNovaSenha
 * (index.html, linha 6339). Código de 6 dígitos, válido por 30 minutos.
 */
import { useUi } from '~/stores/ui'
import { SENHA_REGRA, senhaForte, faltasDaSenha } from '~/composables/useSenha'

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const email = computed(() => String(route.query.email || ''))
const codigo = ref('')
const senha1 = ref('')
const senha2 = ref('')
const salvando = ref(false)

const faltas = computed(() => (senha1.value ? faltasDaSenha(senha1.value) : []))

async function salvar() {
  if (!codigo.value) { ui.avisar('Informe o código', 'erro'); return }
  if (!senhaForte(senha1.value)) { ui.avisar(SENHA_REGRA, 'erro'); return }
  if (senha1.value !== senha2.value) { ui.avisar('Senhas não conferem', 'erro'); return }
  salvando.value = true
  try {
    await server('apiConfirmarReset', email.value, codigo.value, senha1.value)
    ui.avisar('Senha alterada! Faça login.')
    await router.push('/login')
  } catch {
    /* o useServer já avisou */
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <TelaEntrada>
    <div class="card">
      <h3>Digite o código</h3>
      <div class="meta">
        Enviamos um código para <b>{{ email }}</b>. Ele vale por 30 minutos.
        Verifique também a caixa de spam.
      </div>

      <label for="rs_cod">Código *</label>
      <input
        id="rs_cod"
        v-model="codigo"
        inputmode="numeric"
        maxlength="6"
        placeholder="000000"
        class="codigo"
      >

      <label for="rs_s1">Nova senha *</label>
      <input id="rs_s1" v-model="senha1" type="password" autocomplete="new-password">

      <div class="meta regra">{{ SENHA_REGRA }}</div>
      <div v-if="faltas.length" class="meta falta">
        Falta: {{ faltas.join(', ') }}
      </div>
      <div v-else-if="senha1" class="meta ok">Senha aceita ✓</div>

      <label for="rs_s2">Confirmar *</label>
      <input id="rs_s2" v-model="senha2" type="password" autocomplete="new-password">

      <button class="btn" :disabled="salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : 'Redefinir senha' }}
      </button>
      <NuxtLink to="/esqueci" class="btn sec">Reenviar código</NuxtLink>
    </div>
  </TelaEntrada>
</template>

<style scoped>
.card h3 { margin: 0 0 4px; }
.card .meta { margin-bottom: 10px; }
.codigo { text-align: center; letter-spacing: 6px; font-size: 22px; }
.regra { margin: -4px 0 4px; }
.falta { color: var(--danger); margin: -2px 0 8px; }
.ok { color: var(--ok); margin: -2px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
