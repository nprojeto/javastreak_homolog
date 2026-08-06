<script setup lang="ts">
/**
 * Porta de entrada do cadastro. Porte de VIEWS.maioridade (linha 5466).
 *
 * Sempre se passa por aqui: é nesta tela que mora a escolha do tipo de conta,
 * e é onde a declaração de maioridade é feita antes de qualquer formulário.
 */
const route = useRoute()
const router = useRouter()

const tipo = ref<'manejador' | 'empresa'>(
  route.query.tipo === 'empresa' ? 'empresa' : 'manejador'
)

function continuar() {
  router.push(tipo.value === 'empresa' ? '/registrar-empresa' : '/registrar')
}
</script>

<template>
  <TelaEntrada>
    <h3 class="pergunta">Que tipo de conta você quer criar?</h3>

    <div class="tipo-conta">
      <button :class="{ on: tipo === 'manejador' }" @click="tipo = 'manejador'">
        🌿 Manejador
        <small>Cevas, rotas, cães, abates e troféus</small>
      </button>
      <button :class="{ on: tipo === 'empresa' }" @click="tipo = 'empresa'">
        🏪 Empresa
        <small>Loja no mapa, promoções e vitrine</small>
      </button>
    </div>

    <div class="card idade">
      <h3>🔞 Conteúdo para maiores de 18 anos</h3>
      <p>
        O JavaStreak é uma ferramenta de manejo de javali destinada a pessoas com
        18 anos ou mais, que possuam as autorizações legais exigidas para a
        atividade.
      </p>
      <button class="btn" @click="continuar">Tenho 18 anos ou mais — continuar</button>
      <NuxtLink to="/" class="btn sec">Voltar</NuxtLink>
      <div class="meta fim">Se você tem menos de 18 anos, feche esta página.</div>
    </div>
  </TelaEntrada>
</template>

<style scoped>
.pergunta { margin: 14px 4px 2px; }
.tipo-conta { display: flex; gap: 8px; }
.tipo-conta button {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 8px; border-radius: 14px; border: 1.5px solid var(--linha);
  background: #fff; cursor: pointer; font-size: 15px; font-weight: 600; color: var(--txt);
}
.tipo-conta button.on { border-color: var(--verde); background: var(--verde-claro); color: var(--verde-esc); }
.tipo-conta small { font-weight: 400; font-size: 11.5px; color: var(--txt); opacity: .75; text-align: center; }
.idade { border-top: 4px solid var(--alerta); }
.idade h3 { margin: 0 0 6px; }
.idade p { font-size: 14.5px; line-height: 1.6; margin: 0 0 12px; }
.btn.sec { margin-top: 10px; text-decoration: none; }
.fim { text-align: center; margin-top: 10px; }
</style>
