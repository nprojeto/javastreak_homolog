<script setup lang="ts">
/**
 * Administração — painel, usuários, cortesia e diagnósticos.
 * Porte parcial de VIEWS.admin (index.html, 6845).
 *
 * ⚠️ Tela restrita: o backend recusa toda ação da `ADMIN_ACTIONS` para quem
 * não é admin, mesmo que a tela apareça. A checagem aqui só evita mostrar
 * botão que não vai funcionar.
 *
 * A CORTESIA é o que destrava o teste em homologação: sem ela, o plano Novato
 * limita quase tudo a 1 ou 3, e várias telas não dá para exercitar.
 *
 * Limites por plano, parâmetros, avisos, campanhas, denúncias, artigos,
 * chamados e pagamentos vêm na entrega seguinte.
 */
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'
import { useSessaoApp } from '~/composables/useSessaoApp'
import { dataBR } from '~/composables/useMascaras'

definePageMeta({ layout: 'app' })

interface Painel {
  cadastrados: number; manejadores: number; empresas: number
  ativos: number; pctAtivos: number; engajados: number; pctEngajados: number
  adocaoMedia: number; planos: Record<string, number>
  porModulo: Array<{ chave: string; nome: string; usuarios: number; pct: number }>
}
interface Usuario {
  id: string; login: string; tipo: string; ativo?: unknown
  dataCadastro?: string; emailConfirmado?: unknown
  nome?: string; telefone?: string; cidade?: string; temFicha?: boolean
}
interface Ficha {
  usuario: Usuario & { confirmadoEm?: string; indicSaldo?: number; chaveIndic?: string }
  ficha: Record<string, unknown>
  plano: { plano: string; fim?: string; origem?: string; obs?: string }
  ctf: { numero?: string; vencimento?: string; temArquivo?: boolean; emDia?: boolean } | null
  contadores: Record<string, number>
}

const auth = useAuth()
const ui = useUi()
const { server } = useServer()
const { carregarCreditos } = useSessaoApp()

const aba = ref<'painel' | 'planos' | 'moderacao' | 'ajustes'>('painel')
const painel = ref<Painel | null>(null)
const busca = ref('')
const usuarios = ref<Usuario[]>([])
const total = ref(0)
const ficha = ref<Ficha | null>(null)
const erro = ref('')
const carregandoLista = ref(false)

/**
 * Cortesia — o destino tem CINCO formatos aceitos pelo servidor, e só esses:
 * `login:<email>`, `todos`, `manejadores`, `empresas` e `novos:<dias>`.
 * Qualquer outra coisa volta como "Destino inválido".
 *
 * ⚠️ Isto era um campo de texto livre com o formato só no placeholder — e
 * digitar o e-mail sem o prefixo `login:` derrubava a ação. Virou seletor:
 * a sintaxe deixou de ser problema de quem usa.
 */
const ctTipo = ref<'login' | 'todos' | 'manejadores' | 'empresas' | 'novos'>('login')
const ctEmail = ref('')
const ctNovosDias = ref('7')

const ctDestino = computed(() => {
  if (ctTipo.value === 'login') {
    const e = ctEmail.value.trim().toLowerCase()
    return e ? 'login:' + e : ''
  }
  if (ctTipo.value === 'novos') return 'novos:' + (ctNovosDias.value || '7')
  return ctTipo.value
})
const ctPlano = ref('n2')
const ctDias = ref('30')
const ctObs = ref('')
const ctQtd = ref<number | null>(null)
const dandoCortesia = ref(false)

/* diagnósticos */
const diagEmail = ref('')
const diagSaida = ref('')
const diagRodando = ref(false)

const PLANOS = [
  ['n1', 'Mateiro'], ['n2', 'Veterano'],
  ['empresa', 'Empresa'], ['empresapro', 'Empresa Pro']
]

let timer: ReturnType<typeof setTimeout> | null = null
watch(busca, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(listar, 350)
})

async function carregarPainel() {
  try {
    painel.value = await server<Painel>('apiPainelAdmin')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o painel'
  }
}

async function listar() {
  carregandoLista.value = true
  try {
    const r = await server<{ usuarios: Usuario[]; total: number }>(
      'apiListarUsuarios', busca.value, 0
    )
    usuarios.value = r.usuarios || []
    total.value = r.total || 0
  } catch { /* já avisado */ } finally {
    carregandoLista.value = false
  }
}

async function abrirFicha(u: Usuario) {
  ficha.value = null
  try {
    ficha.value = await server<Ficha>('apiFichaUsuario', u.id)
    /* Preenche o destino da cortesia com quem está aberto — é o uso comum. */
    ctTipo.value = 'login'
    ctEmail.value = u.login
    contarDestino()
  } catch { /* já avisado */ }
}

