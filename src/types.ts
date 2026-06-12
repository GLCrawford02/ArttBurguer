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
  transferivel?: boolean;
  ultimoPrecoCompra?: number;
  validadeIndefinida?: boolean;
  restrito?: boolean;
  codigoBarras?: string;
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
  oculto?: boolean;
  // Dados fiscais para emissão de NFC-e
  ncm?: string;
  cfop?: string;
  csosn?: string;
  unidadeComercial?: string;
  origem?: string;
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
  faceDescriptor?: number[];
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

export interface Tarefa {
  id: string;
  codigo?: string;
  titulo: string;
  descricao: string;
  url?: string;
  responsavelId?: string;
  responsaveisIds?: string[];
  dataAgendada: string;
  horaAgendada: string;
  urgente?: boolean;
  status: 'pendente' | 'concluida';
  timestamp: number;
  dataConclusao?: number;
  notificadoWhatsApp?: boolean;
  notificadoAtraso24h?: boolean;
  notificadoAntecipado?: boolean;
  prioridade?: 'Nenhuma' | 'Baixa' | 'Média' | 'Alta';
  sinalizado?: boolean;
  categoria?: string;
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Anual' | 'Personalizado';
  recorrenciaCustomValor?: number;
  recorrenciaCustomUnidade?: 'dia' | 'semana' | 'mes' | 'ano';
  terminarRepeticao?: 'nunca' | 'em_data';
  dataFimRepeticao?: string;
  lembreteAntecipado?: number; // minutos
  criadoPor?: string | null;
  contaVinculadaId?: string;
  contaVinculadaTipo?: 'pagar' | 'receber';
  novaContaVinculadaId?: string; // Usado internamente na recorrência
}
