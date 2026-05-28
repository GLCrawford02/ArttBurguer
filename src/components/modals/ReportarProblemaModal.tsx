import { X, AlertTriangle, Map, PhoneOff } from 'lucide-react';

interface Props {
  reportModal: number | null;
  activeRoute: any;
  onClose: () => void;
  onReportarProblema: (paradaIndex: number, tipo: 'endereco' | 'telefone') => void;
}

export default function ReportarProblemaModal({ reportModal, activeRoute, onClose, onReportarProblema }: Props) {
  if (reportModal === null || !activeRoute) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
          <h3 className="font-bold text-red-700 flex items-center"><AlertTriangle size={20} className="mr-2"/> Reportar Problema</h3>
          <button onClick={onClose} className="text-red-400 hover:text-red-600 bg-red-100 hover:bg-red-200 rounded-full p-1 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">Escolha o problema abaixo para que o robô envie um aviso automaticamente para o WhatsApp do cliente.</p>

          <button onClick={() => onReportarProblema(reportModal, 'endereco')} className="w-full bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 p-4 rounded-xl flex items-center text-left transition-colors group shadow-sm">
            <Map className="text-gray-400 group-hover:text-red-500 mr-4 shrink-0" size={28}/>
            <div>
              <h4 className="font-bold text-gray-800 group-hover:text-red-700">Não encontro o endereço</h4>
              <p className="text-xs text-gray-500 mt-1">Avisa o cliente para mandar ponto de referência.</p>
            </div>
          </button>

          <button onClick={() => onReportarProblema(reportModal, 'telefone')} className="w-full bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 p-4 rounded-xl flex items-center text-left transition-colors group shadow-sm">
            <PhoneOff className="text-gray-400 group-hover:text-red-500 mr-4 shrink-0" size={28}/>
            <div>
              <h4 className="font-bold text-gray-800 group-hover:text-red-700">Cliente não atende</h4>
              <p className="text-xs text-gray-500 mt-1">Avisa o cliente para verificar o celular ou portão.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