async function confirmarEmail(login: string) {
  if (!confirm('Confirmar o e-mail desta conta manualmente?')) return
  try {
    await server('apiAdminConfirmarEmail', login)
    ui.avisar('E-mail confirmado ✔')
    await listar()
  } catch { /* já avisado */ }
}

async function resetSenha(login: string) {
  if (!confirm('Gerar uma senha nova para esta conta?')) return
  try {
    const r = await server<{ senha: string }>('apiAdminResetSenha', login, '')
    ui.avisar('Senha nova: ' + r.senha)
    window.prompt('Copie a senha e entregue ao usuário:', r.senha)
  } catch { /* já avisado */ }
}

async function contarDestino() {
  if (!ctDestino.value) { ctQtd.value = null; return }
  try {
    const r = await server<{ quantidade: number }>('apiContarDestino', ctDestino.value)
    ctQtd.value = r.quantidade
  } catch {
    ctQtd.value = null
  }
}

watch(ctDestino, contarDestino)

async function darCortesia() {
  if (!ctDestino.value) { ui.avisar('Informe o destino', 'erro'); return }
  if (!confirm('Dar ' + ctDias.value + ' dias de plano para ' + ctDestino.value + '?')) return
  dandoCortesia.value = true
  try {
    const r = await server<{ quantidade: number }>(
      'apiDarCortesia', ctDestino.value, ctPlano.value, ctDias.value, ctObs.value
    )
    ui.avisar('Cortesia dada para ' + r.quantidade + ' conta(s) ✔')
    /* Se a cortesia foi para você, a faixa precisa saber na hora. */
    await carregarCreditos(true)
  } catch { /* já avisado */ } finally {
    dandoCortesia.value = false
  }
}

async function testarEmail() {
  if (!diagEmail.value) { ui.avisar('Informe o destino', 'erro'); return }
  diagRodando.value = true
  diagSaida.value = ''
  try {
    const d = await server<Record<string, unknown>>('apiDiagEmail', diagEmail.value)
    diagSaida.value = JSON.stringify(d, null, 2)
  } catch (e) {
    diagSaida.value = e instanceof Error ? e.message : 'falhou'
  } finally {
    diagRodando.value = false
  }
}

async function diagPerfil() {
  diagRodando.value = true
  diagSaida.value = ''
  try {
    diagSaida.value = JSON.stringify(await server('apiDiagPerfil'), null, 2)
  } catch (e) {
    diagSaida.value = e instanceof Error ? e.message : 'falhou'
  } finally {
    diagRodando.value = false
  }
}

onMounted(() => {
  if (!auth.admin) return
  carregarPainel()
  listar()
  diagEmail.value = auth.login
})
</script>

