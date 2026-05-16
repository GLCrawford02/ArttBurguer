export interface LoteDados {
  lote: string;
  validade: string;
  quantidade: number;
  custoPorVolume?: number;
  valorTotalLote?: number;
}

export interface Insumo {
  id: string;
  nome: string;
  precoPacote: number;
  qtdPacote: number;
  estoqueRotativo: number;
  estoqueEstacionario: number;
  alertaMinimo: number;
  estoqueMaximo?: number;
  diasAvisoValidade?: number;
  unidade: string;
  fornecedor?: string;
  lotes?: Record<string, LoteDados>;
  lote?: string;
  validade?: string;
  tipoUso?: string;
  sku?: string;
  insumoVinculado?: string;
  isVariavel?: boolean;
  ultimoPrecoCompra?: number;
  validadeIndefinida?: boolean;
  restrito?: boolean;
}

export interface IngredienteReceita {
  insumoId: string;
  quantidade: number;
}

export interface Produto {
  id: string;
  nome: string;
  categoria?: string;
  ingredientes: IngredienteReceita[];
  custoTotal: number;
}

export interface ItemCombo {
  produtoId: string;
  quantidade: number;
}

export interface Promocao {
  id: string;
  nome: string;
  itens: ItemCombo[];
  ingredientes: IngredienteReceita[];
  custoTotal: number;
  precoVenda: number;
  dataInicio?: string;
  dataFim?: string;
  horarioInicio?: string;
  horarioFim?: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  pin: string;
  cargo?: string | string[];
}

export interface ConsumoLog {
  id: string;
  pedidoId: string;
  identificadorPedido: string;
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  unidade: string;
  tipo: 'ingrediente' | 'adicional';
  timestamp: number;
  funcionarioId?: string;
  funcionarioNome?: string;
}

export interface TransferenciaLog {
  id: string;
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  direcao: string;
  funcionarioId: string;
  funcionarioNome: string;
  timestamp: number;
}

export interface DescarteLog {
  id: string;
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  unidade: string;
  lote?: string;
  motivo: string;
  tipoEstoque: 'rotativo' | 'estacionario';
  valorTotal: number;
  funcionarioId: string;
  funcionarioNome: string;
  autorizadoPorId: string;
  autorizadoPorNome: string;
  timestamp: number;
}
