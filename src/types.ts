export interface LoteDados {
  lote: string;
  validade: string;
  quantidade: number;
}

export interface Item {
  id: string;
  nome: string;
  precoPacote: number;
  qtdPacote: number; // Quantidade total no pacote (ex: 1000g, 12 unidades)
  estoqueAtual: number;
  alertaMinimo: number;
  estoqueMaximo?: number;
  diasAvisoValidade?: number;
  unidade: string; // g, kg, un, ml
  fornecedor?: string;
  lotes?: Record<string, LoteDados>;
  lote?: string; // legado
  validade?: string; // legado
}

export interface IngredienteReceita {
  insumoId: string;
  quantidade: number;
}

export interface Produto {
  id: string;
  nome: string;
  ingredientes: IngredienteReceita[];
  custoTotal: number;
}