<template>
  <div>
    <div v-if="!auth.admin" class="card">
      <div class="meta"><Icone nome="bloqueio" /> Esta tela é do administrador.</div>
    </div>

    <template v-else>
      <TituloTela titulo="Administração" descricao="Painel, usuários, cortesia e diagnósticos." />

      <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>

      <nav class="abas">
        <button :class="{ on: aba === 'painel' }" @click="aba = 'painel'"><Icone nome="grafico" /> Painel</button>
        <button :class="{ on: aba === 'planos' }" @click="aba = 'planos'"><Icone nome="planos" /> Planos</button>
        <button :class="{ on: aba === 'moderacao' }" @click="aba = 'moderacao'"><Icone nome="denuncia" /> Moderação</button>
        <button :class="{ on: aba === 'ajustes' }" @click="aba = 'ajustes'"><Icone nome="ajustes" /> Ajustes</button>
      </nav>

      <AdminPlanos v-if="aba === 'planos'" />
      <AdminModeracao v-else-if="aba === 'moderacao'" />
      <AdminAjustes v-else-if="aba === 'ajustes'" />

      <template v-else>
      <!-- ───── PAINEL ───── -->
      <div class="card">
        <div class="topo">
          <h3><Icone nome="grafico" /> Painel da plataforma</h3>
          <button class="ib" title="Atualizar" @click="carregarPainel"><Icone nome="atualizar" /></button>
        </div>

        <div v-if="!painel" class="meta">Carregando…</div>
        <template v-else>
          <div class="dash">
            <div class="kpi"><b>{{ painel.cadastrados }}</b><span>cadastrados</span></div>
            <div class="kpi"><b>{{ painel.manejadores }}</b><span>manejadores</span></div>
            <div class="kpi"><b>{{ painel.empresas }}</b><span>empresas</span></div>
          </div>
          <div class="dash">
            <div class="kpi"><b>{{ painel.ativos }}</b><span>com sessão ({{ painel.pctAtivos }}%)</span></div>
            <div class="kpi"><b>{{ painel.engajados }}</b><span>usaram algo ({{ painel.pctEngajados }}%)</span></div>
            <div class="kpi"><b>{{ painel.adocaoMedia }}%</b><span>adoção média</span></div>
          </div>

          <h4 class="sub">Adoção por módulo</h4>
          <div v-for="m in painel.porModulo" :key="m.chave" class="mod">
            <div class="mod-rot">{{ m.nome }}<span>{{ m.usuarios }} ({{ m.pct }}%)</span></div>
            <div class="barra"><span :style="{ width: m.pct + '%' }" /></div>
          </div>
        </template>
      </div>

      <!-- ───── USUÁRIOS ───── -->
      <div class="card">
        <h3><Icone nome="amigos" /> Usuários da plataforma</h3>
        <div class="meta">
          Busque por nome, e-mail, telefone, cidade, CPF/CNPJ ou id. Clique para
          ver a ficha completa.
        </div>
        <input v-model="busca" placeholder="Buscar usuário…" class="no-i18n">

        <!-- FICHA -->
        <div v-if="ficha" class="ficha">
          <div class="topo">
            <div class="grow">
              <b class="no-i18n">{{ ficha.ficha.nome || ficha.usuario.login }}</b>
              <span class="pill">{{ ficha.usuario.tipo }}</span>
              <div class="meta no-i18n">{{ ficha.usuario.login }}</div>
            </div>
            <button class="ib" title="Fechar" @click="ficha = null">✕</button>
          </div>

          <div class="linha"><span>Situação</span>
            <b>{{ String(ficha.usuario.ativo) === 'false' ? 'bloqueado' : 'ativo' }}</b></div>
          <div class="linha"><span>E-mail confirmado</span>
            <b>{{ ficha.usuario.emailConfirmado === 'Sim' ? 'sim' : 'não' }}</b></div>
          <div class="linha"><span>Cadastro</span>
            <b>{{ dataBR(ficha.usuario.dataCadastro) }}</b></div>
          <div class="linha"><span>Plano</span>
            <b>{{ ficha.plano.plano }}{{ ficha.plano.fim ? ' até ' + dataBR(ficha.plano.fim) : '' }}</b></div>
          <div class="linha"><span>CTF</span>
            <b v-if="!ficha.ctf" class="dan">sem CTF</b>
            <b v-else :class="ficha.ctf.emDia ? 'ok' : 'dan'">
              {{ ficha.ctf.emDia ? 'em dia' : 'vencido' }}
              <span class="no-i18n">{{ ficha.ctf.numero || '' }}</span>
            </b>
          </div>

          <h4 class="sub">O que já cadastrou</h4>
          <div class="conts">
            <div v-for="(v, k) in ficha.contadores" :key="k" class="cont">
              <b>{{ v }}</b><span>{{ k }}</span>
            </div>
          </div>

          <div class="acoes">
            <button
              v-if="ficha.usuario.emailConfirmado !== 'Sim'"
              class="btn sm sec"
              @click="confirmarEmail(ficha.usuario.login)"
            >Confirmar e-mail</button>
            <button class="btn sm sec" @click="resetSenha(ficha.usuario.login)">
              Nova senha
            </button>
          </div>
        </div>

        <div v-if="carregandoLista" class="meta">Buscando…</div>
        <template v-else>
          <div class="meta">{{ total }} conta(s)</div>
          <button
            v-for="u in usuarios"
            :key="u.id"
            class="usr"
            @click="abrirFicha(u)"
          >
            <div class="grow">
              <b class="no-i18n">{{ u.nome || u.login }}</b>
              <span class="pill">{{ u.tipo }}</span>
              <div class="meta no-i18n">{{ u.login }}</div>
            </div>
            <span v-if="u.emailConfirmado !== 'Sim'" class="pill warn">não confirmado</span>
          </button>
        </template>
      </div>

      <!-- ───── CORTESIA ───── -->
      <div class="card cortesia">
        <h3><Icone nome="cortesia" /> Dar cortesia</h3>
        <div class="meta">
          Libera um plano por tempo determinado. Em homologação é o que permite
          testar o que o plano Novato limita.
        </div>

        <label for="ct_tipo">Destino *</label>
        <select id="ct_tipo" v-model="ctTipo">
          <option value="login">Uma conta pelo e-mail</option>
          <option value="manejadores">Todos os manejadores</option>
          <option value="empresas">Todas as empresas</option>
          <option value="todos">Todas as contas</option>
          <option value="novos">Cadastrados nos últimos N dias</option>
        </select>

        <template v-if="ctTipo === 'login'">
          <label for="ct_email">E-mail da conta *</label>
          <input id="ct_email" v-model="ctEmail" type="email" class="no-i18n" placeholder="conta@dominio.com">
        </template>
        <template v-else-if="ctTipo === 'novos'">
          <label for="ct_nd">Cadastrados nos últimos (dias)</label>
          <input id="ct_nd" v-model="ctNovosDias" inputmode="numeric">
        </template>

        <div v-if="ctQtd !== null" class="meta">
          Atinge <b>{{ ctQtd }}</b> conta(s).
        </div>
        <div v-if="ctQtd === 0" class="meta ruim">
          <Icone nome="alerta" /> Nenhuma conta encontrada com esse destino — confira o e-mail.
        </div>

        <div class="two">
          <div>
            <label for="ct_plano">Plano</label>
            <select id="ct_plano" v-model="ctPlano">
              <option v-for="p in PLANOS" :key="p[0]" :value="p[0]">{{ p[1] }}</option>
            </select>
          </div>
          <div>
            <label for="ct_dias">Dias</label>
            <input id="ct_dias" v-model="ctDias" inputmode="numeric">
          </div>
        </div>

        <label for="ct_obs">Observação</label>
        <input id="ct_obs" v-model="ctObs" class="no-i18n">

        <button class="btn" :disabled="dandoCortesia" @click="darCortesia">
          {{ dandoCortesia ? 'Aplicando…' : 'Dar cortesia' }}
        </button>
      </div>

      <!-- ───── DIAGNÓSTICOS ───── -->
      <div class="card">
        <h3><Icone nome="diagnostico" /> Diagnósticos</h3>

        <label for="dg_email">Enviar e-mail de teste para</label>
        <input id="dg_email" v-model="diagEmail" type="email" class="no-i18n">
        <div class="acoes">
          <button class="btn sm sec" :disabled="diagRodando" @click="testarEmail">
            Testar envio
          </button>
          <button class="btn sm sec" :disabled="diagRodando" @click="diagPerfil">
            Meu perfil
          </button>
        </div>

        <pre v-if="diagSaida" class="saida no-i18n">{{ diagSaida }}</pre>
      </div>

      </template>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.sub { margin: 14px 0 6px; font-size: 13px; color: var(--verde); }
