<script setup lang="ts">
/**
 * CAÇAR — o portal. Porte de VIEWS.manejoHub (index.html, 9526).
 *
 * ⚠️ Propriedades, Cevas e Rotas vivem AQUI, não como itens soltos no menu
 * lateral. A ordem dos cartões é a ordem da dependência: sem CTF não se caça;
 * sem propriedade regular não há ceva nem rota; sem uma das duas não há
 * caçada. Quem abre a tela vê o caminho.
 */
import { useCreditos } from '~/stores/creditos'

definePageMeta({ layout: 'app' })

const cred = useCreditos()
const { server } = useServer()

const abertas = ref<number | null>(null)

const ctfOk = computed(() => cred.dados?.ctfEmDia === true)

/**
 * ⚠️ Sem CTF em dia, NADA dentro do CAÇAR abre. É a mesma regra do servidor:
 * `exigirCtfEmDia_()` recusa criar propriedade, ceva, rota, caçada e abate.
 * A tela dizer o mesmo evita a pessoa preencher um cadastro inteiro para
 * levar o "não" no fim.
 *
 * Enquanto os créditos não chegam (`cred.dados` nulo), nada é travado — travar
 * por falta de informação seria pior que não travar.
 */
const bloqueio = computed(() =>
  cred.dados && !ctfOk.value
    ? 'Cadastre o CTF para liberar'
    : undefined
)

onMounted(async () => {
  try {
    const l = await server<Array<{ status?: string }>>('apiListarManejos')
    abertas.value = (l || []).filter((m) => m.status === 'aberto').length
  } catch {
    /* O contador é acessório: falhar aqui não pode esconder o portal. */
  }
})
</script>

<template>
  <div>
    <div class="mod-grade">
      <CartaoModulo
        icone="documentos"
        titulo="CTF"
        descricao="Envie o documento para liberar"
        para="/ctf"
        :selo="cred.dados ? (ctfOk ? 'EM DIA' : 'SEM CTF') : undefined"
        :selo-tipo="ctfOk ? 'ok' : 'danger'"
        coluna
      />
      <CartaoModulo
        icone="areas"
        titulo="Propriedades"
        descricao="Áreas de manejo e autorizações"
        para="/propriedades"
        :travado="bloqueio"
        para-destravar="/ctf"
        coluna
      />
      <CartaoModulo
        icone="ceva"
        titulo="Espera (ceva)"
        descricao="Cevas, alimento e nível"
        para="/espera"
        :travado="bloqueio"
        para-destravar="/ctf"
        coluna
      />
      <CartaoModulo
        icone="rotas"
        titulo="Rotas"
        descricao="Trajetos dentro da propriedade"
        para="/rotas"
        :travado="bloqueio"
        para-destravar="/ctf"
        coluna
      />
    </div>

    <CartaoModulo
      icone="painel"
      titulo="Caçar agora"
      descricao="Abertas e encerradas · abates de cada uma"
      para="/cacadas"
      :travado="bloqueio"
      para-destravar="/ctf"
      :selo="abertas ? abertas + ' aberta(s)' : undefined"
      selo-tipo="ok"
    />

    <CartaoModulo
      icone="grafico"
      titulo="Relatório Fechamento IBAMA"
      descricao="Abates por autorização, para prestar contas"
      para="/ibama"
    />
  </div>
</template>

<style scoped>
.mod-grade { margin-bottom: 12px; }
</style>
