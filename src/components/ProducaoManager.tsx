import { useState, useEffect, useRef } from 'react';
import { ref, onValue, runTransaction, update } from 'firebase/database';
import { db } from '../firebase';
import { Produto, Promocao } from '../types';
import { CheckCircle, ChefHat, Search, AlertTriangle, Clock, Flame, UtensilsCrossed, Package, Coffee, CheckSquare, Square, MonitorPlay, Filter, ChevronDown, X, Maximize2, Gift, MapPin, CreditCard, Phone } from 'lucide-react';
import ExpandedOrderModal from './modals/ExpandedOrderModal';

export default function ProducaoManager({ currentUser }: { currentUser?: any }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  const [categoriasDb, setCategoriasDb] = useState<any[]>([]);
  const [pedidosLoaded, setPedidosLoaded] = useState(false);
  const [kdsFiltroCategorias, setKdsFiltroCategorias] = useState<string[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showFiltrosKds, setShowFiltrosKds] = useState(false);
  const [expandedKdsOrderId, setExpandedKdsOrderId] = useState<string | null>(null);
  const isUpdatingFiltersRef = useRef(false);

  const cargos = currentUser ? (Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || '']) : [];
  const kdsRoles = cargos.filter((c: string) => c.toUpperCase().includes('KDS'));

  // Extrai apenas as telas que este funcionário KDS tem acesso (ex: "KDS Chapa" -> "Chapa")
  const allowedStations = kdsRoles.length > 0 
    ? kdsRoles.map((r: string) => r.replace(/KDS\s+/i, '').trim())
    : ['Chapa', 'Char Broiler', 'Montagem', 'Porção', 'Balcão', 'Expedição'];

  const [activeKds, setActiveKds] = useState<any>(() => {
    const saved = localStorage.getItem('arttburger_activeKds');
    if (saved && allowedStations.includes(saved)) return saved;
    return allowedStations[0] || 'Montagem';
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const kdsRef = ref(db, `funcionarios/${currentUser.id}/preferenciasKds/activeKds`);
    const unsub = onValue(kdsRef, (snap) => {
      const savedKds = snap.val();
      if (savedKds && allowedStations.includes(savedKds)) {
        setActiveKds(savedKds);
      } else if (!allowedStations.includes(activeKds)) {
        setActiveKds(allowedStations[0] || 'Montagem');
      }
      unsub();
    });
    return () => unsub();
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id && activeKds) {
      update(ref(db, `funcionarios/${currentUser.id}/preferenciasKds`), { activeKds });
    }
  }, [activeKds, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !activeKds) return;
    
    isUpdatingFiltersRef.current = true;

    const filtrosRef = ref(db, `funcionarios/${currentUser.id}/preferenciasKds/filtros/${activeKds}`);
    const unsub = onValue(filtrosRef, (snap) => {
      const savedFiltersStr = snap.val();
      if (savedFiltersStr) {
        if (savedFiltersStr === 'VAZIO') setKdsFiltroCategorias([]);
        else setKdsFiltroCategorias(savedFiltersStr.split(','));
      } else {
        let defaults: string[] = [];
        switch (activeKds) {
          case 'Expedição': defaults = ['Hambúrguer', 'Promoção / Combo', 'Porção']; break;
          case 'Chapa': case 'Char Broiler': case 'Montagem': defaults = ['Hambúrguer', 'Promoção / Combo']; break;
          case 'Porção': defaults = ['Porção']; break;
          case 'Balcão': defaults = ['Bebida', 'Sobremesa', 'Outros']; break;
        }
        setKdsFiltroCategorias(defaults);
      }
      setTimeout(() => { isUpdatingFiltersRef.current = false; }, 300);
      unsub();
    });
    return () => unsub();
  }, [activeKds, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id && activeKds && !isUpdatingFiltersRef.current) {
      const filtersStr = kdsFiltroCategorias.length === 0 ? 'VAZIO' : kdsFiltroCategorias.join(',');
      update(ref(db, `funcionarios/${currentUser.id}/preferenciasKds/filtros`), { [activeKds]: filtersStr });
    }
  }, [kdsFiltroCategorias, activeKds, currentUser?.id]);

  useEffect(() => {
    const produtosRef = ref(db, 'produtos');
    const pedidosRef = ref(db, 'pedidos_cozinha');

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
      setPedidosLoaded(true);
    });

    const catRef = ref(db, 'categorias_produtos');
    const unsubCat = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategoriasDb(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setCategoriasDb([]);
      }
    });

    return () => {
      unsubProdutos();
      unsubPromocoes();
      unsubPedidos();
      unsubCat();
    };
  }, []);

  const handleFinalizarPedido = async (pedido: any) => {
    try {

      await update(ref(db, `pedidos_cozinha/${pedido.id}`), { status: 'Concluído', finalizadoEm: Date.now() });
      
      if (pedido.referenciaId) {
        const path = pedido.tipo === 'Entrega' ? `entregas_abertas/${pedido.referenciaId}` : `mesas_abertas/${pedido.referenciaId}`;
        await runTransaction(ref(db, path), (data) => {
          if (data && data.carrinho) {
            pedido.itens.forEach((pItem: any) => {
              if (pItem.cartItemId && data.carrinho[pItem.cartItemId]) {
                data.carrinho[pItem.cartItemId].concluidoCozinha = (data.carrinho[pItem.cartItemId].concluidoCozinha || 0) + pItem.qtd;
              } else {
                 const cItem = Object.values(data.carrinho).find((c: any) => c.nome === pItem.nome && c.qtd >= pItem.qtd);
                 if (cItem) {
                    (cItem as any).concluidoCozinha = ((cItem as any).concluidoCozinha || 0) + pItem.qtd;
                 }
              }
            });
          }
          return data;
        });
      }

      showToast('Pedido finalizado e enviado para a mesa/balcão!', 'success');
    } catch (error) {
      showToast('Erro ao finalizar pedido.', 'error');
    }
  };

  const allItems: any[] = [
    ...produtos,
    ...promocoes.map(p => ({ ...p, categoria: 'Promoção / Combo' }))
  ];

  // Agora a lista de filtros do KDS inclui todas as categorias do banco, mesmo vazias,
  // e também as categorias antigas/existentes nos produtos atuais.
  const categoriasExistentes = Array.from(new Set([
    ...categoriasDb.map(c => String(c.nome).trim()),
    ...allItems.map(p => String(p.categoria || 'Outros').trim())
  ])).sort();

  // Mapeia categorias para seus respectivos setores do KDS
  const filterItemsForKDS = (itens: any[], kds: string) => {
    const filtrosAtivos = kdsFiltroCategorias;
    
    if (filtrosAtivos.length === 0) return [];

    console.debug('[ProducaoManager] filtro KDS', {
      activeKds: kds,
      filtrosAtivos,
      filtrosSelecionados: kdsFiltroCategorias,
      categoriasExistentes,
      itensCount: itens.length,
      produtosCount: allItems.length,
    });

    return itens.map((item, idx) => ({ ...item, originalIdx: idx })).filter(item => {
      const prod = allItems.find(p => p.id === item.produtoId || (item.cartItemId && item.cartItemId.startsWith(p.id + '_')) || (item.produtoId && item.produtoId.startsWith(p.id + '_')) || p.nome === item.nome);
      
      const catNorm = String(prod ? (prod.categoria || 'Outros') : (item.categoria || 'Outros')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      
      return filtrosAtivos.some(f => {
        const fNorm = String(f).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        
        if (fNorm.includes('hamburguer') && ['hamburguer', 'lanche', 'sanduiche', 'burger'].some(alias => catNorm.includes(alias))) return true;
        if (fNorm.includes('bebida') && ['bebida', 'suco', 'refrigerante'].some(alias => catNorm.includes(alias))) return true;
        if (fNorm.includes('porcao') && ['porcao', 'batata', 'frita'].some(alias => catNorm.includes(alias))) return true;
        if (fNorm.includes('sobremesa') && ['sobremesa', 'doce', 'sorvete'].some(alias => catNorm.includes(alias))) return true;
        if (fNorm.includes('promocao') && ['promocao', 'combo'].some(alias => catNorm.includes(alias))) return true;

        return catNorm === fNorm || catNorm.includes(fNorm) || fNorm.includes(catNorm);
      });
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
    await update(ref(db, `pedidos_cozinha/${pedidoId}/kdsAceito`), { [activeKds]: true });
    // Marca globalmente como Em Produção somente na primeira aceitação (para outras telas)
    const pedido = pedidosCozinha.find(p => p.id === pedidoId);
    if (pedido?.status === 'Pendente' || pedido?.status === 'Novo') {
      await update(ref(db, `pedidos_cozinha/${pedidoId}`), { status: 'Em Produção', aceitoEm: Date.now() });
    }
    showToast(`${activeKds}: Comanda aceita!`, 'success');
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

  const priorityOrder = ['Hambúrguer', 'Promoção / Combo', 'Porção', 'Bebida', 'Sobremesa', 'Outros'];
  const sortedCategorias = [...categoriasExistentes].sort((a, b) => {
    const idxA = priorityOrder.indexOf(String(a));
    const idxB = priorityOrder.indexOf(String(b));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return String(a).localeCompare(String(b));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setKdsFiltroCategorias(categoriasExistentes.map(c => String(c)))} className="flex-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Marcar Todos
                    </button>
                    <button onClick={() => setKdsFiltroCategorias([])} className="flex-1 bg-gray-100 text-gray-600 hover:bg-gray-200 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      Limpar
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
                    {sortedCategorias.map(cat => {
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

          <div className="grid grid-rows-1 lg:grid-rows-2 grid-flow-col gap-4 overflow-x-auto pb-6 auto-cols-[90vw] sm:auto-cols-[340px] items-start min-h-[50vh] snap-x snap-mandatory [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            {pedidosKds.map(ped => {
              const timeDiff = Math.floor((currentTime - (ped.inicioPrazoEntrega || ped.timestamp)) / 60000);
              
              let timeColor = 'bg-green-500 text-white';
              let borderColor = 'border-gray-200';
              if (timeDiff >= 25) { timeColor = 'bg-red-600 text-white animate-pulse'; borderColor = 'border-red-500 ring-2 ring-red-100'; }
              else if (timeDiff >= 20) { timeColor = 'bg-yellow-400 text-yellow-900'; borderColor = 'border-yellow-400'; }

              const temRecompensa = (ped.recompensasResgatadas?.length || 0) > 0;
              if (temRecompensa && timeDiff < 20) borderColor = 'border-green-500 ring-2 ring-green-100';

              const allItemsDone = ped.itensKds.every((ik: any) => ik.concluidoNoKds);

              return (
                <div key={ped.id} className={`bg-white rounded-xl shadow-md border-t-4 flex flex-col overflow-hidden transition-all ${borderColor} snap-start`}>
                  <div className={`p-3 border-b border-gray-100 flex flex-col gap-2 ${temRecompensa ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start">
                      <span className="font-black text-gray-800 text-lg uppercase tracking-tight leading-none">{ped.identificador}</span>
                      <div className="flex items-center gap-1">
                        {temRecompensa && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-green-100 text-green-800 border border-green-200 flex items-center gap-1"><Gift size={10}/> Recompensa</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-800 border border-blue-200`}>{ped.origem || 'PDV'}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs font-bold text-gray-500">{ped.kdsAceito?.[activeKds] ? 'Em Produção' : 'Aguardando'}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-sm ${timeColor}`}><Clock size={12} className="mr-1"/> {timeDiff} min</span>
                    </div>
                    {activeKds === 'Expedição' && (
                      <div className="flex gap-2 mt-1 pt-2 border-t border-gray-200/60">
                        {['Chapa', 'Montagem'].map(praca => {
                          const hasItems = ped.itens.some((item: any) => {
                            const prod = allItems.find(p => p.id === item.produtoId || p.nome === item.nome);
                            const catNorm = String(prod ? (prod.categoria || 'Outros') : (item.categoria || 'Outros')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                            return ['hamburguer', 'lanche', 'sanduiche', 'burger', 'promocao', 'combo'].some(alias => catNorm.includes(alias));
                          });
                          
                          if (!hasItems && !ped.kdsAceito?.[praca] && !ped.kdsFinalizado?.[praca]) return null;

                          const isFinalizado = ped.kdsFinalizado?.[praca];
                          const isAceito = ped.kdsAceito?.[praca];

                          let statusText = 'Pendente';
                          let statusColor = 'bg-gray-100 text-gray-500 border border-gray-200';
                          
                          if (isFinalizado) {
                            statusText = 'Pronto';
                            statusColor = 'bg-green-50 text-green-700 border border-green-200';
                          } else if (isAceito) {
                            statusText = 'Fazendo';
                            statusColor = 'bg-blue-50 text-blue-700 border border-blue-200';
                          }

                          return (
                            <div key={praca} className={`flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
                              {isFinalizado ? <CheckCircle size={10} className="mr-1"/> : isAceito ? <ChefHat size={10} className="mr-1"/> : <Clock size={10} className="mr-1"/>}
                              {praca}: {statusText}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {ped.tipo === 'Entrega' && (ped.enderecoEntrega || ped.formaPagamento || ped.clienteTelefone || ped.valorTotal !== undefined || ped.isRetirada) && (
                      <div className="mt-1 pt-2 border-t border-gray-200/60 text-[11px] font-bold text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          {ped.isRetirada ? (
                            <span className="flex items-center gap-1 truncate min-w-0">
                              <Package size={11} className="shrink-0 text-gray-400"/>
                              <span className="truncate">Retirada no Balcão</span>
                            </span>
                          ) : ped.enderecoEntrega && (
                            <span className="flex items-center gap-1 truncate min-w-0">
                              <MapPin size={11} className="shrink-0 text-gray-400"/>
                              <span className="truncate">{ped.enderecoEntrega.logradouro}, {ped.enderecoEntrega.numero}{ped.enderecoEntrega.bairro ? ` - ${ped.enderecoEntrega.bairro}` : ''}</span>
                            </span>
                          )}
                          {ped.clienteTelefone && (
                            <span className="flex items-center gap-1 shrink-0 ml-auto">
                              <Phone size={11} className="text-gray-400"/> {ped.clienteTelefone}
                            </span>
                          )}
                        </div>
                        {(ped.formaPagamento || ped.valorTotal !== undefined) && (
                          <div className="flex items-center gap-2">
                            {ped.formaPagamento && (
                              <span className="flex items-center gap-1 truncate min-w-0">
                                <CreditCard size={11} className="text-gray-400"/> {ped.formaPagamento}
                              </span>
                            )}
                            {ped.valorTotal !== undefined && (
                              <span className="shrink-0 ml-auto">
                                Total: R$ {Number(ped.valorTotal).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1 bg-white flex flex-col">
                    <div className="p-4 space-y-3 overflow-hidden max-h-[180px]">
                    {!ped.kdsAceito?.[activeKds] ? (
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
                  {ped.kdsAceito?.[activeKds] && (
                    <button onClick={() => handleProntoKds(ped)} className={`p-4 font-bold text-sm flex items-center justify-center transition-colors ${allItemsDone && activeKds !== 'Expedição' ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' : activeKds === 'Expedição' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                      <CheckCircle size={18} className="mr-2"/> {activeKds === 'Expedição' ? 'Despachar Pedido' : 'Despachar Peça'}
                    </button>
                  )}
                </div>
              );
            })}
            {pedidosKds.length === 0 && (
              <div className="w-[85vw] lg:w-[600px] py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100 border-dashed h-fit">
                <UtensilsCrossed size={48} className="mb-4 opacity-30"/>
                <p className="text-lg font-bold">Praça Livre</p>
                <p className="text-sm">Nenhum item aguardando para o setor: {activeKds}</p>
              </div>
            )}
          </div>

          <ExpandedOrderModal
            expandedOrder={expandedOrder}
            onClose={() => setExpandedKdsOrderId(null)}
            activeKds={activeKds}
            currentTime={currentTime}
            toggleItemConcluido={toggleItemConcluido}
            onAceitarComanda={handleAceitarComanda}
            onPronto={handleProntoKds}
          />
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