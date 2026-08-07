// https://nuxt.com/docs/api/configuration/nuxt-config
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
    '~/assets/css/legado.css'
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
    baseURL: '/',
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover'
        },
        { name: 'theme-color', content: '#2e4d2e' }
      ],
      link: [
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
      appVer: 'vJS.070826.1015',
      ambiente: 'homologacao'
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'JavaStreak',
      short_name: 'JavaStreak',
      description: 'Manejo de javali',
      lang: 'pt-BR',
      start_url: '/',
      display: 'standalone',
      background_color: '#f4f1e8',
      theme_color: '#2e4d2e',
      icons: [
        { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icone-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      // O app é offline-tolerante, não offline-first: mapa e API precisam de
      // rede. Cacheamos só a casca.
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
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
