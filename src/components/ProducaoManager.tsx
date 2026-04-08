import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, ProdutoFinal } from '../types';
import { CheckCircle, ChefHat } from 'lucide-react';

export default function ProducaoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoFinal[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos_finais');

    onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
    });

    onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProdutos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setProdutos([]);
      }
    });
  }, []);

  const registrarProducao = async (produto: ProdutoFinal) => {
    const multiplicador = quantidades[produto.id] || 1; // Padrão é 1 se não preenchido
    if (multiplicador <= 0) return;

    // 1. Verificar se há estoque suficiente de TODOS os ingredientes
    const checks = produto.ingredientes.map(ing => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      const qtdNecessaria = ing.quantidade * multiplicador;
      if (!insumo || insumo.estoqueAtual < qtdNecessaria) {
        return { ok: false, nome: insumo?.nome || 'Desconhecido', precisa: qtdNecessaria, tem: insumo?.estoqueAtual || 0, unidade: insumo?.unidade || '' };
      }
      return { ok: true };
    });

    const falhas = checks.filter(c => !c.ok);
    if (falhas.length > 0) {
      const msg = falhas.map(f => `- ${f.nome}: Precisa ${f.precisa}${f.unidade}, mas só tem ${f.tem}${f.unidade}`).join('\n');
      alert(`ESTOQUE INSUFICIENTE!\n\n${msg}`);
      return;
    }

    // 2. Realizar o abatimento no estoque de forma segura (Transaction)
    for (const ing of produto.ingredientes) {
      const insumoRef = ref(db, `insumos/${ing.insumoId}/estoqueAtual`);
      const qtdNecessaria = ing.quantidade * multiplicador;
      await runTransaction(insumoRef, (currentValue) => {
        return (currentValue || 0) - qtdNecessaria;
      });
    }
    
    alert(`Produção de ${multiplicador}x ${produto.nome} registrada com sucesso!\nO estoque foi atualizado.`);
    setQuantidades({ ...quantidades, [produto.id]: 1 }); // Reseta o input
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <ChefHat className="mr-2 text-orange-500" size={20} />
          Registro de Produção / Saída
        </h3>
        <p className="text-sm text-gray-500 mt-1">Informe a quantidade feita de cada produto para abater os insumos do estoque automaticamente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 text-lg">{p.nome}</h4>
              <p className="text-xs text-gray-400">{p.ingredientes.length} ingredientes na receita</p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Qtd Produzida:</label>
              <div className="flex space-x-2">
                <input type="number" min="1" value={quantidades[p.id] || 1} onChange={(e) => setQuantidades({ ...quantidades, [p.id]: Number(e.target.value) })} className="w-20 p-2 border border-gray-200 rounded-lg outline-none text-center font-bold" />
                <button onClick={() => registrarProducao(p)} className="flex-1 bg-orange-500 text-white p-2 rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center justify-center">
                  <CheckCircle size={18} className="mr-2" /> Produzir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}