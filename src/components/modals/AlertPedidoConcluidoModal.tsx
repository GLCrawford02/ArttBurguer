import { X, Bell, CheckCircle } from 'lucide-react';

interface Props {
  pedido: any | null;
  onClose: () => void;
  onConfirmarX9: (pedido: any) => void;
}

export default function AlertPedidoConcluidoModal({ pedido, onClose, onConfirmarX9 }: Props) {
  if (!pedido) return null;

  const temBebidas = (pedido.itens || []).some((item: any) => {
    const b = item.opcoes?.bebidas;
    if (!b) return false;
    const arr = Array.isArray(b) ? b : Object.values(b);
    return arr.length > 0;
  });

  const todasBebidas = (pedido.itens || []).flatMap((item: any) => {
    const b = item.opcoes?.bebidas;
    if (!b) return [];
    return Array.isArray(b) ? b : Object.values(b);
  });

  return (
    <div className="fixed top-4 right-4 z-[210] bg-green-600 text-white rounded-2xl shadow-2xl p-5 max-w-sm w-full animate-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-black text-lg flex items-center gap-2">
          <Bell size={20}/>
          {pedido.tipo === 'Mesa' ? 'Levar para a Mesa!' : 'Pedido Finalizado!'}
        </h3>
        {pedido.tipo !== 'Mesa' && (
          <button onClick={onClose} className="text-white/80 hover:text-white ml-2 shrink-0"><X size={20}/></button>
        )}
      </div>
      <p className="font-bold text-sm mb-2 text-green-100">{pedido.identificador}</p>
      <div className="text-sm text-green-100 space-y-0.5 max-h-32 overflow-y-auto">
        {(pedido.itens || []).map((item: any, i: number) => (
          <p key={i}><span className="font-bold">{item.qtd}x</span> {item.nome}</p>
        ))}
      </div>
      {temBebidas && (
        <div className="mt-3 pt-3 border-t border-green-500">
          <p className="text-xs font-bold text-green-200 mb-1">Bebidas Solicitadas:</p>
          {todasBebidas.map((b: any, i: number) => (
            <p key={i} className="text-sm text-green-100">{b.qtd}x {b.nome}</p>
          ))}
        </div>
      )}
      {pedido.tipo === 'Mesa' && (
        <button
          onClick={() => onConfirmarX9(pedido)}
          className="w-full mt-4 py-3 bg-white text-green-700 rounded-xl font-black hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle size={18}/> OK, Vou Levar!
        </button>
      )}
    </div>
  );
}
