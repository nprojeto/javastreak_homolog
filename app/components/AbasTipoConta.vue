<script setup lang="ts">
/** Os dois botões de tipo de conta. Porte de abasTipoConta. */
const props = defineProps<{ atual: 'manejador' | 'empresa' }>()
const router = useRouter()

function trocar(t: 'manejador' | 'empresa') {
  if (t === props.atual) return
  router.replace(t === 'empresa' ? '/registrar-empresa' : '/registrar')
}
</script>

<template>
  <div class="tipo-conta">
    <button :class="{ on: props.atual === 'manejador' }" @click="trocar('manejador')">
      <Icone nome="manejador" /> Manejador
    </button>
    <button :class="{ on: props.atual === 'empresa' }" @click="trocar('empresa')">
      <Icone nome="loja" /> Empresa
    </button>
  </div>
</template>

<style scoped>
.tipo-conta { display: flex; gap: 8px; margin-top: 10px; }
.tipo-conta button {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px 8px; border-radius: 14px; border: 1.5px solid var(--linha);
  background: var(--card); cursor: pointer; font-size: 14px; font-weight: 600; color: var(--txt);
}
.tipo-conta button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
</style>
