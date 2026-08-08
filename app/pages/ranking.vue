<script setup lang="ts">
/**
 * Ranking de troféus. Porte de VIEWS.ranking + avaliarTrofeu
 * (index.html, 7500).
 *
 * ⚠️ Só disputa quem colocou o troféu no ranking, e só nas últimas 24 horas
 * contadas da ENTRADA. E só avalia quem tem a própria sala visível — a régua
 * é a mesma para todos.
 */
import { useUi } from '~/stores/ui'

definePageMeta({ layout: 'app' })

interface Item {
  id: string; autorNome?: string; fotoUrl?: string; titulo?: string
  votos: number; media: number; minhaNota: number; ehMeu?: boolean; saiEm?: string
}

const { server } = useServer()
const ui = useUi()

const dados = ref<{ podeVotar: boolean; trofeus: Item[] } | null>(null)
const erro = ref('')
const votando = ref('')

async function carregar() {
  erro.value = ''
  try {
    dados.value = await server('apiRankingTrofeus')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o ranking'
  }
}

async function avaliar(t: Item, nota: number) {
  votando.value = t.id
  try {
    const r = await server<{ minhaNota: number; votos: number; media: number }>(
      'apiAvaliarTrofeu', t.id, nota
    )
    t.minhaNota = r.minhaNota; t.votos = r.votos; t.media = r.media
    ui.avisar('Avaliação registrada ✔')
  } catch { /* já avisado */ } finally {
    votando.value = ''
  }
}

onMounted(carregar)
</script>

<template>
  <div>
    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!dados" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <TituloTela
        titulo="Ranking"
        descricao="Troféus em disputa nas últimas 24 horas, ordenados pela média."
      />

      <div v-if="!dados.podeVotar" class="card aviso-sala">
        <div class="meta">
          <Icone nome="alerta" /> Deixe a sua sala visível para poder avaliar os
          troféus dos outros.
        </div>
        <NuxtLink to="/trofeus" class="btn sec">Abrir minha sala</NuxtLink>
      </div>

      <ClientOnly><CartaoDestaque /></ClientOnly>

      <div v-if="!dados.trofeus.length" class="card vazio">
        <div class="big"><Icone nome="trofeu" /></div>
        Nenhum troféu em disputa agora.
      </div>

      <div v-for="(t, i) in dados.trofeus" :key="t.id" class="card trofeu">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="foto" alt="">
        <div class="corpo">
          <div class="topo">
            <span class="pos">{{ i + 1 }}º</span>
            <div class="grow">
              <b class="no-i18n">{{ t.titulo || 'Troféu' }}</b>
              <div class="meta no-i18n">{{ t.autorNome || 'manejador' }}</div>
            </div>
            <div class="nota">
              <Icone nome="estrela" /> {{ t.media ? t.media.toFixed(1).replace('.', ',') : '—' }}
              <span class="meta">{{ t.votos }} voto(s)</span>
            </div>
          </div>

          <div v-if="t.ehMeu" class="meta">Este é o seu troféu.</div>
          <div v-else-if="dados.podeVotar" class="estrelas">
            <button
              v-for="n in 5"
              :key="n"
              :disabled="votando === t.id"
              :class="{ on: t.minhaNota >= n }"
              @click="avaliar(t, n)"
            >★</button>
            <span v-if="t.minhaNota" class="meta">sua nota: {{ t.minhaNota }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ruim { color: var(--danger); }
.aviso-sala { border-left: 3px solid var(--alerta); }
.aviso-sala .btn { margin-top: 8px; text-decoration: none; width: auto; }
.aviso { color: var(--laranja-esc); margin-top: 6px; }
.aviso a { color: var(--laranja); font-weight: 600; }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.trofeu { padding: 0; overflow: hidden; }
.foto { width: 100%; display: block; max-height: 240px; object-fit: cover; }
.corpo { padding: 12px 14px; }
.topo { display: flex; align-items: center; gap: 10px; }
.pos { font-size: 19px; font-weight: 800; color: var(--laranja); flex: none; }
.topo .grow { flex: 1; min-width: 0; }
.nota { text-align: right; flex: none; font-weight: 700; }
.nota .meta { display: block; font-weight: 400; }
.estrelas { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.estrelas button {
  border: 0; background: none; cursor: pointer; font-size: 24px;
  color: var(--linha); padding: 0 2px;
}
.estrelas button.on { color: #e8a51e; }
.estrelas .meta { margin-left: 8px; }
</style>
