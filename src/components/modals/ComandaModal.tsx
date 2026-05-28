import { X, Receipt, User, Printer } from 'lucide-react';

interface Props {
  venda: any | null;
  onClose: () => void;
  onImprimir: () => void;
}

export default function ComandaModal({ venda, onClose, onImprimir }: Props) {
  if (!venda) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-gray-800 flex items-center"><Receipt size={20} className="mr-2 text-gray-600"/> Comanda Virtual</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto max-h-[70vh]">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">ARTT BURGER</h2>
            <p className="text-sm text-gray-500 mt-1">Venda: {new Date(venda.timestamp).toLocaleString('pt-BR')}</p>
            <p className="text-sm font-bold text-gray-600 mt-1">{venda.descricao || 'Venda Balcão'} {venda.tipoPedido ? `(${venda.tipoPedido})` : ''}</p>
            {venda.clienteNome && <p className="text-sm text-gray-600">Cliente: {venda.clienteNome}</p>}
          </div>

          <div className="border-t border-b border-gray-200 py-4 mb-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itens do Pedido</h4>
            {venda.itens && venda.itens.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-gray-800">{item.qtd}x {item.nome}</p>
                  {item.opcoes && (
                    <div className="text-xs text-gray-500 pl-4 mt-1">
                      {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && <p><span className="font-semibold text-gray-600">Montagem:</span> {Object.values(item.opcoes.montagem).join(', ')}</p>}
                      {item.opcoes.pontoCarne && <p><span className="font-semibold text-gray-600">Ponto:</span> {item.opcoes.pontoCarne}</p>}
                      {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).map((a: any, i: number) => <p key={i}>+ {a.qtd}x AD/ {a.nome}</p>)}
                      {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && <p className="text-red-500 font-semibold">- Sem: {Object.values(item.opcoes.restricoes).join(', ')}</p>}
                      {item.opcoes.observacao && <p><span className="font-semibold text-gray-600">Obs:</span> {item.opcoes.observacao}</p>}
                    </div>
                  )}
                  {item.adicionadoPor && (
                    <p className="text-[9px] text-gray-400 mt-1 pl-4 flex items-center font-medium">
                      <User size={10} className="mr-1"/> Add por {item.adicionadoPor} às {new Date(item.adicionadoEm || Date.now()).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                    </p>
                  )}
                </div>
                <span className="font-bold text-gray-800 shrink-0">R$ {(item.preco * item.qtd).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {venda.desconto > 0 && (
            <div className="border-t border-gray-200 py-3 mb-2 flex justify-between items-center text-red-600 bg-red-50 px-3 rounded-lg">
              <span className="text-sm font-bold flex flex-col">
                Desconto Aplicado {venda.cupom ? `(${venda.cupom})` : ''}
                <span className="text-[10px] font-medium mt-0.5">Autorizado por: {venda.descontoAutorizadoPor || 'Desconhecido'}</span>
              </span>
              <span className="font-black text-lg">- R$ {venda.desconto.toFixed(2)}</span>
            </div>
          )}

          <div className="space-y-2 mb-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pagamento</h4>
            {venda.pagamentos ? venda.pagamentos.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600">{p.nomeTaxa}</span>
                <span className="font-bold text-gray-800">R$ {p.valor.toFixed(2)}</span>
              </div>
            )) : (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{venda.nomeTaxa}</span>
                <span className="font-bold text-gray-800">R$ {venda.valor.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
            <span className="font-bold text-gray-800 uppercase">Total</span>
            <span className="font-black text-2xl text-green-600">R$ {venda.valor.toFixed(2)}</span>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onImprimir}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-900 transition-colors"
          >
            <Printer size={16} /> Imprimir / Salvar PDF
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
