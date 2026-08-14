<script setup lang="ts">
/**
 * Detalhe da caçada: abates, amigos e documentação.
 * Porte de VIEWS.manejoDetalhe + cicloAbates + cicloAmigos + cicloDocs
 * (index.html, 9824 / 10109-10145).
 *
 * ⚠️ Entrar numa caçada ABERTA exige CTF em dia — nem o dono escapa. Caçada
 * encerrada continua legível: é histórico, e barrar a leitura do que já
 * aconteceu não protege ninguém. Quem recusa é o `apiManejo`.
 *
 * ⚠️ Convidar amigo confere o CTF DOS DOIS LADOS. O servidor devolve
 * `AMIGO_SEM_CTF|Nome` quando o convidado está irregular.
 *
 * O registro de abate chega no lote 7b; o relatório do IBAMA, no 7c.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import type { Manejo } from '~/pages/cacadas.vue'
import type { Propriedade } from '~/pages/propriedades.vue'

definePageMeta({ layout: 'app' })

interface Abate {
  id: string; dataHora?: string; quantidade?: string; sexo?: string
  pesoAprox?: string; obs?: string; cevaNome?: string; rotaNome?: string
  abatidoPorNome?: string; souEu?: boolean
}
interface Amigo {
  id: string; amigoNome?: string; status?: string; criadoEm?: string
}

const route = useRoute()
const router = useRouter()
const { server } = useServer()
const ui = useUi()

const id = computed(() => String(route.query.id || ''))
const m = ref<Manejo | null>(null)
const prop = ref<Propriedade | null>(null)
const abates = ref<Abate[] | null>(null)
const amigos = ref<Amigo[] | null>(null)
const erro = ref('')

const aba = ref<'abates' | 'amigos' | 'docs'>('abates')
const loginAmigo = ref('')
const convidando = ref(false)

const aberta = computed(() => m.value?.status === 'aberto')

/**
 * Leva ao painel de campo, que está no topo desta mesma tela. Rolar até lá é
 * melhor que abrir outra tela: o mapa já está carregado, com a posição e o
 * percurso em gravação, e recarregar tudo perderia os dois.
 */
