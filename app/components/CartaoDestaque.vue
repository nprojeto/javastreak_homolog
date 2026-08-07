<script setup lang="ts">
/**
 * Destaque patrocinado. Porte de apiCampanhaAtiva + o card do legado.
 *
 * ⚠️ Uma campanha por vez, e quem decide é o administrador: publicar uma nova
 * encerra a anterior no servidor. Por isso a tela não escolhe nada — só mostra
 * o que estiver no ar.
 *
 * ⚠️ Some sozinho quando não há nada. Um espaço reservado vazio no meio da
 * tela é pior que nenhum espaço.
 */
import { dataBR } from '~/composables/useMascaras'

interface Campanha {
  id: string; titulo?: string; patrocinador?: string; premio?: string
  descricao?: string; encerraEm?: string; tipo?: string; fotoUrl?: string
  precoAtual?: string; precoPromo?: string
}

const { server } = useServer()
const c = ref<Campanha | null>(null)

onMounted(async () => {
  try {
    c.value = await server<Campanha | null>('apiCampanhaAtiva')
  } catch {
    /* Destaque é acessório: falhar aqui não pode atrapalhar a tela. */
  }
})
</script>

<template>
  <div v-if="c" class="card destaque">
    <div class="selo">Patrocinado</div>
    <img v-if="c.fotoUrl" :src="String(c.fotoUrl)" class="foto" alt="">
    <div class="corpo">
      <b class="no-i18n">{{ c.titulo }}</b>
      <div v-if="c.patrocinador" class="meta no-i18n">por {{ c.patrocinador }}</div>
      <div v-if="c.premio" class="premio no-i18n">
        <Icone nome="trofeu" /> {{ c.premio }}
      </div>
      <div v-if="c.descricao" class="meta no-i18n">{{ c.descricao }}</div>
      <div v-if="c.precoPromo" class="precos no-i18n">
        <s v-if="c.precoAtual">R$ {{ c.precoAtual }}</s>
        <b>R$ {{ c.precoPromo }}</b>
      </div>
      <div v-if="c.encerraEm" class="meta">até {{ dataBR(c.encerraEm) }}</div>
    </div>
  </div>
</template>

<style scoped>
.destaque { border-left: 3px solid var(--laranja); padding: 0; overflow: hidden; position: relative; }
.selo {
  position: absolute; top: 10px; right: 10px; z-index: 2;
  background: var(--laranja); color: #fff; font-size: 10px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px;
}
.foto { width: 100%; display: block; max-height: 170px; object-fit: cover; }
.corpo { padding: 12px 14px; }
.corpo > b { font-size: 15px; }
.corpo .meta { margin: 3px 0 0; }
.premio { color: var(--laranja-cl); font-weight: 600; margin-top: 6px; display: flex; align-items: center; gap: 6px; }
.precos { margin-top: 6px; }
.precos s { color: var(--osso-2); margin-right: 8px; }
.precos b { color: var(--laranja-cl); font-size: 17px; }
</style>
