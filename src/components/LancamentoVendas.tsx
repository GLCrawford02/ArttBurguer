import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Calculator, CheckCircle, Trash2, AlertTriangle, ArrowRightLeft, Plus, Minus, X, Search, ShoppingCart, Store, User, CreditCard, Receipt, ArrowLeft, Save, Truck, Flame, Pencil, Sparkles, Loader2, Bot, Ticket, Map, Package, MapPin, Printer } from 'lucide-react';

export default function LancamentoVendas({ currentUser, permissoes = {} }: { currentUser?: any, permissoes?: any }) {
  const [activeView, setActiveView] = useState<'pdv' | 'comandas' | 'conferencia'>('pdv');
  
  const [taxas, setTaxas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [vendasPdv, setVendasPdv] = useState<any[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [cupons, setCupons] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  const [pdvItemModal, setPdvItemModal] = useState<any>(null);
  const [pdvItemOptions, setPdvItemOptions] = useState<any>({
    montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1
  });

  const [pdvDescontoAplicado, setPdvDescontoAplicado] = useState<{valor: number, cupom?: string, autorizadoPorId: string, autorizadoPorNome: string} | null>(null);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [descontoInput, setDescontoInput] = useState('');
  const [descontoPin, setDescontoPin] = useState('');


  const [pdvView, setPdvView] = useState<'mapa' | 'caixa'>('mapa');
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null);
  const [mesasAbertas, setMesasAbertas] = useState<Record<string, any>>({});
  const [entregasAbertas, setEntregasAbertas] = useState<Record<string, any>>({});
  const [entregaSelecionada, setEntregaSelecionada] = useState<string | null>(null);
  const [qtdMesas, setQtdMesas] = useState(30);

  const [pdvCarrinho, setPdvCarrinho] = useState<Record<string, { produtoId?: string, nome: string, preco: number, qtd: number, enviadoCozinha?: number, concluidoCozinha?: number, opcoes?: any, adicionadoPor?: string, adicionadoEm?: number }>>({});
  const [pdvPagamentos, setPdvPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [pdvDescricao, setPdvDescricao] = useState('');
  const [pdvSearchProd, setPdvSearchProd] = useState('');
  const [pdvSearchCliente, setPdvSearchCliente] = useState('');
  const [pdvCliente, setPdvCliente] = useState<any | null>(null);
  const [pdvTipoPedido, setPdvTipoPedido] = useState<'Balcão' | 'Entrega' | 'Mesa'>('Balcão');
  const [showPainelEntregas, setShowPainelEntregas] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [pdvCategoria, setPdvCategoria] = useState<string>('Todos');


  const [showConfModal, setShowConfModal] = useState(false);
  const [editConfId, setEditConfId] = useState<string | null>(null);
  const [confCarrinho, setConfCarrinho] = useState<Record<string, { nome: string, preco: number, qtd: number }>>({});
  const [confPagamentos, setConfPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [confDescricao, setConfDescricao] = useState('');
  const [confSearchProd, setConfSearchProd] = useState('');
  const [viewComanda, setViewComanda] = useState<any>(null);
  
  const [showIaModal, setShowIaModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const temPermissao = (modulo: string, abaId?: string) => {
    if (!currentUser) return false;
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    if (cargos.includes('Dono') || cargos.includes('TI')) return true;
    return cargos.some((c: string) => {
      const p = permissoes[c];
      if (!p) return false;
      if (abaId && p[abaId] && p[abaId].visualizar === false) return false;
      return p[modulo]?.visualizar;
    });
  };

  const isAdminOrGerente = temPermissao('pdv_conferencia', 'aba_pdv');
  const canViewComandas = temPermissao('pdv_comandas', 'aba_pdv');
  const isCaixaOrAdmin = temPermissao('vendas', 'aba_pdv');
  const canDelivery = temPermissao('pdv_delivery', 'aba_pdv');

  useEffect(() => {
    if (!isAdminOrGerente && activeView === 'conferencia') setActiveView('pdv');
    if (!canViewComandas && activeView === 'comandas') setActiveView('pdv');
  }, [isAdminOrGerente, canViewComandas, activeView]);

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

    const pedidosCozRef = ref(db, 'pedidos_cozinha');
    onValue(pedidosCozRef, snap => {
      if (snap.val()) setPedidosCozinha(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setPedidosCozinha([]);
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

    const cuponsRef = ref(db, 'cupons');
    onValue(cuponsRef, snap => {
      if (snap.val()) setCupons(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setCupons([]);
    });

    const funcRef = ref(db, 'funcionarios');
    onValue(funcRef, snap => {
      if (snap.val()) setFuncionarios(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setFuncionarios([]);
    });

    const mesasRef = ref(db, 'mesas_abertas');
    onValue(mesasRef, snap => setMesasAbertas(snap.val() || {}));

    const entregasAbertasRef = ref(db, 'entregas_abertas');
    onValue(entregasAbertasRef, snap => setEntregasAbertas(snap.val() || {}));

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


  const rawTotalPdvBase = Object.values(pdvCarrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  let descontoCalculado = 0;
  if (pdvDescontoAplicado) {
     descontoCalculado = pdvDescontoAplicado.valor;
     if (descontoCalculado > rawTotalPdvBase) descontoCalculado = rawTotalPdvBase;
  }
  const rawTotalPdv = rawTotalPdvBase - Math.max(0, descontoCalculado);
  const totalPdv = Number(rawTotalPdv.toFixed(2));
  
  const rawPagoPdv = pdvPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const pagoPdv = Number(rawPagoPdv.toFixed(2));
  const restantePdv = Number((totalPdv - pagoPdv).toFixed(2));

  useEffect(() => {
    if (pdvPagamentos.length === 1 && totalPdv > 0) setPdvPagamentos([{ ...pdvPagamentos[0], valor: totalPdv }]);
    else if (totalPdv === 0) setPdvPagamentos([{ taxaId: pdvPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalPdv]);


  const rawTotalConf = Object.values(confCarrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const totalConf = Number(rawTotalConf.toFixed(2));
  const rawPagoConf = confPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const pagoConf = Number(rawPagoConf.toFixed(2));
  const restanteConf = Number((totalConf - pagoConf).toFixed(2));

  useEffect(() => {
    if (confPagamentos.length === 1 && totalConf > 0) setConfPagamentos([{ ...confPagamentos[0], valor: totalConf }]);
    else if (totalConf === 0) setConfPagamentos([{ taxaId: confPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalConf]);

  const getNumeroDiario = (tipo: 'Entrega' | 'Balcão/Mesa', idExistente: string | null) => {
    const inicioHoje = getInicioDiaComercial();
    if (tipo === 'Entrega') {
       if (idExistente && entregasAbertas[idExistente]?.numeroDiario) return entregasAbertas[idExistente].numeroDiario;
       const maxEntrega = Math.max(0, ...Object.values(entregasAbertas).filter((e: any) => e.timestamp >= inicioHoje).map((e: any) => e.numeroDiario || 0), ...vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.timestamp >= inicioHoje).map((v: any) => v.numeroDiario || 0));
       return maxEntrega + 1;
    } else {
       const maxPdv = Math.max(0, ...vendasPdv.filter((v: any) => v.tipoPedido !== 'Entrega' && v.timestamp >= inicioHoje).map((v: any) => v.numeroDiario || 0));
       return maxPdv + 1;
    }
  };

  const updateCartItemQtd = (cartItemId: string, delta: number) => {
    setPdvCarrinho((prev: any) => {
      const current = prev[cartItemId];
      if (!current) return prev;
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) { const { [cartItemId]: _, ...rest } = prev; return rest; }
      let newEnviado = current.enviadoCozinha || 0;
      if (newQtd < newEnviado) newEnviado = newQtd;
      let newConcluido = current.concluidoCozinha || 0;
      if (newQtd < newConcluido) newConcluido = newQtd;
      return { ...prev, [cartItemId]: { ...current, qtd: newQtd, enviadoCozinha: newEnviado, concluidoCozinha: newConcluido } };
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

  const dispararParaCozinha = async (identificador: string, tipo: string, referenciaId?: string) => {
    const itensParaEnviar = Object.entries(pdvCarrinho)
      .filter(([id, item]) => item.qtd > (item.enviadoCozinha || 0))
      .map(([id, item]) => ({
        cartItemId: id,
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
        identificador, tipo, 
        referenciaId: referenciaId || null,
        itens: itensParaEnviar, status: 'Pendente', timestamp: Date.now()
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
    setEntregaSelecionada(null);
    setPdvTipoPedido('Mesa');
    setPdvDescontoAplicado(null);
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
        const novoCarrinho = await dispararParaCozinha(`Mesa ${mesaSelecionada}`, 'Mesa', `mesa_${mesaSelecionada}`);
      await set(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`), {
        carrinho: novoCarrinho,
        timestamp: Date.now()
      });
      await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
      showToast(`Pedido salvo na Mesa ${mesaSelecionada}!`, 'success');
      setPdvDescontoAplicado(null);
    }
    setPdvView('mapa');
  };

  const handleAbrirEntrega = (id: string) => {
    setEntregaSelecionada(id);
    setMesaSelecionada(null);
    setPdvTipoPedido('Entrega');
    setPdvDescontoAplicado(null);
    const entregaData = entregasAbertas[id];
    if (entregaData) {
      setPdvCarrinho(entregaData.carrinho || {});
      const c = clientes.find((client: any) => client.id === entregaData.clienteId);
      if (c) setPdvCliente(c);
      else setPdvCliente({ id: entregaData.clienteId, nome: entregaData.clienteNome, telefone: entregaData.clienteTelefone });
    }
    setPdvView('caixa');
  };

  const handleSalvarEntrega = async () => {
    if (!pdvCliente) return showToast('Selecione um cliente para o Delivery.', 'error');
    if (Object.keys(pdvCarrinho).length === 0) {
      if (entregaSelecionada) await remove(ref(db, `entregas_abertas/${entregaSelecionada}`));
      showToast('Delivery cancelado/removido!', 'success');
    } else {
      const id = entregaSelecionada || `delivery_${Date.now()}`;
      const numDiario = getNumeroDiario('Entrega', entregaSelecionada);
        const novoCarrinho = await dispararParaCozinha(`Delivery: ${pdvCliente.nome}`, 'Entrega', id);
      await set(ref(db, `entregas_abertas/${id}`), {
        clienteId: pdvCliente.id,
        clienteNome: pdvCliente.nome,
        clienteTelefone: pdvCliente.telefone,
        carrinho: novoCarrinho,
        numeroDiario: numDiario,
        timestamp: Date.now()
      });
      showToast('Pedido de Delivery salvo!', 'success');
      setPdvDescontoAplicado(null);
    }
    setPdvView('mapa');
  };

  const handleReimprimirMesa = (e: React.MouseEvent, num: number, isAberta: any) => {
    e.stopPropagation();
    if (!isAberta) return;
    const total = Object.values(isAberta.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);
    setViewComanda({
      timestamp: isAberta.timestamp || Date.now(),
      descricao: `Mesa ${num} (Parcial)`,
      itens: Object.values(isAberta.carrinho || {}),
      valor: total,
      desconto: 0,
      pagamentos: []
    });
  };

  const handleReabrirEntrega = async (venda: any) => {
    if (window.confirm('Deseja reabrir este pedido? O pagamento e o registro de venda serão desfeitos até que você finalize no caixa novamente.')) {
      await remove(ref(db, `vendas_pdv/${venda.id}`));
      const carrinhoRestaurado: Record<string, any> = {};
      if (venda.itens) {
        venda.itens.forEach((item: any) => { carrinhoRestaurado[item.id] = { ...item }; });
      }
      const c = clientes.find((client: any) => client.id === venda.clienteId);
      await set(ref(db, `entregas_abertas/${venda.id}`), { clienteId: venda.clienteId, clienteNome: venda.clienteNome, clienteTelefone: c ? c.telefone : (venda.clienteTelefone || ''), carrinho: carrinhoRestaurado, timestamp: venda.timestamp });
      setShowPainelEntregas(false);
      handleAbrirEntrega(venda.id);
    }
  };

  const handleImprimirCupom = () => {
    if (!viewComanda) return;

    const win = window.open('', '_blank');
    if (!win) return;

    let itensHtml = '';
    if (viewComanda.itens) {
      viewComanda.itens.forEach((item: any) => {
        itensHtml += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <div>${item.qtd}x ${item.nome}</div>
            <div>R$ ${(item.preco * item.qtd).toFixed(2)}</div>
          </div>
        `;
        if (item.opcoes) {
          if (item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0) itensHtml += `<div style="font-size: 10px; color: #555; padding-left: 10px;">Montagem: ${Object.values(item.opcoes.montagem).join(', ')}</div>`;
          if (item.opcoes.pontoCarne) itensHtml += `<div style="font-size: 10px; color: #555; padding-left: 10px;">Ponto: ${item.opcoes.pontoCarne}</div>`;
          if (item.opcoes.adicionais && Object.values(item.opcoes.adicionais).length > 0) Object.values(item.opcoes.adicionais).forEach((a: any) => {
            itensHtml += `<div style="font-size: 10px; color: #555; padding-left: 10px;">+ ${a.qtd}x AD/ ${a.nome}</div>`;
          });
          if (item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0) itensHtml += `<div style="font-size: 10px; color: #555; padding-left: 10px;">- Sem: ${Object.values(item.opcoes.restricoes).join(', ')}</div>`;
          if (item.opcoes.observacao) itensHtml += `<div style="font-size: 10px; color: #555; padding-left: 10px;">Obs: ${item.opcoes.observacao}</div>`;
        }
      });
    }

    let pagamentosHtml = '';
    if (viewComanda.pagamentos) {
      viewComanda.pagamentos.forEach((p: any) => {
        pagamentosHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><div>${p.nomeTaxa}</div><div>R$ ${p.valor.toFixed(2)}</div></div>`;
      });
    } else if (viewComanda.nomeTaxa) {
      pagamentosHtml += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><div>${viewComanda.nomeTaxa}</div><div>R$ ${viewComanda.valor.toFixed(2)}</div></div>`;
    }

    const html = `
      <html>
        <head>
          <title>Cupom - ${viewComanda.descricao || 'Venda'}</title>
          <style>
            body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: #000; }
            .header { text-align: center; margin-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 12px; margin: 2px 0; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .item-list { font-size: 12px; margin-bottom: 10px; }
            .totals { font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; }
            .footer { text-align: center; font-size: 10px; margin-top: 20px; }
            @media print { body { width: 100%; margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header"><h1 class="title">ARTT BURGER</h1><p class="subtitle">${viewComanda.descricao || 'Venda Balcão'} ${viewComanda.tipoPedido ? `(${viewComanda.tipoPedido})` : ''}</p><p class="subtitle">${new Date(viewComanda.timestamp).toLocaleString('pt-BR')}</p>${viewComanda.clienteNome ? `<p class="subtitle">Cliente: ${viewComanda.clienteNome}</p>` : ''}</div>
          <div class="divider"></div>
          <div class="item-list">${itensHtml}</div>
          <div class="divider"></div>
          ${viewComanda.desconto > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;"><div>Desconto ${viewComanda.cupom ? `(${viewComanda.cupom})` : ''}</div><div>- R$ ${viewComanda.desconto.toFixed(2)}</div></div><div class="divider"></div>` : ''}
          <div style="font-size: 12px; margin-bottom: 5px;">${pagamentosHtml}</div>
          <div class="divider"></div>
          <div class="totals"><span>TOTAL</span><span>R$ ${viewComanda.valor.toFixed(2)}</span></div>
          <div class="footer"><p>Obrigado pela preferência!</p><p>Volte sempre</p></div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
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
        return { id: add?.id, nome: add?.nome, qtd, preco: Number(add?.preco || 0), insumoId: add?.insumoId, quantidadeInsumo: add?.quantidade || 1 };
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
        enviadoCozinha: 0,
        adicionadoPor: currentUser?.nome || 'Sistema',
        adicionadoEm: Date.now()
      }
    }));
    
    setPdvItemModal(null);
  };

  const handleAplicarDesconto = () => {
     // Verificação de segurança e autorização
     const func = funcionarios.find(f => String(f.pin) === descontoPin);
     if (!func) return showToast('PIN inválido', 'error');
     const roles = Array.isArray(func.cargo) ? func.cargo : [func.cargo];
     const isAuthorized = roles.some((c: string) => ['Dono', 'TI'].includes(c) || permissoes[c]?.['vendas']?.visualizar || permissoes[c]?.['pdv_conferencia']?.visualizar);
     if (!isAuthorized) {
        return showToast('Autorização negada! Requer permissão de acesso ao Caixa ou Conferência.', 'error');
     }

     let valorDesconto = 0;
     let cupomUsado = '';
     const cupom = cupons.find(c => c.codigo.toLowerCase() === descontoInput.trim().toLowerCase() && c.ativo !== false);
     
     if (cupom) {
        if (cupom.tipo === 'valor') valorDesconto = Number(cupom.valor);
        else if (cupom.tipo === 'porcentagem') valorDesconto = rawTotalPdvBase * (Number(cupom.valor) / 100);
        cupomUsado = cupom.codigo;
     } else {
        const rawNum = Number(descontoInput.replace(',', '.'));
        if (!isNaN(rawNum) && rawNum > 0) {
           valorDesconto = rawNum;
        } else {
           return showToast('Cupom não encontrado ou valor inválido.', 'error');
        }
     }

     setPdvDescontoAplicado({ valor: valorDesconto, cupom: cupomUsado, autorizadoPorId: func.id, autorizadoPorNome: func.nome });
     setShowDescontoModal(false);
     setDescontoInput('');
     setDescontoPin('');
     showToast('Desconto autorizado e aplicado!', 'success');
  };

  const handlePdvSalvar = async () => {
    // Validação inicial do Caixa
    if (totalPdv < 0) return showToast('O total não pode ser negativo.', 'error');
    if (totalPdv === 0 && Object.keys(pdvCarrinho).length === 0) return showToast('Adicione produtos à venda.', 'error');
    const pagamentosValidos = pdvPagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (totalPdv > 0 && pagamentosValidos.length === 0) return showToast('Informe uma forma de pagamento.', 'error');
    if (Math.abs(restantePdv) > 0.05) return showToast(`O valor pago deve ser exatamente R$ ${totalPdv.toFixed(2)} para liberar a mesa/venda.`, 'error');
    if (pdvTipoPedido === 'Entrega' && !pdvCliente) return showToast('Para entregas, é obrigatório selecionar o cliente.', 'error');

    try {
      let valorLiquidoTotal = 0;
      const pagamentosProcessados = pagamentosValidos.map(p => {
        const taxa = taxasComPadroes.find(t => t.id === p.taxaId);
        const perc = taxa ? Number(taxa.percentual || 0) : 0;
        const rawLiq = Number(p.valor) - (Number(p.valor) * (perc / 100));
        const liq = Number(rawLiq.toFixed(2));
        valorLiquidoTotal += liq;
        return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
      });
  
      let custoPedido = 0;
      Object.entries(pdvCarrinho).forEach(([id, item]) => {
        const prod = produtos.find(p => p.id === item.produtoId) || promocoes.find(p => p.id === item.produtoId);
        if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
      });
      valorLiquidoTotal = Number((valorLiquidoTotal - custoPedido).toFixed(2));
  
      let ident = 'Balcão';
      if (pdvTipoPedido === 'Entrega') ident = `Delivery: ${pdvCliente?.nome || ''}`;
      else if (pdvTipoPedido === 'Mesa') ident = `Mesa ${mesaSelecionada}`;
      else if (pdvCliente) ident = `Balcão: ${pdvCliente.nome}`;
      await dispararParaCozinha(ident, pdvTipoPedido);
  
      const statusEntregaAtual = pdvTipoPedido === 'Entrega' && entregaSelecionada && entregasAbertas[entregaSelecionada]?.statusEntrega
        ? entregasAbertas[entregaSelecionada].statusEntrega
        : 'Pendente';

      const numDiario = pdvTipoPedido === 'Entrega' ? getNumeroDiario('Entrega', entregaSelecionada) : getNumeroDiario('Balcão/Mesa', null);

      await set(push(ref(db, 'vendas_pdv')), {
        valor: totalPdv,
        valorLiquido: valorLiquidoTotal,
        pagamentos: pagamentosProcessados,
        taxaId: pagamentosProcessados[0].taxaId,
        nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : pagamentosProcessados[0].nomeTaxa,
        descricao: pdvDescricao || 'Venda Balcão',
        clienteId: pdvCliente?.id || null,
        clienteNome: pdvCliente?.nome || 'Cliente Balcão',
        desconto: pdvDescontoAplicado ? pdvDescontoAplicado.valor : 0,
        cupom: pdvDescontoAplicado?.cupom || null,
        descontoAutorizadoPor: pdvDescontoAplicado?.autorizadoPorNome || null,
        itens: Object.entries(pdvCarrinho).map(([id, item]) => ({ id, ...item })),
        tipoPedido: pdvTipoPedido,
        mesa: pdvTipoPedido === 'Mesa' ? mesaSelecionada : null,
        statusEntrega: pdvTipoPedido === 'Entrega' ? statusEntregaAtual : null,
        numeroDiario: numDiario,
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
      
      if (pdvTipoPedido === 'Entrega' && entregaSelecionada) {
        await remove(ref(db, `entregas_abertas/${entregaSelecionada}`));
      }
  
      setPdvCarrinho({}); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvCliente(null); setPdvTipoPedido('Balcão');
      setPdvDescontoAplicado(null);
      setMesaSelecionada(null);
      setEntregaSelecionada(null);
      setPdvView('mapa');
      showToast('Venda finalizada com sucesso!', 'success');
    } catch (error: any) {
      showToast('Erro ao finalizar venda: ' + error.message, 'error');
      console.error(error);
    }
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
      const rawLiq = Number(p.valor) - (Number(p.valor) * (perc / 100));
      const liq = Number(rawLiq.toFixed(2));
      valorLiquidoTotal += liq;
      return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
    });

    let custoPedido = 0;
    Object.entries(confCarrinho).forEach(([id, item]) => {
      const prod = produtos.find(p => p.id === id) || promocoes.find(p => p.id === id);
      if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
    });
    valorLiquidoTotal = Number((valorLiquidoTotal - custoPedido).toFixed(2));

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

  const getInicioDiaComercial = () => {
    const agora = new Date();
    const limiteStr = new Date(agora);
    limiteStr.setHours(6, 59, 59, 999); // Limite de virada do dia (06:59:59 da manhã)
    if (agora.getTime() <= limiteStr.getTime()) {
      const ontem = new Date(agora);
      ontem.setDate(ontem.getDate() - 1);
      ontem.setHours(7, 0, 0, 0); // Considera como "Hoje Comercial" a partir de Ontem às 07:00
      return ontem.getTime();
    } else {
      const hoje = new Date(agora);
      hoje.setHours(7, 0, 0, 0); // Considera como "Hoje Comercial" a partir de Hoje às 07:00
      return hoje.getTime();
    }
  };

  const calcularConferencia = () => {
    const inicioHoje = getInicioDiaComercial();

    const lancamentosHoje = lancamentos.filter(l => l.timestamp >= inicioHoje).sort((a, b) => b.timestamp - a.timestamp);

    const vendasHoje = vendasPdv.filter(v => v.timestamp >= inicioHoje);

    const rawTotalLancado = lancamentosHoje.reduce((acc, l) => acc + l.valor, 0);
    const totalLancado = Number(rawTotalLancado.toFixed(2));
    const rawTotalLiquido = lancamentosHoje.reduce((acc, l) => acc + l.valorLiquido, 0);
    const totalLiquido = Number(rawTotalLiquido.toFixed(2));
    const rawTotalSistema = vendasHoje.reduce((acc, v) => acc + v.valor, 0);
    const totalSistema = Number(rawTotalSistema.toFixed(2));
    const diferenca = Number((totalLancado - totalSistema).toFixed(2));

    return { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje, vendasHoje };
  };
  const { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje, vendasHoje } = calcularConferencia();

  const todosItens = [...produtos.map(p => ({ ...p, tipoItem: 'Produto' })), ...promocoes.map(p => ({ ...p, tipoItem: 'Promoção' }))];
  
  const pdvFilteredItems = todosItens.filter(i => {
    const nome = i.nome || '';
    if (!nome.toLowerCase().includes(pdvSearchProd.toLowerCase())) return false;
    const nomeTrimmed = nome.trimStart();
    if (pdvTipoPedido === 'Entrega' && nomeTrimmed.startsWith('%')) return false;
    if (pdvTipoPedido !== 'Entrega' && nomeTrimmed.startsWith('/')) return false;

    if (pdvCategoria !== 'Todos') {
      if (pdvCategoria === 'Promoções') {
        if (i.tipoItem !== 'Promoção') return false;
      } else {
        if (i.tipoItem === 'Promoção' || i.categoria !== pdvCategoria) return false;
      }
    }
    
    return true;
  });

  const categoriasCardapio = ['Todos', 'Promoções', ...Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)))].sort((a: any, b: any) => {
    if (a === 'Todos') return -1;
    if (b === 'Todos') return 1;
    if (a === 'Promoções') return -1;
    if (b === 'Promoções') return 1;
    return a.localeCompare(b);
  });
  
  const confFilteredItems = todosItens.filter(i => (i.nome || '').toLowerCase().includes(confSearchProd.toLowerCase()));
  const pdvFilteredClientes = clientes.filter(c => (c.nome || '').toLowerCase().includes(pdvSearchCliente.toLowerCase()) || (c.telefone || '').includes(pdvSearchCliente));

  const handlePedidoIA = async () => {
    if (!aiPrompt.trim()) return showToast('Descreva o pedido do cliente.', 'error');
    setIsGenerating(true);
    try {
      const availableItems = todosItens.map(i => `${i.nome} (ID: ${i.id}, Preço: ${i.precoVenda})`).join('\n');

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
        body: JSON.stringify({
          model: 'grok-3-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Você é um garçom anotando o pedido. Extraia os itens solicitados do texto e cruze com os itens do cardápio disponíveis. Responda APENAS com um array JSON com a estrutura solicitada.
Cardápio Disponível:
${availableItems}

Formato esperado:
[{
  "produtoId": "ID exato do produto correspondente do cardápio",
  "nome": "Nome do Produto",
  "preco": preco (número),
  "qtd": quantidade (número),
  "observacao": "Alguma observação, restrição ou adicional solicitado para este item específico"
}]`
            },
            { role: 'user', content: aiPrompt }
          ]
        })
      });
      const data = await response.json();
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('Não foi possível compreender o pedido.');
      const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const itensPedido = JSON.parse(cleanJson);
      
      const novosItens: any = { ...pdvCarrinho };
      let addCount = 0;
      for (const item of itensPedido) {
        const prod = todosItens.find(i => i.id === item.produtoId);
        if (prod) {
          const cartItemId = `${prod.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          novosItens[cartItemId] = {
            produtoId: prod.id,
            nome: prod.nome,
            preco: Number(item.preco) || Number(prod.precoVenda) || 0,
            qtd: Number(item.qtd) || 1,
            enviadoCozinha: 0,
            opcoes: item.observacao ? { observacao: item.observacao } : null,
            adicionadoPor: `${currentUser?.nome || 'Sistema'} (IA)`,
            adicionadoEm: Date.now()
          };
          addCount++;
        }
      }
      setPdvCarrinho(novosItens);
      showToast(`Garçom IA adicionou ${addCount} itens ao carrinho!`, 'success');
      setAiPrompt('');
      setShowIaModal(false);
    } catch (e: any) { showToast('Erro IA: ' + e.message, 'error'); } 
    finally { setIsGenerating(false); }
  };

  const DescontoArea = (
    <div className="mb-3 px-1">
       {!pdvDescontoAplicado ? (
         <button onClick={() => setShowDescontoModal(true)} className="w-full py-2.5 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors flex justify-center items-center">
            <Ticket size={16} className="mr-2" /> Adicionar Desconto / Cupom
         </button>
       ) : (
         <div className="flex justify-between items-center bg-red-50 p-2.5 rounded-lg border border-red-200 shadow-sm">
           <div className="flex flex-col">
              <span className="text-xs font-bold text-red-700 flex items-center"><Ticket size={14} className="mr-1"/> Desconto {pdvDescontoAplicado.cupom ? `(${pdvDescontoAplicado.cupom})` : ''}</span>
              <span className="text-[10px] text-red-500 font-medium">Autorizado por: {pdvDescontoAplicado.autorizadoPorNome}</span>
           </div>
           <div className="flex items-center space-x-3">
             <span className="text-sm font-black text-red-600">- R$ {pdvDescontoAplicado.valor.toFixed(2)}</span>
             <button onClick={() => setPdvDescontoAplicado(null)} className="text-red-400 hover:text-red-600 p-1 bg-white rounded-md"><X size={16}/></button>
           </div>
         </div>
       )}
    </div>
  );

  const PaymentSection = (
    <div className="flex flex-col gap-3">
      {pdvTipoPedido === 'Mesa' || pdvTipoPedido === 'Entrega' ? (
        <>
          <button onClick={pdvTipoPedido === 'Mesa' ? handleSalvarMesa : handleSalvarEntrega} className="w-full bg-orange-500 text-white p-3 rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors shadow-md flex justify-center items-center">
            <Save className="mr-2" size={16}/> Salvar / Enviar para Cozinha
          </button>
          
          <div className="border-t border-gray-200 pt-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-center bg-gray-100 py-1.5 rounded-lg"><CreditCard size={14} className="mr-2"/> Pagamento (Encerrar {pdvTipoPedido})</h4>
            
            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 mb-2">
              <span className="font-bold text-gray-800 uppercase text-xs">Total a Pagar</span>
              <div className="text-right">
                {pdvDescontoAplicado && <span className="text-xs text-red-500 line-through mr-2">R$ {rawTotalPdvBase.toFixed(2)}</span>}
                <span className="font-black text-lg text-green-600">R$ {totalPdv.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="space-y-2 mb-2 max-h-[120px] overflow-y-auto">
              {pdvPagamentos.map((p, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium">
                    <option value="">Forma de Pagto...</option>
                    {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs font-medium">R$</span>
                    <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-bold text-right" placeholder="0,00" />
                  </div>
                  {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                </div>
              ))}
              {restantePdv > 0.05 && (
                <div className="flex justify-between items-center text-xs px-1">
                  <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                  <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={12} className="mr-1" /> Dividir</button>
                </div>
              )}
            </div>
            
            <button onClick={handlePdvSalvar} disabled={totalPdv < 0 || (totalPdv > 0 && pdvPagamentos.some(p => !p.taxaId)) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center mt-2">
              <CheckCircle className="mr-2" size={16}/> Finalizar e Liberar {pdvTipoPedido}
            </button>
          </div>
        </>
      ) : (
        <>
          {DescontoArea}
          <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100 shadow-inner">
            <span className="font-bold text-green-800 uppercase text-xs">Total a Pagar</span>
            <div className="text-right">
              {pdvDescontoAplicado && <span className="text-xs text-red-500 line-through mr-2">R$ {rawTotalPdvBase.toFixed(2)}</span>}
              <span className="font-black text-xl text-green-600">R$ {totalPdv.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-2 max-h-[120px] overflow-y-auto">
            {pdvPagamentos.map((p, index) => (
              <div key={index} className="flex items-center space-x-2">
                <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium">
                  <option value="">Forma de Pagto...</option>
                  {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs font-medium">R$</span>
                  <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-bold text-right" placeholder="0,00" />
                </div>
                {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
              </div>
            ))}
            {restantePdv > 0.05 && (
              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={12} className="mr-1" /> Dividir</button>
              </div>
            )}
          </div>
          
          <button onClick={handlePdvSalvar} disabled={totalPdv < 0 || (totalPdv > 0 && pdvPagamentos.some(p => !p.taxaId)) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold text-base hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 mt-2 flex justify-center items-center">
            <CheckCircle className="mr-2" size={18}/> Finalizar Venda
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-emerald-100 p-3 rounded-xl mr-4 text-emerald-600">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Caixa e Vendas</h3>
            <p className="text-sm text-gray-500">Ponto de Venda Oficial e Módulo de Conferência Financeira.</p>
          </div>
        </div>
        
        {(canViewComandas || isAdminOrGerente) && (
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('pdv')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${activeView === 'pdv' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Frente de Caixa (PDV)</button>
            {canViewComandas && (
              <button onClick={() => setActiveView('comandas')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'comandas' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Receipt size={16} className="mr-1"/> Comandas</button>
            )}
            {isAdminOrGerente && (
              <button onClick={() => setActiveView('conferencia')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'conferencia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Calculator size={16} className="mr-1"/> Conferência (Admin)</button>
            )}
          </div>
        )}
      </div>

      {activeView === 'pdv' && pdvView === 'mapa' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in duration-300 min-h-[600px]">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center"><Store className="mr-2 text-green-600"/> Controle de Mesas e Pedidos</h3>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full xl:w-auto">
              {isCaixaOrAdmin && (
                <button onClick={() => { setMesaSelecionada(null); setEntregaSelecionada(null); setPdvTipoPedido('Balcão'); setPdvCarrinho({}); setPdvCliente(null); setPdvView('caixa'); }} className="flex-1 bg-gray-800 text-white px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-gray-900 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
                  <Store size={18} className="mr-2 shrink-0" /> Venda Balcão
                </button>
              )}
              {canDelivery && (
                <button onClick={() => { setMesaSelecionada(null); setEntregaSelecionada(null); setPdvTipoPedido('Entrega'); setPdvCarrinho({}); setPdvCliente(null); setPdvView('caixa'); }} className="flex-1 bg-green-600 text-white px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
                  <Truck size={18} className="mr-2 shrink-0" /> Novo Delivery
                </button>
              )}
              {canDelivery && (
                <button onClick={() => setShowPainelEntregas(true)} className="flex-1 bg-blue-100 text-blue-700 px-4 py-3 sm:py-2.5 rounded-lg font-bold hover:bg-blue-200 transition-colors shadow-sm flex items-center justify-center whitespace-nowrap">
                  <Map size={18} className="mr-2 shrink-0" /> Painel de Entregas
                </button>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {canDelivery && (
              <div>
              <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Truck className="mr-2 text-orange-500" size={20}/> Entregas em Aberto</h4>
              {Object.keys(entregasAbertas).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {Object.entries(entregasAbertas).map(([id, entrega]: any) => {
                    const total = Object.values(entrega.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);
                    return (
                      <button key={id} onClick={() => handleAbrirEntrega(id)} className="p-3 sm:p-4 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-700 shadow-sm flex flex-col justify-center items-start transition-all hover:bg-orange-100">
                        <span className="font-bold text-sm truncate w-full text-left">{entrega.clienteNome}</span>
                        <span className="text-[10px] text-orange-600 mt-1">{entrega.clienteTelefone}</span>
                        <span className="text-sm font-black mt-2">R$ {total.toFixed(2)}</span>
                        {entrega.statusEntrega === 'Em Rota' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold mt-2 inline-block">Em Rota</span>}
                        {entrega.statusEntrega === 'Concluída' && <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold mt-2 inline-block">Entregue (Aguardando Pgto)</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum delivery em aberto no momento.</p>
              )}
            </div>
          )}

            <div>
              <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Store className="mr-2 text-green-500" size={20}/> Mesas</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
                {Array.from({length: qtdMesas}).map((_, i) => {
                  const num = i + 1;
                  const isAberta = mesasAbertas[`mesa_${num}`] || mesasAbertas[num];
                  const total = isAberta ? Object.values(isAberta.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) : 0;
                  return (
                    <div key={num} onClick={() => handleAbrirMesa(num)} className={`relative p-2 sm:p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all h-20 sm:h-24 cursor-pointer ${isAberta ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm hover:bg-orange-100' : 'bg-white border-gray-200 text-gray-400 hover:border-green-500 hover:text-green-600 hover:bg-green-50'}`}>
                      <span className="text-xl sm:text-2xl font-black leading-none pointer-events-none">{num}</span>
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold mt-1 sm:mt-2 pointer-events-none">{isAberta ? `R$ ${total.toFixed(2)}` : 'Livre'}</span>
                      {isAberta && (
                        <button onClick={(e) => handleReimprimirMesa(e, num, isAberta)} className="absolute top-1 sm:top-2 right-1 sm:right-2 p-1 sm:p-1.5 bg-orange-200 hover:bg-orange-300 text-orange-800 rounded-md transition-colors shadow-sm" title="Imprimir Pedido Parcial">
                          <Printer size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => set(ref(db, 'configuracoes/pdv/qtdMesas'), qtdMesas + 1)} className="p-2 sm:p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 hover:bg-gray-50 flex flex-col items-center justify-center transition-all h-20 sm:h-24">
                  <Plus size={20} className="sm:w-6 sm:h-6" />
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold mt-1 sm:mt-2">Adicionar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'pdv' && pdvView === 'caixa' && (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 animate-in slide-in-from-left-4 duration-300 pb-52 lg:pb-0 lg:h-[calc(100vh-140px)]">
          
          <div className="flex flex-col w-full lg:w-[400px] xl:w-[450px] gap-4 h-full shrink-0">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-[300px] max-h-[50vh] lg:max-h-none z-10 overflow-hidden">
              <h3 className="font-bold text-gray-800 flex items-center mb-4 text-lg"><ShoppingCart className="mr-2 text-green-600"/> Caixa Aberto</h3>
            
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg items-center">
              <button onClick={() => setPdvView('mapa')} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-colors" title="Voltar para Mapa">
                <ArrowLeft size={18}/>
              </button>
              {pdvTipoPedido === 'Mesa' ? (
                <div className="flex-1 text-center font-bold text-gray-700">Mesa {mesaSelecionada}</div>
              ) : entregaSelecionada ? (
                <div className="flex-1 text-center font-bold text-green-700">Edição de Delivery</div>
              ) : (
                <div className="flex flex-1 gap-1">
                {isCaixaOrAdmin && <button onClick={() => setPdvTipoPedido('Balcão')} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Balcão' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Balcão</button>}
                {canDelivery && <button onClick={() => setPdvTipoPedido('Entrega')} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Entrega' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Delivery</button>}
                {!isCaixaOrAdmin && !canDelivery && <div className="flex-1 text-center font-bold text-gray-500 py-1.5">Selecione uma mesa no mapa</div>}
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

            <div className="flex-1 overflow-y-auto border-t border-b border-gray-100 py-3 space-y-3 pr-1">
              {(() => {
                const cartItemsList = Object.entries(pdvCarrinho);
                const displayedItems = isCartExpanded ? cartItemsList : cartItemsList.slice(0, 3);
                return (
                  <>
                    {displayedItems.map(([id, item]) => (
                      <div key={id} className="flex justify-between items-start text-base group border-b border-gray-100 pb-4 mb-2 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center">
                            <div className="flex items-center space-x-2 mr-3 bg-gray-100 rounded p-1 shrink-0">
                              <button onClick={() => updateCartItemQtd(id, -1)} className="text-gray-500 hover:text-red-500 hover:bg-white rounded px-2 py-1 transition-colors"><Minus size={18}/></button>
                              <span className="font-black w-6 text-center text-base">{item.qtd}</span>
                              <button onClick={() => updateCartItemQtd(id, 1)} className="text-gray-500 hover:text-green-500 hover:bg-white rounded px-2 py-1 transition-colors"><Plus size={18}/></button>
                            </div>
                            <p className="font-bold text-gray-800 break-words text-lg">{item.nome}</p>
                            {item.enviadoCozinha && item.enviadoCozinha > 0 ? (
                              (item.concluidoCozinha || 0) >= item.enviadoCozinha ? (
                                 <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2 font-bold whitespace-nowrap flex items-center shrink-0"><CheckCircle size={12} className="mr-1"/> Pronto ({item.enviadoCozinha})</span>
                              ) : (item.concluidoCozinha || 0) > 0 ? (
                                 <div className="flex gap-1 ml-2">
                                   <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center shrink-0"><CheckCircle size={12} className="mr-1"/> Pronto ({item.concluidoCozinha})</span>
                                   <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center shrink-0"><Flame size={12} className="mr-1"/> Cozinha ({(item.enviadoCozinha || 0) - (item.concluidoCozinha || 0)})</span>
                                 </div>
                              ) : (
                                 <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full ml-2 font-bold whitespace-nowrap flex items-center shrink-0"><Flame size={12} className="mr-1"/> Na Cozinha ({item.enviadoCozinha})</span>
                              )
                            ) : null}
                          </div>
                          {item.opcoes && (
                            <div className="text-sm text-gray-500 mt-2 pl-16 space-y-1">
                              {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && <p><span className="font-bold text-gray-600">Montagem:</span> {Object.values(item.opcoes.montagem).join(', ')}</p>}
                              {item.opcoes.pontoCarne && <p><span className="font-bold text-gray-600">Ponto:</span> {item.opcoes.pontoCarne}</p>}
                              {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).map((a:any, i:number) => <p key={i}>+ {a.qtd}x AD/ {a.nome}</p>)}
                              {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && <p className="text-red-500 font-medium">- {Object.values(item.opcoes.restricoes).join(', ')}</p>}
                              {item.opcoes.observacao && <p><span className="font-bold text-gray-600">Obs:</span> {item.opcoes.observacao}</p>}
                            </div>
                          )}
                          {item.adicionadoPor && (
                            <p className="text-xs text-gray-400 mt-2 pl-16 flex items-center font-medium">
                              <User size={12} className="mr-1"/> Add por {item.adicionadoPor} às {new Date(item.adicionadoEm || Date.now()).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                            </p>
                          )}
                        </div>
                        <span className="font-black text-gray-800 shrink-0 mt-1 text-lg">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                      </div>
                    ))}
                    {cartItemsList.length > 3 && (
                      <button onClick={() => setIsCartExpanded(!isCartExpanded)} className="w-full text-center text-sm font-bold text-gray-500 hover:text-gray-800 py-3 mt-2 bg-gray-100 rounded-lg transition-colors flex items-center justify-center">
                        {isCartExpanded ? 'Recolher Itens' : `Ver mais ${cartItemsList.length - 3} itens...`}
                      </button>
                    )}
                  </>
                );
              })()}
              {Object.keys(pdvCarrinho).length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-80 py-4">
                  <Receipt size={48} className="mb-3" />
                  <p className="text-sm font-medium">Caixa Livre</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex bg-white p-4 rounded-xl shadow-sm border border-gray-100 shrink-0 flex-col">
            {PaymentSection}
          </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 h-[60vh] lg:h-full min-h-[400px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar hambúrguer, bebida ou combo..." value={pdvSearchProd} onChange={(e) => setPdvSearchProd(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors text-lg" />
              </div>
              <button onClick={() => setShowIaModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-sm shrink-0" title="Garçom IA">
                <Sparkles size={24} />
              </button>
            </div>
            
            <div className="flex overflow-x-auto gap-1 mb-4 pb-2 border-b border-gray-100 shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoriasCardapio.map((cat: any) => (
                <button
                  key={cat}
                  onClick={() => setPdvCategoria(cat)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full font-bold text-xs transition-colors border ${pdvCategoria === cat ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-y-auto pr-2 pb-4">
              {pdvFilteredItems.map(item => (
                <div key={item.id} onClick={() => handleOpenPdvItemModal(item)} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm hover:border-green-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between h-28 sm:h-36 relative overflow-hidden group">
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

          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.1)] z-50 rounded-t-2xl max-h-[50vh] overflow-y-auto">
             {PaymentSection}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit flex flex-col items-center justify-center text-center space-y-4">
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto flex flex-col h-fit max-h-[500px]">
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

      {activeView === 'comandas' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto flex flex-col h-fit max-h-[700px]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-bold text-gray-800 flex items-center"><Receipt className="mr-2 text-blue-500" size={18}/> Comandas (Dia Comercial Atual)</h4>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {vendasHoje.sort((a: any, b: any) => b.timestamp - a.timestamp).map((v: any, index: number) => (
                <div key={v.id} className="p-4 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setViewComanda(v)}>
                  <div>
                    <p className="font-bold text-gray-800 flex items-center">
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono mr-2">#{v.numeroDiario || (vendasHoje.length - index)}</span>
                      {v.descricao || 'Venda Balcão'} {v.tipoPedido ? `(${v.tipoPedido})` : ''}
                    </p>
                    {v.itens && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{v.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}</p>}
                    {v.pagamentos ? (
                      <p className="text-[10px] text-gray-500 mt-1 font-bold">{v.pagamentos.map((p: any) => `${p.nomeTaxa} (R$ ${p.valor.toFixed(2)})`).join(' + ')} • {new Date(v.timestamp).toLocaleTimeString('pt-BR')}</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1 font-bold">{v.nomeTaxa} • {new Date(v.timestamp).toLocaleTimeString('pt-BR')}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="font-bold text-green-600">R$ {v.valor.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {vendasHoje.length === 0 && <p className="p-8 text-center text-gray-400">Nenhuma venda registrada no período comercial atual.</p>}
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
                   {(pdvItemModal.opcoes?.restricoesLivres || []).map((r: any) => (
                     <button key={r.id} onClick={() => setPdvItemOptions((prev: any) => ({ ...prev, restricoes: prev.restricoes.includes(r.nome) ? prev.restricoes.filter((n: any) => n !== r.nome) : [...prev.restricoes, r.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${pdvItemOptions.restricoes.includes(r.nome) ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{r.nome}</button>
                   ))}
                   {(pdvItemModal.opcoes?.restricoesLivres || []).length === 0 && <span className="text-xs text-gray-400">Nenhuma restrição configurada.</span>}
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


      {showIaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center"><Bot size={20} className="mr-2 text-indigo-600"/> Garçom IA</h3>
              <button onClick={() => setShowIaModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="bg-indigo-50 p-3 rounded border border-indigo-100 shadow-sm text-xs text-indigo-800">
              <p>Descreva o pedido como o cliente falou e a IA vai lançar no carrinho. Exemplo:</p>
              <p className="font-mono mt-1">"O cliente quer 2 combos de smash duplo sem cebola e um x-salada com extra de bacon"</p>
            </div>
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Descreva o pedido aqui..."
              className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[120px] resize-y bg-gray-50"
            />
            <button onClick={handlePedidoIA} disabled={isGenerating} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70">
              {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Lendo Cardápio...</> : <><Sparkles size={18} className="mr-2"/> Adicionar ao Carrinho</>}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto sm:max-w-md p-4 rounded-xl shadow-2xl text-white font-bold flex items-start z-[100] transition-all animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-3 shrink-0 mt-0.5" size={20} /> : <AlertTriangle className="mr-3 shrink-0 mt-0.5" size={20} />}
          <span className="whitespace-pre-line break-words text-sm flex-1">{toast.message}</span>
        </div>
      )}

      {viewComanda && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4" onClick={() => setViewComanda(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-gray-800 flex items-center"><Receipt size={20} className="mr-2 text-gray-600"/> Comanda Virtual</h3>
              <button onClick={() => setViewComanda(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto max-h-[70vh]">
               <div className="text-center mb-6">
                 <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter italic">ARTT BURGER</h2>
                 <p className="text-sm text-gray-500 mt-1">Venda: {new Date(viewComanda.timestamp).toLocaleString('pt-BR')}</p>
                 <p className="text-sm font-bold text-gray-600 mt-1">{viewComanda.descricao || 'Venda Balcão'} {viewComanda.tipoPedido ? `(${viewComanda.tipoPedido})` : ''}</p>
                 {viewComanda.clienteNome && <p className="text-sm text-gray-600">Cliente: {viewComanda.clienteNome}</p>}
               </div>

               <div className="border-t border-b border-gray-200 py-4 mb-4 space-y-3">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itens do Pedido</h4>
                 {viewComanda.itens && viewComanda.itens.map((item: any, idx: number) => (
                   <div key={idx} className="flex justify-between items-start text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                     <div className="flex-1 pr-2">
                       <p className="font-bold text-gray-800">{item.qtd}x {item.nome}</p>
                       {item.opcoes && (
                         <div className="text-xs text-gray-500 pl-4 mt-1">
                           {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && <p><span className="font-semibold text-gray-600">Montagem:</span> {Object.values(item.opcoes.montagem).join(', ')}</p>}
                           {item.opcoes.pontoCarne && <p><span className="font-semibold text-gray-600">Ponto:</span> {item.opcoes.pontoCarne}</p>}
                           {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).map((a:any, i:number) => <p key={i}>+ {a.qtd}x AD/ {a.nome}</p>)}
                           {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && <p className="text-red-500 font-semibold">- Sem: {Object.values(item.opcoes.restricoes).join(', ')}</p>}
                           {item.opcoes.observacao && <p><span className="font-semibold text-gray-600">Obs:</span> {item.opcoes.observacao}</p>}
                         </div>
                       )}
                       {item.adicionadoPor && (
                         <p className="text-[9px] text-gray-400 mt-1 pl-4 flex items-center font-medium">
                           <User size={10} className="mr-1"/> Add por {item.adicionadoPor} às {new Date(item.adicionadoEm || Date.now()).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                         </p>
                       )}
                     </div>
                     <span className="font-bold text-gray-800 shrink-0">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                   </div>
                 ))}
               </div>

               {viewComanda.desconto > 0 && (
                 <div className="border-t border-gray-200 py-3 mb-2 flex justify-between items-center text-red-600 bg-red-50 px-3 rounded-lg">
                   <span className="text-sm font-bold flex flex-col">Desconto Aplicado {viewComanda.cupom ? `(${viewComanda.cupom})` : ''} <span className="text-[10px] font-medium mt-0.5">Autorizado por: {viewComanda.descontoAutorizadoPor || 'Desconhecido'}</span></span>
                   <span className="font-black text-lg">- R$ {viewComanda.desconto.toFixed(2)}</span>
                 </div>
               )}

               <div className="space-y-2 mb-4">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pagamento</h4>
                 {viewComanda.pagamentos ? viewComanda.pagamentos.map((p: any, idx: number) => (
                   <div key={idx} className="flex justify-between text-sm">
                     <span className="text-gray-600">{p.nomeTaxa}</span>
                     <span className="font-bold text-gray-800">R$ {p.valor.toFixed(2)}</span>
                   </div>
                 )) : (
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-600">{viewComanda.nomeTaxa}</span>
                     <span className="font-bold text-gray-800">R$ {viewComanda.valor.toFixed(2)}</span>
                   </div>
                 )}
               </div>

               <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                 <span className="font-bold text-gray-800 uppercase">Total</span>
                 <span className="font-black text-2xl text-green-600">R$ {viewComanda.valor.toFixed(2)}</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {showConfModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[95vw] xl:max-w-7xl max-h-[95vh] flex flex-col">
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
            )
            </div>
          </div>
        </div>
      )}

      {showPainelEntregas && canDelivery && (
        <div className="fixed inset-0 bg-gray-100 z-[100] flex flex-col animate-in slide-in-from-bottom-4 duration-300 p-2 sm:p-4">
          <div className="bg-white p-4 rounded-t-xl border-b border-gray-200 flex justify-between items-center shadow-sm shrink-0">
            <h2 className="text-lg sm:text-xl font-black text-gray-800 flex items-center"><Truck className="mr-2 text-blue-600" size={24}/> Painel Geral de Entregas</h2>
            <button onClick={() => setShowPainelEntregas(false)} className="bg-gray-200 text-gray-600 hover:bg-gray-300 p-2 rounded-full transition-colors"><X size={20}/></button>
          </div>
          <div className="flex-1 bg-gray-100 overflow-y-auto rounded-b-xl pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 h-full p-2 sm:p-4">
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
                <div className="bg-orange-50 p-4 border-b border-orange-100 shrink-0">
                  <h3 className="font-bold text-orange-800 flex items-center"><Store className="mr-2" size={18}/> Em Aberto / Editando ({Object.keys(entregasAbertas).length})</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {Object.keys(entregasAbertas).length > 0 ? Object.entries(entregasAbertas).map(([id, entrega]: any) => {
                    const total = Object.values(entrega.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);
                    return (
                      <button key={id} onClick={() => { setShowPainelEntregas(false); handleAbrirEntrega(id); }} className="w-full text-left p-3 rounded-xl border border-orange-200 bg-white hover:bg-orange-50 transition-colors shadow-sm group">
                        <div className="flex justify-between items-start">
                          <div className="overflow-hidden pr-2">
                            <span className="font-bold text-sm text-gray-800 block truncate">#{entrega.numeroDiario || '?'} - {entrega.clienteNome}</span>
                            <span className="text-[10px] text-gray-500 mt-1 block truncate">{entrega.clienteTelefone}</span>
                          </div>
                          <span className="text-sm font-black text-orange-600 shrink-0">R$ {total.toFixed(2)}</span>
                        </div>
                        {entrega.statusEntrega === 'Em Rota' && <div className="mt-2 text-left"><span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold inline-block">Em Rota</span></div>}
                        {entrega.statusEntrega === 'Concluída' && <div className="mt-2 text-left"><span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold inline-block">Entregue (Aguardando Pagamento)</span></div>}
                      </button>
                    );
                  }) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido em aberto.</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
                <div className="bg-blue-50 p-4 border-b border-blue-100 shrink-0">
                  <h3 className="font-bold text-blue-800 flex items-center"><Package className="mr-2" size={18}/> Aguardando Despacho ({vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Pendente').length})</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Pendente').length > 0 ? vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Pendente').sort((a, b) => b.timestamp - a.timestamp).map(v => (
                    <div key={v.id} className="p-3 rounded-xl border border-blue-200 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden pr-2">
                          <span className="font-bold text-sm text-gray-800 block truncate">#{v.numeroDiario || '?'} - {v.clienteNome}</span>
                          <span className="text-[10px] text-gray-500 mt-1 block truncate">Finalizado às {new Date(v.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <span className="text-sm font-black text-blue-600 shrink-0">R$ {v.valor.toFixed(2)}</span>
                      </div>
                      {(() => {
                        const pedido = pedidosCozinha.find(p => p.identificador === `Delivery: ${v.clienteNome}` && Math.abs(p.timestamp - v.timestamp) < 120000);
                        if (!pedido) return <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold mt-2 inline-block">Sem envio à cozinha</span>;
                        return pedido.status === 'Pendente' 
                          ? <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold flex items-center w-fit mt-2"><Flame size={10} className="mr-1"/> Preparando (Cozinha)</span>
                          : <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold flex items-center w-fit mt-2"><CheckCircle size={10} className="mr-1"/> Pronto (Aguardando Motoboy)</span>;
                      })()}
                      <button onClick={() => handleReabrirEntrega(v)} className="mt-3 w-full bg-blue-50 text-blue-700 py-1.5 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors border border-blue-200 flex justify-center items-center">
                        <Pencil size={12} className="mr-1" /> Reabrir para Editar
                      </button>
                    </div>
                  )) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido aguardando despacho.</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
                <div className="bg-green-50 p-4 border-b border-green-100 shrink-0">
                  <h3 className="font-bold text-green-800 flex items-center"><MapPin className="mr-2" size={18}/> Em Rota de Entrega ({vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Em Rota').length})</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Em Rota').length > 0 ? vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Em Rota').sort((a, b) => b.timestamp - a.timestamp).map(v => (
                  <div key={v.id} className="p-3 rounded-xl border border-green-200 bg-white shadow-sm flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden pr-2">
                          <span className="font-bold text-sm text-gray-800 block truncate">#{v.numeroDiario || '?'} - {v.clienteNome}</span>
                          <span className="text-[10px] text-green-600 mt-1 font-bold block truncate">Saiu p/ entrega</span>
                        </div>
                        <span className="text-sm font-black text-green-600 shrink-0">R$ {v.valor.toFixed(2)}</span>
                      </div>
                    <button onClick={() => { if(confirm('Marcar esta entrega como concluída?')) update(ref(db, `vendas_pdv/${v.id}`), { statusEntrega: 'Concluída' }); }} className="mt-3 w-full bg-green-50 text-green-700 py-1.5 rounded text-[10px] font-bold hover:bg-green-100 transition-colors border border-green-200 flex justify-center items-center">
                      <CheckCircle size={12} className="mr-1" /> Finalizar Entrega
                    </button>
                    </div>
                  )) : <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido em rota.</p>}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-full">
                <div className="bg-gray-100 p-4 border-b border-gray-200 shrink-0">
                  <h3 className="font-bold text-gray-800 flex items-center"><CheckCircle className="mr-2 text-gray-500" size={18}/> Entregues Hoje ({vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Concluída' && v.timestamp >= getInicioDiaComercial()).length})</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Concluída' && v.timestamp >= getInicioDiaComercial()).sort((a, b) => b.timestamp - a.timestamp).map(v => (
                    <div key={v.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 shadow-sm flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden pr-2">
                          <span className="font-bold text-sm text-gray-800 block truncate">#{v.numeroDiario || '?'} - {v.clienteNome}</span>
                          <span className="text-[10px] text-gray-500 mt-1 font-bold block truncate">Entregue às {new Date(v.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <span className="text-sm font-black text-gray-600 shrink-0">R$ {v.valor.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {vendasPdv.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Concluída' && v.timestamp >= getInicioDiaComercial()).length === 0 && <p className="text-center text-sm text-gray-400 italic py-8">Nenhum pedido entregue hoje.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDescontoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center justify-center mb-2"><Ticket className="mr-2 text-blue-500"/> Aplicar Desconto</h3>
            <p className="text-sm text-gray-500 text-center">Informe o código promocional ou o valor exato em R$ do desconto a ser aplicado.</p>
            
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Cupom ou Valor (R$)</label>
              <input type="text" value={descontoInput} onChange={e => setDescontoInput(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mt-1" placeholder="Ex: R$ 10,00 ou NATAL15" />
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center">PIN de Autorização (Caixa ou Gerente)</label>
              <input type="tel" maxLength={4} value={descontoPin} onChange={e => setDescontoPin(e.target.value.replace(/\D/g, ''))} className="w-full text-center tracking-[1em] font-mono p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mt-1 text-xl" placeholder="****" style={{ WebkitTextSecurity: 'disc' } as any} />
            </div>

            <div className="flex space-x-3 pt-2">
              <button onClick={() => { setShowDescontoModal(false); setDescontoInput(''); setDescontoPin(''); }} className="flex-1 p-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleAplicarDesconto} disabled={!descontoInput || descontoPin.length !== 4} className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">Autorizar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}