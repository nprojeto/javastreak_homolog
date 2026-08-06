<script setup lang="ts">
/**
 * TELA DE VERIFICAÇÃO — descartável, agora em /verificacao.
 *
 * Não é tela do produto. Existe para provar, num lugar só, que a fundação está
 * de pé: o adaptador fala com o backend de produção, o tradutor troca os três
 * idiomas, o CSS legado carregou e o carimbo de versão está no lugar.
 *
 * Ficou de pé porque é útil: uma tela só para saber qual banco respondeu e
 * quais versões estão no ar.
 */
import type { Idioma } from '~/composables/useTraducao'

const { server } = useServer()
const { t, lang, setLang, IDIOMAS, BANDEIRA } = useTraducao()
const cfg = useRuntimeConfig()

/** Só o identificador do projeto, para conferir de relance qual banco responde. */
const bancoCurto = computed(() => {
  const m = /https:\/\/([a-z0-9]+)\./.exec(String(cfg.public.apiUrl))
  return m ? m[1] : '?'
})

interface Ping {
  ok: boolean
  apiVer: string
  appNome: string
  hora: string
  vagas: { manejador: number; empresa: number }
}

const ping = ref<Ping | null>(null)
const erro = ref('')
const carregando = ref(false)

async function testar() {
  carregando.value = true
  erro.value = ''
  try {
    ping.value = await server<Ping>('apiPing')
  } catch (e) {
    // ⚠️ Regra do dossiê: recusa do servidor APARECE. Nunca vira tela vazia.
    erro.value = e instanceof Error ? e.message : String(e)
  } finally {
    carregando.value = false
  }
}

onMounted(testar)

// Frases de amostra, escolhidas por serem casos que já quebraram o legado.
const amostras = [
  'Registrar abate',
  'Caçar agora',
  'Certificado de regularidade vencido',
  'A documentação da propriedade só existe depois do limite desenhado.'
]
</script>

<template>
  <div class="wrap">
    <div class="card">
      <h2>JavaStreak · Nuxt</h2>
      <p class="meta">
        Diagnóstico. Não faz parte do produto — serve para conferir versões,
        ambiente e se o servidor responde.
      </p>

      <!-- Faixa de ambiente: evitar confundir homologação com produção é a
           coisa mais barata de fazer e a mais cara de esquecer. -->
      <p class="ambiente">
        {{ cfg.public.ambiente === 'homologacao' ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO' }}
        — banco {{ bancoCurto }}
      </p>

      <h3>1. Versão</h3>
      <p>
        Frontend: <code>{{ cfg.public.appVer }}</code><br>
        Backend: <code>{{ ping?.apiVer || '—' }}</code>
      </p>

      <h3>2. Conversa com o servidor</h3>
      <p v-if="carregando" class="meta">Chamando <code>apiPing</code>…</p>
      <p v-else-if="erro" class="ruim">Falhou: {{ erro }}</p>
      <p v-else-if="ping" class="bom">
        Respondeu. App: <b>{{ ping.appNome }}</b><br>
        Hora do servidor: {{ ping.hora }}<br>
        Vagas — manejador: {{ ping.vagas.manejador }} · empresa:
        {{ ping.vagas.empresa }}
      </p>
      <button class="btn sec" :disabled="carregando" @click="testar">
        Testar de novo
      </button>

      <h3>3. Idioma</h3>
      <div class="langs">
        <button
          v-for="(nome, cod) in IDIOMAS"
          :key="cod"
          class="btn sm"
          :class="{ sec: lang !== cod }"
          @click="setLang(cod as Idioma)"
        >
          {{ BANDEIRA[cod as Idioma] }} {{ nome }}
        </button>
      </div>
      <ul>
        <li v-for="f in amostras" :key="f">{{ t(f) }}</li>
      </ul>
      <p class="meta">
        1.481 frases em cada idioma. A última da lista tem apóstrofo na versão
        inglesa — o caso que derrubava o arquivo no legado.
      </p>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 640px; margin: 0 auto; padding: 16px; }
.ambiente {
  display: inline-block;
  background: var(--laranja, #e8552b);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 4px 10px;
  border-radius: 999px;
  margin: 0 0 4px;
}
h3 { margin: 18px 0 6px; }
code { background: var(--areia); padding: 1px 5px; border-radius: 4px; }
.bom { color: var(--ok); }
.ruim { color: var(--danger); }
.langs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.langs .btn { width: auto; }
ul { margin: 8px 0; padding-left: 18px; }
li { margin: 3px 0; }
</style>
