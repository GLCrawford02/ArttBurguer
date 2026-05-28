import { Calculator, X, Search, Minus, Plus, Trash2 } from 'lucide-react';

interface Pagamento {
  taxaId: string;
  valor: number | '';
}

interface Taxa {
  id: string;
  nome: string;
  percentual: number;
}

interface CartItem {
  nome: string;
  preco: number;
  qtd: number;
}

interface Props {
  show: boolean;
  editConfId: string | null;
  onClose: () => void;

  confSearchProd: string;
  setConfSearchProd: (v: string) => void;
  confFilteredItems: any[];
  onUpdateCart: (itemId: string, nome: string, preco: number, delta: number) => void;

  confCarrinho: Record<string, CartItem>;
  totalConf: number;
  restanteConf: number;

  confPagamentos: Pagamento[];
  setConfPagamentos: (v: Pagamento[]) => void;
  taxasComPadroes: Taxa[];
  onPagamentoChange: (index: number, field: string, value: any) => void;

  confDescricao: string;
  setConfDescricao: (v: string) => void;

  onSalvar: () => void;
}

export default function SimuladorRecebimentoModal({
  show, editConfId, onClose,
  confSearchProd, setConfSearchProd, confFilteredItems, onUpdateCart,
  confCarrinho, totalConf, restanteConf,
  confPagamentos, setConfPagamentos, taxasComPadroes, onPagamentoChange,
  confDescricao, setConfDescricao,
  onSalvar
}: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[95vw] xl:max-w-7xl max-h-[95vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-gray-800 flex items-center"><Calculator size={20} className="mr-2 text-gray-600"/> Simulador de Recebimento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
          <div className="flex-1 flex flex-col md:border-r border-gray-100 md:pr-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Buscar produto para simular venda..." value={confSearchProd} onChange={(e) => setConfSearchProd(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 focus:bg-white transition-colors" />
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {confFilteredItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-green-200 hover:bg-green-50 transition-colors group">
                  <div>
                    <p className="font-bold text-gray-800">{item.nome}</p>
                    <p className="text-sm font-bold text-green-600">R$ {(item.precoVenda || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button onClick={() => onUpdateCart(item.id, item.nome, item.precoVenda || 0, -1)} className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"><Minus size={16}/></button>
                    <span className="font-bold w-6 text-center text-gray-800">{confCarrinho[item.id]?.qtd || 0}</span>
                    <button onClick={() => onUpdateCart(item.id, item.nome, item.precoVenda || 0, 1)} className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"><Plus size={16}/></button>
                  </div>
                </div>
              ))}
              {confFilteredItems.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum produto encontrado.</p>}
            </div>
          </div>

          <div className="w-full md:w-80 flex flex-col pt-4 md:pt-0">
            <h4 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Resumo Simulado</h4>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {Object.entries(confCarrinho).map(([id, item]) => (
                <div key={id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600"><span className="font-bold text-gray-800">{item.qtd}x</span> {item.nome}</span>
                  <span className="font-bold text-gray-800">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(confCarrinho).length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Nenhum produto adicionado</p>}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2">
                <span className="font-bold text-gray-800 uppercase text-sm">Valor Total</span>
                <span className="font-black text-xl text-gray-800">R$ {totalConf.toFixed(2)}</span>
              </div>

              <div className="space-y-3 mb-2">
                <p className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Pagamento</p>
                {confPagamentos.map((p, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <select value={p.taxaId} onChange={e => onPagamentoChange(index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 text-sm">
                      <option value="">Selecione...</option>
                      {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome} {t.percentual > 0 ? `(${t.percentual}%)` : ''}</option>)}
                    </select>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                      <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); onPagamentoChange(index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 text-sm text-right" placeholder="0,00" />
                    </div>
                    {confPagamentos.length > 1 && <button onClick={() => setConfPagamentos(confPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                  </div>
                ))}

                {restanteConf > 0.05 && (
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-red-500 font-bold">Falta: R$ {restanteConf.toFixed(2)}</span>
                    <button onClick={() => setConfPagamentos([...confPagamentos, { taxaId: '', valor: restanteConf > 0 ? Number(restanteConf.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={14} className="mr-1" /> Dividir Pagamento</button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Identificador da Venda (Título da Nota)</label>
                <input type="text" placeholder="Ex: Mesa 1 - 19:00" value={confDescricao} onChange={e => setConfDescricao(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 font-bold text-gray-800" />
              </div>

              <button onClick={onSalvar} disabled={totalConf <= 0 || confPagamentos.some(p => !p.taxaId) || Math.abs(restanteConf) > 0.05} className="w-full bg-gray-800 text-white p-3 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-50">{editConfId ? 'Atualizar Conferência' : 'Registrar Conferência'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
