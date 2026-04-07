import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { AlertTriangle, Package, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
        }));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const baixos = insumos.filter(i => i.estoqueAtual <= i.alertaMinimo);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Insumos</p>
            <p className="text-2xl font-bold">{insumos.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Estoque Baixo</p>
            <p className="text-2xl font-bold">{baixos.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Itens Críticos</p>
            <p className="text-2xl font-bold">{insumos.filter(i => i.estoqueAtual === 0).length}</p>
          </div>
        </div>
      </div>

      {baixos.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Alertas de Reposição Necessária</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {baixos.map(i => (
                    <li key={i.id}>
                      {i.nome}: {i.estoqueAtual} {i.unidade} (Mínimo: {i.alertaMinimo} {i.unidade})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Lista de Insumos</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Insumo</th>
              <th className="px-6 py-3">Estoque Atual</th>
              <th className="px-6 py-3">Preço Unit.</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {insumos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                <td className="px-6 py-4 text-gray-600">{i.estoqueAtual} {i.unidade}</td>
                <td className="px-6 py-4 text-gray-600">
                  R$ {(i.precoPacote / i.qtdPacote).toFixed(4)} / {i.unidade}
                </td>
                <td className="px-6 py-4">
                  {i.estoqueAtual <= i.alertaMinimo ? (
                    <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-600 rounded-full">BAIXO</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-600 rounded-full">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
