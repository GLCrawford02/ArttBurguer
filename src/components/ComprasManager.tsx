import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Item } from '../types';
import { ShoppingCart, Plus, Search } from 'lucide-react';

export default function ComprasManager() {
  const [insumos, setInsumos] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [lotes, setLotes] = useState<Record<string, string>>({});
  const [validades, setValidades] = useState<Record<string, string>>({});

  useEffect(() => {
    const insumosRef = ref(db, 'itens');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const registrarCompra = async (insumo: Item) => {
    const qtdPacotes = quantidades[insumo.id];
    if (!qtdPacotes || qtdPacotes <= 0) return;

    const qtdAdicionar = qtdPacotes * insumo.qtdPacote; // Multiplica os pacotes pela Qtd por Pacote

    const lote = lotes[insumo.id] || '';
    const validade = validades[insumo.id] || '';

    const insumoRef = ref(db, `itens/${insumo.id}`);
    await runTransaction(insumoRef, (currentData) => {
      if (currentData) {
        currentData.estoqueAtual = (currentData.estoqueAtual || 0) + qtdAdicionar;
        
        if (lote || validade) {
          if (!currentData.lotes) currentData.lotes = {};
          const newLoteId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
          currentData.lotes[newLoteId] = {
            lote: lote || 'N/A',
            validade: validade || '',
            quantidade: qtdAdicionar
          };
        }
      }
      return currentData;
    });

    // Salvar no histórico de compras financeiro
    const custoTotalCompra = qtdPacotes * insumo.precoPacote;
    const historicoRef = push(ref(db, 'historico_compras'));
    await set(historicoRef, {
      insumoId: insumo.id,
      nome: insumo.nome,
      qtdPacotes,
      custoTotal: custoTotalCompra,
      lote,
      validade,
      timestamp: Date.now()
    });
    
    alert(`Estoque de ${insumo.nome} reabastecido (+${qtdPacotes} pacote(s) = +${qtdAdicionar}${insumo.unidade}) com sucesso!`);
    setQuantidades({ ...quantidades, [insumo.id]: 0 }); // Limpa o campo
    setLotes({ ...lotes, [insumo.id]: '' });
    setValidades({ ...validades, [insumo.id]: '' });
  };

  const filteredInsumos = insumos.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ShoppingCart className="mr-2 text-blue-600" size={20} />
              Reabastecimento de Estoque
            </h3>
            <p className="text-sm text-gray-500 mt-1">Informe a quantidade de pacotes comprados. O sistema multiplicará pela quantidade do pacote automaticamente.</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInsumos.map(insumo => (
          <div key={insumo.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="font-bold text-gray-900">{insumo.nome}</h4>
              <p className="text-sm text-gray-500">Estoque atual: <span className="font-bold">{insumo.estoqueAtual} {insumo.unidade}</span></p>
              <p className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-2 py-1 rounded font-medium border border-blue-100">1 pacote = {insumo.qtdPacote} {insumo.unidade}</p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Lote (opcional)"
                  value={lotes[insumo.id] || ''}
                  onChange={(e) => setLotes({ ...lotes, [insumo.id]: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="date"
                  value={validades[insumo.id] || ''}
                  onChange={(e) => setValidades({ ...validades, [insumo.id]: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
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
          </div>
        ))}
      </div>
    </div>
  );
}