<script setup lang="ts">
/**
 * Faixa dos registros que esperam a rede, e dos que o servidor recusou.
 *
 * ⚠️ Ela existe porque a fila é invisível por natureza. A tela diz "salvo" e
 * segue, e sem esta faixa a pessoa não teria como saber que o registro ainda
 * está no aparelho — nem que ele subiu. Guardar sem mostrar é pior que não
 * guardar: cria confiança em algo que ninguém pode conferir.
 *
 * ⚠️ O RECUSADO NÃO É APAGADO, e é aqui que ele aparece. Um abate que o
 * servidor negou — teto do plano, CTF vencido no meio do caminho — fica
 * guardado com o motivo, e quem decide o que fazer é o dono, não o app.
 * Descartar é um botão, nunca um efeito colateral.
 *
 * ⚠️ Escuta o evento `online` do navegador. Ele é otimista — dispara quando
 * há interface de rede, não quando há internet de verdade —, e é por isso que
 * uma tentativa que falhe simplesmente mantém a fila. Sinal de mato vai e
 * volta o tempo todo; o `esvaziarFila` é seguro de chamar à toa.
 */
import { useUi } from '~/stores/ui'
import { msgErro } from '~/composables/useMsgErro'
import { listarFila, reativar, tirarDaFila, NOME_ESCRITA } from '~/composables/useFilaOffline'
import type { ItemFila } from '~/composables/useFilaOffline'
import { dataBR } from '~/composables/useMascaras'

const ui = useUi()
const { esvaziarFila, atualizarPendentes } = useServer()

const aberto = ref(false)
const recusados = ref<ItemFila[]>([])

async function carregarRecusados() {
  recusados.value = (await listarFila()).filter((x) => !!x.erro)
}

async function verRecusados() {
  aberto.value = !aberto.value
  if (aberto.value) await carregarRecusados()
}

async function tentarDeNovo(item: ItemFila) {
  await reativar(item.id)
  await carregarRecusados()
  await atualizarPendentes()
  esvaziarFila()
}

async function descartar(item: ItemFila) {
  const nome = NOME_ESCRITA[item.acao] || 'registro'
  if (!confirm('Descartar este ' + nome.toLowerCase() + '? Não dá para recuperar.')) return
  await tirarDaFila(item.id)
  await carregarRecusados()
  await atualizarPendentes()
}

function aoVoltarRede() { esvaziarFila() }

onMounted(() => {
  atualizarPendentes()
  /* Tenta já na abertura: o app pode ter sido fechado ainda com fila. */
  esvaziarFila()
  window.addEventListener('online', aoVoltarRede)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', aoVoltarRede)
})

watch(() => ui.recusados, () => { if (aberto.value) carregarRecusados() })
</script>

<template>
  <div v-if="ui.pendentes || ui.recusados">
    <div v-if="ui.pendentes" class="fila" role="status">
      <Icone nome="enviar" :px="16" />
      <span>
        <b class="no-i18n">{{ ui.pendentes }}</b>
        registro(s) esperando a rede
      </span>
      <button class="tentar" :disabled="ui.enviandoFila" @click="esvaziarFila()">
        {{ ui.enviandoFila ? 'Enviando…' : 'Tentar agora' }}
      </button>
    </div>

    <div v-if="ui.recusados" class="fila ruim">
      <Icone nome="alerta" :px="16" />
      <span>
        <b class="no-i18n">{{ ui.recusados }}</b>
        registro(s) recusados e guardados
      </span>
      <button class="tentar" @click="verRecusados">
        {{ aberto ? 'Fechar' : 'Ver' }}
      </button>
    </div>

    <div v-if="aberto" class="lista">
      <div v-for="r in recusados" :key="r.id" class="item">
        <div class="grow">
          <b class="no-i18n">{{ NOME_ESCRITA[r.acao] || r.acao }}</b>
          <div class="meta no-i18n">{{ dataBR(new Date(r.quando).toISOString()) }}</div>
          <div class="meta motivo">{{ msgErro(new Error(r.erro || '')) }}</div>
        </div>
        <div class="acoes">
          <button class="mini" @click="tentarDeNovo(r)">Tentar de novo</button>
          <button class="mini perigo" @click="descartar(r)">Descartar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fila {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px; font-size: 12px; font-weight: 600;
  background: var(--carvao-3); color: var(--osso);
  border-bottom: 1px solid var(--linha);
}
.fila span { flex: 1; }
.fila b { color: var(--laranja-cl); }
.fila.ruim { background: var(--danger); color: #fff; }
.fila.ruim b { color: #fff; }
.tentar {
  border: 1px solid currentColor; background: none; color: inherit;
  font: inherit; padding: 4px 10px; border-radius: 999px; cursor: pointer;
}
.tentar:disabled { opacity: .6; cursor: default; }

.lista { background: var(--carvao-3); border-bottom: 1px solid var(--linha); padding: 4px 12px 10px; }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid var(--linha); }
.item .grow { flex: 1; min-width: 0; }
.item .meta { margin: 2px 0 0; font-size: 11.5px; }
.item .motivo { color: var(--alerta); }
.acoes { display: flex; flex-direction: column; gap: 5px; flex: none; }
.mini {
  border: 1px solid var(--linha); background: none; color: var(--osso);
  font: inherit; font-size: 11px; padding: 4px 9px; border-radius: 8px; cursor: pointer;
}
.mini.perigo { color: var(--danger); border-color: var(--danger); }
</style>
