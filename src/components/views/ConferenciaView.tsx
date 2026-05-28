import { Calculator, Plus, Pencil, Trash2 } from 'lucide-react';

interface Props {
  totalSistema: number;
  totalLancado: number;
  totalLiquido: number;
  diferenca: number;
  lancamentosHoje: any[];
  onAbrirSimulador: () => void;
  onEditConf: (l: any) => void;
  onZerarConferencia: () => void;
  onDeletarLancamento: (id: string) => void;
}

export default function ConferenciaView({
  totalSistema, totalLancado, totalLiquido, diferenca,
  lancamentosHoje, onAbrirSimulador, onEditConf, onZerarConferencia, onDeletarLancamento
}: Props) {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase">Total Vendido (Sistema PDV)</p>
          <h4 className="text-2xl font-black text-blue-600 mt-2">R$ {totalSistema.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">Registrado pelo Caixa hoje</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase">Total Lançado (Simulação Admin)</p>
          <h4 className="text-2xl font-black text-green-600 mt-2">R$ {totalLancado.toFixed(2)}</h4>
          <p className="text-xs text-green-600 font-bold mt-1">Lucro Líquido (Após Custos e Taxas): R$ {totalLiquido.toFixed(2)}</p>
        </div>
        <div className={`bg-white p-6 rounded-xl shadow-sm border ${diferenca === 0 ? 'border-green-100' : diferenca > 0 ? 'border-blue-100' : 'border-red-100'}`}>
          <p className="text-sm font-bold text-gray-500 uppercase">Diferença de Caixa</p>
          <h4 className={`text-2xl font-black mt-2 ${diferenca === 0 ? 'text-green-600' : diferenca > 0 ? 'text-blue-600' : 'text-red-600'}`}>
            R$ {Math.abs(diferenca).toFixed(2)} {diferenca > 0 ? '' : diferenca < 0 ? '(Falta / Quebra)' : ''}
          </h4>
          <p className="text-xs text-gray-400 mt-1">Lançado / Físico vs Vendido (PDV)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-gray-100 p-4 rounded-full text-gray-600 mb-2">
            <Calculator size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Bater Gaveta</h3>
            <p className="text-sm text-gray-500 mt-2">Pegue as vias de cartão e o dinheiro físico da gaveta e lance aqui para o sistema verificar o fechamento.</p>
          </div>
          <button onClick={onAbrirSimulador} className="w-full bg-gray-800 text-white p-3 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm flex items-center justify-center mt-4">
            <Plus size={20} className="mr-2" /> Simular Valores Físicos
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto flex flex-col h-fit max-h-[500px]">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h4 className="font-bold text-gray-800">Lançamentos de Conferência Hoje</h4>
            {lancamentosHoje.length > 0 && (
              <button onClick={onZerarConferencia} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center">
                <Trash2 size={14} className="mr-1" /> Zerar Conferência
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {lancamentosHoje.map((l, index) => (
              <div key={l.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-bold text-gray-800 flex items-center">
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono mr-2">#{lancamentosHoje.length - index}</span>
                    {l.descricao || 'Simulação Avulsa'}
                  </p>
                  {l.itens && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{l.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}</p>}
                  {l.pagamentos ? (
                    <p className="text-[10px] text-gray-500 mt-1 font-bold">{l.pagamentos.map((p: any) => `${p.nomeTaxa} (R$ ${p.valor.toFixed(2)})`).join(' + ')} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">{l.nomeTaxa} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-bold text-green-600">R$ {l.valor.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 font-bold">Lucro: R$ {l.valorLiquido.toFixed(2)}</p>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => onEditConf(l)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                    <button onClick={() => onDeletarLancamento(l.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            ))}
            {lancamentosHoje.length === 0 && <p className="p-8 text-center text-gray-400">Nenhum lançamento no simulador hoje.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
