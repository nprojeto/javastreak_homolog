/**
 * Máscaras de digitação. Porte de aplicaMask/maskCPF/maskCNPJ/mTel e da lista
 * PAISES do legado (index.html, linhas 5564-5607).
 *
 * O `0` na máscara é o lugar de um dígito; qualquer outro caractere é literal.
 */
export interface Pais { c: string; nome: string; flag: string; mask: string }

export const PAISES: Pais[] = [
  { c: '55', nome: 'Brasil', flag: '🇧🇷', mask: '(00) 00000-0000' },
  { c: '351', nome: 'Portugal', flag: '🇵🇹', mask: '000 000 000' },
  { c: '1', nome: 'EUA/Canadá', flag: '🇺🇸', mask: '(000) 000-0000' },
  { c: '54', nome: 'Argentina', flag: '🇦🇷', mask: '(00) 0000-0000' },
  { c: '595', nome: 'Paraguai', flag: '🇵🇾', mask: '(000) 000-000' },
  { c: '598', nome: 'Uruguai', flag: '🇺🇾', mask: '(00) 000-000' },
  { c: '591', nome: 'Bolívia', flag: '🇧🇴', mask: '000-00000' },
  { c: '0', nome: 'Outro país', flag: '🌐', mask: '' }
]

export function soDig(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

export function aplicaMask(v: string, mask: string): string {
  if (!mask) return soDig(v)
  const d = soDig(v)
  let out = ''
  let i = 0
  for (let k = 0; k < mask.length && i < d.length; k++) {
    out += mask[k] === '0' ? d[i++] : mask[k]
  }
  return out
}

export const maskCPF = (v: string) => aplicaMask(v, '000.000.000-00')
export const maskCNPJ = (v: string) => aplicaMask(v, '00.000.000/0000-00')

/** Só conta dígito: o campo chega formatado e o código do país vem à parte. */
export function whatsValido(numero: string): boolean {
  return soDig(numero).length >= 8
}

/** Formato que o backend recebe: `+55 (12) 98800-7953`. */
export function telCompleto(codigoPais: string, numero: string): string {
  if (!soDig(numero)) return ''
  return (codigoPais && codigoPais !== '0' ? '+' + codigoPais + ' ' : '') + numero
}

/* ---- Datas ---- */
export function dataBR(iso: string | undefined | null): string {
  const s = String(iso || '').slice(0, 10)
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return p ? `${p[3]}/${p[2]}/${p[1]}` : ''
}

export function dataIso(br: string): string {
  const d = soDig(br)
  if (d.length !== 8) return ''
  const dia = d.slice(0, 2), mes = d.slice(2, 4), ano = d.slice(4)
  return `${ano}-${mes}-${dia}`
}

/**
 * 18 anos completos. Mesma conta do `maior18` legado e do `maiorDeIdade_` do
 * servidor — o meio-dia evita o pulo de data por fuso.
 */
export function maior18(nascIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(nascIso || ''))) return false
  const d = new Date(String(nascIso).slice(0, 10) + 'T12:00:00')
  if (isNaN(d.getTime())) return false
  const h = new Date()
  let a = h.getFullYear() - d.getFullYear()
  const m = h.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--
  return a >= 18 && a <= 120
}
