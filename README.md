# JavaStreak — frontend Nuxt

Reescrita do `index.html` (arquivo único, 11.059 linhas) em Nuxt 4 + Vue.
**O backend não muda:** continua a Supabase Edge Function em Deno
(`api-index.ts`) sobre o mesmo Postgres.

Estado atual: **lotes 0, 1 e 2 concluídos** — entrada (bem-vindo, login,
cadastro, recuperação de senha) e casca do app (menu, início, agenda, perfil,
planos, compras, suporte).

---

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
```

A página inicial é a **tela de verificação do lote 0** — ela chama `apiPing` no
seu backend de produção, troca os três idiomas e mostra os dois carimbos de
versão. Ela é descartável e some no lote 1.

```bash
npm run generate     # gera .output/public — é o que vai para o GitHub Pages
npm run conferir:frases
```

---

## O que já está de pé

| Peça | Arquivo | O que faz |
|---|---|---|
| Adaptador de rede | `app/composables/useServer.ts` | **A única porta para o servidor.** Porte fiel do `server()` legado |
| Tradução | `app/composables/useTraducao.ts` | 1.481 frases × 3 idiomas, carregadas sob demanda |
| Sessão | `app/stores/auth.ts` | Token no `localStorage`, mesma chave `mj_token` |
| Interface | `app/stores/ui.ts` | Avisos (toast), ponto de conexão, pedido de upgrade |
| CSS | `app/assets/css/legado.css` | 1.070 linhas copiadas como estão |
| Publicação | `.github/workflows/deploy.yml` | Build + conferência de idiomas + Pages |

## Por que o adaptador importa tanto

As 176 chamadas do app legado passavam todas por uma função só. Aqui vale o
mesmo contrato: **nenhum `fetch` solto em tela nenhuma, nunca.**

É isso que torna a fase 2 barata. Quando o backend virar Laravel na Laravel
Cloud, o formato muda de `{ action, args, token }` para REST — e muda **só o
`useServer.ts`**. As 80 telas não sabem, e não devem saber, como o servidor é
falado.

---

## Regras herdadas do dossiê que continuam valendo

- **Frase visível nova entra nos três idiomas na mesma entrega.** Agora isso é
  porta de build: `npm run conferir:frases` falha e o deploy não sai.
- **Recusa do servidor aparece.** Nunca vira lista vazia. `serverOpc` só
  silencia bloqueio de plano — qualquer outro erro sobe.
- **Versão `vJS.ddmmaa.hhmm`** pelo relógio de São Paulo, em
  `runtimeConfig.public.appVer`.
- **A validação que manda é a do servidor.** Geometria no cliente é
  conveniência; `pontoDentro_` continua no Deno.

## Regras do dossiê que deixaram de existir

Cache não semeado, `textContent` fora do tradutor, apóstrofo derrubando o
arquivo, função declarada duas vezes, `MAPDATA` como fonte de verdade. Estão
detalhadas na seção 4 do plano.

---

## Refazer a extração

Se o `index.html` legado mudar antes do corte:

```bash
node scripts/extrair-do-html.mjs ../caminho/index.html
```

Regenera os três JSON de idioma e o `legado.css` a partir do fonte cru.

---

## Trocar a marca (demonstração ↔ JavaStreak)

O app está vestido com a marca do cliente para a apresentação. Voltar ao
JavaStreak é **uma linha**, em `nuxt.config.ts`:

```ts
marca: process.env.NUXT_PUBLIC_MARCA || 'meateater'   // demonstração
marca: process.env.NUXT_PUBLIC_MARCA || 'javastreak'  // depois
```

Isso muda de uma vez: logo do cabeçalho, logo das telas de entrada, cor de
acento, nome no título da página e o `data-marca` do `<html>`.

As imagens ficam em `public/marca/`, já sem fundo. Marca nova é acrescentar
dois PNG lá e uma entrada em `app/composables/useMarca.ts`.

⚠️ Nenhuma tela conhece a marca — todas passam por `useMarca()`. Se você
escrever `/logo.png` direto em algum lugar, esse lugar deixa de acompanhar a
troca.
