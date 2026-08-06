/**
 * Política única de senha, igual à do backend (`senhaForte_` / `SENHA_REGRA`).
 * Estar nos dois lados é de propósito: o servidor é quem manda, o cliente só
 * evita a viagem perdida.
 */
export const SENHA_REGRA =
  'A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.'

const TESTES: Array<[RegExp | null, string]> = [
  [null, '8 caracteres'],
  [/[A-ZÀ-Þ]/, 'maiúscula'],
  [/[a-zà-þ]/, 'minúscula'],
  [/[0-9]/, 'número'],
  [/[^A-Za-zÀ-þ0-9]/, 'caractere especial']
]

export function senhaForte(s: string): boolean {
  return faltasDaSenha(s).length === 0
}

/** O que ainda falta. Vazio = senha aceita. Alimenta o medidor ao vivo. */
export function faltasDaSenha(s: string): string[] {
  const v = String(s || '')
  const faltas: string[] = []
  for (const [re, rotulo] of TESTES) {
    if (re === null ? v.length < 8 : !re.test(v)) faltas.push(rotulo)
  }
  return faltas
}