.ruim, .dan { color: var(--danger); }
.ok { color: var(--verde); }
.topo { display: flex; align-items: flex-start; gap: 8px; }
.topo .grow { flex: 1; min-width: 0; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.dash { display: flex; gap: 8px; margin: 10px 0 0; }
.kpi { flex: 1; background: var(--areia); border-radius: 12px; padding: 9px; text-align: center; }
.kpi b { display: block; font-size: 18px; }
.kpi span { font-size: 10.5px; color: var(--osso-2); }
.mod { margin-bottom: 8px; }
.mod-rot { display: flex; justify-content: space-between; font-size: 12.5px; }
.mod-rot span { color: var(--osso-2); }
.barra { height: 8px; background: var(--linha); border-radius: 999px; overflow: hidden; margin-top: 3px; }
.barra span { display: block; height: 100%; background: var(--verde); }
.ficha { border-left: 5px solid var(--verde); background: var(--carvao-3); border-radius: 10px; padding: 12px; margin: 10px 0; }
.linha { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--linha); }
.linha span { color: var(--osso-2); }
.conts { display: flex; flex-wrap: wrap; gap: 6px; }
.cont { background: var(--card); border: 1px solid var(--linha); border-radius: 10px; padding: 6px 10px; text-align: center; min-width: 74px; }
.cont b { display: block; font-size: 15px; }
.cont span { font-size: 10.5px; color: var(--osso-2); }
.acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.acoes .btn { width: auto; margin: 0; }
.usr {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 10px 0; border: 0; border-top: 1px solid var(--linha);
  background: none; cursor: pointer; color: var(--txt);
}
.usr .grow { flex: 1; min-width: 0; }
.usr .meta { margin: 2px 0 0; }
.pill { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.pill.warn { background: #3A2E13; color: var(--alerta); }
.cortesia { border-left: 5px solid var(--laranja); }
.saida {
  background: #0E0D09; color: #B7D3A8; border-radius: 10px; padding: 10px;
  font-size: 11px; overflow-x: auto; margin-top: 10px; white-space: pre-wrap;
}
.abas { display: flex; gap: 6px; margin-bottom: 10px; }
.abas button {
  flex: 1; padding: 10px 6px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--txt);
}
.abas button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
</style>
