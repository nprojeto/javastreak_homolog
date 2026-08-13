<script setup lang="ts">
/**
 * CAÇAR — o portal, agora organizado pelo caminho: PREPARAR → CAÇAR → ENCERRAR.
 *
 * ⚠️ ESTA TELA NÃO TEM REGRA DE NEGÓCIO NOVA. Ela LÊ o que o servidor já
 * devolve e desenha o estado. Quem bloqueia continua sendo o servidor —
 * `exigirCtfEmDia_()`, `propriedadeUsavel_()`, `dadosManejo_()`. Se algum
 * cálculo daqui discordar do servidor, quem manda é o servidor: o pior
 * resultado possível seria a tela liberar o que o backend recusa, e por isso
 * o cartão de caçar continua clicável mesmo pendente.
 *
 * ⚠️ CEVA E ROTA NÃO SÃO OBRIGATÓRIAS PARA CAÇAR. A caça livre precisa só de
 * propriedade regular COM LIMITE DESENHADO — é o que o `dadosManejo_` exige:
 *
 *     if (tipo === 'livre' && !temLimite_(propRow)) throw ...
 *
 * Por isso o requisito "local de caça" entra como OPCIONAL. Tratá-lo como
 * obrigatório seria inventar uma trava que o backend não tem.
 *
 * ⚠️ Propriedade "cadastrada" não basta: ela precisa estar REGULAR e com o
 * limite desenhado. É a causa mais comum de a pessoa travar sem entender, e a
 * tela antiga não dizia nada a respeito.
 */
import { useCreditos } from '~/stores/creditos'
import type { Propriedade } from '~/pages/propriedades.vue'
import type { Ceva } from '~/pages/espera.vue'
import type { Rota } from '~/pages/rotas.vue'

definePageMeta({ layout: 'app' })

const cred = useCreditos()
const { server, serverOpc } = useServer()

const abertas = ref<number | null>(null)
const props_ = ref<Propriedade[] | null>(null)
const cevas = ref<Ceva[] | null>(null)
const rotas = ref<Rota[] | null>(null)

const ctfOk = computed(() => cred.dados?.ctfEmDia === true)

/**
 * ⚠️ Sem CTF em dia, NADA dentro do CAÇAR abre. É a mesma regra do servidor:
 * `exigirCtfEmDia_()` recusa criar propriedade, ceva, rota, caçada e abate.
 *
 * Enquanto os créditos não chegam (`cred.dados` nulo), nada é travado — travar
 * por falta de informação seria pior que não travar.
 */
const bloqueio = computed(() =>
  cred.dados && !ctfOk.value
    ? 'Cadastre o CTF para liberar'
    : undefined
)

/** Propriedades que o servidor aceitaria num ciclo: regular E com limite. */
const propsUsaveis = computed(() =>
  (props_.value || []).filter((p) => p.regular && p.temLimite)
)
const temProp = computed(() => propsUsaveis.value.length > 0)

/** Enquanto qualquer lista não chegou, não se afirma que falta. */
const carregado = computed(() => props_.value !== null && cevas.value !== null && rotas.value !== null)

const reqCtf = computed(() => {
  if (!cred.dados) return { estado: 'ok' as const, texto: 'Conferindo…' }
  return ctfOk.value
    ? { estado: 'ok' as const, texto: 'Em dia' }
    : { estado: 'pendente' as const, texto: 'Regularize seu CTF para continuar' }
})

const reqProp = computed(() => {
  if (!carregado.value) return { estado: 'ok' as const, texto: 'Conferindo…' }
  const n = propsUsaveis.value.length
  if (n) return { estado: 'ok' as const, texto: n + ' propriedade(s) pronta(s)' }
  const total = (props_.value || []).length
  /* A frase diz o que REALMENTE falta. "Cadastre uma propriedade" para quem já
     tem três, faltando só o polígono, é a mensagem que faz a pessoa desistir. */
  if (!total) return { estado: 'pendente' as const, texto: 'Cadastre uma propriedade para continuar' }
  const semLimite = (props_.value || []).filter((p) => p.regular && !p.temLimite).length
  if (semLimite) return { estado: 'pendente' as const, texto: 'Desenhe o limite da propriedade no mapa' }
  return { estado: 'pendente' as const, texto: 'Sua propriedade está irregular: confira as autorizações' }
})


const descCevas = computed(() => {
  if (!carregado.value) return 'Pontos de espera'
  const n = (cevas.value || []).length
  return n ? n + ' ceva(s) cadastrada(s)' : 'Nenhuma ceva — opcional para caçar'
})
const descRotas = computed(() => {
  if (!carregado.value) return 'Trajetos dentro da propriedade'
  const n = (rotas.value || []).length
  return n ? n + ' rota(s) cadastrada(s)' : 'Nenhuma rota — opcional para caçar'
})

/** O que impede de abrir uma caçada. Ceva e rota NÃO entram aqui. */
const faltas = computed(() => {
  const f: string[] = []
  if (cred.dados && !ctfOk.value) f.push('Cadastrar o CTF')
  if (carregado.value && !temProp.value) f.push('Ter uma propriedade regular com o limite desenhado')
  return f
})
const prontoParaCacar = computed(() => faltas.value.length === 0)

/** Primeiro atalho útil para resolver, na ordem da dependência. */
const paraResolver = computed(() => {
  if (cred.dados && !ctfOk.value) return '/ctf'
  return '/propriedades'
})

