/**
 * ── BÚSSOLA DO APARELHO ───────────────────────────────────────────────────
 *
 * Devolve para onde o celular está apontado, em graus de 0 a 360 contados do
 * norte no sentido horário — a mesma convenção do `rumo()` em `useMapa`, para
 * uma poder ser subtraída da outra.
 *
 * É a parte mais cheia de diferença de plataforma do app inteiro. As quatro
 * que importam:
 *
 * ⚠️ 1. iOS EXIGE PERMISSÃO, E POR TOQUE. `DeviceOrientationEvent
 *    .requestPermission()` só funciona dentro de um gesto do usuário. Chamar
 *    na abertura da tela é recusado em silêncio — o evento simplesmente nunca
 *    dispara, sem erro nenhum. Por isso `precisaPermissao` existe: a tela
 *    mostra um botão.
 *
 * ⚠️ 2. `alpha` NÃO É NORTE em todo lugar. No iOS, quem dá o norte é
 *    `webkitCompassHeading`, que já vem em graus horários. No Android, é o
 *    evento `deviceorientationabsolute`, e aí o rumo é `360 - alpha`, porque
 *    o alpha conta ao contrário. Usar `deviceorientation` puro no Android dá
 *    um ângulo relativo a onde o aparelho estava quando a página abriu — o
 *    que parece funcionar na mesa e aponta para o lugar errado no mato.
 *
 * ⚠️ 3. A TELA GIRA. Deitar o celular soma 90° ao que o sensor informa; sem
 *    descontar `screen.orientation.angle`, a seta erra um quarto de volta
 *    justamente quando a pessoa vira o aparelho para ver melhor o mapa.
 *
 * ⚠️ 4. SEM SENSOR, SOBRA O GPS. `coords.heading` é a direção do movimento,
 *    não para onde o aparelho aponta — só vale andando, e some ao parar.
 *    Serve de reserva, e a tela precisa saber a diferença: por isso `fonte`.
 */

export type FonteBussola = 'sensor' | 'gps' | null

interface OrientacaoIOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

type ClasseComPermissao = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

export function useBussola() {
  /** Rumo do aparelho, 0–360. `null` enquanto não se sabe. */
  const graus = ref<number | null>(null)
  const fonte = ref<FonteBussola>(null)
  const precisaPermissao = ref(false)
  const erro = ref('')

  let ouvindo = false
  let evento = ''

  function anguloDaTela(): number {
    try {
      const o = screen.orientation
      if (o && typeof o.angle === 'number') return o.angle
    } catch { /* navegador sem screen.orientation */ }
    return 0
  }

  function aoOrientar(ev: DeviceOrientationEvent) {
    const e = ev as OrientacaoIOS
    let h: number | null = null

    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      /* iOS: já é o rumo da bússola, horário a partir do norte. */
      h = e.webkitCompassHeading
    } else if (typeof e.alpha === 'number' && (e.absolute || evento === 'deviceorientationabsolute')) {
      /* Android: alpha conta ao contrário. */
      h = 360 - e.alpha
    }
    if (h === null) return

    graus.value = ((h + anguloDaTela()) % 360 + 360) % 360
    fonte.value = 'sensor'
  }

  /**
   * Reserva pelo GPS. A tela repassa o `heading` de cada posição; ele só vem
   * preenchido em movimento, então nunca sobrescreve o sensor.
   */
  function daPosicao(heading: number | null | undefined) {
    if (fonte.value === 'sensor') return
    if (heading === null || heading === undefined || isNaN(heading)) return
    graus.value = ((heading % 360) + 360) % 360
    fonte.value = 'gps'
  }

  function ligarOuvinte() {
    if (ouvindo) return
    /* `deviceorientationabsolute` primeiro: é ele que dá o norte no Android. */
    evento = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation'
    window.addEventListener(evento, aoOrientar as EventListener, true)
    ouvindo = true
  }

  /** Chamada por um TOQUE, sempre. Ver a armadilha 1. */
  async function pedirPermissao() {
    erro.value = ''
    const C = (window as unknown as { DeviceOrientationEvent?: ClasseComPermissao }).DeviceOrientationEvent
    if (C && typeof C.requestPermission === 'function') {
      try {
        const r = await C.requestPermission()
        if (r !== 'granted') {
          erro.value = 'Permissão de bússola negada. A seta vai usar o GPS enquanto você caminha.'
          precisaPermissao.value = false
          return false
        }
      } catch {
        erro.value = 'Não foi possível ativar a bússola.'
        return false
      }
    }
    precisaPermissao.value = false
    ligarOuvinte()
    return true
  }

  function iniciar() {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      erro.value = 'Este aparelho não tem bússola. A seta vai usar o GPS enquanto você caminha.'
      return
    }
    const C = (window as unknown as { DeviceOrientationEvent?: ClasseComPermissao }).DeviceOrientationEvent
    if (C && typeof C.requestPermission === 'function') {
      /* iOS: espera o toque. Pedir aqui seria recusado sem avisar. */
      precisaPermissao.value = true
      return
    }
    ligarOuvinte()
  }

  function parar() {
    if (!ouvindo) return
    window.removeEventListener(evento, aoOrientar as EventListener, true)
    ouvindo = false
  }

  onBeforeUnmount(parar)

  return { graus, fonte, precisaPermissao, erro, iniciar, parar, pedirPermissao, daPosicao }
}
