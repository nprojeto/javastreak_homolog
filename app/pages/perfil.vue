<script setup lang="ts">
/**
 * Meu perfil. Porte de VIEWS.perfilManejador + cardIdioma + cardConta +
 * salvarNetwork + trocarSenha + pedirTrocaEmail (index.html, 7717 / 1287).
 *
 * ⚠️ Três coisas herdadas que parecem detalhe e não são:
 *
 * 1. A visibilidade na rede NÃO fica neste formulário. Ela tem botão próprio,
 *    porque `apiSalvarNetwork` preserva o valor quando o campo não vem — e o
 *    legado já escondeu gente da rede sem querer ao salvar o perfil.
 * 2. A troca de e-mail é em duas etapas, com o código indo para o endereço
 *    NOVO: só confirma quem tem acesso a ele.
 * 3. O campo de senha atual nasce `readonly` e só libera no foco. É isso que
 *    impede o navegador de despejar a senha salva ali.
 */
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { useSessaoApp } from '~/composables/useSessaoApp'
import { SENHA_REGRA, senhaForte, faltasDaSenha } from '~/composables/useSenha'

definePageMeta({ layout: 'app' })

const auth = useAuth()
const ui = useUi()
const { server } = useServer()
const { carregarCreditos } = useSessaoApp()
const { lang, setLang, IDIOMAS, BANDEIRA } = useTraducao()

type Idm = 'pt' | 'en' | 'es'
const m = computed(() => auth.manejador || {})

const nome = ref('')
const sexo = ref('Masculino')
const whatsapp = ref('')
const telefone = ref('')
const cidade = ref('')
const bio = ref('')
const lat = ref('')
const lng = ref('')
const foto = ref('')
const salvando = ref(false)
const visivel = ref(false)

/**
 * ⚠️ Não copie a ficha só na montagem. O `apiBoot` que a traz do servidor
 * ainda está a caminho quando esta tela monta — e o resultado era cruel: o
 * cabeçalho mostrava o nome (é reativo) e o formulário aparecia VAZIO,
 * parecendo que nada tinha sido salvo. Estava tudo salvo; a tela é que
 * congelava a cópia.
 *
 * `preenchido` garante que a chegada tardia não apague o que a pessoa já
 * começou a digitar.
 */
const preenchido = ref(false)
watch(m, (f) => {
  if (preenchido.value || !f || !f.id) return
  nome.value = String(f.nome || '')
  sexo.value = String(f.sexo || 'Masculino')
  whatsapp.value = String(f.whatsapp || '')
  telefone.value = String(f.telefone || '')
  cidade.value = String(f.cidade || '')
  bio.value = String(f.bioNetwork || '')
  lat.value = String(f.latNetwork || f.lat || '')
  lng.value = String(f.lngNetwork || f.lng || '')
  visivel.value = String(f.visivelNetwork || '') === 'Sim'
  preenchido.value = true
}, { immediate: true, deep: true })
const trocandoVis = ref(false)
const temCoord = computed(() => !!(lat.value && lng.value))

const emailNovo = ref(auth.login)
const pedindoEmail = ref(false)
const aguardandoCodigo = ref(false)
const codigoEmail = ref('')

const senhaAtual = ref('')
const senhaNova = ref('')
const senhaNova2 = ref('')
const liberouSenha = ref(false)
const trocandoSenha = ref(false)
const faltas = computed(() => (senhaNova.value ? faltasDaSenha(senhaNova.value) : []))

function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { foto.value = ''; return }
  if (f.size > 8 * 1024 * 1024) {
    ui.avisar('Imagem muito grande (máximo 8 MB)', 'erro')
    return
  }
  const r = new FileReader()
  r.onload = () => { foto.value = String(r.result || '') }
  r.readAsDataURL(f)
}

async function salvar() {
  if (nome.value.trim().length < 2) { ui.avisar('Informe seu nome', 'erro'); return }
  salvando.value = true
  try {
    const r = await server<{ manejador?: Record<string, unknown>; bloqueado?: boolean }>(
      'apiSalvarNetwork',
      {
        nome: nome.value, sexo: sexo.value, whatsapp: whatsapp.value,
        telefone: telefone.value, cidade: cidade.value, bio: bio.value,
        lat: lat.value, lng: lng.value, foto: foto.value
        /* `visivel` fica de fora de propósito — ver o comentário do topo. */
      }
    )
    if (r?.manejador) auth.manejador = r.manejador
    foto.value = ''
    ui.avisar(r?.bloqueado
      ? 'Perfil salvo, mas falta a localização para aparecer na rede'
      : 'Perfil salvo ✔')
    await carregarCreditos(true)
  } catch { /* o useServer já avisou */ } finally {
    salvando.value = false
  }
}

