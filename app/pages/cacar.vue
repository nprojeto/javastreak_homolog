<script setup lang="ts">
/**
 * Portal do CAÇAR. Por enquanto só o CTF, que é a porta de tudo — o ciclo de
 * caça, os convites e o abate chegam no lote 5.
 */
import { useCreditos } from '~/stores/creditos'

definePageMeta({ layout: 'app' })

const cred = useCreditos()
</script>

<template>
  <div>
    <div class="card hero">
      <h2>CAÇAR</h2>
      <div class="meta">
        Tudo começa pelo CTF: sem ele em dia não se abre caçada, não se registra
        abate e não se entra na caçada de ninguém.
      </div>
    </div>

    <NuxtLink to="/ctf" class="card menu-card">
      <Icone nome="documentos" :px="34" />
      <div class="txt">
        <h3>
          CTF — Cadastro Técnico Federal
          <span v-if="cred.dados" class="doc-tag" :class="cred.dados.ctfEmDia ? 'ok' : 'venc'">
            {{ cred.dados.ctfEmDia ? 'em dia' : 'pendente' }}
          </span>
        </h3>
        <p>Número, emissão, validade e o anexo que comprova o registro</p>
      </div>
      <div class="chev">›</div>
    </NuxtLink>

    <NuxtLink to="/cacadas" class="card menu-card">
      <Icone nome="painel" :px="34" />
      <div class="txt">
        <h3>Caçadas</h3>
        <p>Abrir ciclo, convidar amigos e acompanhar os abates</p>
      </div>
      <div class="chev">›</div>
    </NuxtLink>

    <NuxtLink to="/ibama" class="card menu-card">
      <Icone nome="arquivo" :px="34" />
      <div class="txt">
        <h3>Fechamento IBAMA</h3>
        <p>Juntar os abates de uma autorização e prestar contas</p>
      </div>
      <div class="chev">›</div>
    </NuxtLink>
  </div>
</template>

<style scoped>
.hero { border-top: 4px solid var(--laranja); }
.hero h2 { margin: 0 0 4px; font-size: 20px; letter-spacing: 1px; }
.menu-card { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--txt); }
.menu-card .txt { flex: 1; }
.menu-card h3 { margin: 0 0 2px; font-size: 15px; }
.menu-card p { margin: 0; font-size: 12.5px; color: var(--osso-2); }
.chev { font-size: 22px; color: var(--linha); }
.doc-tag { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; background: var(--linha); }
.doc-tag.ok { background: var(--verde-claro); color: var(--verde-esc); }
.doc-tag.venc { background: #3A1E1C; color: var(--danger); }
</style>