const campoEl = ref<HTMLElement | null>(null)
function irAoCampo() {
  campoEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function carregar() {
  erro.value = ''
  try {
    m.value = await server<Manejo>('apiManejo', id.value)
    abates.value = await server<Abate[]>('apiAbatesDoManejo', id.value)
    amigos.value = await server<Amigo[]>('apiAmigosDoManejo', id.value)
    const pid = m.value?.propriedade?.id
    if (pid) {
      const ps = await server<Propriedade[]>('apiListarPropriedades').catch(() => [] as Propriedade[])
      prop.value = (ps || []).find((p) => p.id === pid) || null
    }
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível abrir a caçada'
  }
}

async function convidar() {
  if (!loginAmigo.value) { ui.avisar('Informe o e-mail do amigo', 'erro'); return }
  convidando.value = true
  try {
    const r = await server<{ nome?: string }>('apiConvidarAmigo', id.value, loginAmigo.value)
    ui.avisar('Convite enviado para ' + (r.nome || loginAmigo.value) + ' ✔')
    loginAmigo.value = ''
    amigos.value = await server<Amigo[]>('apiAmigosDoManejo', id.value)
  } catch { /* já avisado, traduzido */ } finally {
    convidando.value = false
  }
}

async function remover(a: Amigo) {
  if (!confirm('Remover este amigo da caçada?')) return
  try {
    await server('apiRemoverAmigoManejo', a.id)
    amigos.value = await server<Amigo[]>('apiAmigosDoManejo', id.value)
  } catch { /* já avisado */ }
}


onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Caçada" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!m" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card cab" :class="{ aberta }">
        <h3 class="no-i18n">{{ m.nome || 'Caçada' }}</h3>
        <div class="meta">
          <span class="pill" :class="aberta ? 'viva' : ''">
            {{ aberta ? 'aberta' : 'encerrada' }}
          </span>
          <span class="pill">{{ m.tipo }}</span>
          <span v-if="!m.souDono" class="pill">convidado</span>
        </div>
        <div class="meta no-i18n">
          {{ m.propriedade?.nome || '—' }} · desde {{ dataBR(m.criadoEm) }}
        </div>
        <div v-if="m.obs" class="meta no-i18n">{{ m.obs }}</div>
      </div>

      <!--
        ⚠️ O MAPA É A PRIMEIRA COISA da caçada aberta, antes das abas. Havia
        uma tela de guiamento separada; ela era uma parada a mais entre a
        pessoa e o campo, e quem entra numa caçada aberta entra para ver o
        caminho. Fechada, a caçada é histórico e não precisa de mapa ao vivo.
      -->
      <div ref="campoEl">
        <PainelCampo v-if="aberta" :manejo-id="id" :sou-dono="m.souDono" />
      </div>

      <div class="dash">
        <div class="kpi"><b>{{ m.abates?.animais || 0 }}</b><span>animais</span></div>
        <div class="kpi"><b>{{ (m.participantes || []).length }}</b><span>participantes</span></div>
        <div class="kpi">
          <b>{{ m.avistamentos == null ? '—' : m.avistamentos }}</b><span>avistamentos</span>
        </div>
      </div>

      <div class="tabs">
        <button :class="{ on: aba === 'abates' }" @click="aba = 'abates'"><Icone nome="abate" /> Abates</button>
        <button :class="{ on: aba === 'amigos' }" @click="aba = 'amigos'"><Icone nome="amigos" /> Amigos</button>
        <button :class="{ on: aba === 'docs' }" @click="aba = 'docs'"><Icone nome="documentos" /> Documentação</button>
      </div>

      <!-- ABATES -->
      <template v-if="aba === 'abates'">
        <div v-if="abates === null" class="card"><div class="meta">Carregando…</div></div>
        <div v-else-if="!abates.length" class="card">
          <div class="meta">Nenhum abate registrado nesta caçada.</div>
        </div>
        <div v-for="a in abates || []" :key="a.id" class="card linha">
          <span class="ic"><Icone nome="abate" /></span>
          <div class="grow">
            <b>{{ a.quantidade || 1 }} · {{ a.sexo || '—' }}</b>
            <div class="meta no-i18n">
              {{ dataBR(a.dataHora) }}
              <template v-if="a.cevaNome"> · {{ a.cevaNome }}</template>
              <template v-else-if="a.rotaNome"> · {{ a.rotaNome }}</template>
            </div>
            <div v-if="a.abatidoPorNome" class="meta no-i18n">
              por {{ a.abatidoPorNome }}{{ a.souEu ? ' (você)' : '' }}
            </div>
          </div>
        </div>

        <!--
          ⚠️ REGISTRAR EVENTO, não "registrar abate". Abate é UM dos eventos, e
          mandar direto para a tela dele obrigava a pessoa a saber, antes de
          tocar, que o que ela viu era abate — quando muitas vezes é rastro,
          avistamento ou perigo. O painel de campo pergunta primeiro e desvia
          para o abate quando for o caso.
        -->
        <button v-if="aberta" class="btn" @click="irAoCampo">
          <img src="/marca/javali-branco.png" class="ic-javali" alt=""> Registrar evento
        </button>
      </template>

      <!-- AMIGOS -->
      <template v-else-if="aba === 'amigos'">
        <div class="card">
          <div class="meta">
            O amigo convidado enxerga a documentação desta propriedade enquanto a
            caçada estiver aberta, e registra abate dentro dela.
          </div>
        </div>

        <div v-if="aberta && m.souDono" class="card">
          <label for="a_login">E-mail do amigo *</label>
          <input id="a_login" v-model="loginAmigo" type="email" class="no-i18n" placeholder="e-mail de acesso dele">
          <button class="btn" :disabled="convidando" @click="convidar">
            {{ convidando ? 'Enviando…' : 'Convidar' }}
          </button>
          <div class="meta">
            <Icone nome="alerta" /> O CTF é conferido dos dois lados: quem convida e quem é convidado.
          </div>
        </div>

        <div v-if="!amigos || !amigos.length" class="card">
          <div class="meta">Ninguém convidado ainda.</div>
        </div>
        <div v-for="a in amigos || []" :key="a.id" class="card linha">
          <div class="grow">
            <b class="no-i18n">{{ a.amigoNome || 'Manejador' }}</b>
            <span class="pill" :class="a.status === 'aceito' ? 'viva' : ''">{{ a.status }}</span>
            <div class="meta">{{ dataBR(a.criadoEm) }}</div>
          </div>
          <button v-if="aberta" class="ib" title="Remover" @click="remover(a)"><Icone nome="excluir" /></button>
        </div>
      </template>

      <!-- DOCUMENTAÇÃO -->
      <template v-else>
        <div v-if="!prop" class="card">
          <div class="meta">Esta caçada não está ligada a nenhuma propriedade.</div>
        </div>
        <template v-else>
          <div class="card">
            <h3 class="no-i18n"><Icone nome="areas" /> {{ prop.nome }}</h3>
            <div v-if="prop.dono" class="meta no-i18n">Proprietário: {{ prop.dono }}</div>
            <div v-if="prop.car" class="meta no-i18n">CAR: {{ prop.car }}</div>

            <div class="aut" :class="{ falta: !prop.autManejo || prop.autManejo.vencido }">
              <b>Autorização de Acesso</b>
              <div class="meta no-i18n">
                <template v-if="prop.autManejo">
                  nº {{ prop.autManejo.numero || '—' }} · vence
                  {{ dataBR(prop.autManejo.vencimento) }}
                </template>
                <template v-else>não cadastrada</template>
              </div>
            </div>

            <div class="aut" :class="{ falta: !prop.autIbama || prop.autIbama.vencido }">
              <b>Autorização do IBAMA</b>
              <div class="meta no-i18n">
                <template v-if="prop.autIbama">
                  nº {{ prop.autIbama.numero || '—' }} · vence
                  {{ dataBR(prop.autIbama.vencimento) }}
                </template>
                <template v-else>não cadastrada</template>
              </div>
            </div>
          </div>

          <ClientOnly>
            <MapaPontos
              :limites="prop.temLimite ? [{ nome: prop.nome, pontos: prop.limite }] : []"
              altura="36vh"
            />
          </ClientOnly>
        </template>
      </template>

      <!--
        ⚠️ ENCERRAR SAIU DAQUI. Ele vive no cartão da caçada, uma tela antes,
        com o Entrar ao lado: encerrar é decisão que se toma olhando a lista,
        não no meio da operação — e ter o botão aqui convidava a encerrar sem
        querer, no fim de uma tela que se usa com o celular na mão, andando.
      -->
      <NuxtLink to="/cacadas" class="btn sec">Voltar</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
/* O javali da marca dentro do botão. */
.ic-javali { width: 20px; height: 20px; object-fit: contain; vertical-align: -4px; margin-right: 4px; }
.ruim { color: var(--danger); }
.cab.aberta { border-left: 5px solid var(--danger); }
.cab .meta { margin: 4px 0 0; }
.pill { font-size: 11px; padding: 2px 9px; border-radius: 999px; background: var(--linha); margin-right: 6px; }
.pill.viva { background: var(--verde-claro); color: var(--verde-esc); }
.dash { display: flex; gap: 8px; margin: 10px 0; }
.kpi { flex: 1; background: var(--card); border: 1px solid var(--linha); border-radius: 12px; padding: 10px; text-align: center; }
.kpi b { display: block; font-size: 19px; }
.kpi span { font-size: 11px; color: var(--osso-2); }
.tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.tabs button {
  flex: 1; padding: 10px 6px; border-radius: 10px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--txt);
}
.tabs button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.linha { display: flex; align-items: flex-start; gap: 10px; }
.linha .ic { font-size: 20px; flex: none; }
.linha .grow { flex: 1; min-width: 0; }
.linha .meta { margin: 3px 0 0; }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; flex: none; }
.obra { border-left: 5px solid var(--alerta); }
.aut { border-left: 4px solid var(--verde); padding: 8px 10px; margin: 10px 0 0; background: var(--carvao-3); border-radius: 8px; }
.aut.falta { border-left-color: var(--danger); }
.encerrar { border-left: 5px solid var(--danger); }
.encerrar .btn { background: var(--danger); }
.btn.sec { margin-top: 14px; text-decoration: none; }
</style>
