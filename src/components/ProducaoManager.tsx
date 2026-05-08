import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, Promocao } from '../types';
import { CheckCircle, ChefHat, Search, AlertTriangle, Clock, Flame, UtensilsCrossed, Package, Coffee, CheckSquare, Square, MonitorPlay, Filter, ChevronDown, X, Maximize2 } from 'lucide-react';

export default function ProducaoManager({ currentUser }: { currentUser?: any }) {
  const [view, setView] = useState<'kds' | 'manual'>('kds');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [kdsFiltroCategorias, setKdsFiltroCategorias] = useState<string[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showFiltrosKds, setShowFiltrosKds] = useState(false);
  const [expandedKdsOrderId, setExpandedKdsOrderId] = useState<string | null>(null);

  const cargos = currentUser ? (Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || '']) : [];
  const kdsRoles = cargos.filter((c: string) => c.toUpperCase().includes('KDS'));
  const isKdsOnly = cargos.length > 0 && cargos.every((c: string) => c.toUpperCase().includes('KDS'));

  // Extrai apenas as telas que este funcionário KDS tem acesso (ex: "KDS Chapa" -> "Chapa")
  const allowedStations = kdsRoles.length > 0 
    ? kdsRoles.map((r: string) => r.replace(/KDS\s+/i, '').trim())
    : ['Chapa', 'Char Broiler', 'Montagem', 'Porção', 'Balcão', 'Expedição'];

  const [activeKds, setActiveKds] = useState<any>(allowedStations[0] || 'Montagem');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (allowedStations.length > 0 && !allowedStations.includes(activeKds)) {
      setActiveKds(allowedStations[0]);
    }
  }, [currentUser]);

  useEffect(() => {
    let defaults: string[] = [];
    switch (activeKds) {
      case 'Expedição':
        defaults = ['Hambúrguer', 'Promoção / Combo', 'Porção'];
        break;
      case 'Chapa':
      case 'Char Broiler':
      case 'Montagem':
        defaults = ['Hambúrguer', 'Promoção / Combo'];
        break;
      case 'Porção':
        defaults = ['Porção'];
        break;
      case 'Balcão':
        defaults = ['Bebida', 'Sobremesa', 'Outros'];
        break;
    }
    setKdsFiltroCategorias(defaults);
  }, [activeKds]);

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
          const insumo = insumos.find(i => i.id === ing.insumoId);
          if (insumo && item.opcoes && item.opcoes.restricoes) {
            const restricoesArray = Object.values(item.opcoes.restricoes) as string[];
            if (restricoesArray.includes(insumo.nome)) {
              continue; // Não abate do estoque pois o cliente pediu sem este ingrediente
            }
          }

          const insumoRef = ref(db, `insumos/${ing.insumoId}`);
          await runTransaction(insumoRef, (currentData) => {
            if (currentData) {
              currentData.estoqueRotativo = (currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0) - (ing.quantidade * multiplicador);
            }
            return currentData;
          });
        }

        // Abater adicionais
        if (item.opcoes && item.opcoes.adicionais) {
          const adicionaisArray = Object.values(item.opcoes.adicionais) as any[];
          for (const add of adicionaisArray) {
            const insumoAdicional = insumos.find(i => i.nome.toLowerCase().trim() === (add.nome || '').toLowerCase().trim());
            if (insumoAdicional) {
              const insumoRef = ref(db, `insumos/${insumoAdicional.id}`);
              await runTransaction(insumoRef, (currentData) => {
                if (currentData) {
                  currentData.estoqueRotativo = (currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0) - (add.qtd * multiplicador);
                }
                return currentData;
              });
            }
          }
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

  const categoriasExistentes = Array.from(new Set(allItems.map(p => p.categoria || 'Outros'))).sort();

  const filteredProdutos = allItems.filter(p => {
    const matchSearch = (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        ((p as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filtroCategoria ? (p.categoria || 'Outros') === filtroCategoria : true;
    return matchSearch && matchCat;
  });

  // Mapeia categorias para seus respectivos setores do KDS
  const filterItemsForKDS = (itens: any[], kds: string) => {
    return itens.map((item, idx) => ({ ...item, originalIdx: idx })).filter(item => {
      const prod = allItems.find(p => p.id === item.produtoId);
      const cat = prod ? (prod.categoria || 'Outros') : 'Outros';
      return kdsFiltroCategorias.includes(cat);
    });
  };

  const toggleItemConcluido = async (pedidoId: string, itemIdx: number, isConcluido: boolean) => {
    // Salva o status de concluído de forma independente para cada KDS
    await update(ref(db, `pedidos_cozinha/${pedidoId}/itens/${itemIdx}/kdsStatus`), { [activeKds]: !isConcluido });
  };

  const handleProntoKds = async (pedido: any) => {
    if (activeKds === 'Expedição') {
      await handleFinalizarPedido(pedido);
    } else {
      // Remove a comanda apenas desta praça específica sem interferir nas outras
      await update(ref(db, `pedidos_cozinha/${pedido.id}/kdsFinalizado`), { [activeKds]: true });
      showToast(`${activeKds}: Comanda despachada da praça!`, 'success');
    }
  };

  const handleAceitarComanda = async (pedidoId: string) => {
    await update(ref(db, `pedidos_cozinha/${pedidoId}`), { status: 'Em Produção', aceitoEm: Date.now() });
    showToast('Comanda aceita! Em produção.', 'success');
  };

  const pendentes = pedidosCozinha.filter(p => p.status !== 'Concluído' && p.status !== 'Cancelado').sort((a, b) => a.timestamp - b.timestamp);
  const pedidosKds = pendentes
    .filter(ped => !(ped.kdsFinalizado && ped.kdsFinalizado[activeKds])) // Oculta se já foi despachado desta praça
    .map(ped => ({ 
      ...ped, 
      itensKds: filterItemsForKDS(ped.itens, activeKds).map((ik: any) => ({
         ...ik,
         concluidoNoKds: ik.kdsStatus ? ik.kdsStatus[activeKds] : false
      }))
    }))
    .filter(ped => ped.itensKds.length > 0); // Exibe apenas se houver itens que passaram no filtro de categoria

  const expandedOrder = expandedKdsOrderId ? pedidosKds.find(p => p.id === expandedKdsOrderId) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!isKdsOnly && (
      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setView('kds')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${view === 'kds' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Modo KDS (Telas)</button>
        <button onClick={() => setView('manual')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${view === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Baixa Avulsa / Manual</button>
      </div>
      )}

      {view === 'kds' && (
        <div className="space-y-6">
          {/* Navegação de Estações (Yooga Style) */}
          {allowedStations.length > 1 && (
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-gray-200">
            {[
              { id: 'Chapa', icon: <Flame size={18} /> },
              { id: 'Char Broiler', icon: <Flame size={18} /> },
              { id: 'Montagem', icon: <ChefHat size={18} /> },
              { id: 'Porção', icon: <UtensilsCrossed size={18} /> },
              { id: 'Balcão', icon: <Coffee size={18} /> },
              { id: 'Expedição', icon: <Package size={18} /> }
            ].filter(s => allowedStations.includes(s.id)).map(station => (
              <button 
                key={station.id}
                onClick={() => setActiveKds(station.id as any)} 
                className={`flex items-center px-5 py-2.5 rounded-t-lg font-bold text-sm transition-colors border-t border-x ${activeKds === station.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
              >
                <span className="mr-2 opacity-80">{station.icon}</span> {station.id}
              </button>
            ))}
          </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center shrink-0"><MonitorPlay className="mr-2 text-indigo-600"/> Tela Ativa: {activeKds} ({pedidosKds.length} pedidos)</h2>
            
            <div className="relative">
              <button 
                onClick={() => setShowFiltrosKds(!showFiltrosKds)}
                className="flex items-center px-4 py-2 text-sm font-bold bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Filter size={16} className="mr-2 text-gray-500" />
                Filtros ({kdsFiltroCategorias.length})
                <ChevronDown size={16} className={`ml-2 text-gray-400 transition-transform ${showFiltrosKds ? 'rotate-180' : ''}`} />
              </button>
              
              {showFiltrosKds && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Categorias Visíveis</span>
                    <button onClick={() => setShowFiltrosKds(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                  </div>
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
                    {categoriasExistentes.map(cat => {
                      const isSelected = kdsFiltroCategorias.includes(cat as string);
                      return (
                        <label key={cat as string} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) setKdsFiltroCategorias(prev => prev.filter(c => c !== cat));
                              else setKdsFiltroCategorias(prev => [...prev, cat as string]);
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className={`text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>{cat as string}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {pedidosKds.map(ped => {
              const timeDiff = Math.floor((currentTime - ped.timestamp) / 60000);
              
              let timeColor = 'bg-green-500 text-white';
              let borderColor = 'border-gray-200';
              if (timeDiff >= 15) { timeColor = 'bg-red-600 text-white animate-pulse'; borderColor = 'border-red-500 ring-2 ring-red-100'; }
              else if (timeDiff >= 10) { timeColor = 'bg-yellow-400 text-yellow-900'; borderColor = 'border-yellow-400'; }

              const allItemsDone = ped.itensKds.every((ik: any) => ik.concluidoNoKds);

              return (
                <div key={ped.id} className={`bg-white rounded-xl shadow-md border-t-4 flex flex-col overflow-hidden transition-all ${borderColor}`}>
                  <div className="p-3 border-b border-gray-100 flex flex-col gap-2 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <span className="font-black text-gray-800 text-lg uppercase tracking-tight leading-none">{ped.identificador}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-800 border border-blue-200`}>{ped.origem || 'PDV'}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs font-bold text-gray-500">{ped.status === 'Em Produção' ? 'Em Produção' : 'Aguardando'}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-sm ${timeColor}`}><Clock size={12} className="mr-1"/> {timeDiff} min</span>
                    </div>
                  </div>
                  <div className="relative flex-1 bg-white flex flex-col">
                    <div className="p-4 space-y-3 overflow-hidden max-h-[180px]">
                    {(ped.status === 'Pendente' || ped.status === 'Novo') ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-4">
                        <AlertTriangle size={36} className="text-yellow-500" />
                        <p className="text-sm font-bold text-gray-700">Nova comanda recebida</p>
                        <button onClick={() => handleAceitarComanda(ped.id)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded-xl font-bold transition-colors w-full shadow-sm">Aceitar Comanda</button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {ped.itensKds.map((item: any, idx: number) => (
                          <div key={idx} className={`border-b border-gray-100 pb-3 last:border-0 last:pb-0 transition-colors ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
                            <div className="flex items-start cursor-pointer group hover:bg-gray-50" onClick={() => toggleItemConcluido(ped.id, item.originalIdx, !!item.concluidoNoKds)}>
                              <button className={`mr-2 mt-0.5 flex-shrink-0 transition-colors ${item.concluidoNoKds ? 'text-green-500' : 'text-gray-300 group-hover:text-blue-400'}`}>{item.concluidoNoKds ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                              <span className={`font-black text-lg w-8 shrink-0 ${item.concluidoNoKds ? 'text-gray-500' : 'text-gray-800'}`}>{item.qtd}x</span>
                              <span className={`font-medium leading-tight pt-0.5 ${item.concluidoNoKds ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.nome}</span>
                            </div>
                            {item.opcoes && (
                              <div className={`text-sm mt-2 pl-10 space-y-2 ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
                                {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && (
                                  <div><span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Tipo de Montagem:</span><ul className="list-disc pl-4 text-gray-700 font-medium">{Object.values(item.opcoes.montagem).map((m:any, i:number)=><li key={i}>{m}</li>)}</ul></div>
                                )}
                                {item.opcoes.pontoCarne && (
                                  <div><span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Ponto da carne:</span><ul className="list-disc pl-4 text-gray-700 font-medium"><li>{item.opcoes.pontoCarne}</li></ul></div>
                                )}
                                {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).length > 0 && (
                                  <div><span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Adicionais:</span><ul className="list-disc pl-4 text-blue-700 font-bold">{Object.values(item.opcoes.adicionais).map((a:any, i:number)=><li key={i}>{a.qtd}x AD/ {a.nome}</li>)}</ul></div>
                                )}
                                {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && (
                                  <div><span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Restrições (Sem):</span><ul className="list-none pl-0 text-red-600 font-bold">{Object.values(item.opcoes.restricoes).map((r:any, i:number)=><li key={i}>- {r}</li>)}</ul></div>
                                )}
                                {item.opcoes.observacao && (
                                  <div><span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider block mb-0.5">Observação Especial:</span><p className="text-gray-800 font-medium italic bg-yellow-50 border border-yellow-200 p-2 rounded-lg">{item.opcoes.observacao}</p></div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    {ped.status !== 'Pendente' && ped.status !== 'Novo' && (
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                    )}
                  </div>
                  <div className="bg-gray-50 px-3 py-2 flex justify-between items-center border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Expandir para ler tudo</span>
                    <button onClick={() => setExpandedKdsOrderId(ped.id)} className="text-xs font-bold text-indigo-600 flex items-center hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md">
                      <Maximize2 size={14} className="mr-1" /> Tela Cheia
                    </button>
                  </div>
                  {(ped.status !== 'Pendente' && ped.status !== 'Novo') && (
                    <button onClick={() => handleProntoKds(ped)} className={`p-4 font-bold text-sm flex items-center justify-center transition-colors ${allItemsDone && activeKds !== 'Expedição' ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' : activeKds === 'Expedição' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                      <CheckCircle size={18} className="mr-2"/> {activeKds === 'Expedição' ? 'Despachar Pedido' : 'Despachar Peça'}
                    </button>
                  )}
                </div>
              );
            })}
            {pedidosKds.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100 border-dashed">
                <UtensilsCrossed size={48} className="mb-4 opacity-30"/>
                <p className="text-lg font-bold">Praça Livre</p>
                <p className="text-sm">Nenhum item aguardando para o setor: {activeKds}</p>
              </div>
            )}
          </div>

          {expandedOrder && (
            <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4 sm:p-8" onClick={() => setExpandedKdsOrderId(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 sm:p-6 bg-gray-100 border-b border-gray-200 flex justify-between items-center shrink-0">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl sm:text-4xl font-black text-gray-900 uppercase tracking-tight">{expandedOrder.identificador}</h2>
                      <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full uppercase bg-blue-100 text-blue-800 border border-blue-200">{expandedOrder.origem || 'PDV'}</span>
                    </div>
                    <p className="text-base font-bold text-gray-600 mt-2">Tela Ativa: {activeKds} • {Math.floor((currentTime - expandedOrder.timestamp) / 60000)} min atrás</p>
                  </div>
                  <button onClick={() => setExpandedKdsOrderId(null)} className="p-3 bg-white shadow-sm hover:bg-gray-50 text-gray-600 rounded-full transition-colors border border-gray-200">
                    <X size={28} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white space-y-6">
                  {expandedOrder.itensKds.map((item: any, idx: number) => (
                    <div key={idx} className={`border-b border-gray-100 pb-6 last:border-0 last:pb-0 transition-colors ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
                      <div className="flex items-start cursor-pointer group hover:bg-gray-50 p-2 rounded-lg" onClick={() => toggleItemConcluido(expandedOrder.id, item.originalIdx, !!item.concluidoNoKds)}>
                        <button className={`mr-4 mt-1 flex-shrink-0 transition-colors ${item.concluidoNoKds ? 'text-green-500' : 'text-gray-300 group-hover:text-blue-400'}`}>
                          {item.concluidoNoKds ? <CheckSquare size={36} /> : <Square size={36} />}
                        </button>
                        <span className={`font-black text-3xl sm:text-4xl w-16 shrink-0 ${item.concluidoNoKds ? 'text-gray-500' : 'text-gray-900'}`}>{item.qtd}x</span>
                        <span className={`font-bold text-2xl sm:text-3xl pt-1 leading-tight ${item.concluidoNoKds ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.nome}</span>
                      </div>
                      {item.opcoes && (
                        <div className={`text-lg sm:text-xl mt-4 pl-20 space-y-3 ${item.concluidoNoKds ? 'opacity-50' : ''}`}>
                          {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && (
                            <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Tipo de Montagem:</span><ul className="list-disc pl-6 text-gray-800 font-bold">{Object.values(item.opcoes.montagem).map((m:any, i:number)=><li key={i}>{m}</li>)}</ul></div>
                          )}
                          {item.opcoes.pontoCarne && (
                            <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Ponto da carne:</span><ul className="list-disc pl-6 text-gray-800 font-bold"><li>{item.opcoes.pontoCarne}</li></ul></div>
                          )}
                          {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).length > 0 && (
                            <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Adicionais:</span><ul className="list-disc pl-6 text-blue-700 font-black">{Object.values(item.opcoes.adicionais).map((a:any, i:number)=><li key={i}>{a.qtd}x AD/ {a.nome}</li>)}</ul></div>
                          )}
                          {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && (
                            <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Restrições (Sem):</span><ul className="list-none pl-0 text-red-600 font-black">{Object.values(item.opcoes.restricoes).map((r:any, i:number)=><li key={i}>- {r}</li>)}</ul></div>
                          )}
                          {item.opcoes.observacao && (
                            <div><span className="font-bold text-gray-500 text-sm sm:text-base uppercase tracking-wider block mb-1">Observação Especial:</span><p className="text-gray-900 font-bold italic bg-yellow-50 border border-yellow-300 p-4 rounded-xl">{item.opcoes.observacao}</p></div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-100 shrink-0">
                  <button onClick={() => { if (expandedOrder.status !== 'Pendente' && expandedOrder.status !== 'Novo') { const allItemsDoneExpanded = expandedOrder.itensKds.every((ik: any) => ik.concluidoNoKds); handleProntoKds(expandedOrder); if (activeKds === 'Expedição' || allItemsDoneExpanded) { setExpandedKdsOrderId(null); } } }} disabled={expandedOrder.status === 'Pendente' || expandedOrder.status === 'Novo'} className={`w-full py-4 sm:py-5 font-black text-xl sm:text-2xl rounded-xl flex items-center justify-center transition-colors shadow-md ${expandedOrder.status === 'Pendente' || expandedOrder.status === 'Novo' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : activeKds === 'Expedição' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    <CheckCircle size={28} className="mr-3"/> {activeKds === 'Expedição' ? 'Despachar Pedido' : 'Despachar Peça'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select 
              value={filtroCategoria} 
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white w-full sm:w-auto"
            >
              <option value="">Todas as Categorias</option>
              {categoriasExistentes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
            </select>
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