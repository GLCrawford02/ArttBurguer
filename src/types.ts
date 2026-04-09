export interface LoteDados {
  lote: string;
  validade: string;
  quantidade: number;
}

export interface Insumo {
  id: string;
  nome: string;
  precoPacote: number;
  qtdPacote: number; // Quantidade total no pacote (ex: 1000g, 12 unidades)
  estoqueRotativo: number;
  estoqueEstacionario: number;
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

export interface Funcionario {
  id: string;
  nome: string;
  pin: string;
  cargo?: string;
}

export interface TransferenciaLog {
  id: string;
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  funcionarioId: string;
  funcionarioNome: string;
  timestamp: number;
}

export interface DescarteLog {
  id: string;
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  lote: string;
  funcionarioId: string;
  funcionarioNome: string;
  timestamp: number;
}
