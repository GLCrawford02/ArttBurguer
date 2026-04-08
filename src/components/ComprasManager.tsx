import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { ShoppingCart, Plus } from 'lucide-react';

export default function ComprasManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

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

  const registrarCompra = async (insumo: Insumo) => {
    const qtdPacotes = quantidades[insumo.id];
    if (!qtdPacotes || qtdPacotes <= 0) return;

    const qtdAdicionar = qtdPacotes * insumo.qtdPacote; // Multiplica os pacotes pela Qtd por Pacote

    const insumoRef = ref(db, `insumos/${insumo.id}/estoqueAtual`);
    await runTransaction(insumoRef, (currentValue) => {
      return (currentValue || 0) + qtdAdicionar;
    });
    
    alert(`Estoque de ${insumo.nome} reabastecido (+${qtdPacotes} pacote(s) = +${qtdAdicionar}${insumo.unidade}) com sucesso!`);
    setQuantidades({ ...quantidades, [insumo.id]: 0 }); // Limpa o campo
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <ShoppingCart className="mr-2 text-blue-600" size={20} />
          Reabastecimento de Estoque
        </h3>
        <p className="text-sm text-gray-500 mt-1">Informe a quantidade de pacotes comprados. O sistema multiplicará pela quantidade do pacote automaticamente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumos.map(insumo => (
          <div key={insumo.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="font-bold text-gray-900">{insumo.nome}</h4>
              <p className="text-sm text-gray-500">Estoque atual: <span className="font-bold">{insumo.estoqueAtual} {insumo.unidade}</span></p>
              <p className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-2 py-1 rounded font-medium border border-blue-100">1 pacote = {insumo.qtdPacote} {insumo.unidade}</p>
            </div>
            <div className="flex space-x-2">
              <input
                type="number"
                min="1"
                value={quantidades[insumo.id] || ''}
                onChange={(e) => setQuantidades({ ...quantidades, [insumo.id]: Number(e.target.value) })}
                placeholder="Qtd de pacotes"
                className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => registrarCompra(insumo)}
                className="bg-green-600 text-white p-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center"
                title="Adicionar ao Estoque"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}