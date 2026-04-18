import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Settings, Save, CheckCircle } from 'lucide-react';

export default function ConfiguracoesGerais() {
  const [tempoLogout, setTempoLogout] = useState('5');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const confRef = ref(db, 'configuracoes/gerais');
    const unsub = onValue(confRef, (snap) => {
      const data = snap.val();
      if (data && data.tempoLogout) {
        setTempoLogout(String(data.tempoLogout));
      }
    });
    return () => unsub();
  }, []);

  const handleSalvar = async () => {
    const tempo = Number(tempoLogout);
    if (tempo < 1) return;
    await set(ref(db, 'configuracoes/gerais/tempoLogout'), tempo);
    setToast({ message: 'Configurações salvas!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

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
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1">Tempo para Logout Automático (minutos)</label>
            <p className="text-xs text-gray-500 mb-2">Tempo de inatividade antes de desconectar funcionários (exceto Admins e Gerentes).</p>
            <input type="number" min="1" max="120" value={tempoLogout} onChange={e => setTempoLogout(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500" />
          </div>
          <button onClick={handleSalvar} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-900 transition-colors flex items-center">
            <Save size={18} className="mr-2" /> Salvar Configurações
          </button>
        </div>
      </div>

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}><CheckCircle className="mr-2" size={20} /><span>{toast.message}</span></div>)}
    </div>
  );
}