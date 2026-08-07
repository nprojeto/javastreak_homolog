<script setup lang="ts">
/**
 * Admin — avisos, denúncias e chamados.
 * Porte de apiCriarAviso / apiAdminDenuncias / apiAdminChamados
 * (index.html, 6845-6930).
 *
 * ⚠️ Denúncia bloqueia sozinha: atingido o número definido em Ajustes, o
 * perfil é bloqueado automaticamente. Resolver aqui é o que devolve o acesso.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'

interface Aviso {
  id: string; titulo: string; mensagem: string; publico?: string
  criadoEm?: string; expiraEm?: string; autorNome?: string
}
interface Denuncia {
  donoTipo: string; donoId: string; nome: string; bloqueado: boolean
  total: number; denuncias: Array<{ motivo?: string; por?: string; alvoTipo?: string }>
}
interface Chamado {
  id: string; login: string; nome?: string; assunto: string; mensagem: string
  status: string; resposta?: string; criadoEm?: string
}

const { server } = useServer()
const ui = useUi()

const avisos = ref<Aviso[] | null>(null)
const denuncias = ref<Denuncia[] | null>(null)
const chamados = ref<{ lista: Chamado[]; abertos: number } | null>(null)

const avTitulo = ref('')
const avMsg = ref('')
const avPublico = ref('Todos')
const avDias = ref('7')
const enviando = ref(false)

const respostas = reactive<Record<string, string>>({})

async function carregar() {
  const [a, d, c] = await Promise.all([
    server<Aviso[]>('apiListarAvisosAdmin').catch(() => [] as Aviso[]),
    server<Denuncia[]>('apiAdminDenuncias').catch(() => [] as Denuncia[]),
    server<{ lista: Chamado[]; abertos: number }>('apiAdminChamados', '').catch(() => null)
  ])
  avisos.value = a || []
  denuncias.value = d || []
  chamados.value = c
}

async function enviarAviso() {
  if (!avTitulo.value || !avMsg.value) {
    ui.avisar('Preencha título e mensagem', 'erro'); return
  }
  enviando.value = true
  try {
    await server('apiCriarAviso', {
      titulo: avTitulo.value, mensagem: avMsg.value,
      publico: avPublico.value, dias: avDias.value
    })
    ui.avisar('Aviso enviado ✔')
    avTitulo.value = ''; avMsg.value = ''
    avisos.value = await server<Aviso[]>('apiListarAvisosAdmin')
  } catch { /* já avisado */ } finally {
    enviando.value = false
  }
}

async function excluirAviso(a: Aviso) {
  if (!confirm('Excluir este aviso?')) return
  try {
    await server('apiExcluirAviso', a.id)
    avisos.value = await server<Aviso[]>('apiListarAvisosAdmin')
  } catch { /* já avisado */ }
}

async function resolver(d: Denuncia, acao: 'liberar' | 'manter') {
  try {
    await server('apiResolverDenuncia', d.donoTipo, d.donoId, acao)
    ui.avisar(acao === 'liberar' ? 'Perfil liberado' : 'Perfil segue bloqueado')
    denuncias.value = await server<Denuncia[]>('apiAdminDenuncias')
  } catch { /* já avisado */ }
}

