import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Scale, Save, Download } from 'lucide-react';

export default function BalancoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [novosEstoques, setNovosEstoques] = useState<Record<string, string>>({});

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const handleAjuste = async (insumo: Insumo) => {
    const novoValor = novosEstoques[insumo.id];
    if (novoValor === undefined || novoValor === '') return;
    
    await set(ref(db, `insumos/${insumo.id}/estoqueAtual`), Number(novoValor));
    alert(`Balanço concluído! O estoque de ${insumo.nome} agora é ${novoValor}${insumo.unidade}.`);
    
    setNovosEstoques(prev => {
      const newState = { ...prev };
      delete newState[insumo.id];
      return newState;
    });
  };

  const exportarExcel = () => {
    const headers = ['Insumo', 'Estoque no Sistema', 'Unidade', 'Preco Unitario (R$)'];
    const rows = insumos.map(i => [
      i.nome,
      i.estoqueAtual,
      i.unidade,
      (i.precoPacote / i.qtdPacote).toFixed(3).replace('.', ',')
    ]);
    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="flex-1 flex items-center">
          <div className="bg-purple-100 p-3 rounded-xl mr-4 text-purple-600">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Auditoria e Balanço de Estoque</h3>
            <p className="text-sm text-gray-500">Faça a contagem física (real) na cozinha e ajuste os valores desatualizados do sistema.</p>
          </div>
        </div>
        <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex items-center shadow-sm">
          <Download size={18} className="mr-2 hidden sm:block" /> Exportar Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Insumo</th>
              <th className="px-6 py-3">Estoque no Sistema</th>
              <th className="px-6 py-3">Estoque Real (Contagem)</th>
              <th className="px-6 py-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {insumos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                <td className="px-6 py-4 text-gray-600 font-bold">{i.estoqueAtual} {i.unidade}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <input type="number" value={novosEstoques[i.id] !== undefined ? novosEstoques[i.id] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [i.id]: e.target.value})} placeholder={String(i.estoqueAtual)} className="w-24 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
                    <span className="text-gray-500 text-sm font-medium">{i.unidade}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleAjuste(i)} disabled={novosEstoques[i.id] === undefined || novosEstoques[i.id] === ''} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
                    <Save size={16} className="mr-2" /> Ajustar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}