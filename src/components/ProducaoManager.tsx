import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, Promocao } from '../types';
import { CheckCircle, ChefHat, Search, AlertTriangle, Clock, Flame, UtensilsCrossed } from 'lucide-react';

export default function ProducaoManager() {
  const [view, setView] = useState<'kds' | 'manual'>('kds');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos');
    const pedidosRef = ref(db, 'pedidos_cozinha');

    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
    });

    const unsubProdutos = onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProdutos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setProdutos([]);
      }
    });

    const promocoesRef = ref(db, 'promocoes');
    const unsubPromocoes = onValue(promocoesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPromocoes(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setPromocoes([]);
      }
    });

    const unsubPedidos = onValue(pedidosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        setPedidosCozinha(list);
      } else setPedidosCozinha([]);
    });

    return () => {
      unsubInsumos();
      unsubProdutos();
      unsubPromocoes();
      unsubPedidos();
    };
  }, []);

  const registrarProducao = async (produto: Produto | Promocao | any) => {
    const multiplicador = quantidades[produto.id] || 1;
    if (multiplicador <= 0) return;


    const checks = (produto.ingredientes || []).map((ing: any) => {
      const insumo = insumos.find(i => i.id === ing.insumoId);
      const qtdNecessaria = ing.quantidade * multiplicador;
      const tem = insumo ? (insumo.estoqueRotativo ?? (insumo as any).estoqueAtual ?? 0) : 0;
      if (!insumo || tem < qtdNecessaria) {
        return { ok: false, nome: insumo?.nome || 'Desconhecido', precisa: qtdNecessaria, tem: tem, unidade: insumo?.unidade || '' };
      }
      return { ok: true };
    });

    const falhas = checks.filter((c: any) => !c.ok);
    if (falhas.length > 0) {
      const msg = falhas.map((f: any) => `- ${f.nome}: Precisa ${f.precisa}${f.unidade}, mas só tem ${f.tem}${f.unidade}`).join('\n');
      showToast(`ESTOQUE INSUFICIENTE!\n\n${msg}`, 'error');
      return;
    }


    for (const ing of (produto.ingredientes || [])) {
      const insumoRef = ref(db, `insumos/${ing.insumoId}`);
      const qtdNecessaria = ing.quantidade * multiplicador;
      await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          currentData.estoqueRotativo = (currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0) - qtdNecessaria;
        }
        return currentData;
      });
    }

    showToast(`Produção de ${multiplicador}x ${produto.nome} registrada com sucesso!\nO estoque foi atualizado.`, 'success');
    setQuantidades({ ...quantidades, [produto.id]: 1 });
  };

  const checkPromocaoValida = (promo: Promocao) => {
    const now = new Date();

    if (promo.dataInicio) {
      const start = new Date(`${promo.dataInicio}T00:00:00`);
      if (now < start) return false;
    }
    if (promo.dataFim) {
      const end = new Date(`${promo.dataFim}T23:59:59`);
      if (now > end) return false;
    }


    if (promo.horarioInicio || promo.horarioFim) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      let startMinutes = 0;
      if (promo.horarioInicio) {
        const [h, m] = promo.horarioInicio.split(':').map(Number);
        startMinutes = h * 60 + m;
      }
      let endMinutes = 24 * 60;
      if (promo.horarioFim) {
        const [h, m] = promo.horarioFim.split(':').map(Number);
        endMinutes = h * 60 + m;
      }
      if (startMinutes <= endMinutes) {
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
      } else {
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) return false;
      }
    }
    return true;
  };

  const handleFinalizarPedido = async (pedido: any) => {
    try {

      for (const item of pedido.itens) {
        const prod = produtos.find(p => p.id === item.produtoId) || promocoes.find(p => p.id === item.produtoId);
        if (!prod) continue;
        
        const multiplicador = item.qtd;
        for (const ing of (prod.ingredientes || [])) {
          const insumoRef = ref(db, `insumos/${ing.insumoId}`);
          await runTransaction(insumoRef, (currentData) => {
            if (currentData) {
              currentData.estoqueRotativo = (currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0) - (ing.quantidade * multiplicador);
            }
            return currentData;
          });
        }
      }
      await update(ref(db, `pedidos_cozinha/${pedido.id}`), { status: 'Concluído', finalizadoEm: Date.now() });
      showToast('Pedido finalizado e enviado para a mesa/balcão!', 'success');
    } catch (error) {
      showToast('Erro ao finalizar pedido e abater estoque.', 'error');
    }
  };

  const allItems: any[] = [
    ...produtos,
    ...promocoes.filter(checkPromocaoValida).map(p => ({ ...p, categoria: 'Promoção / Combo' }))
  ];

  const filteredProdutos = allItems.filter(p => 
    (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    ((p as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendentes = pedidosCozinha.filter(p => p.status === 'Pendente').sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setView('kds')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${view === 'kds' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Monitor da Cozinha</button>
        <button onClick={() => setView('manual')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${view === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Baixa Avulsa / Manual</button>
      </div>

      {view === 'kds' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 flex items-center"><Flame className="mr-2 text-orange-500"/> Fila de Produção ({pendentes.length})</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pendentes.map(ped => {
              const timeDiff = Math.floor((currentTime - ped.timestamp) / 60000);
              const isLate = timeDiff > 15;
              return (
                <div key={ped.id} className={`bg-white rounded-xl shadow-md border-t-4 flex flex-col overflow-hidden transition-all ${isLate ? 'border-red-500 ring-2 ring-red-100' : 'border-orange-500'}`}>
                  <div className={`p-3 border-b flex justify-between items-center ${isLate ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="font-black text-gray-800 text-lg uppercase tracking-tight">{ped.identificador}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-sm ${isLate ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-100 text-orange-800'}`}><Clock size={12} className="mr-1"/> {timeDiff} min</span>
                  </div>
                  <div className="p-4 flex-1 space-y-3 bg-white">
                     {ped.itens.map((item: any, idx: number) => (
                       <div key={idx} className="flex items-start border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                         <span className={`font-black text-lg w-8 shrink-0 ${isLate ? 'text-red-600' : 'text-gray-800'}`}>{item.qtd}x</span>
                         <span className="text-gray-700 font-medium leading-tight pt-0.5">{item.nome}</span>
                       </div>
                     ))}
                  </div>
                  <button onClick={() => handleFinalizarPedido(ped)} className="bg-green-500 hover:bg-green-600 text-white p-4 font-bold text-sm flex items-center justify-center transition-colors">
                    <CheckCircle size={18} className="mr-2"/> Pronto / Enviar
                  </button>
                </div>
              );
            })}
            {pendentes.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100 border-dashed">
                <UtensilsCrossed size={48} className="mb-4 opacity-30"/>
                <p className="text-lg font-bold">Cozinha Livre</p>
                <p className="text-sm">Nenhum pedido aguardando produção no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'manual' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ChefHat className="mr-2 text-gray-500" size={20} />
              Baixa Manual de Estoque (Avulsa)
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
        {filteredProdutos.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-gray-900 text-lg leading-tight">{p.nome}</h4>
                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full uppercase ml-2 whitespace-nowrap">{((p as any).categoria) || 'Outros'}</span>
              </div>
              <p className="text-xs text-gray-400">{(p.ingredientes || []).length} insumos totais descontados</p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Qtd Produzida:</label>
              <div className="flex space-x-2">
                <input type="number" min="1" value={quantidades[p.id] || 1} onChange={(e) => setQuantidades({ ...quantidades, [p.id]: Number(e.target.value) })} className="w-20 p-2 border border-gray-200 rounded-lg outline-none text-center font-bold" />
                <button onClick={() => registrarProducao(p)} className="flex-1 bg-gray-800 text-white p-2 rounded-lg font-bold hover:bg-gray-900 transition-colors flex items-center justify-center">
                  <CheckCircle size={18} className="mr-2" /> Produzir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}
    </div>
  );
}