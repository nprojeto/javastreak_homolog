<script setup lang="ts">
import { useAuth } from '~/stores/auth'
import { useUi } from '~/stores/ui'

const auth = useAuth()
const ui = useUi()

// SPA: o token só existe no aparelho, então restaurar no cliente.
onMounted(() => auth.restaurar())
</script>

<template>
  <div class="app">
    <!-- Ponto de conexão: mesmo papel do #connDot legado -->
    <span
      class="dot"
      :class="ui.conectado === null ? '' : ui.conectado ? 'on' : 'off'"
      :title="ui.conectado === false ? 'Sem conexão' : 'Conectado'"
    />

    <!--
      <Icone nome="alerta" /> O <NuxtLayout> é OBRIGATÓRIO aqui. Quando existe app.vue, é ele quem
      aplica o layout que cada tela declara em definePageMeta. Sem esta linha,
      `layout: 'app'` é ignorado em silêncio e as telas aparecem sem moldura —
      sem cabeçalho, sem menu e sem a faixa de créditos.
    -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Recusa por plano. Fica aqui, e não no layout do app, porque o
         cadastro (fora do layout) também pode recebê-la. -->
    <AvisoPlano />

    <!-- Avisos (toast). Um lugar só para o app inteiro. -->
    <div class="avisos">
      <div
        v-for="a in ui.avisos"
        :key="a.id"
        class="aviso"
        :class="a.tipo"
      >
        {{ a.texto }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.dot {
  position: fixed;
  top: 8px;
  right: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--linha);
  z-index: 50;
}
.dot.on { background: var(--ok); }
.dot.off { background: var(--danger); }

.avisos {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 100;
  width: min(92vw, 420px);
}
.aviso {
  background: var(--carvao-3);
  color: var(--osso);
  border-left: 3px solid var(--laranja);
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: var(--sombra);
  font-size: 14px;
}
.aviso.erro { border-left-color: var(--danger); color: #F3C9C7; }
</style>
