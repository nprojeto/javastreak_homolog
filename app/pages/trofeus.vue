<script setup lang="ts">
/**
 * Sala de troféus. Porte de VIEWS.trofeus + addTrofeu + setSalaVisivel +
 * setTrofeuRanking (index.html, 7398).
 *
 * ⚠️ Duas visibilidades diferentes, e confundi-las já custou tempo:
 *   • SALA VISÍVEL — deixa outros verem seus troféus, e é o que permite VOCÊ
 *     avaliar os dos outros. Quem se esconde não avalia ninguém.
 *   • NO RANKING — coloca UM troféu para disputar, por 24 horas contadas da
 *     ENTRADA, não da criação. Sair e voltar reinicia a contagem.
 */
import { useUi } from '~/stores/ui'
import { dataBR } from '~/composables/useMascaras'
import { lerArquivo, FOTO_MAX_MB } from '~/composables/useArquivo'

definePageMeta({ layout: 'app' })

interface Trofeu {
  id: string; fotoUrl?: string; titulo?: string; criadoEm?: string
  votos: number; media: number; noRanking: boolean
  saiuDoRanking?: boolean; horasRestantes?: number | null
}

const { server } = useServer()
const ui = useUi()

const sala = ref<{ visivel: boolean; trofeus: Trofeu[] } | null>(null)
const erro = ref('')
const trocando = ref(false)

const form = ref(false)
const titulo = ref('')
const foto = ref('')
const salvando = ref(false)

async function carregar() {
  erro.value = ''
  try {
    sala.value = await server('apiMinhaSala')
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar a sala'
  }
}

async function alternarSala() {
  trocando.value = true
  try {
    const r = await server<{ visivel: boolean }>('apiSetSalaVisivel', !sala.value?.visivel)
    if (sala.value) sala.value.visivel = !!r.visivel
    ui.avisar(r.visivel ? 'Sua sala está visível ✔' : 'Sua sala está oculta')
  } catch { /* já avisado */ } finally {
    trocando.value = false
  }
}

async function escolheuFoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) { foto.value = ''; return }
  try {
    const a = await lerArquivo(f, { tipos: ['image/jpeg', 'image/png', 'image/webp'], maxMb: FOTO_MAX_MB })
    foto.value = a.dados
  } catch (err) {
    foto.value = ''
    ui.avisar(err instanceof Error ? err.message : 'Imagem inválida', 'erro')
  }
}

async function salvar() {
  if (!foto.value) { ui.avisar('Escolha uma foto', 'erro'); return }
  salvando.value = true
  try {
    await server('apiAddTrofeu', { foto: foto.value, titulo: titulo.value })
    ui.avisar('Troféu salvo ✔')
    form.value = false; titulo.value = ''; foto.value = ''
    await carregar()
  } catch { /* já avisado */ } finally {
    salvando.value = false
  }
}

async function alternarRanking(t: Trofeu) {
  try {
    await server('apiSetTrofeuRanking', t.id, !t.noRanking || !!t.saiuDoRanking)
    await carregar()
  } catch { /* já avisado, inclusive a tela de plano */ }
}

async function excluir(t: Trofeu) {
  if (!confirm('Excluir este troféu?')) return
  try {
    await server('apiExcluirTrofeu', t.id)
    await carregar()
  } catch { /* já avisado */ }
}

onMounted(carregar)
</script>

<template>
  <div>
    <TituloTela titulo="Sala de troféu" />

    <div v-if="erro" class="card"><div class="meta ruim">{{ erro }}</div></div>
    <div v-else-if="!sala" class="card"><div class="meta">Carregando…</div></div>

    <template v-else>
      <div class="card card-acao">
        <div class="ca-txt">
          <h3><Icone nome="trofeu" /> Minha sala de troféus</h3>
          <div class="meta">
            {{ sala.visivel
              ? 'Sua sala está visível — outros veem seus troféus e você pode avaliar os deles.'
              : 'Sua sala está oculta. Enquanto estiver assim, você também não avalia os troféus dos outros.' }}
          </div>
        </div>
        <button
          class="btn ca-btn"
          :class="{ sec: sala.visivel }"
          :disabled="trocando"
          @click="alternarSala"
        >{{ sala.visivel ? 'Ocultar' : 'Deixar visível' }}</button>
      </div>

      <div v-if="form" class="card">
        <label for="t_tit">Título</label>
        <input id="t_tit" v-model="titulo" class="no-i18n" placeholder="Ex: Primeiro da temporada">
        <label for="t_foto">Foto *</label>
        <img v-if="foto" :src="foto" class="prev" alt="Prévia">
        <input id="t_foto" type="file" accept="image/*" @change="escolheuFoto">
        <button class="btn" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando…' : 'Salvar troféu' }}
        </button>
        <button class="btn sec" @click="form = false">Cancelar</button>
      </div>

      <div v-if="!sala.trofeus.length && !form" class="card vazio">
        <div class="big"><Icone nome="trofeu" /></div>
        Nenhum troféu ainda.
      </div>

      <div v-for="t in sala.trofeus" :key="t.id" class="card trofeu">
        <img v-if="t.fotoUrl" :src="String(t.fotoUrl)" class="foto" alt="">
        <div class="corpo">
          <b class="no-i18n">{{ t.titulo || 'Troféu' }}</b>
          <div class="meta">
            <Icone nome="estrela" /> {{ t.media ? t.media.toFixed(1).replace('.', ',') : '—' }}
            · {{ t.votos }} voto(s) · {{ dataBR(t.criadoEm) }}
          </div>
          <div v-if="t.noRanking && !t.saiuDoRanking" class="meta viva">
            <Icone nome="alerta" /> No ranking
            <template v-if="t.horasRestantes"> · sai em {{ t.horasRestantes }}h</template>
          </div>
          <div v-else-if="t.saiuDoRanking" class="meta">
            Saiu do ranking — dá para disputar de novo.
          </div>

          <div class="acoes">
            <button class="btn sm sec" @click="alternarRanking(t)">
              {{ t.noRanking && !t.saiuDoRanking ? 'Tirar do ranking' : 'Disputar ranking' }}
            </button>
            <button class="btn sm sec" @click="excluir(t)"><Icone nome="excluir" /> Excluir</button>
          </div>
        </div>
      </div>

      <BotaoCriar
        v-if="!form"
        rotulo="＋ Novo troféu"
        chave="trofeusRanking"
        @criar="form = true"
      />
    </template>
  </div>
</template>

<style scoped>
h3 { margin: 0 0 4px; }
.ruim { color: var(--danger); }
.viva { color: var(--danger); }
.vazio { text-align: center; padding: 24px; }
.vazio .big { font-size: 40px; margin-bottom: 6px; }
.trofeu { padding: 0; overflow: hidden; }
.foto { width: 100%; display: block; max-height: 260px; object-fit: cover; }
.corpo { padding: 12px 14px; }
.corpo .meta { margin: 3px 0 0; }
.acoes { display: flex; gap: 8px; margin-top: 10px; }
.acoes .btn { width: auto; margin: 0; }
.prev { max-width: 180px; border-radius: 10px; display: block; margin: 4px 0 8px; }
.btn.sec { margin-top: 8px; }
</style>
