export interface DenominacaoCaixa {
  key: string;
  label: string;
  valor: number;
}

export const DENOMINACOES_CAIXA: DenominacaoCaixa[] = [
  { key: 'nota100', label: 'R$ 100,00', valor: 100 },
  { key: 'nota50', label: 'R$ 50,00', valor: 50 },
  { key: 'nota20', label: 'R$ 20,00', valor: 20 },
  { key: 'nota10', label: 'R$ 10,00', valor: 10 },
  { key: 'nota5', label: 'R$ 5,00', valor: 5 },
  { key: 'nota2', label: 'R$ 2,00', valor: 2 },
  { key: 'moeda1', label: 'Moeda R$ 1,00', valor: 1 },
  { key: 'moeda050', label: 'Moeda R$ 0,50', valor: 0.5 },
  { key: 'moeda025', label: 'Moeda R$ 0,25', valor: 0.25 },
  { key: 'moeda010', label: 'Moeda R$ 0,10', valor: 0.10 },
  { key: 'moeda005', label: 'Moeda R$ 0,05', valor: 0.05 },
];

export const calcularTotalContagem = (contagem: Record<string, number>) => {
  return DENOMINACOES_CAIXA.reduce((acc, d) => acc + (contagem[d.key] || 0) * d.valor, 0);
};

export interface CaixaSessao {
  status: 'aberto' | 'fechado';
  dataAbertura: number;
  aberturaPorNome: string;
  contagemAbertura: Record<string, number>;
  valorAbertura: number;
  dataFechamento?: number;
  fechamentoPorId?: string;
  fechamentoPorNome?: string;
  contagemFechamento?: Record<string, number>;
  valorFechamento?: number;
  vendasDinheiro?: number;
  valorEsperado?: number;
  diferenca?: number;
}

const formatMoeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const formatDataHora = (ts: number) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const buildRelatorioCaixaTexto = (sessao: CaixaSessao) => {
  const linhas: string[] = [];
  linhas.push('*RELATÓRIO DE CAIXA*');
  linhas.push('');
  linhas.push(`Abertura: ${formatDataHora(sessao.dataAbertura)} - ${sessao.aberturaPorNome}`);
  if (sessao.dataFechamento) {
    linhas.push(`Fechamento: ${formatDataHora(sessao.dataFechamento)} - ${sessao.fechamentoPorNome || ''}`);
  }

  linhas.push('');
  linhas.push('*Contagem de Abertura*');
  DENOMINACOES_CAIXA.forEach(d => {
    const qtd = sessao.contagemAbertura?.[d.key] || 0;
    if (qtd > 0) linhas.push(`${d.label} x ${qtd} = ${formatMoeda(qtd * d.valor)}`);
  });
  linhas.push(`Total Abertura: ${formatMoeda(sessao.valorAbertura)}`);

  if (sessao.contagemFechamento) {
    linhas.push('');
    linhas.push('*Contagem de Fechamento*');
    DENOMINACOES_CAIXA.forEach(d => {
      const qtd = sessao.contagemFechamento?.[d.key] || 0;
      if (qtd > 0) linhas.push(`${d.label} x ${qtd} = ${formatMoeda(qtd * d.valor)}`);
    });
    linhas.push(`Total Fechamento: ${formatMoeda(sessao.valorFechamento || 0)}`);

    linhas.push('');
    linhas.push(`Vendas em Dinheiro: ${formatMoeda(sessao.vendasDinheiro || 0)}`);
    linhas.push(`Valor Esperado: ${formatMoeda(sessao.valorEsperado || 0)}`);
    linhas.push(`Valor Contado: ${formatMoeda(sessao.valorFechamento || 0)}`);
    const diferenca = sessao.diferenca || 0;
    const label = diferenca >= 0 ? 'Sobra' : 'Falta';
    linhas.push(`Diferença: ${formatMoeda(Math.abs(diferenca))} (${label})`);
  }

  return linhas.join('\n');
};
