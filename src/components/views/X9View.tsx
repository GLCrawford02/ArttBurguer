import { Eye, Trash2, User } from 'lucide-react';

interface Props {
  logsX9: any[];
  onLimparX9: () => void;
}

export default function X9View({ logsX9, onLimparX9 }: Props) {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto flex flex-col h-fit max-h-[700px]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h4 className="font-bold text-gray-800 flex items-center"><Eye className="mr-2 text-indigo-500" size={18}/> Registros de Entregas às Mesas (X9)</h4>
          {logsX9.length > 0 && (
            <button onClick={onLimparX9} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center">
              <Trash2 size={14} className="mr-1" /> Limpar Registros
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto p-4 space-y-3">
          {logsX9.map((log: any) => (
            <div key={log.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-bold text-gray-800 text-lg mb-1">{log.identificador}</p>
                <p className="text-sm text-gray-600 flex items-center"><User size={14} className="mr-1"/> Entregue por: <strong className="ml-1 text-indigo-700">{log.atendenteNome || 'Desconhecido'}</strong></p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400">{new Date(log.timestamp).toLocaleDateString('pt-BR')} às</p>
                <p className="text-sm font-black text-gray-700">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</p>
              </div>
            </div>
          ))}
          {logsX9.length === 0 && <p className="text-center text-gray-400 italic py-8">Nenhum registro de entrega por atendente no momento.</p>}
        </div>
      </div>
    </div>
  );
}
