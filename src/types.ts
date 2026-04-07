export interface Insumo {
  id: string;
  nome: string;
  precoPacote: number;
  qtdPacote: number; // Quantidade total no pacote (ex: 1000g, 12 unidades)
  estoqueAtual: number;
  alertaMinimo: number;
  unidade: string; // g, kg, un, ml
}

export interface IngredienteReceita {
  insumoId: string;
  quantidade: number;
}

export interface ProdutoFinal {
  id: string;
  nome: string;
  ingredientes: IngredienteReceita[];
  custoTotal: number;
}
