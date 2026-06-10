import { Receipt, Gift } from 'lucide-react';

interface Props {
  vendasHoje: any[];
  onVerComanda: (v: any) => void;
}

export default function ComandasView({ vendasHoje, onVerComanda }: Props) {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto flex flex-col h-fit max-h-[700px]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h4 className="font-bold text-gray-800 flex items-center"><Receipt className="mr-2 text-blue-500" size={18}/> Comandas (Dia Comercial Atual)</h4>
        </div>
        <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
          {vendasHoje.sort((a: any, b: any) => b.timestamp - a.timestamp).map((v: any, index: number) => (
            <div key={v.id} className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${v.recompensasResgatadas?.length ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-blue-50'}`} onClick={() => onVerComanda(v)}>
              <div>
                <p className="font-bold text-gray-800 flex items-center">
                  <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono mr-2">#{v.numeroDiario || (vendasHoje.length - index)}</span>
                  {v.descricao || 'Venda Balcão'} {v.tipoPedido ? `(${v.tipoPedido})` : ''}
                  {v.recompensasResgatadas?.length > 0 && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"><Gift size={10}/> Recompensa</span>}
                </p>
                {v.itens && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{v.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}</p>}
                {v.pagamentos ? (
                  <p className="text-[10px] text-gray-500 mt-1 font-bold">{v.pagamentos.map((p: any) => `${p.nomeTaxa} (R$ ${p.valor.toFixed(2)})`).join(' + ')} • {new Date(v.timestamp).toLocaleTimeString('pt-BR')}</p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">{v.nomeTaxa} • {new Date(v.timestamp).toLocaleTimeString('pt-BR')}</p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="font-bold text-green-600">R$ {v.valor.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
          {vendasHoje.length === 0 && <p className="p-8 text-center text-gray-400">Nenhuma venda registrada no período comercial atual.</p>}
        </div>
      </div>
    </div>
  );
}
