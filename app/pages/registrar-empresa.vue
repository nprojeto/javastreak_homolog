<script setup lang="ts">
/**
 * Cadastro de empresa. Porte de VIEWS.registrarEmpresa + salvarEmpresaConta
 * (index.html, linhas 6593 e 6619).
 *
 * Diferenças de verdade em relação ao cadastro de manejador: não pede data de
 * nascimento nem CPF (pede CNPJ), tem segmento e redes sociais, e aceita uma
 * foto de logo. O resto — termo, captcha, indicação, WhatsApp obrigatório,
 * localização obrigatória — é idêntico.
 */
import { useApp } from '~/stores/app'
import { useAuth } from '~/stores/auth'
import type { RespostaAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { ErroApi } from '~/composables/useServer'
import { SENHA_REGRA, senhaForte } from '~/composables/useSenha'
import { maskCNPJ, whatsValido } from '~/composables/useMascaras'

const SEGMENTOS = [
  'Agricultor', 'Despachante', 'Clube de tiro', 'Loja de artigos de caça',
  'Veterinário', 'Canil', 'Outro'
]

const app = useApp()
const auth = useAuth()
const ui = useUi()
const { server } = useServer()
const router = useRouter()

const email = ref('')
const senha = ref('')
const senha2 = ref('')
const cnpj = ref('')
const nome = ref('')
const segmento = ref(SEGMENTOS[0])
const descricao = ref('')
const telefone = ref('')
const whatsapp = ref('')
const cidade = ref('')
const endereco = ref('')
const lat = ref('')
const lng = ref('')
const instagram = ref('')
const facebook = ref('')
const site = ref('')
const foto = ref('')

const chaveInd = ref('')
const aceito = ref(false)
const versaoTermo = ref('')
const captcha = ref('')

const enviando = ref(false)
const refCaptcha = ref<{ reset: () => void; pegarToken: () => string } | null>(null)
const refIndicacao = ref<{ validar: () => boolean } | null>(null)

watch(cnpj, (v) => { cnpj.value = maskCNPJ(v) })

onMounted(async () => {
  if (app.carregado) return
  try {
    app.aplicarPing(await server('apiPing'))
  } catch { /* sem ping, o servidor decide */ }
})

/** O backend recebe a imagem como data URL e sobe para o bucket público. */
function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { foto.value = ''; return }
  if (f.size > 8 * 1024 * 1024) {
    ui.avisar('Imagem muito grande (máximo 8 MB)', 'erro')
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  const r = new FileReader()
  r.onload = () => { foto.value = String(r.result || '') }
  r.onerror = () => ui.avisar('Não foi possível ler a imagem', 'erro')
  r.readAsDataURL(f)
}

async function criar() {
  if (!email.value || email.value.indexOf('@') < 0) {
    return ui.avisar('Informe um e-mail válido', 'erro')
  }
  if (!senhaForte(senha.value)) return ui.avisar(SENHA_REGRA, 'erro')
  if (senha.value !== senha2.value) return ui.avisar('Senhas não conferem', 'erro')
  if (!nome.value) return ui.avisar('Informe o nome da empresa', 'erro')
  if (!lat.value || !lng.value) return ui.avisar('Informe a localização da sede', 'erro')
  if (!whatsValido(whatsapp.value)) return ui.avisar('Informe o WhatsApp da empresa', 'erro')
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
        tipo: 'empresa',
        email: email.value, login: email.value, senha: senha.value,
        nome: nome.value, segmento: segmento.value, descricao: descricao.value,
        telefone: telefone.value, whatsapp: whatsapp.value,
        cidade: cidade.value, endereco: endereco.value,
        lat: lat.value, lng: lng.value,
        instagram: instagram.value, facebook: facebook.value, site: site.value,
        foto: foto.value, cnpj: cnpj.value,
        aceiteTermo: true, versaoTermo: versaoTermo.value, maiorIdade: true,
        chaveIndicacao: chaveInd.value,
        captcha: tokenCaptcha
      }
    )
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
    if (e instanceof ErroApi && e.codigo === 'VAGAS_ESGOTADAS') app.esgotou('empresa')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <TelaEntrada>
    <ParedeVagas v-if="!app.vagas.empresa" tipo="empresa" />

    <template v-else>
      <AbasTipoConta atual="empresa" />
      <ResumoPlataforma tipo="empresa" />

      <div class="card">
        <h3>Dados de acesso</h3>
        <label for="fe_login">E-mail *</label>
        <input id="fe_login" v-model="email" type="email" autocomplete="username" placeholder="seu@email.com">

        <CampoSenha v-model:senha="senha" v-model:confirma="senha2" />
        <BlocoIndicacao ref="refIndicacao" v-model="chaveInd" />

        <label for="fe_cnpj">CNPJ</label>
        <input id="fe_cnpj" v-model="cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" maxlength="18">
      </div>

      <div class="card">
        <h3>Dados da empresa</h3>
        <label for="fe_nome">Nome da empresa *</label>
        <input id="fe_nome" v-model="nome">

        <label for="fe_seg">Segmento *</label>
        <select id="fe_seg" v-model="segmento">
          <option v-for="s in SEGMENTOS" :key="s">{{ s }}</option>
        </select>

        <label for="fe_desc">Descrição</label>
        <textarea id="fe_desc" v-model="descricao" placeholder="O que sua empresa oferece" />

        <CampoTelefone v-model="telefone" label="Telefone" />
        <CampoTelefone v-model="whatsapp" label="WhatsApp" obrigatorio />

        <label for="fe_cidade">Cidade</label>
        <input id="fe_cidade" v-model="cidade">

        <label for="fe_end">Endereço / sede</label>
        <input id="fe_end" v-model="endereco">

        <BotaoGps v-model:lat="lat" v-model:lng="lng" />

        <label for="fe_insta">Instagram</label>
        <input id="fe_insta" v-model="instagram" placeholder="@seuperfil">
        <label for="fe_face">Facebook</label>
        <input id="fe_face" v-model="facebook">
        <label for="fe_site">Site</label>
        <input id="fe_site" v-model="site" placeholder="https://...">

        <label for="fe_foto">Logo/foto</label>
        <input id="fe_foto" type="file" accept="image/*" @change="escolheuFoto">
        <img v-if="foto" :src="foto" class="prev" alt="Prévia do logo">

        <div class="meta rodape">
          Sua empresa já aparece na rede após o cadastro. Conteúdo ofensivo pode
          ser denunciado por outros usuários.
        </div>
      </div>

      <BlocoTermo v-model:aceito="aceito" v-model:versao="versaoTermo" />

      <div class="card">
        <BlocoCaptcha ref="refCaptcha" v-model="captcha" />
        <button class="btn" :disabled="enviando" @click="criar">
          {{ enviando ? 'Criando…' : 'Criar conta de empresa' }}
        </button>
        <NuxtLink to="/" class="btn sec">✕ Cancelar</NuxtLink>
      </div>
    </template>
  </TelaEntrada>
</template>

<style scoped>
.prev { max-width: 140px; border-radius: 12px; margin-top: 8px; display: block; }
.rodape { margin-top: 8px; }
.btn.sec { margin-top: 8px; text-decoration: none; }
</style>