async function alternarVisibilidade() {
  trocandoVis.value = true
  try {
    const r = await server<{ visivel: boolean; motivo?: string }>(
      'apiSetVisivelNetwork', !visivel.value
    )
    visivel.value = !!r.visivel
    ui.avisar(r.motivo || (r.visivel ? 'Seu perfil aparece na rede ✔' : 'Seu perfil saiu da rede'))
  } catch { /* já avisado */ } finally {
    trocandoVis.value = false
  }
}

async function pedirTrocaEmail() {
  if (!senhaAtual.value) {
    ui.avisar('Digite sua senha atual, no bloco abaixo, para trocar o e-mail', 'erro')
    return
  }
  pedindoEmail.value = true
  try {
    await server('apiSolicitarTrocaEmail', emailNovo.value, senhaAtual.value)
    aguardandoCodigo.value = true
    ui.avisar('Código enviado para o e-mail novo')
  } catch { /* já avisado */ } finally {
    pedindoEmail.value = false
  }
}

async function confirmarTrocaEmail() {
  try {
    const r = await server<{ login: string }>('apiConfirmarTrocaEmail', codigoEmail.value)
    auth.login = r.login
    aguardandoCodigo.value = false
    codigoEmail.value = ''
    ui.avisar('E-mail alterado ✔')
  } catch { /* já avisado */ }
}

async function trocarSenha() {
  if (!senhaAtual.value) { ui.avisar('Digite a senha atual', 'erro'); return }
  if (!senhaForte(senhaNova.value)) { ui.avisar(SENHA_REGRA, 'erro'); return }
  if (senhaNova.value !== senhaNova2.value) { ui.avisar('Senhas não conferem', 'erro'); return }
  trocandoSenha.value = true
  try {
    await server('apiTrocarSenha', senhaAtual.value, senhaNova.value)
    senhaAtual.value = ''; senhaNova.value = ''; senhaNova2.value = ''
    ui.avisar('Senha alterada ✔')
  } catch { /* já avisado */ } finally {
    trocandoSenha.value = false
  }
}

async function escolherIdioma(l: Idm) {
  const anterior = lang.value
  await setLang(l)
  try {
    await server('apiSalvarIdioma', l)
  } catch {
    ui.avisar('Idioma trocado aqui, mas não foi salvo na conta', 'erro')
  }
  /* Voltar ao português precisa de recarga: o varredor já trocou os textos no
     DOM e não há como desfazer sem redesenhar. Só DEPOIS de salvar — senão a
     conta fica no idioma antigo e o boot desfaz a escolha. */
  if (l === 'pt' && anterior !== 'pt') window.location.reload()
}
</script>

