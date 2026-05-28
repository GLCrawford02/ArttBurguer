import { X, CheckCircle, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface Props {
  expandedOrder: any | null;
  onClose: () => void;
  activeKds: string;
  currentTime: number;
  toggleItemConcluido: (pedidoId: string, itemIdx: number, concluido: boolean) => void;
  onAceitarComanda: (pedidoId: string) => void;
  onPronto: (pedido: any) => void;
}

export default function ExpandedOrderModal({
  expandedOrder, onClose, activeKds, currentTime,
  toggleItemConcluido, onAceitarComanda, onPronto
}: Props) {
  if (!expandedOrder) return null;

  const handleDespachar = () => {
    const allDone = expandedOrder.itensKds.every((ik: any) => ik.concluidoNoKds);
    onPronto(expandedOrder);
    if (activeKds === 'Expedição' || allDone) onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 bg-gray-100 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-4xl font-black text-gray-900 uppercase tracking-tight">{expandedOrder.identificador}</h2>
              <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full uppercase bg-blue-100 text-blue-800 border border-blue-200">{expandedOrder.origem || 'PDV'}</span>
            </div>
            <p className="text-base font-bold text-gray-600 mt-2">Tela Ativa: {activeKds} • {Math.floor((currentTime - expandedOrder.timestamp) / 60000)} min atrás</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white shadow-sm hover:bg-gray-50 text-gray-600 rounded-full transition-colors border border-gray-200">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white space-y-6">
          {expandedOrder.itensKds.map((item: any, idx: number) => (
            <div key={idx} className={`border-b border-gray-100 pb-6 last:border-0 last:pb-0 transition-colors ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
              <div className="flex items-start cursor-pointer group hover:bg-gray-50 p-2 rounded-lg" onClick={() => toggleItemConcluido(expandedOrder.id, item.originalIdx, !!item.concluidoNoKds)}>
                <button className={`mr-4 mt-1 flex-shrink-0 transition-colors ${item.concluidoNoKds ? 'text-green-500' : 'text-gray-300 group-hover:text-blue-400'}`}>
                  {item.concluidoNoKds ? <CheckSquare size={36} /> : <Square size={36} />}
                </button>
                <span className={`font-black text-3xl sm:text-4xl w-16 shrink-0 ${item.concluidoNoKds ? 'text-gray-500' : 'text-gray-900'}`}>{item.qtd}x</span>
                <span className={`font-bold text-2xl sm:text-3xl pt-1 leading-tight ${item.concluidoNoKds ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.nome}</span>
              </div>
              {item.opcoes && (
                <div className={`text-lg sm:text-xl mt-4 pl-20 space-y-3 ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
                  {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && (
                    <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Tipo de Montagem:</span><ul className="list-disc pl-6 text-gray-800 font-bold">{Object.values(item.opcoes.montagem).map((m: any, i: number) => <li key={i}>{m}</li>)}</ul></div>
                  )}
                  {item.opcoes.pontoCarne && (
                    <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Ponto da carne:</span><ul className="list-disc pl-6 text-gray-800 font-bold"><li>{item.opcoes.pontoCarne}</li></ul></div>
                  )}
                  {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).length > 0 && (
                    <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Adicionais:</span><ul className="list-disc pl-6 text-blue-700 font-black">{Object.values(item.opcoes.adicionais).map((a: any, i: number) => <li key={i}>{a.qtd}x AD/ {a.nome}</li>)}</ul></div>
                  )}
                  {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && (
                    <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Restrições (Sem):</span><ul className="list-none pl-0 text-red-600 font-black">{Object.values(item.opcoes.restricoes).map((r: any, i: number) => <li key={i}>- {r}</li>)}</ul></div>
                  )}
                  {item.opcoes.observacao && (
                    <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Observação Especial:</span><p className="text-gray-900 font-bold italic bg-yellow-50 border border-yellow-300 p-4 rounded-xl">{item.opcoes.observacao}</p></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-100 shrink-0">
          {!expandedOrder.kdsAceito?.[activeKds] ? (
            <button onClick={() => onAceitarComanda(expandedOrder.id)} className="w-full py-4 sm:py-5 font-black text-xl sm:text-2xl rounded-xl flex items-center justify-center transition-colors shadow-md bg-yellow-500 hover:bg-yellow-600 text-white">
              <AlertTriangle size={28} className="mr-3"/> Aceitar Comanda
            </button>
          ) : (
            <button onClick={handleDespachar} className={`w-full py-4 sm:py-5 font-black text-xl sm:text-2xl rounded-xl flex items-center justify-center transition-colors shadow-md ${activeKds === 'Expedição' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
              <CheckCircle size={28} className="mr-3"/> {activeKds === 'Expedição' ? 'Despachar Pedido' : 'Despachar Peça'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
