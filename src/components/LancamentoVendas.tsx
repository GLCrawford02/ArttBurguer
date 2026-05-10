import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Calculator, CheckCircle, Trash2, AlertTriangle, ArrowRightLeft, Plus, Minus, X, Search, ShoppingCart, Store, User, CreditCard, Receipt, ArrowLeft, Save, Truck, Flame, Pencil } from 'lucide-react';

export default function LancamentoVendas({ currentUser }: { currentUser?: any }) {
  const [activeView, setActiveView] = useState<'pdv' | 'conferencia'>('pdv');
  
  const [taxas, setTaxas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [vendasPdv, setVendasPdv] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);

  const [pdvItemModal, setPdvItemModal] = useState<any>(null);
  const [pdvItemOptions, setPdvItemOptions] = useState<any>({
    montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1
  });


  const [pdvView, setPdvView] = useState<'mapa' | 'caixa'>('mapa');
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null);
  const [mesasAbertas, setMesasAbertas] = useState<Record<string, any>>({});
  const [qtdMesas, setQtdMesas] = useState(30);

  const [pdvCarrinho, setPdvCarrinho] = useState<Record<string, { produtoId?: string, nome: string, preco: number, qtd: number, enviadoCozinha?: number, opcoes?: any }>>({});
  const [pdvPagamentos, setPdvPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [pdvDescricao, setPdvDescricao] = useState('');
  const [pdvSearchProd, setPdvSearchProd] = useState('');
  const [pdvSearchCliente, setPdvSearchCliente] = useState('');
  const [pdvCliente, setPdvCliente] = useState<any | null>(null);
  const [pdvTipoPedido, setPdvTipoPedido] = useState<'Balcão' | 'Entrega' | 'Mesa'>('Balcão');


  const [showConfModal, setShowConfModal] = useState(false);
  const [editConfId, setEditConfId] = useState<string | null>(null);
  const [confCarrinho, setConfCarrinho] = useState<Record<string, { nome: string, preco: number, qtd: number }>>({});
  const [confPagamentos, setConfPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [confDescricao, setConfDescricao] = useState('');
  const [confSearchProd, setConfSearchProd] = useState('');

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isAdminOrGerente = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Gerente' || c === 'Dono')
      : currentUser.cargo === 'Administrador' || currentUser.cargo === 'Gerente' || currentUser.cargo === 'Dono'
  );

  useEffect(() => {
    if (!isAdminOrGerente) setActiveView('pdv');
  }, [isAdminOrGerente]);

  useEffect(() => {
    const taxasRef = ref(db, 'taxas_cartoes');
    onValue(taxasRef, snap => {
      if (snap.val()) setTaxas(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setTaxas([]);
    });

    const lancamentosRef = ref(db, 'lancamentos_vendas');
    onValue(lancamentosRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setLancamentos(list);
      } else setLancamentos([]);
    });

    const vendasPdvRef = ref(db, 'vendas_pdv');
    onValue(vendasPdvRef, snap => {
      if (snap.val()) setVendasPdv(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setVendasPdv([]);
    });

    const prodRef = ref(db, 'produtos');
    onValue(prodRef, snap => {
      if (snap.val()) setProdutos(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setProdutos([]);
    });

    const promoRef = ref(db, 'promocoes');
    onValue(promoRef, snap => {
      if (snap.val()) setPromocoes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setPromocoes([]);
    });

    const clientesRef = ref(db, 'clientes');
    onValue(clientesRef, snap => {
      if (snap.val()) setClientes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setClientes([]);
    });

    const insumosRef = ref(db, 'insumos');
    onValue(insumosRef, snap => {
      if (snap.val()) setInsumos(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setInsumos([]);
    });

    const mesasRef = ref(db, 'mesas_abertas');
    onValue(mesasRef, snap => setMesasAbertas(snap.val() || {}));

    const configMesasRef = ref(db, 'configuracoes/pdv/qtdMesas');
    onValue(configMesasRef, snap => {
      if (snap.val()) setQtdMesas(Number(snap.val()));
    });
  }, []);

  const taxasComPadroes = [
    { id: 'pix', nome: 'Pix', percentual: 0 },
    { id: 'dinheiro', nome: 'Dinheiro', percentual: 0 },
    ...taxas
  ];


  const totalPdv = Object.values(pdvCarrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const pagoPdv = pdvPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const restantePdv = totalPdv - pagoPdv;

  useEffect(() => {
    if (pdvPagamentos.length === 1 && totalPdv > 0) setPdvPagamentos([{ ...pdvPagamentos[0], valor: totalPdv }]);
    else if (totalPdv === 0) setPdvPagamentos([{ taxaId: pdvPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalPdv]);


  const totalConf = Object.values(confCarrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const pagoConf = confPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const restanteConf = totalConf - pagoConf;

  useEffect(() => {
    if (confPagamentos.length === 1 && totalConf > 0) setConfPagamentos([{ ...confPagamentos[0], valor: totalConf }]);
    else if (totalConf === 0) setConfPagamentos([{ taxaId: confPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalConf]);

  const updateCartItemQtd = (cartItemId: string, delta: number) => {
    setPdvCarrinho((prev: any) => {
      const current = prev[cartItemId];
      if (!current) return prev;
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) { const { [cartItemId]: _, ...rest } = prev; return rest; }
      let newEnviado = current.enviadoCozinha || 0;
      if (newQtd < newEnviado) newEnviado = newQtd;
      return { ...prev, [cartItemId]: { ...current, qtd: newQtd, enviadoCozinha: newEnviado } };
    });
  };

  const updateCart = (setter: any, id: string, nome: string, preco: number, delta: number) => {
    setter((prev: any) => {
      const current = prev[id] || { nome, preco, qtd: 0, enviadoCozinha: 0 };
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) { const { [id]: _, ...rest } = prev; return rest; }
      let newEnviado = current.enviadoCozinha || 0;
      if (newQtd < newEnviado) newEnviado = newQtd;
      return { ...prev, [id]: { ...current, qtd: newQtd, enviadoCozinha: newEnviado } };
    });
  };

  const dispararParaCozinha = async (identificador: string, tipo: string) => {
    const itensParaEnviar = Object.entries(pdvCarrinho)
      .filter(([id, item]) => item.qtd > (item.enviadoCozinha || 0))
      .map(([id, item]) => ({
        produtoId: item.produtoId || id,
        nome: item.nome,
        qtd: item.qtd - (item.enviadoCozinha || 0),
        opcoes: item.opcoes || null
      }));

    const novoCarrinho: any = {};
    Object.keys(pdvCarrinho).forEach(id => {
      novoCarrinho[id] = { ...pdvCarrinho[id], enviadoCozinha: pdvCarrinho[id].qtd };
    });

    if (itensParaEnviar.length > 0) {
      await set(push(ref(db, 'pedidos_cozinha')), {
        identificador, tipo, itens: itensParaEnviar, status: 'Pendente', timestamp: Date.now()
      });
    }

    return novoCarrinho;
  };

  const handlePagamentoChange = (setter: any, stateList: any[], index: number, field: string, value: any) => {
    const novos = [...stateList];
    novos[index] = { ...novos[index], [field]: value };
    setter(novos);
  };

  const handleAbrirMesa = (numero: number) => {
    setMesaSelecionada(numero);
    setPdvTipoPedido('Mesa');
    const mesaData = mesasAbertas[`mesa_${numero}`] || mesasAbertas[numero];
    if (mesaData) {
      setPdvCarrinho(mesaData.carrinho || {});
    } else {
      setPdvCarrinho({});
    }
    setPdvView('caixa');
  };

  const handleSalvarMesa = async () => {
    if (Object.keys(pdvCarrinho).length === 0) {
      await remove(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`));
      await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
      showToast(`Mesa ${mesaSelecionada} liberada!`, 'success');
    } else {
      const novoCarrinho = await dispararParaCozinha(`Mesa ${mesaSelecionada}`, 'Mesa');
      await set(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`), {
        carrinho: novoCarrinho,
        timestamp: Date.now()
      });
      await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
      showToast(`Pedido salvo na Mesa ${mesaSelecionada}!`, 'success');
    }
    setPdvView('mapa');
  };

  const handleOpenPdvItemModal = (item: any) => {
    setPdvItemModal(item);
    setPdvItemOptions({
      montagem: [],
      pontoCarne: '',
      adicionais: {},
      restricoes: [],
      observacao: '',
      quantidade: 1
    });
  };

  const handleAddPdvItem = () => {
    let basePrice = Number(pdvItemModal.precoVenda || 0);
    let adicionaisPrice = 0;
    const adicionaisDoProduto = pdvItemModal.opcoes?.adicionais || [];
    
    Object.entries(pdvItemOptions.adicionais).forEach(([addId, qtd]: [string, any]) => {
       const add = adicionaisDoProduto.find((a: any) => a.id === addId);
       if (add) adicionaisPrice += Number(add.preco || 0) * qtd;
    });
    
    const unitPrice = basePrice + adicionaisPrice;
    const cartItemId = `${pdvItemModal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const hasOptions = pdvItemOptions.montagem.length > 0 || pdvItemOptions.pontoCarne || Object.keys(pdvItemOptions.adicionais).length > 0 || pdvItemOptions.restricoes.length > 0 || pdvItemOptions.observacao;
  
    const opcoesObj = hasOptions ? {
      montagem: pdvItemOptions.montagem,
      pontoCarne: pdvItemOptions.pontoCarne,
      adicionais: Object.entries(pdvItemOptions.adicionais).map(([addId, qtd]: [string, any]) => {
        const add = adicionaisDoProduto.find((a: any) => a.id === addId);
        return { id: add?.id, nome: add?.nome, qtd, preco: Number(add?.preco || 0) };
      }),
      restricoes: pdvItemOptions.restricoes,
      observacao: pdvItemOptions.observacao
    } : null;
  
    setPdvCarrinho(prev => ({
      ...prev,
      [cartItemId]: {
        produtoId: pdvItemModal.id,
        nome: pdvItemModal.nome,
        preco: unitPrice,
        qtd: pdvItemOptions.quantidade,
        opcoes: opcoesObj,
        enviadoCozinha: 0
      }
    }));
    
    setPdvItemModal(null);
  };

  const handlePdvSalvar = async () => {
    if (totalPdv <= 0) return showToast('Adicione produtos à venda.', 'error');
    const pagamentosValidos = pdvPagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (pagamentosValidos.length === 0) return showToast('Informe uma forma de pagamento.', 'error');
    if (Math.abs(restantePdv) > 0.05) return showToast(`O valor pago deve ser exatamente R$ ${totalPdv.toFixed(2)}.`, 'error');
    if (pdvTipoPedido === 'Entrega' && !pdvCliente) return showToast('Para entregas, é obrigatório selecionar o cliente.', 'error');

    let valorLiquidoTotal = 0;
    const pagamentosProcessados = pagamentosValidos.map(p => {
      const taxa = taxasComPadroes.find(t => t.id === p.taxaId);
      const perc = taxa ? Number(taxa.percentual || 0) : 0;
      const liq = Number(p.valor) - (Number(p.valor) * (perc / 100));
      valorLiquidoTotal += liq;
      return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
    });

    let custoPedido = 0;
    Object.entries(pdvCarrinho).forEach(([id, item]) => {
      const prod = produtos.find(p => p.id === item.produtoId) || promocoes.find(p => p.id === item.produtoId);
      if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
    });
    valorLiquidoTotal -= custoPedido;

    let ident = 'Balcão';
    if (pdvTipoPedido === 'Entrega') ident = `Delivery: ${pdvCliente?.nome || ''}`;
    else if (pdvTipoPedido === 'Mesa') ident = `Mesa ${mesaSelecionada}`;
    else if (pdvCliente) ident = `Balcão: ${pdvCliente.nome}`;
    await dispararParaCozinha(ident, pdvTipoPedido);

    await set(push(ref(db, 'vendas_pdv')), {
      valor: totalPdv,
      valorLiquido: valorLiquidoTotal,
      pagamentos: pagamentosProcessados,
      taxaId: pagamentosProcessados[0].taxaId,
      nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : pagamentosProcessados[0].nomeTaxa,
      descricao: pdvDescricao || 'Venda Balcão',
      clienteId: pdvCliente?.id || null,
      clienteNome: pdvCliente?.nome || 'Cliente Balcão',
      itens: Object.entries(pdvCarrinho).map(([id, item]) => ({ id, ...item })),
      tipoPedido: pdvTipoPedido,
      mesa: pdvTipoPedido === 'Mesa' ? mesaSelecionada : null,
      statusEntrega: pdvTipoPedido === 'Entrega' ? 'Pendente' : null,
      timestamp: Date.now()
    });

    if (pdvCliente) {
      const ultimos = pdvCliente.ultimosPedidos || [];
      const novoPedido = { data: Date.now(), total: totalPdv, itens: Object.values(pdvCarrinho).map((i: any) => `${i.qtd}x ${i.nome}`) };
      const atualizados = [novoPedido, ...ultimos].slice(0, 5);
      await update(ref(db, `clientes/${pdvCliente.id}`), { ultimosPedidos: atualizados });
    }

    if (pdvTipoPedido === 'Mesa' && mesaSelecionada) {
      await remove(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`));
      await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
    }

    setPdvCarrinho({}); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvCliente(null); setPdvTipoPedido('Balcão');
    setPdvView('mapa');
    showToast('Venda finalizada com sucesso!', 'success');
  };

  const handleConfSalvar = async () => {
    if (totalConf <= 0) return showToast('Adicione produtos ao lançamento.', 'error');
    const pagamentosValidos = confPagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (pagamentosValidos.length === 0) return showToast('Selecione a forma de pagamento.', 'error');
    if (Math.abs(restanteConf) > 0.05) return showToast(`O valor pago deve ser exatamente igual ao total.`, 'error');

    let valorLiquidoTotal = 0;
    const pagamentosProcessados = pagamentosValidos.map(p => {
      const taxa = taxasComPadroes.find(t => t.id === p.taxaId);
      const perc = taxa ? Number(taxa.percentual || 0) : 0;
      const liq = Number(p.valor) - (Number(p.valor) * (perc / 100));
      valorLiquidoTotal += liq;
      return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
    });

    let custoPedido = 0;
    Object.entries(confCarrinho).forEach(([id, item]) => {
      const prod = produtos.find(p => p.id === id) || promocoes.find(p => p.id === id);
      if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
    });
    valorLiquidoTotal -= custoPedido;

    const lancamentoData = {
      valor: totalConf,
      valorLiquido: valorLiquidoTotal,
      pagamentos: pagamentosProcessados,
      taxaId: pagamentosProcessados[0].taxaId,
      nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : pagamentosProcessados[0].nomeTaxa,
      descricao: confDescricao || 'Simulação Avulsa',
      itens: Object.entries(confCarrinho).map(([id, item]) => ({ id, ...item })),
      timestamp: editConfId ? (lancamentos.find(l => l.id === editConfId)?.timestamp || Date.now()) : Date.now()
    };

    if (editConfId) {
      await update(ref(db, `lancamentos_vendas/${editConfId}`), lancamentoData);
      showToast('Conferência atualizada com sucesso!', 'success');
    } else {
      await set(push(ref(db, 'lancamentos_vendas')), lancamentoData);
      showToast('Conferência registrada com sucesso!', 'success');
    }

    setConfCarrinho({}); setConfDescricao(''); setConfPagamentos([{ taxaId: '', valor: 0 }]); setShowConfModal(false); setEditConfId(null);
  };

  const handleEditConf = (l: any) => {
    setEditConfId(l.id);
    setConfDescricao(l.descricao || '');
    
    const restoredCarrinho: Record<string, any> = {};
    if (l.itens && Array.isArray(l.itens)) {
      l.itens.forEach((i: any) => restoredCarrinho[i.id] = { nome: i.nome, preco: i.preco || 0, qtd: i.qtd || 1 });
    }
    setConfCarrinho(restoredCarrinho);
    
    if (l.pagamentos && Array.isArray(l.pagamentos)) {
      setConfPagamentos(l.pagamentos.map((p: any) => ({ taxaId: p.taxaId, valor: p.valor })));
    } else {
      setConfPagamentos([{ taxaId: l.taxaId || '', valor: l.valor || 0 }]);
    }
    
    setShowConfModal(true);
  };

  const calcularConferencia = () => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();

    const lancamentosHoje = lancamentos.filter(l => l.timestamp >= inicioHoje).sort((a, b) => b.timestamp - a.timestamp);

    const vendasHoje = vendasPdv.filter(v => v.timestamp >= inicioHoje);

    const totalLancado = lancamentosHoje.reduce((acc, l) => acc + l.valor, 0);
    const totalLiquido = lancamentosHoje.reduce((acc, l) => acc + l.valorLiquido, 0);
    const totalSistema = vendasHoje.reduce((acc, v) => acc + v.valor, 0);
    const diferenca = totalLancado - totalSistema;

    return { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje };
  };
  const { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje } = calcularConferencia();

  const todosItens = [...produtos.map(p => ({ ...p, tipoItem: 'Produto' })), ...promocoes.map(p => ({ ...p, tipoItem: 'Promoção' }))];
  
  const pdvFilteredItems = todosItens.filter(i => {
    const nome = i.nome || '';
    if (!nome.toLowerCase().includes(pdvSearchProd.toLowerCase())) return false;
    const nomeTrimmed = nome.trimStart();
    if (pdvTipoPedido === 'Entrega' && nomeTrimmed.startsWith('%')) return false;
    if (pdvTipoPedido !== 'Entrega' && nomeTrimmed.startsWith('/')) return false;
    return true;
  });
  const confFilteredItems = todosItens.filter(i => (i.nome || '').toLowerCase().includes(confSearchProd.toLowerCase()));
  const pdvFilteredClientes = clientes.filter(c => (c.nome || '').toLowerCase().includes(pdvSearchCliente.toLowerCase()) || (c.telefone || '').includes(pdvSearchCliente));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-green-100 p-3 rounded-xl mr-4 text-green-600">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Caixa e Vendas</h3>
            <p className="text-sm text-gray-500">Ponto de Venda Oficial e Módulo de Conferência Financeira.</p>
          </div>
        </div>
        
        {isAdminOrGerente && (
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('pdv')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${activeView === 'pdv' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Frente de Caixa (PDV)</button>
            <button onClick={() => setActiveView('conferencia')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'conferencia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Calculator size={16} className="mr-1"/> Conferência (Admin)</button>
          </div>
        )}
      </div>

      {activeView === 'pdv' && pdvView === 'mapa' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in duration-300 min-h-[600px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center"><Store className="mr-2 text-green-600"/> Controle de Mesas e Pedidos</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => { setMesaSelecionada(null); setPdvTipoPedido('Balcão'); setPdvCarrinho({}); setPdvCliente(null); setPdvView('caixa'); }} className="flex-1 sm:flex-none bg-gray-800 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm flex items-center justify-center">
                <Store size={18} className="mr-2" /> Venda Balcão
              </button>
              <button onClick={() => { setMesaSelecionada(null); setPdvTipoPedido('Entrega'); setPdvCarrinho({}); setPdvCliente(null); setPdvView('caixa'); }} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center">
                <Truck size={18} className="mr-2" /> Novo Delivery
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {Array.from({length: qtdMesas}).map((_, i) => {
              const num = i + 1;
              const isAberta = mesasAbertas[`mesa_${num}`] || mesasAbertas[num];
              const total = isAberta ? Object.values(isAberta.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) : 0;
              return (
                <button key={num} onClick={() => handleAbrirMesa(num)} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all h-24 ${isAberta ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-green-500 hover:text-green-600 hover:bg-green-50'}`}>
                  <span className="text-2xl font-black leading-none">{num}</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold mt-2">{isAberta ? `R$ ${total.toFixed(2)}` : 'Livre'}</span>
                </button>
              );
            })}
            <button onClick={() => set(ref(db, 'configuracoes/pdv/qtdMesas'), qtdMesas + 1)} className="p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 hover:bg-gray-50 flex flex-col items-center justify-center transition-all h-24">
              <Plus size={24} />
              <span className="text-[10px] uppercase tracking-wider font-bold mt-2">Adicionar</span>
            </button>
          </div>
        </div>
      )}

      {activeView === 'pdv' && pdvView === 'caixa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-left-4 duration-300">
          <div className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[750px]">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Buscar hambúrguer, bebida ou combo..." value={pdvSearchProd} onChange={(e) => setPdvSearchProd(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors text-lg" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-4">
              {pdvFilteredItems.map(item => (
                <div key={item.id} onClick={() => handleOpenPdvItemModal(item)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-green-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between h-36 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <p className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">{item.nome}</p>
                  <div className="mt-auto">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.tipoItem}</p>
                    <p className="font-black text-green-600 text-lg">R$ {(item.precoVenda || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[750px]">
            <h3 className="font-bold text-gray-800 flex items-center mb-6 text-lg"><ShoppingCart className="mr-2 text-green-600"/> Caixa Aberto</h3>
            
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg items-center">
              <button onClick={() => setPdvView('mapa')} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-colors" title="Voltar para Mapa">
                <ArrowLeft size={18}/>
              </button>
              {pdvTipoPedido === 'Mesa' ? (
                <div className="flex-1 text-center font-bold text-gray-700">Mesa {mesaSelecionada}</div>
              ) : (
                <div className="flex flex-1 gap-1">
                  <button onClick={() => setPdvTipoPedido('Balcão')} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Balcão' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Balcão</button>
                  <button onClick={() => setPdvTipoPedido('Entrega')} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Entrega' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Delivery</button>
                </div>
              )}
            </div>
            
            <div className="mb-4 relative">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Cliente {pdvTipoPedido === 'Entrega' ? '(Obrigatório)' : '(Opcional)'}</label>
              {pdvCliente ? (
                <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-800 text-sm flex items-center"><User size={16} className="mr-2"/> {pdvCliente.nome}</span>
                  <button onClick={() => setPdvCliente(null)} className="text-indigo-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-100"><X size={18}/></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" placeholder="Vincular a um cliente..." value={pdvSearchCliente} onChange={e => setPdvSearchCliente(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                  {pdvSearchCliente && pdvFilteredClientes.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {pdvFilteredClientes.map(c => (
                        <button key={c.id} onClick={() => { setPdvCliente(c); setPdvSearchCliente(''); }} className="w-full text-left p-3 hover:bg-indigo-50 border-b border-gray-50 text-sm flex justify-between items-center transition-colors">
                          <div><p className="font-bold text-gray-800">{c.nome}</p><p className="text-xs text-gray-500">{c.telefone}</p></div>
                          <Plus size={16} className="text-indigo-500"/>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border-t border-b border-gray-100 py-4 space-y-3">
              {Object.entries(pdvCarrinho).map(([id, item]) => (
                <div key={id} className="flex justify-between items-start text-sm group border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center">
                      <div className="flex items-center space-x-1 mr-2 bg-gray-100 rounded p-0.5 shrink-0">
                        <button onClick={() => updateCartItemQtd(id, -1)} className="text-gray-500 hover:bg-white rounded px-1"><Minus size={14}/></button>
                        <span className="font-bold w-4 text-center text-xs">{item.qtd}</span>
                        <button onClick={() => updateCartItemQtd(id, 1)} className="text-gray-500 hover:bg-white rounded px-1"><Plus size={14}/></button>
                      </div>
                      <p className="font-bold text-gray-800 break-words">{item.nome}</p>
                      {item.enviadoCozinha && item.enviadoCozinha > 0 ? (
                        <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full ml-2 font-bold whitespace-nowrap flex items-center shrink-0"><Flame size={10} className="mr-0.5"/> Na Cozinha ({item.enviadoCozinha})</span>
                      ) : null}
                    </div>
                    {item.opcoes && (
                      <div className="text-xs text-gray-500 mt-1.5 pl-12 space-y-0.5">
                        {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && <p><span className="font-bold text-gray-600">Montagem:</span> {Object.values(item.opcoes.montagem).join(', ')}</p>}
                        {item.opcoes.pontoCarne && <p><span className="font-bold text-gray-600">Ponto:</span> {item.opcoes.pontoCarne}</p>}
                        {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).map((a:any, i:number) => <p key={i}>+ {a.qtd}x AD/ {a.nome}</p>)}
                        {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && <p className="text-red-500 font-medium">- {Object.values(item.opcoes.restricoes).join(', ')}</p>}
                        {item.opcoes.observacao && <p><span className="font-bold text-gray-600">Obs:</span> {item.opcoes.observacao}</p>}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-gray-800 shrink-0 mt-1">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(pdvCarrinho).length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-80">
                  <Receipt size={48} className="mb-3" />
                  <p className="text-sm font-medium">Caixa Livre</p>
                </div>
              )}
            </div>

            <div className="pt-4 space-y-3 shrink-0">
               {pdvTipoPedido === 'Mesa' ? (
                 <>
                   <button onClick={handleSalvarMesa} className="w-full bg-orange-500 text-white p-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition-colors shadow-md flex justify-center items-center mb-4">
                     <Save className="mr-2" size={20}/> Salvar Pedido
                   </button>

                   <div className="border-t border-gray-200 pt-4">
                     <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center justify-center bg-gray-100 py-2 rounded-lg"><CreditCard size={14} className="mr-2"/> Pagamento (Encerrar Mesa)</h4>
                     
                     <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                        <span className="font-bold text-gray-800 uppercase text-xs">Total da Mesa</span>
                        <span className="font-black text-xl text-green-600">R$ {totalPdv.toFixed(2)}</span>
                     </div>
                     
                     <div className="space-y-2 mb-3">
                       {pdvPagamentos.map((p, index) => (
                         <div key={index} className="flex items-center space-x-2">
                           <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium">
                             <option value="">Forma de Pagto...</option>
                             {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                           </select>
                           <div className="relative w-32">
                             <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                             <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-7 pr-2 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold text-right" placeholder="0,00" />
                           </div>
                           {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                         </div>
                       ))}
                       {restantePdv > 0.05 && (
                         <div className="flex justify-between items-center text-sm px-1">
                           <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                           <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={14} className="mr-1" /> Dividir</button>
                         </div>
                       )}
                     </div>
                     
                     <button onClick={handlePdvSalvar} disabled={totalPdv <= 0 || pdvPagamentos.some(p => !p.taxaId) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-4 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center">
                       <CheckCircle className="mr-2" size={18}/> Finalizar e Liberar Mesa
                     </button>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-100 shadow-inner">
                      <span className="font-bold text-green-800 uppercase text-sm">Total da Venda</span>
                      <span className="font-black text-2xl text-green-600">R$ {totalPdv.toFixed(2)}</span>
                   </div>
                   
                   <div className="space-y-2 mt-2">
                     {pdvPagamentos.map((p, index) => (
                       <div key={index} className="flex items-center space-x-2">
                         <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium">
                           <option value="">Forma de Pagto...</option>
                           {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                         </select>
                         <div className="relative w-32">
                           <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                           <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-7 pr-2 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold text-right" placeholder="0,00" />
                         </div>
                         {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                       </div>
                     ))}
                     {restantePdv > 0.05 && (
                       <div className="flex justify-between items-center text-sm px-1">
                         <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                         <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={14} className="mr-1" /> Dividir</button>
                       </div>
                     )}
                   </div>
                   
                   <button onClick={handlePdvSalvar} disabled={totalPdv <= 0 || pdvPagamentos.some(p => !p.taxaId) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 mt-4 flex justify-center items-center">
                     <CheckCircle className="mr-2" size={20}/> Finalizar Venda
                   </button>
                 </>
               )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'conferencia' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 uppercase">Total Vendido (Sistema PDV)</p>
              <h4 className="text-2xl font-black text-blue-600 mt-2">R$ {totalSistema.toFixed(2)}</h4>
              <p className="text-xs text-gray-400 mt-1">Registrado pelo Caixa hoje</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 uppercase">Total Lançado (Simulação Admin)</p>
              <h4 className="text-2xl font-black text-green-600 mt-2">R$ {totalLancado.toFixed(2)}</h4>
              <p className="text-xs text-green-600 font-bold mt-1">Lucro Líquido (Após Custos e Taxas): R$ {totalLiquido.toFixed(2)}</p>
            </div>
            <div className={`bg-white p-6 rounded-xl shadow-sm border ${diferenca === 0 ? 'border-green-100' : diferenca > 0 ? 'border-blue-100' : 'border-red-100'}`}>
              <p className="text-sm font-bold text-gray-500 uppercase">Diferença de Caixa</p>
              <h4 className={`text-2xl font-black mt-2 ${diferenca === 0 ? 'text-green-600' : diferenca > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                R$ {Math.abs(diferenca).toFixed(2)} {diferenca > 0 ? '' : diferenca < 0 ? '(Falta / Quebra)' : ''}
              </h4>
              <p className="text-xs text-gray-400 mt-1">Lançado / Físico vs Vendido (PDV)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 h-fit flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-gray-100 p-4 rounded-full text-gray-600 mb-2">
                <Calculator size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Bater Gaveta</h3>
                <p className="text-sm text-gray-500 mt-2">Pegue as vias de cartão e o dinheiro físico da gaveta e lance aqui para o sistema verificar o fechamento.</p>
              </div>
              <button onClick={() => { setEditConfId(null); setConfCarrinho({}); setConfPagamentos([{ taxaId: '', valor: 0 }]); setConfDescricao(''); setShowConfModal(true); }} className="w-full bg-gray-800 text-white p-3 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm flex items-center justify-center mt-4">
                <Plus size={20} className="mr-2" /> Simular Valores Físicos
              </button>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h4 className="font-bold text-gray-800">Lançamentos de Conferência Hoje</h4>
                {lancamentosHoje.length > 0 && (
                  <button onClick={() => { if(confirm('Excluir todos os lançamentos simulados?')) remove(ref(db, 'lancamentos_vendas')); }} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center">
                    <Trash2 size={14} className="mr-1" /> Zerar Conferência
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {lancamentosHoje.map((l, index) => (
                  <div key={l.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-bold text-gray-800 flex items-center">
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono mr-2">#{lancamentosHoje.length - index}</span>
                        {l.descricao || 'Simulação Avulsa'}
                      </p>
                      {l.itens && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{l.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}</p>}
                      {l.pagamentos ? (
                        <p className="text-[10px] text-gray-500 mt-1 font-bold">{l.pagamentos.map((p: any) => `${p.nomeTaxa} (R$ ${p.valor.toFixed(2)})`).join(' + ')} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                      ) : (
                        <p className="text-[10px] text-gray-400 mt-1 font-bold">{l.nomeTaxa} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-bold text-green-600">R$ {l.valor.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400 font-bold">Lucro: R$ {l.valorLiquido.toFixed(2)}</p>
                      </div>
                      <div className="flex space-x-1"><button onClick={() => handleEditConf(l)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={() => { if(confirm('Excluir?')) remove(ref(db, `lancamentos_vendas/${l.id}`)); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></div>
                    </div>
                  </div>
                ))}
                {lancamentosHoje.length === 0 && <p className="p-8 text-center text-gray-400">Nenhum lançamento no simulador hoje.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {pdvItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
               <h3 className="font-black text-xl text-gray-800">{pdvItemModal.nome}</h3>
               <button onClick={() => setPdvItemModal(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               
               <div className="space-y-2">
                 <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Tipo de Montagem</h4></div>
                 <div className="flex flex-wrap gap-2">
                   {(pdvItemModal.opcoes?.tiposMontagem || []).map((t: any) => (
                     <button key={t.id} onClick={() => setPdvItemOptions((prev: any) => ({ ...prev, montagem: prev.montagem.includes(t.nome) ? [] : [t.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${pdvItemOptions.montagem.includes(t.nome) ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t.nome}</button>
                   ))}
                   {(pdvItemModal.opcoes?.tiposMontagem || []).length === 0 && <span className="text-xs text-gray-400">Nenhum tipo de montagem configurado.</span>}
                 </div>
               </div>

               <div className="space-y-2">
                 <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Ponto da Carne</h4></div>
                 <div className="flex flex-wrap gap-2">
                   {(pdvItemModal.opcoes?.pontosCarne || []).map((p: any) => (
                     <button key={p.id} onClick={() => setPdvItemOptions({...pdvItemOptions, pontoCarne: pdvItemOptions.pontoCarne === p.nome ? '' : p.nome})} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${pdvItemOptions.pontoCarne === p.nome ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{p.nome}</button>
                   ))}
                   {(pdvItemModal.opcoes?.pontosCarne || []).length === 0 && <span className="text-xs text-gray-400">Nenhum ponto de carne configurado.</span>}
                 </div>
               </div>

               <div className="space-y-2">
                 <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Adicionais</h4></div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {(pdvItemModal.opcoes?.adicionais || []).map((a: any) => {
                     const qtd = pdvItemOptions.adicionais[a.id] || 0;
                     return (
                       <div key={a.id} className="flex justify-between items-center p-2 border rounded-lg bg-gray-50">
                         <div>
                           <span className="font-medium text-sm text-gray-800">{a.nome}</span>
                           {a.preco > 0 && <span className="block text-xs text-green-600 font-bold">+ R$ {a.preco.toFixed(2)}</span>}
                         </div>
                         <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border shadow-sm">
                           <button onClick={() => setPdvItemOptions((prev: any) => { const n = {...prev.adicionais}; if (qtd <= 1) delete n[a.id]; else n[a.id] = qtd - 1; return {...prev, adicionais: n}; })} className="text-gray-500 hover:text-red-500 px-2">-</button>
                           <span className="text-sm font-bold w-4 text-center">{qtd}</span>
                           <button onClick={() => setPdvItemOptions((prev: any) => ({...prev, adicionais: {...prev.adicionais, [a.id]: qtd + 1}}))} className="text-gray-500 hover:text-green-500 px-2">+</button>
                         </div>
                       </div>
                     );
                   })}
                   {(pdvItemModal.opcoes?.adicionais || []).length === 0 && <span className="text-xs text-gray-400">Nenhum adicional configurado.</span>}
                 </div>
               </div>

               <div className="space-y-2">
                 <div className="flex justify-between items-end"><h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Restrições (Sem)</h4></div>
                 <div className="flex flex-wrap gap-2">
                   {pdvItemModal.ingredientes && pdvItemModal.ingredientes.length > 0 ? (
                     pdvItemModal.ingredientes
                       .map((ing: any) => insumos.find(i => i.id === ing.insumoId))
                       .filter((insumo: any) => {
                         if (!insumo) return false;
                         const nome = (insumo.nome || '').toLowerCase();
                         const tipoUso = (insumo.tipoUso || '').toLowerCase();
                         if (tipoUso === 'embalagem') return false;
                         if (['embalagem', 'palito', 'sacola', 'sache', 'sachê', 'lacre', 'adesivo', 'ch3', 'papel'].some(word => nome.includes(word))) return false;
                         return true;
                       })
                       .map((r: any) => (
                         <button key={r.id} onClick={() => setPdvItemOptions((prev: any) => ({ ...prev, restricoes: prev.restricoes.includes(r.nome) ? prev.restricoes.filter((n: any) => n !== r.nome) : [...prev.restricoes, r.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${pdvItemOptions.restricoes.includes(r.nome) ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{r.nome}</button>
                       ))
                   ) : (
                     <span className="text-xs text-gray-400">Nenhum ingrediente configurado.</span>
                   )}
                 </div>
               </div>

               <div className="space-y-2">
                 <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Observação Especial</h4>
                 <textarea value={pdvItemOptions.observacao} onChange={e=>setPdvItemOptions({...pdvItemOptions, observacao: e.target.value})} className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm bg-gray-50 focus:bg-white" rows={2} placeholder="Ex: Embalar separado..."></textarea>
               </div>

            </div>
            
            <div className="p-4 border-t bg-gray-100 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
               <div className="flex items-center space-x-4 bg-white p-2 rounded-lg border shadow-sm w-full sm:w-auto justify-center">
                 <button onClick={() => setPdvItemOptions({...pdvItemOptions, quantidade: Math.max(1, pdvItemOptions.quantidade - 1)})} className="px-4 py-1 text-gray-500 hover:text-red-500 font-bold text-lg">-</button>
                 <span className="font-black text-lg">{pdvItemOptions.quantidade}</span>
                 <button onClick={() => setPdvItemOptions({...pdvItemOptions, quantidade: pdvItemOptions.quantidade + 1})} className="px-4 py-1 text-gray-500 hover:text-green-500 font-bold text-lg">+</button>
               </div>
               <button onClick={handleAddPdvItem} className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center shadow-md text-lg">
                 Adicionar <span className="ml-3 bg-green-700 px-2.5 py-1.5 rounded-md text-sm">R$ {((Number(pdvItemModal.precoVenda) || 0) * pdvItemOptions.quantidade + Object.entries(pdvItemOptions.adicionais).reduce((acc,[id,qtd]: [string, any])=>acc+(Number((pdvItemModal.opcoes?.adicionais || []).find((a:any)=>a.id===id)?.preco)||0)*qtd,0) * pdvItemOptions.quantidade).toFixed(2)}</span>
               </button>
            </div>
          </div>
        </div>
      )}


      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}

      {showConfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-gray-800 flex items-center"><Calculator size={20} className="mr-2 text-gray-600"/> Simulador de Recebimento</h3>
              <button onClick={() => { setShowConfModal(false); setEditConfId(null); }} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
            </div>
            
            <div className="p-4 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
              <div className="flex-1 flex flex-col md:border-r border-gray-100 md:pr-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Buscar produto para simular venda..." value={confSearchProd} onChange={(e) => setConfSearchProd(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 bg-gray-50 focus:bg-white transition-colors" />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                  {confFilteredItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-green-200 hover:bg-green-50 transition-colors group">
                      <div>
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <p className="text-sm font-bold text-green-600">R$ {(item.precoVenda || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        <button onClick={() => updateCart(setConfCarrinho, item.id, item.nome, item.precoVenda || 0, -1)} className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"><Minus size={16}/></button>
                        <span className="font-bold w-6 text-center text-gray-800">{confCarrinho[item.id]?.qtd || 0}</span>
                        <button onClick={() => updateCart(setConfCarrinho, item.id, item.nome, item.precoVenda || 0, 1)} className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"><Plus size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {confFilteredItems.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum produto encontrado.</p>}
                </div>
              </div>

              <div className="w-full md:w-80 flex flex-col pt-4 md:pt-0">
                <h4 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Resumo Simulado</h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {Object.entries(confCarrinho).map(([id, item]) => (
                    <div key={id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600"><span className="font-bold text-gray-800">{item.qtd}x</span> {item.nome}</span>
                      <span className="font-bold text-gray-800">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.keys(confCarrinho).length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Nenhum produto adicionado</p>}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200 mb-2">
                    <span className="font-bold text-gray-800 uppercase text-sm">Valor Total</span>
                    <span className="font-black text-xl text-gray-800">R$ {totalConf.toFixed(2)}</span>
                  </div>
                  
                  <div className="space-y-3 mb-2">
                    <p className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Pagamento</p>
                    {confPagamentos.map((p, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select value={p.taxaId} onChange={e => handlePagamentoChange(setConfPagamentos, confPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 text-sm">
                          <option value="">Selecione...</option>
                          {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome} {t.percentual > 0 ? `(${t.percentual}%)` : ''}</option>)}
                        </select>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                          <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setConfPagamentos, confPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 text-sm text-right" placeholder="0,00" />
                        </div>
                        {confPagamentos.length > 1 && <button onClick={() => setConfPagamentos(confPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                      </div>
                    ))}

                    {restanteConf > 0.05 && (
                      <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-red-500 font-bold">Falta: R$ {restanteConf.toFixed(2)}</span>
                        <button onClick={() => setConfPagamentos([...confPagamentos, { taxaId: '', valor: restanteConf > 0 ? Number(restanteConf.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={14} className="mr-1" /> Dividir Pagamento</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Identificador da Venda (Título da Nota)</label>
                    <input type="text" placeholder="Ex: Mesa 1 - 19:00" value={confDescricao} onChange={e=>setConfDescricao(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-500 font-bold text-gray-800" />
                  </div>
                  
                  <button onClick={handleConfSalvar} disabled={totalConf <= 0 || confPagamentos.some(p => !p.taxaId) || Math.abs(restanteConf) > 0.05} className="w-full bg-gray-800 text-white p-3 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm disabled:opacity-50">{editConfId ? 'Atualizar Conferência' : 'Registrar Conferência'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}