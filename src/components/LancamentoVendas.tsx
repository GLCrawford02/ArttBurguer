import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { Calculator, CheckCircle, Trash2, AlertTriangle, ArrowRightLeft, Plus, Minus, X, Search, ShoppingCart } from 'lucide-react';

export default function LancamentoVendas() {
  const [taxas, setTaxas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [vendasSistema, setVendasSistema] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  
  const [pagamentos, setPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [descricao, setDescricao] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [carrinho, setCarrinho] = useState<Record<string, { nome: string, preco: number, qtd: number }>>({});
  const [searchTermProd, setSearchTermProd] = useState('');

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const taxasRef = ref(db, 'taxas_cartoes');
    const unsubT = onValue(taxasRef, snap => {
      const data = snap.val();
      if (data) setTaxas(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setTaxas([]);
    });

    const lancamentosRef = ref(db, 'lancamentos_vendas');
    const unsubL = onValue(lancamentosRef, snap => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setLancamentos(list);
      }
      else setLancamentos([]);
    });

    const vendasRef = ref(db, 'historico_vendas');
    const unsubV = onValue(vendasRef, snap => {
      const data = snap.val();
      if (data) setVendasSistema(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setVendasSistema([]);
    });

    const prodRef = ref(db, 'produtos');
    const unsubP = onValue(prodRef, snap => {
      const data = snap.val();
      if (data) setProdutos(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setProdutos([]);
    });

    const promoRef = ref(db, 'promocoes');
    const unsubPr = onValue(promoRef, snap => {
      const data = snap.val();
      if (data) setPromocoes(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setPromocoes([]);
    });

    return () => { unsubT(); unsubL(); unsubV(); unsubP(); unsubPr(); };
  }, []);

  const taxasComPadroes = [
    { id: 'pix', nome: 'Pix', percentual: 0 },
    { id: 'dinheiro', nome: 'Dinheiro', percentual: 0 },
    ...taxas
  ];

  const totalCarrinho = Object.values(carrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const totalPago = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const restante = totalCarrinho - totalPago;

  useEffect(() => {
    if (pagamentos.length === 1 && totalCarrinho > 0) {
      setPagamentos([{ ...pagamentos[0], valor: totalCarrinho }]);
    } else if (totalCarrinho === 0) {
      setPagamentos([{ taxaId: pagamentos[0]?.taxaId || '', valor: 0 }]);
    }
  }, [totalCarrinho]);

  const updateCart = (id: string, nome: string, preco: number, delta: number) => {
    setCarrinho(prev => {
      const current = prev[id] || { nome, preco, qtd: 0 };
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...current, qtd: newQtd } };
    });
  };

  const handlePagamentoChange = (index: number, field: string, value: any) => {
    const novos = [...pagamentos];
    novos[index] = { ...novos[index], [field]: value };
    setPagamentos(novos);
  };

  const addPagamento = () => {
    const restanteAtual = totalCarrinho - pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    setPagamentos([...pagamentos, { taxaId: '', valor: restanteAtual > 0 ? Number(restanteAtual.toFixed(2)) : '' }]);
  };

  const removePagamento = (index: number) => {
    setPagamentos(pagamentos.filter((_, i) => i !== index));
  };

  const openModal = () => {
    setCarrinho({});
    setPagamentos([{ taxaId: '', valor: 0 }]);
    setDescricao('');
    setShowModal(true);
  };

  const handleSalvar = async () => {
    if (totalCarrinho <= 0) {
      showToast('Adicione produtos ao lançamento.', 'error');
      return;
    }
    
    const pagamentosValidos = pagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (pagamentosValidos.length === 0) {
      showToast('Selecione a forma de pagamento com valor maior que zero.', 'error');
      return;
    }
    
    if (Math.abs(restante) > 0.05) {
      showToast(`O valor pago deve ser exatamente igual ao total (R$ ${totalCarrinho.toFixed(2)}).`, 'error');
      return;
    }

    let valorLiquidoTotal = 0;
    const pagamentosProcessados = pagamentosValidos.map(p => {
      const taxaSelecionada = taxasComPadroes.find(t => t.id === p.taxaId);
      const percentual = taxaSelecionada ? Number(taxaSelecionada.percentual || 0) : 0;
      const liq = Number(p.valor) - (Number(p.valor) * (percentual / 100));
      valorLiquidoTotal += liq;
      return {
        taxaId: p.taxaId,
        nomeTaxa: taxaSelecionada ? taxaSelecionada.nome : 'Desconhecida',
        valor: Number(p.valor),
        valorLiquido: liq
      };
    });

    await set(push(ref(db, 'lancamentos_vendas')), {
      valor: totalCarrinho,
      valorLiquido: valorLiquidoTotal,
      pagamentos: pagamentosProcessados,
      taxaId: pagamentosProcessados[0].taxaId,
      nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : pagamentosProcessados[0].nomeTaxa,
      descricao: descricao || 'Venda de Produtos',
      itens: Object.entries(carrinho).map(([id, item]) => ({ id, ...item })),
      timestamp: Date.now()
    });

    setCarrinho({});
    setDescricao('');
    setPagamentos([{ taxaId: '', valor: 0 }]);
    setShowModal(false);
    showToast('Lançamento registrado com sucesso!', 'success');
  };

  const excluir = async (id: string) => {
    if (confirm('Deseja excluir este lançamento do caixa?')) {
      await remove(ref(db, `lancamentos_vendas/${id}`));
      showToast('Lançamento excluído!', 'success');
    }
  };

  const zerarLancamentos = async () => {
    if (confirm('Tem certeza que deseja excluir TODOS os lançamentos de caixa? Esta ação não pode ser desfeita.')) {
      await remove(ref(db, 'lancamentos_vendas'));
      showToast('Todos os lançamentos foram zerados!', 'success');
    }
  };

  const calcularConferencia = () => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();

    const lancamentosHoje = lancamentos
      .filter(l => l.timestamp >= inicioHoje)
      .sort((a, b) => b.timestamp - a.timestamp); // Força a ordenação do mais recente para o mais antigo
    const vendasHoje = vendasSistema.filter(v => v.timestamp >= inicioHoje);

    const totalLancado = lancamentosHoje.reduce((acc, l) => acc + l.valor, 0);
    const totalLiquido = lancamentosHoje.reduce((acc, l) => acc + l.valorLiquido, 0);
    const totalSistema = vendasHoje.reduce((acc, v) => acc + v.receitaVenda, 0);

    const diferenca = totalLancado - totalSistema;

    return { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje };
  };

  const { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje } = calcularConferencia();

  const todosItens = [...produtos.map(p => ({ ...p, tipoItem: 'Produto' })), ...promocoes.map(p => ({ ...p, tipoItem: 'Promoção' }))];
  const filteredItems = todosItens.filter(i => (i.nome || '').toLowerCase().includes(searchTermProd.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-green-100 p-3 rounded-xl mr-4 text-green-600">
          <ArrowRightLeft size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Conferência de Caixa / Vendas</h3>
          <p className="text-sm text-gray-500">Lance os pagamentos recebidos e compare com a produção registrada no sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase">Total Produzido (Sistema)</p>
          <h4 className="text-2xl font-black text-blue-600 mt-2">R$ {totalSistema.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">Registrado na aba Produção hoje</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase">Total Lançado (Caixa Físico/Cartões)</p>
          <h4 className="text-2xl font-black text-green-600 mt-2">R$ {totalLancado.toFixed(2)}</h4>
          <p className="text-xs text-green-600 font-bold mt-1">Valor Líquido (Após Taxas): R$ {totalLiquido.toFixed(2)}</p>
        </div>
        <div className={`bg-white p-6 rounded-xl shadow-sm border ${diferenca === 0 ? 'border-green-100' : diferenca > 0 ? 'border-blue-100' : 'border-red-100'}`}>
          <p className="text-sm font-bold text-gray-500 uppercase">Diferença de Caixa</p>
          <h4 className={`text-2xl font-black mt-2 ${diferenca === 0 ? 'text-green-600' : diferenca > 0 ? 'text-blue-600' : 'text-red-600'}`}>
            R$ {Math.abs(diferenca).toFixed(2)} {diferenca > 0 ? '(Sobra)' : diferenca < 0 ? '(Quebra de Caixa)' : ''}
          </h4>
          <p className="text-xs text-gray-400 mt-1">Lançado - Produzido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 h-fit flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-green-100 p-4 rounded-full text-green-600 mb-2">
            <ShoppingCart size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Novo Lançamento</h3>
            <p className="text-sm text-gray-500 mt-2">Recrie a venda selecionando os produtos e a forma de pagamento para conferir o caixa com precisão.</p>
          </div>
          <button onClick={openModal} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center mt-4">
            <Plus size={20} className="mr-2" /> Criar Lançamento
          </button>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h4 className="font-bold text-gray-800">Lançamentos de Hoje</h4>
            {lancamentosHoje.length > 0 && (
              <button onClick={zerarLancamentos} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center">
                <Trash2 size={14} className="mr-1" /> Zerar Tudo
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {lancamentosHoje.map(l => (
              <div key={l.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-bold text-gray-800">{l.descricao || 'Venda de Produtos'}</p>
                  {l.itens && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={l.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}>
                      {l.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}
                    </p>
                  )}
                  {l.pagamentos ? (
                    <p className="text-[10px] text-gray-500 mt-1 font-bold">{l.pagamentos.map((p: any) => `${p.nomeTaxa} (R$ ${p.valor.toFixed(2)})`).join(' + ')} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">{l.nomeTaxa} • {new Date(l.timestamp).toLocaleTimeString('pt-BR')}</p>
                  )}
                </div>
                <div className="flex items-center space-x-4"><div className="text-right"><p className="font-bold text-green-600">R$ {l.valor.toFixed(2)}</p><p className="text-[10px] text-gray-400 font-bold">Líquido: R$ {l.valorLiquido.toFixed(2)}</p></div><button onClick={()=>excluir(l.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></div>
              </div>
            ))}
            {lancamentosHoje.length === 0 && <p className="p-8 text-center text-gray-400">Nenhum lançamento no caixa hoje.</p>}
          </div>
        </div>
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-gray-800 flex items-center"><ShoppingCart size={20} className="mr-2 text-green-600"/> Lançamento de Produtos</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
            </div>
            
            <div className="p-4 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
              <div className="flex-1 flex flex-col md:border-r border-gray-100 md:pr-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Buscar hambúrguer ou combo..." value={searchTermProd} onChange={(e) => setSearchTermProd(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors" />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                  {filteredItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:border-green-200 hover:bg-green-50 transition-colors group">
                      <div>
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <p className="text-sm font-bold text-green-600">R$ {(item.precoVenda || 0).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        <button onClick={() => updateCart(item.id, item.nome, item.precoVenda || 0, -1)} className="p-1 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"><Minus size={16}/></button>
                        <span className="font-bold w-6 text-center text-gray-800">{carrinho[item.id]?.qtd || 0}</span>
                        <button onClick={() => updateCart(item.id, item.nome, item.precoVenda || 0, 1)} className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"><Plus size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {filteredItems.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum produto encontrado.</p>}
                </div>
              </div>

              <div className="w-full md:w-80 flex flex-col pt-4 md:pt-0">
                <h4 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Resumo da Venda</h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {Object.entries(carrinho).map(([id, item]) => (
                    <div key={id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600"><span className="font-bold text-gray-800">{item.qtd}x</span> {item.nome}</span>
                      <span className="font-bold text-gray-800">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.keys(carrinho).length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Nenhum produto adicionado</p>}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100 mb-2">
                    <span className="font-bold text-green-800 uppercase text-sm">Valor Total</span>
                    <span className="font-black text-xl text-green-600">R$ {totalCarrinho.toFixed(2)}</span>
                  </div>
                  
                  <div className="space-y-3 mb-2">
                    <p className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Pagamento</p>
                    {pagamentos.map((p, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select value={p.taxaId} onChange={e => handlePagamentoChange(index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm">
                          <option value="">Selecione...</option>
                          {taxasComPadroes.map(t => (
                            <option key={t.id} value={t.id}>{t.nome} {t.percentual > 0 ? `(${t.percentual}%)` : ''}</option>
                          ))}
                        </select>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                          <input 
                            type="text" 
                            value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                            onChange={e => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const val = digits ? parseInt(digits, 10) / 100 : '';
                              handlePagamentoChange(index, 'valor', val);
                            }} 
                            className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm text-right" 
                            placeholder="0,00" 
                          />
                        </div>
                        {pagamentos.length > 1 && (
                          <button onClick={() => removePagamento(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        )}
                      </div>
                    ))}

                    {restante > 0.05 && (
                      <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-red-500 font-bold">Falta: R$ {restante.toFixed(2)}</span>
                        <button onClick={addPagamento} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={14} className="mr-1" /> Dividir Pagamento</button>
                      </div>
                    )}
                    {restante < -0.05 && (
                      <div className="text-sm mt-2">
                        <span className="text-orange-500 font-bold">Ajuste o valor (Passou R$ {Math.abs(restante).toFixed(2)})</span>
                      </div>
                    )}
                  </div>
                  
                  <input type="text" placeholder="Observação (Opcional)" value={descricao} onChange={e=>setDescricao(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" />
                  
                  <button onClick={handleSalvar} disabled={totalCarrinho <= 0 || pagamentos.some(p => !p.taxaId) || Math.abs(restante) > 0.05} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50">Lançar no Caixa</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}