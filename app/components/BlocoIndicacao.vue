<script setup lang="ts">
/**
 * Chave de indicação. Porte de blocoIndicacao/checarIndicador/
 * indicacaoParaEnviar.
 *
 * Sem promoção no ar, o bloco não aparece — o estado vem do `apiPing`. E a
 * chave é conferida NO SERVIDOR antes de enviar o cadastro: indicador
 * inválido derruba o cadastro inteiro lá atrás, então perguntar antes evita
 * a pessoa preencher tudo para levar erro no fim.
 */
import { useApp } from '~/stores/app'

/** '' = sem indicação. A tela lê isto na hora de montar o envio. */
const chave = defineModel<string>({ default: '' })

const app = useApp()
const { server } = useServer()

const tem = ref(false)
const digitada = ref('')
const estado = ref<'' | 'conferindo' | 'ok' | 'ruim' | 'erro'>('')

const soAlfaNum = (x: string) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

watch(digitada, () => {
  estado.value = ''
  chave.value = tem.value ? digitada.value : ''
})
watch(tem, () => {
  if (!tem.value) { digitada.value = ''; estado.value = ''; chave.value = '' }
})

async function conferir() {
  if (soAlfaNum(digitada.value).length < 8) { estado.value = ''; return }
  estado.value = 'conferindo'
  try {
    const r = await server<{ valido: boolean }>('apiValidarIndicador', digitada.value)
    estado.value = r.valido ? 'ok' : 'ruim'
  } catch {
    estado.value = 'erro'
  }
}

/** A tela chama antes de enviar: false = não pode seguir. */
function validar(): boolean {
  if (!tem.value) return true
  if (!digitada.value) return false
  return estado.value === 'ok'
}
defineExpose({ validar, conferir })
</script>

<template>
  <div v-if="app.promoIndAtiva" class="bloco">
    <label>Alguém indicou o JavaStreak para você?</label>
    <select v-model="tem">
      <option :value="false">Não</option>
      <option :value="true">Sim, tenho uma chave</option>
    </select>

    <template v-if="tem">
      <label>Chave de indicação *</label>
      <input
        v-model="digitada"
        placeholder="JS-XXXX-XXXX"
        maxlength="14"
        class="chave"
        @blur="conferir"
      >
      <div class="meta msg">
        <span v-if="estado === 'conferindo'">Conferindo…</span>
        <span v-else-if="estado === 'ok'" class="bom"><Icone nome="confirmar" /> Chave válida</span>
        <span v-else-if="estado === 'ruim'" class="ruim">
          <Icone nome="fechar" /> Chave não encontrada ou de conta não confirmada
        </span>
        <span v-else-if="estado === 'erro'">Não foi possível conferir agora</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bloco { margin-top: 6px; }
.chave { text-transform: uppercase; letter-spacing: 1px; }
.msg { margin: -4px 0 8px; min-height: 18px; }
.bom { color: var(--verde); }
.ruim { color: var(--danger); }
</style>
