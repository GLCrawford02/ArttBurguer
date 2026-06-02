import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Printer, Save, CheckCircle, AlertTriangle, Search, Play } from 'lucide-react';

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
  const [impressorasLocais, setImpressorasLocais] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
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

  const detectarImpressoras = async () => {
    if (!isElectron) {
      showToast('A detecção automática só funciona no aplicativo Windows (.exe).', 'error');
      return;
    }
    setIsDetecting(true);
    try {
      const electron = (window as any).electronAPI;
      if (electron && electron.getPrinters) {
        const list = await electron.getPrinters();
        const names = list.map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
        setImpressorasLocais(names);
        showToast(`${names.length} impressoras detectadas no computador!`, 'success');
      } else {
        showToast('Sua versão do app desktop não suporta detecção automática.', 'error');
      }
    } catch (err) {
      showToast('Erro ao detectar impressoras locais.', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const testarImpressora = async (dest: 'cozinha' | 'balcao') => {
    const ipOuNome = nomes[dest];
    if (!ipOuNome) {
      showToast(`Informe o IP ou Nome para a impressora do ${dest === 'cozinha' ? 'Cozinha' : 'Balcão'}.`, 'error');
      return;
    }
    if (!isElectron) {
      showToast('Os testes diretos funcionam melhor no app Windows (.exe).', 'error');
      return;
    }
    
    try {
      const electron = (window as any).electronAPI;
      if (electron && electron.imprimirTicketIP) {
        await electron.imprimirTicketIP(
          ipOuNome, 
          [{ qtd: 1, nome: '==== TESTE DE COMUNICACAO ====' }, { qtd: 1, nome: 'IMPRESSORA OK' }], 
          dest === 'cozinha' ? 'COZINHA (TESTE)' : 'BALCÃO (TESTE)', 
          'TESTE-001', 
          'Sistema'
        );
        showToast(`Teste enviado para ${ipOuNome}!`, 'success');
      } else {
        showToast('Integração de impressão não encontrada.', 'error');
      }
    } catch (err) {
      showToast(`Falha ao testar a impressora ${dest}. Verifique a conexão.`, 'error');
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-gray-100 pb-3 gap-4">
          <div>
            <h4 className="font-bold text-gray-700">Identificação das Impressoras (Rede ou USB)</h4>
            <p className="text-xs text-gray-400 mt-0.5">Informe o IP (Rede) ou selecione o nome da impressora (USB/Local).</p>
          </div>
          {isElectron && (
            <button onClick={detectarImpressoras} disabled={isDetecting} className="bg-gray-800 text-white hover:bg-gray-900 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm disabled:opacity-50 whitespace-nowrap">
              <Search size={14} className={`mr-2 ${isDetecting ? 'animate-pulse' : ''}`} />
              {isDetecting ? 'Buscando...' : 'Detectar Impressoras'}
            </button>
          )}
        </div>

        <datalist id="detected-printers">
          {impressorasLocais.map(p => <option key={p} value={p} />)}
        </datalist>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {(['cozinha', 'balcao'] as const).map(dest => (
            <div key={dest} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                Impressora — {dest === 'cozinha' ? 'Cozinha' : 'Balcão'}
              </label>
              <div className="flex flex-col xl:flex-row gap-2">
                <input
                  type="text"
                  list="detected-printers"
                  value={nomes[dest]}
                  onChange={e => setNomes(prev => ({ ...prev, [dest]: e.target.value }))}
                  placeholder="IP (192.168...) ou Nome"
                  className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                />
                <button onClick={() => testarImpressora(dest)} className="bg-blue-100 text-blue-700 px-4 py-2.5 rounded-lg font-bold hover:bg-blue-200 transition-colors flex items-center justify-center shadow-sm text-sm" title="Enviar teste de impressão">
                  <Play size={16} className="mr-2" /> Testar
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Você pode utilizar o IP para impressoras de rede Ethernet/Wi-Fi ou selecionar o nome exato da impressora para conexões USB (apenas no App Windows).
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