async function responder(c: Chamado) {
  const txt = respostas[c.id]
  if (!txt) { ui.avisar('Escreva a resposta', 'erro'); return }
  try {
    await server('apiResponderChamado', c.id, txt)
    ui.avisar('Chamado respondido ✔')
    respostas[c.id] = ''
    chamados.value = await server<{ lista: Chamado[]; abertos: number }>('apiAdminChamados', '')
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <!-- ───── AVISOS ───── -->
    <div class="card">
      <h3><Icone nome="avisos" /> Enviar aviso</h3>
      <label for="av_tit">Título *</label>
      <input id="av_tit" v-model="avTitulo" class="no-i18n" placeholder="Ex: Nova função disponível">
      <label for="av_msg">Mensagem *</label>
      <textarea id="av_msg" v-model="avMsg" class="no-i18n" placeholder="Escreva o comunicado" />
      <div class="two">
        <div>
          <label for="av_pub">Para</label>
          <select id="av_pub" v-model="avPublico">
            <option>Todos</option>
            <option>Manejadores</option>
            <option>Empresas</option>
          </select>
        </div>
        <div>
          <label for="av_dias">Dias visível</label>
          <input id="av_dias" v-model="avDias" inputmode="numeric">
        </div>
      </div>
      <button class="btn" :disabled="enviando" @click="enviarAviso">
        {{ enviando ? 'Enviando…' : 'Enviar aviso' }}
      </button>

      <div v-for="a in avisos || []" :key="a.id" class="linha">
        <div class="grow">
          <b class="no-i18n">{{ a.titulo }}</b>
          <div class="meta no-i18n">{{ a.mensagem }}</div>
          <div class="meta">
            {{ a.publico }} · até {{ dataBR(a.expiraEm) }}
          </div>
        </div>
        <button class="ib" title="Excluir" @click="excluirAviso(a)"><Icone nome="excluir" /></button>
      </div>
    </div>

    <!-- ───── DENÚNCIAS ───── -->
    <div class="card">
      <h3><Icone nome="denuncia" /> Denúncias</h3>
      <div v-if="denuncias === null" class="meta">Carregando…</div>
      <div v-else-if="!denuncias.length" class="meta">Nenhuma denúncia no momento.</div>

      <div v-for="d in denuncias || []" :key="d.donoTipo + d.donoId" class="den">
        <b class="no-i18n">
          <Icone :nome="d.donoTipo === 'empresa' ? 'loja' : 'manejador'" /> {{ d.nome }}
        </b>
        <span class="pill" :class="d.bloqueado ? 'dan' : 'warn'">
          {{ d.bloqueado ? 'bloqueado' : d.total + ' denúncia(s)' }}
        </span>
        <div v-for="(x, i) in d.denuncias" :key="i" class="motivo no-i18n">
          <b v-if="x.por">{{ x.por }}:</b> {{ x.motivo || '(sem motivo)' }}
        </div>
        <div class="acoes">
          <button class="btn sm" @click="resolver(d, 'liberar')"><Icone nome="confirmar" /> Liberar perfil</button>
          <button class="btn sm sec" @click="resolver(d, 'manter')"><Icone nome="bloqueio" /> Manter bloqueado</button>
        </div>
      </div>
    </div>

    <!-- ───── CHAMADOS ───── -->
    <div class="card">
      <h3>
        <Icone nome="planos" /> Chamados
        <span v-if="chamados?.abertos" class="pill warn">{{ chamados.abertos }} aberto(s)</span>
      </h3>
      <div v-if="!chamados" class="meta">Carregando…</div>
      <div v-else-if="!chamados.lista.length" class="meta">Nenhum chamado.</div>

      <div v-for="c in chamados?.lista || []" :key="c.id" class="linha col">
        <div class="topo">
          <b class="no-i18n">{{ c.assunto }}</b>
          <span class="pill" :class="c.status === 'aberto' ? 'warn' : 'ok'">{{ c.status }}</span>
        </div>
        <div class="meta no-i18n">{{ c.nome || c.login }} · {{ dataBR(c.criadoEm) }}</div>
        <p class="msg no-i18n">{{ c.mensagem }}</p>

        <div v-if="c.resposta" class="resp no-i18n">{{ c.resposta }}</div>
        <template v-else>
          <textarea v-model="respostas[c.id]" class="no-i18n" placeholder="Escreva a resposta" />
          <button class="btn sm" @click="responder(c)">Responder</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 6px; }
.linha { display: flex; align-items: flex-start; gap: 8px; padding: 10px 0; border-top: 1px solid var(--linha); }
.linha.col { display: block; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 2px 0 0; }
.topo { display: flex; align-items: center; gap: 8px; }
.topo b { flex: 1; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.pill.ok { background: var(--verde-claro); color: var(--verde-esc); }
.pill.warn { background: #3A2E13; color: var(--alerta); }
.pill.dan { background: #3A1E1C; color: var(--danger); }
.den { border-left: 4px solid #8a3a2c; padding: 10px 12px; margin: 10px 0 0; background: var(--carvao-3); border-radius: 8px; }
.motivo { border-left: 3px solid var(--linha); padding-left: 8px; margin: 6px 0; font-size: 12.5px; }
.acoes { display: flex; gap: 8px; margin-top: 8px; }
.acoes .btn { width: auto; margin: 0; }
.msg { font-size: 13px; line-height: 1.5; margin: 6px 0; white-space: pre-wrap; }
.resp { background: var(--verde-claro); border-radius: 8px; padding: 8px 10px; font-size: 13px; white-space: pre-wrap; }
</style>