<template>
  <div>
    <div class="card">
      <h3>Idioma</h3>
      <div class="meta">O idioma fica salvo na sua conta e acompanha você em qualquer aparelho.</div>
      <div class="lang-sel">
        <button
          v-for="(rot, l) in IDIOMAS"
          :key="l"
          :title="rot"
          :class="{ on: lang === l }"
          @click="escolherIdioma(l as Idm)"
        >{{ BANDEIRA[l as Idm] }} {{ String(l).toUpperCase() }}</button>
      </div>
    </div>

    <div v-if="m.bloqueado === 'Sim'" class="card bloqueado">
      <div class="meta">
        🚩 <b>Seu perfil está bloqueado</b> por denúncias e está em análise.
        Enquanto isso, você não aparece na rede, no mapa nem no ranking.
      </div>
    </div>

    <div class="card">
      <h3>Perfil público na rede</h3>
      <div class="meta">
        {{ visivel ? 'Seu perfil aparece no mapa da rede.' : 'Seu perfil está oculto.' }}
      </div>
      <button
        class="btn"
        :class="{ sec: visivel }"
        :disabled="trocandoVis || (!visivel && !temCoord)"
        @click="alternarVisibilidade"
      >{{ visivel ? 'Ocultar da rede' : 'Aparecer na rede' }}</button>
      <div v-if="!temCoord" class="meta aviso">
        ⚠️ Preencha a localização abaixo antes de aparecer na rede.
      </div>
    </div>

    <div class="card">
      <h3>Seus dados</h3>

      <label for="p_nome">Seu nome *</label>
      <input id="p_nome" v-model="nome" placeholder="Nome completo">

      <label for="p_foto">Foto do perfil</label>
      <img v-if="foto" :src="foto" class="foto-prev" alt="Prévia">
      <img
        v-else-if="m.fotoUrl"
        :src="String(m.fotoUrl)"
        class="foto-prev"
        alt="Foto atual"
      >
      <input id="p_foto" type="file" accept="image/*" @change="escolheuFoto">

      <label for="p_sexo">Sexo (define seu avatar padrão)</label>
      <select id="p_sexo" v-model="sexo">
        <option>Masculino</option>
        <option>Feminino</option>
      </select>

      <label for="p_wa">WhatsApp (contato)</label>
      <input id="p_wa" v-model="whatsapp" placeholder="DDD + número">

      <label for="p_tel">Telefone</label>
      <input id="p_tel" v-model="telefone">

      <label for="p_cid">Cidade / região</label>
      <input id="p_cid" v-model="cidade">

      <label for="p_bio">Sobre você</label>
      <textarea id="p_bio" v-model="bio" placeholder="Ex: manejo com cães, aberto a parcerias" />

      <BotaoGps v-model:lat="lat" v-model:lng="lng" />

      <div v-if="!temCoord" class="meta aviso">
        ⚠️ Sem a localização preenchida você não aparece no mapa da rede e também
        não vê os outros manejadores. Lojistas você vê sempre.
      </div>

      <button class="btn" :disabled="salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : 'Salvar perfil' }}
      </button>
    </div>

    <div class="card">
      <h3>Conta</h3>

      <label for="c_email">E-mail de acesso</label>
      <input id="c_email" v-model="emailNovo" type="email">
      <div class="meta ajuda">
        Trocar o e-mail exige a senha atual e a confirmação de um código enviado
        ao endereço novo.
      </div>

      <template v-if="aguardandoCodigo">
        <label for="c_cod">Código enviado ao novo e-mail *</label>
        <input id="c_cod" v-model="codigoEmail" inputmode="numeric" maxlength="6" class="codigo">
        <button class="btn sec" @click="confirmarTrocaEmail">Confirmar novo e-mail</button>
      </template>
      <button v-else class="btn sec" :disabled="pedindoEmail" @click="pedirTrocaEmail">
        {{ pedindoEmail ? 'Enviando…' : 'Alterar e-mail' }}
      </button>

      <hr>

      <h3>Alterar senha</h3>
      <label for="c_atual">Senha atual *</label>
      <input
        id="c_atual"
        v-model="senhaAtual"
        type="password"
        autocomplete="off"
        :readonly="!liberouSenha"
        @focus="liberouSenha = true"
      >
      <NuxtLink to="/esqueci" class="btn sm sec esq">Esqueci a senha</NuxtLink>

      <label for="c_nova">Nova senha *</label>
      <input id="c_nova" v-model="senhaNova" type="password" autocomplete="new-password">
      <div class="meta regra">{{ SENHA_REGRA }}</div>
      <div v-if="faltas.length" class="meta ruim">Falta: {{ faltas.join(', ') }}</div>
      <div v-else-if="senhaNova" class="meta bom">Senha aceita ✓</div>

      <label for="c_nova2">Confirmar nova senha *</label>
      <input id="c_nova2" v-model="senhaNova2" type="password" autocomplete="new-password">

      <button class="btn sec" :disabled="trocandoSenha" @click="trocarSenha">
        {{ trocandoSenha ? 'Salvando…' : 'Salvar nova senha' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.card > .meta { margin-bottom: 8px; }
.bloqueado { border-left: 5px solid #8a3a2c; }
.lang-sel { display: flex; gap: 6px; }
.lang-sel button {
  flex: 1; padding: 9px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: #fff; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--txt);
}
.lang-sel button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.foto-prev { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; display: block; margin: 4px 0 8px; }
.aviso { color: var(--laranja-esc); margin-top: 8px; }
.ajuda { margin: -4px 0 8px; }
.codigo { text-align: center; letter-spacing: 6px; font-size: 20px; }
.esq { width: auto; margin: -2px 0 10px; text-decoration: none; }
.regra { margin: -4px 0 4px; }
.ruim { color: var(--danger); margin: -2px 0 8px; }
.bom { color: var(--ok); margin: -2px 0 8px; }
hr { border: 0; border-top: 1px solid var(--linha); margin: 16px 0; }
</style>
