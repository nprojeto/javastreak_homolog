<script setup lang="ts">
/**
 * Verificação anti-robô (Cloudflare Turnstile). Porte de blocoDesafio/
 * carregarDesafio/montarTurnstile/resetarCaptcha.
 *
 * ⚠️ O token do Turnstile vale UMA vez. Depois de um cadastro recusado é
 * preciso renovar, senão a segunda tentativa é rejeitada pelo servidor mesmo
 * com todos os dados certos. Por isso o `reset()` exposto abaixo.
 *
 * ⚠️ O widget só responde nos hostnames autorizados no painel da Cloudflare.
 * Domínio novo sem cadastro = caixa que nunca marca, e não é bug do código.
 *
 * ⚠️ NÃO dependa só do `callback`. Ele nem sempre chega ao componente, e o
 * sintoma é cruel: a caixa marca ✓, o token existe no DOM, e o formulário
 * insiste que falta a verificação. Por isso `pegarToken()` consulta, em
 * ordem: o que o callback guardou, o `getResponse()` oficial da Cloudflare e,
 * por último, o campo escondido que o próprio widget cria.
 */
const token = defineModel<string>({ default: '' })

const { server } = useServer()

const caixa = ref<HTMLElement | null>(null)
const aviso = ref('')
let widgetId: string | null = null

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, o: Record<string, unknown>) => string
      reset: (id: string) => void
      getResponse: (id: string) => string | undefined
    }
  }
}

function montar(siteKey: string) {
  const desenhar = () => {
    if (!window.turnstile || !caixa.value) return
    widgetId = window.turnstile.render(caixa.value, {
      sitekey: siteKey,
      theme: 'light',
      callback: (tk: string) => { token.value = tk },
      'expired-callback': () => { token.value = '' },
      'error-callback': () => { token.value = '' }
    })
  }
  if (window.turnstile) return desenhar()
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.async = true
  s.defer = true
  s.onload = desenhar
  document.head.appendChild(s)
}

/**
 * Token atual, por três caminhos. A tela chama isto na hora de enviar, em vez
 * de ler o v-model direto.
 */
function pegarToken(): string {
  if (token.value) return token.value
  try {
    if (window.turnstile && widgetId !== null) {
      const r = window.turnstile.getResponse(widgetId)
      if (r) { token.value = r; return r }
    }
  } catch { /* widget ainda não pronto */ }
  const campo = caixa.value?.querySelector<HTMLInputElement>(
    'input[name="cf-turnstile-response"]'
  )
  if (campo?.value) { token.value = campo.value; return campo.value }
  return ''
}

/** Chamado pela tela quando o cadastro falha: token queimado, pede outro. */
function reset() {
  token.value = ''
  try {
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId)
  } catch { /* widget já foi embora */ }
}
defineExpose({ reset, pegarToken })

onMounted(async () => {
  try {
    const c = await server<{ siteKey: string }>('apiCaptchaConfig')
    if (c.siteKey) montar(c.siteKey)
    else aviso.value = 'A verificação anti-robô ainda não foi configurada no servidor.'
  } catch {
    aviso.value = 'Não foi possível carregar a verificação de segurança.'
  }
})
</script>

<template>
  <label>Verificação de segurança *</label>
  <div v-if="aviso" class="ausente">
    <div class="meta">
      🔒 {{ aviso }} O cadastro fica indisponível até o administrador configurar.
      Já tem conta? <NuxtLink to="/login">Entrar</NuxtLink>.
    </div>
  </div>
  <div v-else ref="caixa" class="ts-box" />
</template>

<style scoped>
.ts-box { min-height: 65px; margin-bottom: 8px; }
.ausente { border-left: 5px solid var(--alerta); padding: 10px 12px; background: #fff4e5; border-radius: 8px; margin-bottom: 8px; }
.ausente a { color: var(--laranja); font-weight: 600; }
</style>
