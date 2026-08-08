<script setup lang="ts">
import { useMarca } from '~/composables/useMarca'
/**
 * Menu lateral. Porte de buildSidebar (index.html, 4643).
 *
 * O cadeado nos itens vem do limite do plano (`MODULO_LIMITE`): o item
 * continua clicável, mas já avisa que o plano não inclui — mesma escolha do
 * legado, que prefere explicar a esconder.
 */
import { useAuth } from '~/stores/auth'
import { useCreditos } from '~/stores/creditos'
import { NAV_MANEJADOR, NAV_LOJISTA, TOP_KEYS, CONTA_KEYS, MODULO_LIMITE } from '~/composables/useNavegacao'
import { NAV_SVG } from '~/composables/useIcones'

const aberto = defineModel<boolean>('aberto', { default: false })

const auth = useAuth()
const cred = useCreditos()
const route = useRoute()
const router = useRouter()
const cfg = useRuntimeConfig()
const marca = useMarca()

const itens = computed(() => {
  const base = auth.tipo === 'empresa' ? NAV_LOJISTA : NAV_MANEJADOR
  const lista = base.filter((n) => !TOP_KEYS.includes(n.chave) && !CONTA_KEYS.includes(n.chave))
  return auth.admin
    ? lista.concat([{ chave: 'admin', rota: '/admin', label: 'Administração', icon: 'admin' }])
    : lista
})

function bloqueado(chave: string) {
  const k = MODULO_LIMITE[chave]
  if (!k || auth.tipo === 'empresa') return false
  return cred.dados?.limites?.[k] === 0
}

function ir(rota: string) {
  aberto.value = false
  router.push(rota)
}
</script>

<template>
  <div class="overlay" :class="{ on: aberto }" @click="aberto = false" />

  <aside class="sidebar" :class="{ on: aberto }">
    <div class="sb-topo">
      <img :src="marca.lockup" :alt="marca.nome" class="sb-logo">
      <div class="sb-nome">{{ auth.nome || '—' }}</div>
      <div v-if="cred.dados" class="sb-plano" :class="{ pago: cred.dados.plano !== 'free' }">
        {{ cred.dados.planoNome }}
      </div>
    </div>

    <!-- Chamada de plano no topo, como no legado: é o primeiro item porque é
         o que destrava o resto quando algum limite bate. -->
    <NuxtLink to="/planos" class="sb-planos" @click="aberto = false">
      <Icone nome="estrela" :px="20" />
      <span>
        <b>Ver planos</b>
        <small>Comparar e renovar</small>
      </span>
    </NuxtLink>

    <nav class="sb-nav">
      <button
        v-for="n in itens"
        :key="n.chave"
        class="sb-item"
        :class="{ active: route.path === n.rota, destaque: n.destaque, travado: bloqueado(n.chave) }"
        @click="ir(n.rota)"
      >
        <span class="sb-ico"><Icone :nome="NAV_SVG[n.icon] || 'painel'" :px="24" /></span>
        <span class="sb-label">{{ n.label }}</span>
        <span v-if="bloqueado(n.chave)" class="sb-lock"><Icone nome="bloqueio" /></span>
      </button>
    </nav>

    <!-- ⚠️ Sem "Sair" e sem "Suporte" aqui: os dois moram no menu da conta,
         ao lado do sino. O rodapé fica só com o carimbo de versão. -->
    <div class="sb-pe">
      <div class="sb-ver">{{ cfg.public.appVer }}</div>
    </div>
  </aside>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(20,26,20,.45);
  opacity: 0; pointer-events: none; transition: opacity .18s; z-index: 60;
}
.overlay.on { opacity: 1; pointer-events: auto; }

.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; width: 268px; max-width: 84vw;
  background: var(--card, #fff); border-right: 1px solid var(--linha);
  transform: translateX(-100%); transition: transform .2s; z-index: 70;
  display: flex; flex-direction: column; overflow-y: auto;
}
.sidebar.on { transform: none; }

.sb-topo { padding: 16px 14px 12px; border-bottom: 1px solid var(--linha); text-align: center; }
.sb-logo { width: 150px; max-width: 80%; }
.sb-nome { font-weight: 700; margin-top: 6px; font-size: 15px; }
.sb-plano {
  display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: 999px;
  background: var(--linha); color: var(--txt);
}
.sb-planos {
  display: flex; align-items: center; gap: 10px;
  margin: 10px 12px 4px; padding: 11px 12px; border-radius: 12px;
  background: var(--laranja); color: #fff; text-decoration: none;
}
.sb-planos :deep(.ic-svg) { stroke: #fff; }
.sb-planos b { display: block; font-size: 14px; line-height: 1.2; text-transform: uppercase; }
.sb-planos small { display: block; font-size: 10.5px; opacity: .85; text-transform: uppercase; letter-spacing: .05em; }
.sb-plano.pago { background: var(--verde); color: #fff; }

.sb-nav { flex: 1; padding: 8px 0; }
.sb-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 12px 16px; border: 0; background: none; cursor: pointer;
  font-size: 14.5px; color: var(--txt); text-align: left;
}
.sb-item:hover { background: var(--areia); }
.sb-item.active { background: var(--verde-claro); color: var(--verde-esc); font-weight: 700; }
.sb-item.destaque { color: var(--laranja); font-weight: 800; letter-spacing: .5px; }
.sb-item.travado .sb-label { opacity: .6; }
.sb-ico { display: flex; flex: none; }
.sb-label { flex: 1; }
.sb-lock { font-size: 12px; }

.sb-pe { padding: 10px 14px 16px; border-top: 1px solid var(--linha); }
.sb-ver { text-align: center; font-size: 10.5px; color: var(--osso-2); }
</style>
