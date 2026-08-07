<script setup lang="ts">
/**
 * Espera — lista de cevas. Porte de VIEWS.espera (index.html, 8182).
 */
import { useUi } from '~/stores/ui'

definePageMeta({ layout: 'app' })

export interface Ceva {
  id: string; nome?: string; tipo?: string
  lat?: number | string; lng?: number | string
  obs?: string; fotoUrl?: string; propriedadeId?: string
}

const { server } = useServer()
const ui = useUi()

const lista = ref<Ceva[] | null>(null)
const erro = ref('')

async function carregar() {
  erro.value = ''
  try {
    lista.value = await server<Ceva[]>('apiListarCevas')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar as cevas'
  }
}

async function excluir(c: Ceva) {
  if (!confirm('Excluir esta ceva?')) return
  try {
    await server('apiExcluir', 'ceva', c.id)
    ui.avisar('Excluída')
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="lista === null" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card hero">
        <h2>Cevas</h2>
        <div class="meta">
          Cada ceva fica presa a uma propriedade regular, com o ponto dentro do
          limite desenhado.
        </div>
      </div>

      <div v-if="!lista.length" class="card vazio">
        <div class="big"><Icone nome="ceva" /></div>
        Nenhuma ceva cadastrada.
      </div>

      <div v-for="c in lista" :key="c.id" class="card ceva">
        <img v-if="c.fotoUrl" :src="String(c.fotoUrl)" class="thumb" alt="">
        <div v-else class="ic"><Icone nome="ceva" /></div>

        <NuxtLink :to="{ path: '/ceva-detalhe', query: { id: c.id } }" class="grow">
          <b class="no-i18n">{{ c.nome || 'Ceva' }}</b>
          <div class="meta"><span class="pill">{{ c.tipo || '—' }}</span></div>
          <div v-if="c.obs" class="meta no-i18n">{{ c.obs }}</div>
        </NuxtLink>

        <NuxtLink :to="{ path: '/ceva', query: { id: c.id } }" class="ib" title="Editar"><Icone nome="editar" /></NuxtLink>
        <button class="ib" title="Excluir" @click="excluir(c)"><Icone nome="excluir" /></button>
      </div>

      <BotaoCriar
        rotulo="＋ Nova ceva"
        chave="cevas"
        :quantidade="lista.length"
        para="/ceva"
      />
    </template>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--verde); }
.hero h2 { margin: 0 0 4px; font-size: 20px; }
.ruim { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.ceva { display: flex; align-items: center; gap: 10px; }
.thumb { width: 62px; height: 62px; border-radius: 10px; object-fit: cover; flex: none; }
.ic { width: 62px; height: 62px; border-radius: 10px; background: var(--areia); display: flex; align-items: center; justify-content: center; font-size: 26px; flex: none; }
.grow { flex: 1; min-width: 0; text-decoration: none; color: var(--txt); }
.grow .meta { margin: 3px 0 0; }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--linha); }
.ib { border: 0; background: none; cursor: pointer; font-size: 17px; padding: 4px; text-decoration: none; }
</style>
