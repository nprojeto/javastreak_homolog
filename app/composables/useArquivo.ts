/**
 * Leitura de arquivo para envio. O backend recebe uma data URL e sobe para o
 * bucket. Porte de bindArquivo/arquivoData.
 *
 * Os limites são os MESMOS do servidor (`TIPOS_DOC` e `DOC_MAX_BYTES` no
 * api-index.ts). Repetir aqui não substitui a checagem de lá — só evita
 * mandar 12 MB para receber recusa.
 */
export const TIPOS_DOC = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
]
export const DOC_MAX_MB = 12
export const FOTO_MAX_MB = 8

export interface ArquivoLido { dados: string; nome: string; tamanho: number }

export function lerArquivo(
  f: File,
  opcoes: { tipos?: string[]; maxMb?: number } = {}
): Promise<ArquivoLido> {
  const tipos = opcoes.tipos || TIPOS_DOC
  const maxMb = opcoes.maxMb || DOC_MAX_MB
  return new Promise((ok, erro) => {
    if (tipos.length && !tipos.includes(f.type)) {
      erro(new Error('Envie um PDF ou uma imagem (JPG, PNG, WEBP)'))
      return
    }
    if (f.size > maxMb * 1024 * 1024) {
      erro(new Error('Arquivo muito grande (máximo ' + maxMb + ' MB)'))
      return
    }
    const r = new FileReader()
    r.onload = () => ok({ dados: String(r.result || ''), nome: f.name || '', tamanho: f.size })
    r.onerror = () => erro(new Error('Não consegui ler o arquivo'))
    r.readAsDataURL(f)
  })
}

/** Situação da validade, para o selo colorido. Porte de statusVenc. */
export function statusVencimento(v?: string) {
  const s = String(v || '').slice(0, 10)
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  if (isNaN(d.getTime())) return null
  const dias = Math.ceil((d.getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000)
  if (dias < 0) return { classe: 'venc', texto: 'vencido há ' + Math.abs(dias) + 'd', dias }
  if (dias <= 30) return { classe: 'perto', texto: 'vence em ' + dias + 'd', dias }
  return { classe: 'ok', texto: 'válido', dias }
}
