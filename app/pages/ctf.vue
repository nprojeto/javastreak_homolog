<script setup lang="ts">
/**
 * CTF — Cadastro Técnico Federal do IBAMA. Porte de VIEWS.ctf + pintarTelaCtf
 * + salvarCtf (index.html, 10053).
 *
 * ⚠️ É A PORTA DE TUDO. Sem CTF válido — com anexo e validade futura — não se
 * abre ciclo, não se entra num ciclo aberto, não se aceita convite, não se
 * registra abate e não se cadastra ceva ou rota.
 *
 * ⚠️ Tela própria, de propósito. O CTF NÃO aparece na Documentação: ter duas
 * portas para o mesmo registro deixaria criar um CTF sem anexo por fora, e a
 * trava da caça passaria a valer sobre um registro nunca conferido. O backend
 * recusa o tipo reservado em `apiSalvarDocumento` justamente por isso.
 */
import { useUi } from '~/stores/ui'
import { useSessaoApp } from '~/composables/useSessaoApp'
import { statusVencimento } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Ctf {
  existe: boolean; id?: string; numero?: string; emissao?: string
  vencimento?: string; arquivoNome?: string; temArquivo?: boolean
  emDia?: boolean; diasRestantes?: number | null
}

const { server } = useServer()
const ui = useUi()
const { carregarCreditos } = useSessaoApp()

const ctf = ref<Ctf | null>(null)
const erro = ref('')
const numero = ref('')
const emissao = ref('')
const validade = ref('')
const arq = ref('')
const arqNome = ref('')
const salvando = ref(false)

const selo = computed(() => {
  const c = ctf.value
  if (!c?.existe) return { classe: 'venc', texto: 'sem CTF' }
  return c.emDia
    ? { classe: 'ok', texto: 'em dia' }
    : { classe: 'venc', texto: 'vencido' }
})
const situacao = computed(() => statusVencimento(ctf.value?.vencimento))

async function carregar() {
  erro.value = ''
  try {
    const c = await server<Ctf>('apiMeuCtf')
    ctf.value = c
    numero.value = c.numero || ''
    emissao.value = String(c.emissao || '').slice(0, 10)
    validade.value = String(c.vencimento || '').slice(0, 10)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o CTF'
  }
}

async function salvar() {
  if (!numero.value) { ui.avisar('Informe o número do registro', 'erro'); return }
  if (!emissao.value) { ui.avisar('Informe a data de emissão', 'erro'); return }
  if (!validade.value) { ui.avisar('Informe a validade', 'erro'); return }
  if (validade.value < emissao.value) {
    ui.avisar('A validade não pode ser anterior à emissão', 'erro'); return
  }
  if (!arq.value && !ctf.value?.temArquivo) {
    ui.avisar('O anexo é obrigatório: é ele que comprova o registro.', 'erro'); return
  }
  salvando.value = true
  try {
    await server('apiSalvarCtf', {
      numero: numero.value, emissao: emissao.value, vencimento: validade.value,
      arquivo: arq.value, arquivoNome: arqNome.value
    })
    ui.avisar('CTF salvo ✔')
    arq.value = ''; arqNome.value = ''
    await carregar()
    /* O CTF destrava botões em várias telas — a faixa precisa saber. */
    await carregarCreditos(true)
  } catch { /* o useServer já avisou */ } finally {
    salvando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="CTF" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!ctf" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card topo">
        <h3>
          <Icone nome="documentos" /> Cadastro Técnico Federal
          <span class="doc-tag" :class="selo.classe">{{ selo.texto }}</span>
        </h3>
        <div class="meta">
          Inscrição no CTF do IBAMA, categoria manejo de fauna exótica invasora
          (código 21-58). O certificado de regularidade vale 3 meses.
        </div>
        <div v-if="ctf.existe && !ctf.emDia" class="meta ruim">
          <Icone nome="alerta" /> Enquanto estiver vencido você não abre caçada, não registra abate e
          não pode ser convidado.
        </div>
        <div v-else-if="situacao && situacao.dias <= 30" class="meta alerta">
          <Icone nome="alerta" /> {{ situacao.texto }}. Renove antes de perder o acesso à caçada.
        </div>
      </div>

      <div class="card">
        <label for="ctf_num">Número do registro *</label>
        <input id="ctf_num" v-model="numero" class="no-i18n" placeholder="21-58 / ...">

        <div class="two">
          <div><CampoData v-model="emissao" label="Emissão" obrigatorio /></div>
          <div><CampoData v-model="validade" label="Validade" obrigatorio /></div>
        </div>

        <CampoArquivo
          v-model:dados="arq"
          v-model:nome="arqNome"
          obrigatorio
          :doc-id="ctf.id"
          :tem-arquivo="ctf.temArquivo"
          :arquivo-nome="ctf.arquivoNome"
        />

        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar CTF' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 6px; }
.topo .meta + .meta { margin-top: 6px; }
.ruim { color: var(--danger); }
.alerta { color: var(--laranja-esc); }
.doc-tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); vertical-align: middle; }
.doc-tag.ok { background: var(--verde-claro); color: var(--verde-esc); }
.doc-tag.venc { background: #3A1E1C; color: var(--danger); }
</style>