onMounted(async () => {
  try {
    const l = await server<Array<{ status?: string }>>('apiListarManejos')
    abertas.value = (l || []).filter((m) => m.status === 'aberto').length
  } catch {
    /* O contador é acessório: falhar aqui não pode esconder o portal. */
  }
  try {
    /* `serverOpc`: estas três têm teto de plano e devolvem lista vazia quando
       o plano bloqueia, em vez de derrubar a tela inteira. */
    const [p, c, r] = await Promise.all([
      serverOpc<Propriedade[]>('apiListarPropriedades'),
      serverOpc<Ceva[]>('apiListarCevas'),
      serverOpc<Rota[]>('apiListarRotas')
    ])
    props_.value = (p as Propriedade[]) || []
    cevas.value = (c as Ceva[]) || []
    rotas.value = (r as Rota[]) || []
  } catch {
    /* Sem as listas, os requisitos ficam em "Conferindo…" e nada é afirmado
       como faltante — a tela nunca acusa pendência que não conferiu. */
  }
})
</script>

<template>
  <div>
    <TituloTela titulo="CAÇAR" descricao="Prepare, abra a caçada e preste contas." />

    <!-- ───────── 1. PREPARAÇÃO ─────────
      ⚠️ UM cartão por assunto, não dois. Antes havia uma lista de requisitos
      E uma lista de módulos: CTF aparecia duas vezes, Propriedade duas vezes,
      Espera duas vezes — as duas com seta, as duas indo ao mesmo lugar. O
      estado agora vive DENTRO do cartão que leva ao assunto.
    -->
    <h3 class="etapa">Preparação</h3>

    <CartaoModulo
      icone="documentos"
      titulo="CTF"
      :descricao="reqCtf.texto"
      para="/ctf"
      :selo="cred.dados ? (ctfOk ? 'EM DIA' : 'PENDENTE') : undefined"
      :selo-tipo="ctfOk ? 'ok' : 'danger'"
    />
    <CartaoModulo
      icone="areas"
      titulo="Propriedades"
      :descricao="reqProp.texto"
      para="/propriedades"
      :travado="bloqueio"
      para-destravar="/ctf"
      :selo="carregado && !bloqueio ? (temProp ? 'PRONTA' : 'PENDENTE') : undefined"
      :selo-tipo="temProp ? 'ok' : 'danger'"
    />
    <CartaoModulo
      icone="ceva"
      titulo="Espera (ceva)"
      :descricao="descCevas"
      para="/espera"
      :travado="bloqueio"
      para-destravar="/ctf"
    />
    <CartaoModulo
      icone="rotas"
      titulo="Rotas"
      :descricao="descRotas"
      para="/rotas"
      :travado="bloqueio"
      para-destravar="/ctf"
    />

    <!-- ───────── 2. CAÇAR ───────── -->
    <h3 class="etapa">Caçadas</h3>

    <!--
      ⚠️ Pendente NÃO esconde o caminho. O cartão continua levando ao lugar de
      resolver, e diz o que falta — esconder faria a pessoa bater numa tela
      muda sem saber o que fazer. É a mesma escolha do CartaoModulo travado.
    -->
    <div v-if="prontoParaCacar" class="card pronto">
      <div class="topo">
        <span class="ic"><Icone nome="confirmar" :px="22" /></span>
        <div>
          <b>Pronto para caçar</b>
          <div class="meta">CTF em dia e propriedade liberada.</div>
        </div>
      </div>
      <NuxtLink to="/cacada-nova" class="btn"><Icone nome="adicionar" /> Nova caçada</NuxtLink>
    </div>

    <div v-else class="card falta">
      <div class="topo">
        <span class="ic"><Icone nome="bloqueio" :px="22" /></span>
        <div>
          <b>Ainda não dá para abrir uma caçada</b>
          <div class="meta">Falta:</div>
        </div>
      </div>
      <ul class="lista">
        <li v-for="f in faltas" :key="f"><Icone nome="alerta" :px="15" /> {{ f }}</li>
      </ul>
      <NuxtLink :to="paraResolver" class="btn">Resolver pendências</NuxtLink>
    </div>

    <CartaoModulo
      icone="painel"
      titulo="Minhas caçadas"
      descricao="Abertas e encerradas · abates de cada uma"
      para="/cacadas"
      :travado="bloqueio"
      para-destravar="/ctf"
      :selo="abertas ? abertas + ' aberta(s)' : undefined"
      selo-tipo="ok"
    />

    <!-- ───────── 3. ENCERRAMENTO ───────── -->
    <h3 class="etapa">Encerramento</h3>
    <CartaoModulo
      icone="grafico"
      titulo="Relatório Fechamento IBAMA"
      descricao="Abates por autorização, para prestar contas"
      para="/ibama"
    />
  </div>
</template>

<style scoped>
.etapa {
  margin: 18px 4px 8px; font-size: 12px; letter-spacing: .08em;
  text-transform: uppercase; color: var(--osso-2);
}
.etapa:first-of-type { margin-top: 4px; }


.pronto, .falta { margin-bottom: 12px; }
.pronto { border-left: 5px solid var(--verde); }
.falta { border-left: 5px solid var(--alerta); }

.topo { display: flex; align-items: center; gap: 10px; }
.topo b { font-size: 15px; }
.topo .meta { margin: 2px 0 0; }
.topo .ic {
  flex: none; width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.pronto .ic { background: var(--verde-claro); color: var(--verde-esc); }
.falta .ic { background: #3A2E13; color: var(--alerta); }

.lista { list-style: none; margin: 8px 0 0; padding: 0; }
.lista li {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; padding: 5px 0 5px 48px; color: var(--alerta);
}

.pronto .btn, .falta .btn { margin-top: 12px; text-decoration: none; }
</style>
