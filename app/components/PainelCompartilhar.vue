<script setup lang="ts">
/**
 * ── COMPARTILHAR ──────────────────────────────────────────────────────────
 *
 * Convidar alguém a enxergar uma ceva ou uma propriedade sua.
 *
 * ⚠️ O BACKEND JÁ ESTAVA PRONTO desde o porte — `apiCompartilhar`,
 * `apiCompartilhamentos`, `apiRevogarCompartilhamento`. Só a tela faltava, e
 * por isso a leitura funcionava (o mapa mostrava `cevasCompart`) enquanto o
 * convite não tinha porta nenhuma.
 *
 * ⚠️ Convite é por LOGIN, não por e-mail nem por nome. É o que o servidor
 * exige (`getUsuarioPorLogin_`), e ele recusa com mensagem própria quando não
 * acha — melhor deixar a recusa vir de lá do que adivinhar aqui e discordar.
 *
 * ⚠️ REVOGAR É IMEDIATO e não pede confirmação do outro lado. Quem recebeu
 * perde o acesso na hora. A confirmação é aqui, antes.
 */
import { useUi } from '~/stores/ui'

const props = defineProps<{
  /** 'ceva' ou 'propriedade' — o mesmo vocabulário do `COMPART` do servidor. */
  tipo: 'ceva' | 'propriedade'
  id: string
  /** Nome do item, só para as frases. */
  nome?: string
}>()

interface Compart { id: string; paraNome?: string; status?: string }

const { server } = useServer()
const ui = useUi()

const lista = ref<Compart[] | null>(null)
const login = ref('')
const enviando = ref(false)
const aberto = ref(false)

const ROTULO: Record<string, string> = {
  pendente: 'aguardando aceitar', aceito: 'com acesso'
}

async function carregar() {
  try {
    lista.value = await server<Compart[]>('apiCompartilhamentos', props.tipo, props.id)
  } catch {
    lista.value = []
  }
}

async function convidar() {
  const l = login.value.trim()
  if (!l) { ui.avisar('Informe o login de quem vai receber', 'erro'); return }
  enviando.value = true
  try {
    const r = await server<{ nome?: string }>('apiCompartilhar', props.tipo, props.id, l)
    ui.avisar('Convite enviado para ' + (r?.nome || l) + ' ✔')
    login.value = ''
    await carregar()
  } catch { /* já avisado, traduzido */ } finally {
    enviando.value = false
  }
}

async function revogar(c: Compart) {
  const quem = c.paraNome || 'esta pessoa'
  if (!confirm('Tirar o acesso de ' + quem + '?\n\nEla deixa de ver este item imediatamente.')) return
  try {
    await server('apiRevogarCompartilhamento', props.tipo, c.id)
    ui.avisar('Acesso removido')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div class="card compart">
    <button class="cab" @click="aberto = !aberto">
      <Icone nome="compartilhar" />
      <span class="grow">
        Compartilhar
        <b v-if="(lista || []).length" class="qtd no-i18n">{{ (lista || []).length }}</b>
      </span>
      <span class="seta" :class="{ on: aberto }">›</span>
    </button>

    <div v-show="aberto" class="corpo">
      <label for="cp_login">Login de quem vai receber</label>
      <div class="linha-form">
        <input
          id="cp_login"
          v-model="login"
          class="no-i18n"
          placeholder="login do manejador"
          @keyup.enter="convidar"
        >
        <button class="btn" :disabled="enviando" @click="convidar">
          {{ enviando ? '…' : 'Convidar' }}
        </button>
      </div>
      <div class="meta">
        A pessoa recebe um convite e precisa aceitar. Depois disso, ela enxerga
        este item no mapa dela — sem poder editar nem excluir.
      </div>

      <template v-if="lista && lista.length">
        <h4 class="sub">Quem tem acesso</h4>
        <div v-for="c in lista" :key="c.id" class="item">
          <div class="grow">
            <b class="no-i18n">{{ c.paraNome || '—' }}</b>
            <div class="meta">{{ ROTULO[c.status || 'pendente'] || c.status }}</div>
          </div>
          <button class="tirar" @click="revogar(c)">Tirar acesso</button>
        </div>
      </template>
      <div v-else-if="lista" class="meta">
        Ninguém tem acesso a este item além de você.
      </div>
    </div>
  </div>
</template>

<style scoped>
.compart { padding: 0; overflow: hidden; }

.cab {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: none; border: 0; color: var(--txt); font: inherit;
  text-align: left; padding: 13px 14px; cursor: pointer; margin: 0; min-height: 52px;
}
.cab .grow { flex: 1; font-size: 15px; }
.qtd {
  display: inline-block; margin-left: 6px; padding: 1px 8px;
  border-radius: 999px; background: var(--verde-claro); color: var(--verde-esc);
  font-size: 11.5px;
}
.seta { font-size: 22px; color: var(--osso-2); transition: transform .18s ease; }
.seta.on { transform: rotate(90deg); color: var(--laranja-cl); }

.corpo { padding: 0 14px 14px; border-top: 1px solid var(--linha); }
.corpo label { margin-top: 12px; }

.linha-form { display: flex; gap: 8px; }
.linha-form input { flex: 1; margin: 0; }
.linha-form .btn { flex: none; width: auto; margin: 0; }

.sub { margin: 14px 0 4px; font-size: 13px; }
.item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--linha); }
.item .grow { flex: 1; min-width: 0; }
.item b { font-size: 13.5px; }
.item .meta { margin: 1px 0 0; }
.tirar {
  flex: none; border: 1px solid var(--danger); background: none; color: var(--danger);
  font: inherit; font-size: 11.5px; padding: 5px 11px; border-radius: 999px; cursor: pointer;
}
</style>
