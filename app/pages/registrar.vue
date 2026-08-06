<script setup lang="ts">
/**
 * Cadastro de manejador. Porte de VIEWS.registrar + salvarConta
 * (index.html, linhas 6411 e 6551).
 *
 * A ordem das validações é a mesma do legado, de propósito: o que é barato de
 * conferir vem antes do que custa uma chamada ao servidor.
 *
 * ⚠️ Depois de qualquer recusa o captcha é resetado. O token do Turnstile vale
 * uma vez só — sem o reset, a segunda tentativa falha mesmo com tudo certo.
 */
import { useApp } from '~/stores/app'
import { useAuth } from '~/stores/auth'
import type { RespostaAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { ErroApi } from '~/composables/useServer'
import { SENHA_REGRA, senhaForte } from '~/composables/useSenha'
import { maskCPF, whatsValido, maior18 } from '~/composables/useMascaras'

const app = useApp()
const auth = useAuth()
const ui = useUi()
const { server } = useServer()
const router = useRouter()

const email = ref('')
const senha = ref('')
const senha2 = ref('')
const nome = ref('')
const nasc = ref('')
const sexo = ref('Masculino')
const cpf = ref('')
const cr = ref('')
const telefone = ref('')
const whatsapp = ref('')
const endereco = ref('')
const lat = ref('')
const lng = ref('')

const chaveInd = ref('')
const aceito = ref(false)
const versaoTermo = ref('')
const captcha = ref('')

const enviando = ref(false)
const refCaptcha = ref<{ reset: () => void; pegarToken: () => string } | null>(null)
const refIndicacao = ref<{ validar: () => boolean } | null>(null)

watch(cpf, (v) => { cpf.value = maskCPF(v) })

/* O teto de contas vem do apiPing, que é público e não exige sessão. */
onMounted(async () => {
  if (app.carregado) return
  try {
    app.aplicarPing(await server('apiPing'))
  } catch { /* sem ping, o cadastro segue e o servidor decide */ }
})

async function criar() {
  if (!email.value || email.value.indexOf('@') < 0) {
    return ui.avisar('Informe um e-mail válido', 'erro')
  }
  if (!senhaForte(senha.value)) return ui.avisar(SENHA_REGRA, 'erro')
  if (senha.value !== senha2.value) return ui.avisar('Senhas não conferem', 'erro')
  if (!nome.value) return ui.avisar('Informe o nome', 'erro')
  if (!lat.value || !lng.value) {
    return ui.avisar('Informe sua localização — use o GPS ou digite a coordenada', 'erro')
  }
  if (!whatsValido(whatsapp.value)) return ui.avisar('Informe o WhatsApp', 'erro')
  if (!nasc.value) return ui.avisar('Informe a data de nascimento', 'erro')
  if (!maior18(nasc.value)) {
    return ui.avisar('É preciso ter 18 anos ou mais para criar a conta', 'erro')
  }
  if (!refIndicacao.value?.validar()) {
    return ui.avisar('Chave inválida — confira com quem indicou', 'erro')
  }
  if (!aceito.value) return ui.avisar('Role e aceite os termos de uso para continuar', 'erro')
  /* Lê pelas três portas: o callback nem sempre chega até aqui. */
  const tokenCaptcha = refCaptcha.value?.pegarToken() || ''
  if (!tokenCaptcha) return ui.avisar('Confirme a verificação de segurança', 'erro')

  enviando.value = true
  try {
    const r = await server<RespostaAuth & { precisaConfirmar?: boolean; login?: string }>(
      'apiRegistrar',
      {
        tipo: 'manejador',
        email: email.value, login: email.value, senha: senha.value,
        nome: nome.value, dataNascimento: nasc.value, sexo: sexo.value,
        cpf: cpf.value, cr: cr.value,
        telefone: telefone.value, whatsapp: whatsapp.value,
        endereco: endereco.value, lat: lat.value, lng: lng.value,
        aceiteTermo: true, versaoTermo: versaoTermo.value, maiorIdade: true,
        chaveIndicacao: chaveInd.value,
        captcha: tokenCaptcha
      }
    )
    /* O backend não devolve sessão: a conta só entra depois do código. */
    if (r && r.precisaConfirmar) {
      ui.avisar('Conta criada — confirme seu e-mail')
      return await router.push({ path: '/confirmar-email', query: { email: r.login } })
    }
    if (auth.aplicarAuth(r)) {
      ui.avisar('Conta criada ✔ Bem-vindo!')
      return await router.push('/inicio')
    }
  } catch (e) {
    refCaptcha.value?.reset()
    if (e instanceof ErroApi && e.codigo === 'VAGAS_ESGOTADAS') app.esgotou('manejador')
    /* Demais erros já apareceram pelo useServer, traduzidos. */
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <TelaEntrada>
    <ParedeVagas v-if="!app.vagas.manejador" tipo="manejador" />

    <template v-else>
      <AbasTipoConta atual="manejador" />
      <ResumoPlataforma tipo="manejador" />

      <div class="card">
        <h3>Dados de acesso</h3>
        <label for="f_login">E-mail *</label>
        <input id="f_login" v-model="email" type="email" autocomplete="username" placeholder="seu@email.com">
        <div class="meta ajuda">Este e-mail será o seu login. Ele precisa ser confirmado.</div>

        <CampoSenha v-model:senha="senha" v-model:confirma="senha2" />
        <BlocoIndicacao ref="refIndicacao" v-model="chaveInd" />
      </div>

      <div class="card">
        <h3>Dados do manejador</h3>
        <label for="f_nome">Nome completo *</label>
        <input id="f_nome" v-model="nome" placeholder="Nome do manejador">

        <div class="two">
          <div><CampoData v-model="nasc" label="Data de nascimento" obrigatorio /></div>
          <div>
            <label for="f_sexo">Sexo *</label>
            <select id="f_sexo" v-model="sexo">
              <option>Masculino</option>
              <option>Feminino</option>
            </select>
          </div>
        </div>

        <div class="two">
          <div>
            <label for="f_cpf">CPF</label>
            <input id="f_cpf" v-model="cpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14">
          </div>
          <div><label for="f_cr">CR</label><input id="f_cr" v-model="cr"></div>
        </div>

        <CampoTelefone v-model="telefone" label="Telefone" />
        <CampoTelefone v-model="whatsapp" label="WhatsApp" obrigatorio />

        <label for="f_end">Endereço</label>
        <textarea id="f_end" v-model="endereco" />

        <BotaoGps v-model:lat="lat" v-model:lng="lng" />
      </div>

      <BlocoTermo v-model:aceito="aceito" v-model:versao="versaoTermo" />

      <div class="card">
        <BlocoCaptcha ref="refCaptcha" v-model="captcha" />
        <button class="btn" :disabled="enviando" @click="criar">
          {{ enviando ? 'Criando…' : 'Criar conta e entrar' }}
        </button>
        <NuxtLink to="/" class="btn sec">✕ Cancelar</NuxtLink>
      </div>
    </template>
  </TelaEntrada>
</template>

<style scoped>
.ajuda { margin: -6px 0 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
