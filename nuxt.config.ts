// https://nuxt.com/docs/api/configuration/nuxt-config
/**
 * ⚠️ ENDEREÇO BASE — lido UMA VEZ e reusado.
 *
 * Em homologação o app mora numa subpasta (`/javastreak_homolog/`), e o PWA
 * precisa saber disso. Service worker não pode reivindicar escopo acima da
 * própria pasta: registrar em `/` a partir de `/javastreak_homolog/sw.js` é
 * recusado com `SecurityError` e o worker NUNCA instala — silenciosamente,
 * sem nada no console do app. Foi o que manteve o offline em zero.
 *
 * O Pages não deixa mandar `Service-Worker-Allowed`, então a saída é o escopo
 * certo, não um escopo maior.
 */
const BASE = process.env.NUXT_APP_BASE_URL || '/'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-05',

  /**
   * ssr:false = SPA puro. Decisão do plano, seção 7: o app inteiro fica atrás
   * de login e é cheio de mapa, então renderizar no servidor não agregaria e
   * exigiria hospedagem paga — exatamente o que estamos evitando. O
   * `nuxi generate` cospe arquivos estáticos que o GitHub Pages serve de graça,
   * igual ao index.html de hoje.
   */
  ssr: false,

  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@vite-pwa/nuxt'],

  css: [
    /* O CSS do Leaflet precisa vir ANTES do nosso: o legado sobrescreve
       alguns estilos de controle, e a ordem inversa desfaz isso. */
    'leaflet/dist/leaflet.css',
    '~/assets/css/legado.css',
    /* Entra DEPOIS do legado: só redefine tokens e superfícies. */
    '~/assets/css/tema.css'
  ],

  app: {
    /**
     * ⚠️ Enquanto o app novo estiver em teste, ele NÃO usa javastreak.com — o
     * domínio continua apontando para o index.html em produção. O teste sai em
     * usuario.github.io/javastreak-nuxt/, e por isso o endereço base precisa
     * ser a subpasta. Quem define isso é a variável NUXT_APP_BASE_URL no
     * workflow; aqui fica só o padrão para rodar na máquina.
     * No dia do corte: variável apagada, baseURL volta a '/', CNAME criado.
     */
    baseURL: BASE,
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          /**
           * ⚠️ `maximum-scale=1, user-scalable=no` por causa do MAPA. Sem
           * isso, a pinça sobre o Leaflet no iOS zoomava a PÁGINA inteira em
           * vez do mapa — e o app ficava com tudo deslocado, parecendo layout
           * quebrado, sem jeito óbvio de voltar.
           *
           * O custo é real e conhecido: quem quiser aumentar o texto perde a
           * pinça. Em troca, o app usa fontes de 12,5 px para cima, respeita o
           * tamanho de fonte do sistema, e o mapa — que é a tela em que a
           * pinça importa — continua com o zoom dele.
           */
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        },
        { name: 'theme-color', content: '#16150F' }
      ],
      link: [
        /* Barlow Condensed carrega a personalidade dos títulos e botões.
           É a única fonte externa do projeto — preconnect para não custar
           uma ida e volta extra. */
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap'
        },
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icone-180.png' }
      ]
    }
  },

  /**
   * ⚠️ APONTA PARA A HOMOLOGAÇÃO, NÃO PARA A PRODUÇÃO.
   *
   * Projeto javastreak-homolog (pbtgvllxjnumjiololio): banco próprio, vazio,
   * com as mesmas 43 tabelas e os mesmos 109 ajustes da produção. Nada do que
   * for feito aqui toca no app que está no ar.
   *
   * A produção continua em olafxdwjwlubttnfvqhs — NÃO troque de volta sem
   * saber o que está fazendo: os testes passariam a escrever nos dados reais.
   *
   * A chave é `publishable`, feita para aparecer no navegador. Ela não
   * autentica ninguém: quem autentica é o token de sessão que o `useServer`
   * envia no corpo da requisição e o `validarSessao_` confere no servidor.
   *
   * Fica em runtimeConfig.public para que a troca pelo Laravel, na fase 2,
   * seja variável de ambiente e não edição de código.
   */
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL
        || 'https://pbtgvllxjnumjiololio.supabase.co/functions/v1/api',
      apiKey: process.env.NUXT_PUBLIC_API_KEY
        || 'sb_publishable_y2bMte4WKgzlNNLAi9WtHQ_oWoA-oad',
      /**
       * MARCA DO APP. Uma linha muda logo, cor de acento e nome em todas as
       * telas. `javastreak` é a marca de casa; `meateater` era a roupa da
       * demonstração e continua disponível para vestir de novo.
       * Ver app/composables/useMarca.ts.
       */
      marca: process.env.NUXT_PUBLIC_MARCA || 'javastreak',
      appVer: 'vJS.140826.1100',
      ambiente: 'homologacao'
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    /**
     * ⚠️ `base` e `scope` PRECISAM ser o endereço base. O padrão do módulo é
     * `/`, e em subpasta isso faz o registro do worker ser recusado — o app
     * fica sem offline nenhum e sem erro visível. Ver o comentário do BASE.
     */
    base: BASE,
    scope: BASE,
    manifest: {
      id: BASE,
      name: 'JavaStreak',
      short_name: 'JavaStreak',
      description: 'Manejo de javali',
      lang: 'pt-BR',
      /* Caminhos do manifesto são resolvidos contra a ORIGEM, não contra o
         manifesto. Com `/` fixo, instalar em homologação dava ícone quebrado
         e o atalho abria a raiz do github.io em vez do app. */
      start_url: BASE,
      scope: BASE,
      display: 'standalone',
      background_color: '#16150F',
      theme_color: '#16150F',
      icons: [
        { src: BASE + 'icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: BASE + 'icone-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: BASE + 'icone-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: BASE,
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      /**
       * ⚠️ `200.html` e `404.html` FORA do precache. O Workbox registra os
       * dois sem a extensão (`200`, `404`), e nenhum servidor entrega um
       * arquivo com esse nome — o Pages devolve a página de erro com status
       * 404. **Uma única entrada que não baixa aborta a instalação inteira do
       * worker**, e o app fica sem offline por causa de dois arquivos que
       * ninguém pede. Os dois continuam publicados: quem os usa é o Pages,
       * para devolver o app em rota funda, e isso é do servidor, não do
       * cache.
       */
      globIgnores: ['**/200.html', '**/404.html'],
      /**
       * As telhas do mapa são o que separa "o app abre offline" de "o app
       * serve no mato": sem elas o guiamento mostra rota e posição sobre um
       * quadrado vazio. Guardar o que já foi visto significa que percorrer a
       * área uma vez com sinal — ou só olhar o mapa em casa — deixa a região
       * disponível depois.
       *
       * ⚠️ `statuses: [0, 200]` não é excesso de zelo: telha vem por `<img>`
       * em requisição `no-cors`, e a resposta chega opaca, com status 0. Só
       * com 200 na lista, nada é guardado e o cache parece não funcionar.
       *
       * Teto de 3.000 telhas (~60 MB) e 30 dias. O navegador ainda pode
       * despejar tudo sob pressão de espaço — por isso o app nunca DEPENDE
       * disso, só aproveita.
       */
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'mapa-telhas-ruas',
            expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'mapa-telhas-sat',
            expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
      /* A API NÃO entra aqui de propósito: são POST, que o Workbox não
         cacheia, e a resposta depende do token. O cache de dados é do app,
         em IndexedDB, dentro do `useServer` — onde dá para saber o que é
         seguro reaproveitar. */
    },
    devOptions: { enabled: false }
  },

  typescript: { typeCheck: false, strict: true },

  /**
   * Com `ssr: false` o Nuxt gera uma casca HTML só, e ela precisa ser pedida
   * pelo endereço COM a subpasta — senão o prerender responde 404 e o build
   * sai sem index.html. Por isso a rota abaixo repete o baseURL.
   * No dia do corte (domínio próprio), isto vira `routes: ['/']`.
   */
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: [process.env.NUXT_APP_BASE_URL || '/'],
      /**
       * Com ssr:false o Nuxt acrescenta /200.html, /404.html e /index.html
       * sozinho, e essas três dão 404 quando existe subpasta — o roteador só
       * conhece o caminho com o baseURL. Tolerar o erro delas é o que deixa a
       * rota boa acima ser gerada. O passo seguinte do workflow confere que o
       * arquivo saiu; se não sair, o build quebra ali.
       */
      failOnError: false
    }
  }
})
