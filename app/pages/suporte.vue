<script setup lang="ts">
/**
 * Suporte. Porte de VIEWS.suporte + abrirChamado (index.html, 6092):
 * canais de atendimento vindos da Config e os chamados do usuário.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { soDig } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Info {
  telefone: string; whatsapp: string; email: string; horario: string; texto: string
}
interface Chamado {
  id: string; assunto: string; mensagem: string; status: string
  resposta: string; criadoEm: string; respondidoEm: string
}

const { server } = useServer()
const ui = useUi()

const info = ref<Info | null>(null)
const chamados = ref<Chamado[] | null>(null)
const erro = ref('')

const assunto = ref('')
const mensagem = ref('')
const enviando = ref(false)

const linkWhats = computed(() => {
  const d = soDig(info.value?.whatsapp)
  return d ? 'https://wa.me/' + d : ''
})

async function carregar() {
  try {
    const [i, c] = await Promise.all([
      server<Info>('apiSuporteInfo'),
      server<Chamado[]>('apiMeusChamados')
    ])
    info.value = i
    chamados.value = c
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o suporte'
  }
}

async function abrirChamado() {
  if (!assunto.value) { ui.avisar('Informe o assunto', 'erro'); return }
  if (mensagem.value.trim().length < 10) {
    ui.avisar('Descreva melhor sua dúvida (mínimo 10 caracteres)', 'erro')
    return
  }
  enviando.value = true
  try {
    await server('apiAbrirChamado', { assunto: assunto.value, mensagem: mensagem.value })
    assunto.value = ''; mensagem.value = ''
    ui.avisar('Chamado aberto ✔ Responderemos por aqui.')
    chamados.value = await server<Chamado[]>('apiMeusChamados')
  } catch { /* já avisado */ } finally {
    enviando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!info" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <h3>Fale com a gente</h3>
        <div class="meta">{{ info.texto }}</div>
        <div class="meta horario"><Icone nome="relogio" /> {{ info.horario }}</div>

        <div class="canais">
          <a v-if="linkWhats" :href="linkWhats" target="_blank" rel="noopener" class="canal">
            <Icone nome="whatsapp" :px="20" /><span>{{ info.whatsapp }}</span>
          </a>
          <a v-if="info.telefone" :href="'tel:' + soDig(info.telefone)" class="canal">
            <Icone nome="telefone" :px="20" /><span>{{ info.telefone }}</span>
          </a>
          <a v-if="info.email" :href="'mailto:' + info.email" class="canal">
            <Icone nome="email" :px="20" /><span>{{ info.email }}</span>
          </a>
        </div>
      </div>

      <div class="card">
        <h3>Abrir um chamado</h3>
        <label for="s_ass">Assunto *</label>
        <input id="s_ass" v-model="assunto" placeholder="Resuma em poucas palavras">
        <label for="s_msg">Mensagem *</label>
        <textarea id="s_msg" v-model="mensagem" rows="5" placeholder="Conte o que aconteceu" />
        <button class="btn" :disabled="enviando" @click="abrirChamado">
          {{ enviando ? 'Enviando…' : 'Enviar chamado' }}
        </button>
      </div>

      <h3 class="sec">Meus chamados</h3>
      <div v-if="!chamados || !chamados.length" class="card">
        <div class="meta">Você ainda não abriu nenhum chamado.</div>
      </div>
      <div v-for="c in chamados || []" :key="c.id" class="card chamado">
        <div class="topo">
          <b>{{ c.assunto }}</b>
          <span class="pill" :class="c.status">{{ c.status }}</span>
        </div>
        <div class="meta">{{ dataBR(c.criadoEm) }}</div>
        <p class="msg">{{ c.mensagem }}</p>
        <div v-if="c.resposta" class="resposta">
          <b>Resposta</b>
          <p>{{ c.resposta }}</p>
          <div class="meta">{{ dataBR(c.respondidoEm) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.horario { margin-top: 4px; }
.canais { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.canal {
  display: flex; align-items: center; gap: 10px; padding: 11px 12px;
  border: 1px solid var(--linha); border-radius: 12px;
  text-decoration: none; color: var(--txt); font-size: 14px; background: var(--card);
}
.sec { margin: 14px 4px 6px; font-size: 15px; }
.chamado .topo { display: flex; align-items: center; gap: 8px; }
.chamado .topo b { flex: 1; }
.pill { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--linha); flex: none; }
.pill.aberto { background: #3A2E13; color: var(--alerta); }
.pill.respondido { background: var(--verde-claro); color: var(--verde-esc); }
.msg { font-size: 13.5px; line-height: 1.55; margin: 8px 0 0; white-space: pre-wrap; }
.resposta { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--linha); }
.resposta p { font-size: 13.5px; line-height: 1.55; margin: 4px 0; white-space: pre-wrap; }
</style>
