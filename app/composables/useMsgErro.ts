/**
 * Traduz o código que o servidor devolve para uma frase que a pessoa entende.
 * Porte do `msgErro()` legado (index.html, linha 1315).
 *
 * Fica num lugar só de propósito: o backend responde `PROP_IRREGULAR|Sítio X`
 * em vários pontos, e a explicação não pode variar conforme a tela.
 *
 * A maior parte destes códigos é de telas que só chegam nos lotes 3 a 5. Estão
 * aqui desde já para não haver duas versões da mesma mensagem depois.
 */
const SIMPLES: Record<string, string> = {
  PERFIL_INCOMPLETO:
    'Seu perfil de manejador ainda não foi criado. Preencha nome e localização para liberar este botão.',
  PROPRIEDADE_OBRIGATORIA: 'Escolha a propriedade onde fica esta ceva',
  PROP_SEM_DESENHO: 'Desenhe o limite da propriedade antes de salvar',
  CTF_TELA_PROPRIA: 'O CTF é cadastrado em CAÇAR, na tela própria dele.',
  CTF_VENCIDO:
    'Seu CTF está vencido ou não foi cadastrado. Sem ele não dá para caçar, registrar abate ou entrar na caçada de alguém.',
  CTF_SEM_NUMERO: 'Informe o número do registro',
  CTF_SEM_EMISSAO: 'Informe a data de emissão',
  CTF_SEM_VALIDADE: 'Informe a validade',
  CTF_SEM_ANEXO: 'O anexo é obrigatório: é ele que comprova o registro.',
  PROP_IMUTAVEL:
    'A propriedade não muda depois que a caçada começa — pode haver abate registrado nela.',
  PROP_SEM_PRAZO: 'Faltam as autorizações desta propriedade.',
  ROTA_SEM_PONTOS: 'Marque ao menos 2 pontos no traçado',
  EMAIL_NAO_CONFIRMADO: 'Confirme seu e-mail para entrar',
  NAO_AUTENTICADO: 'Sessão expirada, entre novamente',
  VAGAS_ESGOTADAS: 'Cadastro temporariamente fechado',
  INDICADOR_INVALIDO: 'Chave inválida — confira com quem indicou'
}

/** Códigos no formato `CODIGO|complemento`. */
const COM_NOME: Record<string, (nome: string) => string> = {
  PROP_SEM_LIMITE: () =>
    'Esta propriedade não tem limite desenhado e não pode receber ceva.',
  PROP_IRREGULAR: () =>
    'Esta propriedade está irregular (autorização vencida ou faltando) e não pode receber ceva.',
  FORA_DA_PROPRIEDADE: (n) => 'Este ponto está fora do limite desenhado de ' + n,
  AUT_SEM_VALIDADE: (n) => 'Informe a validade da ' + n,
  AUT_SEM_ANEXO: (n) => 'Anexe o arquivo da ' + n,
  ACERVO_SEM_NUMERO: () => 'Informe o número do documento',
  ACERVO_SEM_VALIDADE: () => 'Informe a validade do documento',
  ACERVO_SEM_ANEXO: () => 'O anexo é obrigatório: é ele que comprova o documento.',
  AMIGO_SEM_CTF: (n) =>
    'Este amigo está com o CTF vencido ou não cadastrado e não pode entrar na caçada: ' + n + '.',
  LIVRE_EXCLUSIVO: () => 'Caçada livre não combina com ceva ou rota já cadastrada.',
  ITEM_DE_OUTRA_PROP: (n) => 'Este item é de outra propriedade: ' + n,
  PROP_VENCIDA: (n) => 'A autorização desta propriedade venceu em ' + dataCurta(n),
  ROTA_FORA: (n) => {
    const p = n.split('|')
    return 'A rota tem ' + (p[1] || '') + ' ponto(s) fora do limite de ' + (p[0] || '')
  }
}

function dataCurta(iso: string) {
  const s = String(iso || '').slice(0, 10)
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return p ? `${p[3]}/${p[2]}/${p[1]}` : s
}

export function msgErro(e: unknown): string {
  const m = (e instanceof Error ? e.message : String(e || '')) || 'Erro'
  if (SIMPLES[m]) return SIMPLES[m]
  const barra = m.indexOf('|')
  if (barra > 0) {
    const cod = m.slice(0, barra)
    const nome = m.slice(barra + 1)
    if (COM_NOME[cod]) return COM_NOME[cod](nome)
    if (SIMPLES[cod]) return SIMPLES[cod]
  }
  if (COM_NOME[m]) return COM_NOME[m]('')
  return m
}
