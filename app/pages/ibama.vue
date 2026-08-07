<script setup lang="ts">
/**
 * Fechamento do IBAMA — lista das autorizações. Porte de VIEWS.ibamaLista
 * (index.html, 9892).
 *
 * Cada autorização do IBAMA cobre um período numa propriedade. O relatório
 * junta os abates desse período para prestar contas.
 */
import { dataBR } from '~/composables/useMascaras'
import { statusVencimento } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Autorizacao {
  id: string; numero?: string; emissao?: string; vencimento?: string
  encerradoEm?: string; propriedadeId: string; propriedadeNome: string
  abates: number; vencido?: boolean
}

const { server } = useServer()
const lista = ref<Autorizacao[] | null>(null)
const erro = ref('')

onMounted(async () => {
  try {
    lista.value = await server<Autorizacao[]>('apiAutorizacoesIbama')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as autorizações'
  }
})
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card">
        <div class="meta">
          Cada autorização cobre um período numa propriedade. O relatório junta
          os abates desse período para prestar contas.
        </div>
      </div>

      <div v-if="!lista.length" class="card vazio">
        <div class="big">📋</div>
        Nenhuma autorização do IBAMA cadastrada. Elas entram no cadastro da
        propriedade.
      </div>

      <NuxtLink
        v-for="d in lista"
        :key="d.id"
        :to="{ path: '/ibama-relatorio', query: { id: d.id } }"
        class="card aut"
      >
        <div class="grow">
          <b class="no-i18n">📋 {{ d.propriedadeNome }}</b>
          <span v-if="d.encerradoEm" class="pill">fechada</span>
          <span
            v-else-if="statusVencimento(d.vencimento)"
            class="pill"
            :class="statusVencimento(d.vencimento)!.classe"
          >{{ statusVencimento(d.vencimento)!.texto }}</span>

          <div class="meta no-i18n">Autorização {{ d.numero || '—' }}</div>
          <div class="meta no-i18n">
            <template v-if="d.emissao">{{ dataBR(d.emissao) }} → </template>
            {{ d.vencimento ? dataBR(d.vencimento) : '—' }}
          </div>
          <div class="meta">
            <b>{{ d.abates }}</b> {{ d.abates === 1 ? 'abate no período' : 'abates no período' }}
          </div>
          <div v-if="d.encerradoEm" class="meta">
            🔒 fechada em {{ dataBR(d.encerradoEm) }}
          </div>
        </div>
        <div class="chev">›</div>
      </NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.aut { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--txt); }
.aut .grow { flex: 1; min-width: 0; }
.aut .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); margin-left: 6px; }
.pill.ok { background: var(--verde-claro); color: var(--verde-esc); }
.pill.perto { background: #ffe9c7; color: #8a5a10; }
.pill.venc { background: #ffdad3; color: #a33; }
.chev { font-size: 22px; color: var(--linha); }
</style>
