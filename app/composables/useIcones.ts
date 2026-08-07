/**
 * Mapa nome → símbolo do sprite. Porte do `ICO` legado (index.html, 8142).
 *
 * ⚠️ Chave inexistente virava o próprio texto na tela — foi assim que
 * "documentacao" apareceu escrito dentro de um card. Aqui cai num ícone
 * genérico e avisa no console, como o legado passou a fazer.
 */
export const ICO: Record<string, string> = {
  painel: 'a1', avisos: 'a2', artigos: 'a3', patrocinio: 'a4', suporte: 'a5',
  pagamentos: 'a6', planos: 'a7', ajustes: 'a8', ceva: 'b1', rotas: 'b2',
  areas: 'b3', transporte: 'b4', propriedade: 'b5', garagem: 'b6', marina: 'b7',
  canil: 'b8', armadilha: 'b9', mapa: 'b10', documentos: 'b11',
  telefone: 'c1', email: 'c2', whatsapp: 'c3', mensagem: 'c4',
  notificacao: 'c5', compartilhar: 'c6',
  inicio: 'd1', usuario: 'd2', arquivo: 'd3', pasta: 'd4', calendario: 'd5',
  relogio: 'd6', grafico: 'd7', global: 'd8', nuvem: 'd9', codigo: 'd10',
  camera: 'd11', play: 'd12', link: 'd13', bloqueio: 'd14', ver: 'd15', ia: 'd16',
  buscar: 'e1', filtrar: 'e2', adicionar: 'e3', editar: 'e4', excluir: 'e5',
  confirmar: 'e6', fechar: 'e7', avancar: 'e8', atualizar: 'e9', baixar: 'e10',
  enviar: 'e11', favorito: 'e12', estrela: 'e13', salvar: 'e14', menu: 'e15',
  voltar: 'e16',
  haras: 'h1', ferradura: 'h2', engrenagem: 'h3', carrinho: 'h4',

  /* Acrescentados na migração — ver o comentário no IconeSprite.vue. */
  alerta: 'n1', abate: 'n2', loja: 'n3', manejador: 'n4', amigos: 'n5',
  denuncia: 'n6', cortesia: 'n7', promocao: 'n8', saude: 'n9',
  ferramenta: 'n10', pino: 'n11', diagnostico: 'n12', trofeu: 'n13',
  desfazer: 'n14'
}

/** Chave antiga do menu → nome novo. Porte de NAV_SVG. */
export const NAV_SVG: Record<string, string> = {
  abate: 'painel', inicio: 'inicio', agenda: 'calendario', espera: 'ceva',
  espreita: 'transporte', caes: 'canil', armadilha: 'armadilha',
  documentacao: 'documentos', suporte: 'suporte', mapa: 'mapa', areas: 'areas',
  trofeus: 'estrela', ranking: 'grafico', avisos: 'avisos',
  carrinho: 'carrinho', admin: 'ajustes', network: 'global'
}

export function simboloDe(nome: string): string {
  const id = ICO[nome]
  if (id) return 'js-' + id
  console.warn('[icone] chave desconhecida:', nome)
  return 'js-' + ICO.painel
}
