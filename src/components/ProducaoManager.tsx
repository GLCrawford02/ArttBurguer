import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto } from '../types';
import { CheckCircle, ChefHat, Search, AlertTriangle } from 'lucide-react';
import { LoteDados } from '../types';

export default function ProducaoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos');

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

  const registrarProducao = async (produto: Produto) => {
    const multiplicador = quantidades[produto.id] || 1; // Padrão é 1 se não preenchido
    if (multiplicador <= 0) return;

    // 1. Verificar se há estoque suficiente de TODOS os ingredientes
    const checks = produto.ingredientes.map(ing => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      const qtdNecessaria = ing.quantidade * multiplicador;
      const tem = insumo ? (insumo.estoqueRotativo ?? (insumo as any).estoqueAtual ?? 0) : 0;
      if (!insumo || tem < qtdNecessaria) {
        return { ok: false, nome: insumo?.nome || 'Desconhecido', precisa: qtdNecessaria, tem: tem, unidade: insumo?.unidade || '' };
      }
      return { ok: true };
    });

    const falhas = checks.filter(c => !c.ok);
    if (falhas.length > 0) {
      const msg = falhas.map(f => `- ${f.nome}: Precisa ${f.precisa}${f.unidade}, mas só tem ${f.tem}${f.unidade}`).join('\n');
      showToast(`ESTOQUE INSUFICIENTE!\n\n${msg}`, 'error');
      return;
    }

    // 2. Realizar o abatimento no estoque de forma segura (Transaction)
    for (const ing of produto.ingredientes) {
      const insumoRef = ref(db, `insumos/${ing.insumoId}`);
      const qtdNecessaria = ing.quantidade * multiplicador;
      await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          currentData.estoqueRotativo = (currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0) - qtdNecessaria;
          
          // Abater dos lotes usando FIFO (vence primeiro, sai primeiro)
          if (currentData.lotes) {
            let qtdRestante = qtdNecessaria;
            const lotesArray = Object.entries(currentData.lotes).map(([id, l]) => ({ id, ...(l as LoteDados) }));
            
            lotesArray.sort((a, b) => {
              if (!a.validade) return 1;
              if (!b.validade) return -1;
              return new Date(a.validade).getTime() - new Date(b.validade).getTime();
            });

            for (const l of lotesArray) {
              if (qtdRestante <= 0) break;
              if (l.quantidade <= qtdRestante) {
                qtdRestante -= l.quantidade;
                delete currentData.lotes[l.id]; // Lote esgotado, remove
              } else {
                currentData.lotes[l.id].quantidade -= qtdRestante;
                qtdRestante = 0;
              }
            }
          }
        }
        return currentData;
      });
    }
    
    // 3. Salvar no histórico de vendas para o Fechamento de Caixa
    const vendasRef = push(ref(db, 'historico_vendas'));
    await set(vendasRef, {
      produtoId: produto.id,
      nome: produto.nome,
      quantidade: multiplicador,
      custoProducao: produto.custoTotal * multiplicador,
      receitaVenda: ((produto as any).precoVenda || 0) * multiplicador,
      timestamp: Date.now()
    });

    showToast(`Produção de ${multiplicador}x ${produto.nome} registrada com sucesso!\nO estoque foi atualizado.`, 'success');
    setQuantidades({ ...quantidades, [produto.id]: 1 }); // Reseta o input
  };

  const filteredProdutos = produtos.filter(p => 
    (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    ((p as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ChefHat className="mr-2 text-orange-500" size={20} />
              Registro de Produção / Saída
            </h3>
            <p className="text-sm text-gray-500 mt-1">Informe a quantidade feita de cada produto para abater os produtos do estoque automaticamente.</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProdutos.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-gray-900 text-lg leading-tight">{p.nome}</h4>
                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full uppercase ml-2 whitespace-nowrap">{((p as any).categoria) || 'Outros'}</span>
              </div>
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

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}
    </div>
  );
}