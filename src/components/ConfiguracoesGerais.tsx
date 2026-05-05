import { useState } from 'react';
import { Settings, CheckCircle } from 'lucide-react';

export default function ConfiguracoesGerais() {
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-gray-100 p-3 rounded-xl mr-4 text-gray-600">
          <Settings size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Configurações Gerais</h3>
          <p className="text-sm text-gray-500">Ajustes globais de comportamento do sistema.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Segurança e Acesso</h4>
        <div className="max-w-md space-y-4">
          <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-100">O tempo de inatividade (logout automático) agora é fixo em 3 minutos para a equipe, garantindo maior segurança. Esta configuração é gerenciada automaticamente pelo sistema.</p>
        </div>
      </div>

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}><CheckCircle className="mr-2" size={20} /><span>{toast.message}</span></div>)}
    </div>
  );
}