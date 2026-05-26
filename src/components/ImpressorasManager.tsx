import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Printer, Save, CheckCircle, AlertTriangle } from 'lucide-react';

const DESTINOS = [
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'ambos', label: 'Ambos' },
  { value: 'nenhum', label: 'Não imprimir' },
];

const isElectron = !!(window as any).electronAPI;

export default function ImpressorasManager() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [nomes, setNomes] = useState({ cozinha: '', balcao: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const prodRef = ref(db, 'produtos');
    const unsubProd = onValue(prodRef, (snap) => {
      const data = snap.val() || {};
      const cats = [...new Set(
        Object.values(data).map((p: any) => p.categoria).filter(Boolean)
      )] as string[];
      cats.push('Promoções');
      setCategorias(cats.sort());
    });

    const configRef = ref(db, 'configuracoes/impressoras');
    const unsubConfig = onValue(configRef, (snap) => setConfig(snap.val() || {}));

    const nomesRef = ref(db, 'configuracoes/impressoras_nomes');
    const unsubNomes = onValue(nomesRef, (snap) => setNomes(snap.val() || { cozinha: '', balcao: '' }));

    return () => { unsubProd(); unsubConfig(); unsubNomes(); };
  }, []);

  const handleSalvar = async () => {
    try {
      await set(ref(db, 'configuracoes/impressoras'), config);
      await set(ref(db, 'configuracoes/impressoras_nomes'), nomes);
      showToast('Configuração de impressoras salva!');
    } catch {
      showToast('Erro ao salvar.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
            <Printer size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Roteamento de Impressoras</h3>
            <p className="text-sm text-gray-500">Configure as impressoras e defina para onde cada categoria é enviada.</p>
          </div>
        </div>
        <button onClick={handleSalvar} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm">
          <Save size={18} className="mr-2" /> Salvar Tudo
        </button>
      </div>

      {/* IP das impressoras */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <div>
            <h4 className="font-bold text-gray-700">Endereço IP das Impressoras</h4>
            <p className="text-xs text-gray-400 mt-0.5">Informe o IP da impressora térmica de cada destino. Ex: 192.168.0.55.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {(['cozinha', 'balcao'] as const).map(dest => (
            <div key={dest}>
              <label className="block text-sm font-bold text-gray-600 mb-1">
                IP — {dest === 'cozinha' ? 'Cozinha' : 'Balcão'}
              </label>
              <input
                type="text"
                value={nomes[dest]}
                onChange={e => setNomes(prev => ({ ...prev, [dest]: e.target.value }))}
                placeholder="Ex: 192.168.0.55"
                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Encontre o VID e PID da impressora no Gerenciador de Dispositivos do Windows (Propriedades &gt; Detalhes &gt; IDs de Hardware).
        </p>
      </div>

      {/* Roteamento por categoria */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Ao confirmar um pedido, o sistema imprime automaticamente um ticket separado por destino.
            Ao reimprimir manualmente, sempre imprime a comanda completa.
          </p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
              <th className="py-4 px-6 font-bold">Categoria</th>
              <th className="py-4 px-6 font-bold text-center">Destino da Impressão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {categorias.length === 0 && (
              <tr>
                <td colSpan={2} className="py-8 text-center text-gray-400 text-sm">Nenhuma categoria cadastrada nos produtos.</td>
              </tr>
            )}
            {categorias.map(cat => (
              <tr key={cat} className="hover:bg-gray-50 transition-colors">
                <td className="py-4 px-6 font-semibold text-gray-700">{cat}</td>
                <td className="py-4 px-6">
                  <div className="flex justify-center gap-2 flex-wrap">
                    {DESTINOS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setConfig(prev => ({ ...prev, [cat]: d.value }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          (config[cat] || 'cozinha') === d.value
                            ? d.value === 'cozinha' ? 'bg-orange-500 text-white border-orange-500'
                              : d.value === 'balcao' ? 'bg-blue-500 text-white border-blue-500'
                              : d.value === 'ambos' ? 'bg-green-500 text-white border-green-500'
                              : 'bg-gray-500 text-white border-gray-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
