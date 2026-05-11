import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Search, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function VisibilidadeManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsub = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
    return () => unsub();
  }, []);

  const toggleVisibilidade = async (insumo: any) => {
    const isRestrito = insumo.restrito || false;
    await update(ref(db, `insumos/${insumo.id}`), { restrito: !isRestrito });
  };

  const filteredInsumos = insumos.filter(i => 
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <ShieldCheck className="mr-2 text-indigo-600" size={20} />
            Visibilidade de Estoque
          </h3>
          <p className="text-sm text-gray-500 mt-1">Defina quais insumos ficarão visíveis para os funcionários comuns em Balanços, Transferências e Dashboard.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full sm:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4">Insumo</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4 text-center">Visível para Todos?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredInsumos.map(i => {
              const isRestrito = (i as any).restrito || false;
              return (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{i.nome}</p>
                    <p className="text-xs font-mono text-gray-400">{(i as any).sku || 'S/ SKU'}</p>
                  </td>
                  <td className="px-6 py-4">
                    {(i as any).tipoUso ? <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full uppercase">{(i as any).tipoUso}</span> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleVisibilidade(i)}
                      className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center transition-colors mx-auto ${!isRestrito ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {!isRestrito ? <><Eye size={16} className="mr-2" /> Sim (Público)</> : <><EyeOff size={16} className="mr-2" /> Não (Restrito a Gestores)</>}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredInsumos.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-gray-400">Nenhum insumo encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}