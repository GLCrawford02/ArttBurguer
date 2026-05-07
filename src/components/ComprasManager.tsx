import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario } from '../types';
import { ShoppingCart, Plus, Search, CheckCircle, MessageCircle, Trash2 } from 'lucide-react';

interface ItemCarrinho {
  id: string;
  insumo: Insumo;
  qtd: number;
  valorTotalStr: string;
  lote: string;
  validade: string;
  isIndefinida: boolean;
}

export default function ComprasManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingCart, setPendingCart] = useState(false);
  const [loading, setLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsub = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
      setLoading(false);
    });

    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setFuncionarios(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      else setFuncionarios([]);
    });

    return () => { unsub(); unsubFunc(); };
  }, []);

  const gerarLoteData = () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear()).slice(-2);
    return `${dia}${mes}${ano}`;
  };

  const toggleValidadeIndefinida = async (insumoId: string, atual: boolean) => {
    try {
      await update(ref(db, `insumos/${insumoId}`), { validadeIndefinida: !atual });
      setCarrinho(prev => prev.map(item => item.id === insumoId ? { ...item, isIndefinida: !atual } : item));
    } catch (error) {
      showToast('Erro ao atualizar opção de validade.', 'error');
    }
  };

  const adicionarAoCarrinho = (insumo: Insumo) => {
    if (carrinho.find(item => item.id === insumo.id)) {
      showToast('Este insumo já está na lista da nota.', 'error');
      setSearchTerm('');
      return;
    }
    setCarrinho([{
      id: insumo.id,
      insumo,
      qtd: 1,
      valorTotalStr: '',
      lote: gerarLoteData(),
      validade: '',
      isIndefinida: (insumo as any).validadeIndefinida || false
    }, ...carrinho]);
    setSearchTerm('');
  };

  const atualizarItem = (id: string, field: keyof ItemCarrinho, value: any) => {
    setCarrinho(carrinho.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removerDoCarrinho = (id: string) => {
    setCarrinho(carrinho.filter(item => item.id !== id));
  };

  const handleFinalizarEntrada = async (isConfirmedAdmin = false) => {
    if (carrinho.length === 0) return showToast('A lista de entrada está vazia.', 'error');

    for (const item of carrinho) {
      const valorTotal = Number(item.valorTotalStr) || 0;
      if (item.qtd <= 0) return showToast(`Informe a quantidade para ${item.insumo.nome}.`, 'error');
      if (valorTotal <= 0) return showToast(`O Valor Total é obrigatório para ${item.insumo.nome}.`, 'error');
      if (!item.validade && !item.isIndefinida) return showToast(`Validade obrigatória para ${item.insumo.nome}.`, 'error');
    }

    if (!isConfirmedAdmin) {
      const excedentes = carrinho.filter(item => {
        const qtdAdicionar = item.qtd * (item.insumo.qtdPacote || 1);
        const novoEstoque = (item.insumo.estoqueEstacionario ?? (item.insumo as any).estoqueAtual ?? 0) + (item.insumo.estoqueRotativo ?? 0) + qtdAdicionar;
        return item.insumo.estoqueMaximo && novoEstoque > item.insumo.estoqueMaximo;
      });

      if (excedentes.length > 0) {
        setPendingCart(true);
        setPin('');
        setShowPinModal(true);
        return;
      }
    }

    setLoading(true);
    let sucessos = 0;

    for (const item of carrinho) {
      const qtdAdicionar = item.qtd * (item.insumo.qtdPacote || 1);
      const valorCompraTotal = Number(item.valorTotalStr) || 0;
      
      const insumoRef = ref(db, `insumos/${item.id}`);
      const result = await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          const atualEstoque = currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0;
          const atualEstoqueVols = atualEstoque / (currentData.qtdPacote || 1);
          const atualPrecoMedio = currentData.precoPacote || 0;
          
          const totalVols = atualEstoqueVols + item.qtd;
          const custoAntigo = atualEstoqueVols * atualPrecoMedio;
          const novoPreco = totalVols > 0 ? (custoAntigo + valorCompraTotal) / totalVols : 0;

          currentData.estoqueEstacionario = atualEstoque + qtdAdicionar;
          currentData.precoPacote = Number(novoPreco.toFixed(4));
          currentData.ultimoPrecoCompra = Number((valorCompraTotal / item.qtd).toFixed(4));
          
          if (item.lote || item.validade) {
            if (!currentData.lotes) currentData.lotes = {};
            const newLoteId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
            currentData.lotes[newLoteId] = {
              lote: item.lote || 'N/A',
              validade: item.validade || '',
              quantidade: qtdAdicionar,
              valorTotalLote: valorCompraTotal,
              custoPorVolume: valorCompraTotal / item.qtd
            };
          }
        }
        return currentData;
      });

      if (result.committed) {
        const tipoEmb = (item.insumo.qtdPacote || 1) > 1 ? 'Volume' : 'UN';
        await set(push(ref(db, 'historico_compras')), {
          insumoId: item.id,
          nome: item.insumo.nome,
          qtdPacotes: item.qtd,
          qtdEmbalagens: item.qtd,
          tipoEmbalagem: tipoEmb,
          qtdUnidadesAdicionadas: qtdAdicionar,
          unidadeBase: item.insumo.unidade,
          custoTotal: valorCompraTotal,
          precoMedioAtualizado: result.snapshot.val().precoPacote,
          lote: item.lote,
          validade: item.validade,
          timestamp: Date.now()
        });
        sucessos++;
      }
    }

    setLoading(false);
    if (sucessos > 0) {
      showToast(`Entrada de Mercadoria finalizada! ${sucessos} insumo(s) reabastecido(s).`, 'success');
      setCarrinho([]);
    }
    setPendingCart(false);
  };

  const handlePinSubmit = async () => {
    const func = funcionarios.find(f => f.pin === pin);
    if (!func) return showToast('PIN inválido!', 'error');
    const isAdminOrGerente = Array.isArray(func.cargo) ? func.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono'].includes(c)) : ['Administrador', 'Gerente', 'Dono'].includes(func.cargo as string);
    if (!isAdminOrGerente) {
      showToast('Autorização negada! Requer Gerente ou Administrador.', 'error');
      return;
    }
    setShowPinModal(false);
    if (pendingCart) {
      await handleFinalizarEntrada(true);
    }
  };

  const enviarWhatsApp = async () => {
    const precisandoReposicao = insumos.filter(i => ((i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) + (i.estoqueRotativo ?? 0)) <= (i.alertaMinimo || 0));
    
    if (precisandoReposicao.length === 0) {
      showToast('Nenhum insumo está abaixo do estoque mínimo!', 'success');
      return;
    }

    precisandoReposicao.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    let msg = `*Lista de Reposição de Estoque*\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    let estimativaTotal = 0;

    precisandoReposicao.forEach(i => {
      const atual = (i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) + (i.estoqueRotativo ?? 0);
      const max = i.estoqueMaximo || 0;
      const tipoEmb = (i.qtdPacote || 1) > 1 ? 'Volume(s)' : 'Unidade(s)';
      const precoMedio = i.precoPacote || 0;
      const ultimoPreco = (i as any).ultimoPrecoCompra || precoMedio;
      
      let qtdComprarStr = 'Defina o Est. Máximo no cadastro';
      let qtdComprar = 0;

      if (max > atual) {
        qtdComprar = Math.ceil((max - atual) / (i.qtdPacote || 1));
        qtdComprarStr = `${qtdComprar} ${tipoEmb}`;
        estimativaTotal += qtdComprar * ultimoPreco;
      }

      msg += `*${i.nome}*\n`;
      msg += `- Comprar: ${qtdComprarStr}\n`;
      msg += `- Valor Médio: R$ ${precoMedio.toFixed(2).replace('.', ',')}\n`;
      msg += `- Última Compra: R$ ${ultimoPreco.toFixed(2).replace('.', ',')}\n\n`;
    });

    if (estimativaTotal > 0) {
      msg += `*Estimativa Total p/ Comprar: R$ ${estimativaTotal.toFixed(2).replace('.', ',')}*\n\n`;
    }

    try {
      await set(push(ref(db, 'fila_mensagens')), {
        telefone: '553898119347',
        mensagem: msg,
        status: 'pendente',
        timestamp: Date.now()
      });
      showToast('O robô está enviando a lista para o seu WhatsApp!', 'success');
    } catch (error) {
      showToast('Erro ao acionar o robô.', 'error');
    }
  };

  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''}</span>;
  };
  
  const valorTotalEntrada = carrinho.reduce((acc, item) => acc + (Number(item.valorTotalStr) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ShoppingCart className="mr-2 text-blue-600" size={20} />
              Nova Entrada de Mercadoria (Nota)
            </h3>
            <p className="text-sm text-gray-500 mt-1">Busque os insumos da nota, adicione à lista e finalize tudo de uma vez.</p>
          </div>
          <button onClick={enviarWhatsApp} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-600 transition-colors flex items-center shadow-sm w-full sm:w-auto justify-center">
            <MessageCircle size={18} className="mr-2" />
            Pedir Reposição
          </button>
        </div>
        
        <div className="mt-6 relative w-full lg:w-1/2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar insumo por nome ou SKU para adicionar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 border-2 border-blue-100 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm w-full transition-all bg-white"
          />
          
          {searchTerm && (
            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
               {insumos.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())).map(i => (
                 <div key={i.id} onClick={() => adicionarAoCarrinho(i)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center transition-colors">
                    <div>
                       <p className="font-bold text-gray-800 text-sm">{i.nome}</p>
                       <p className="text-xs text-gray-500 mt-0.5">{i.qtdPacote > 1 ? `Embalagem c/ ${i.qtdPacote} ${i.unidade}` : `Unidade (${i.unidade})`} • Est: {formatarQtdJSX(i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0, i.qtdPacote || 1, i.unidade)}</p>
                    </div>
                    <Plus size={18} className="text-blue-600 bg-blue-100 p-1 rounded-full"/>
                 </div>
               ))}
               {insumos.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                 <p className="p-4 text-center text-sm text-gray-500">Nenhum insumo encontrado.</p>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-bold">
                <th className="p-2">Insumo</th>
                <th className="p-2 w-20 sm:w-28">Lote</th>
                <th className="p-2 w-24 sm:w-36">Validade</th>
                <th className="p-2 w-16 sm:w-24">Qtd (Vol)</th>
                <th className="p-2 w-24 sm:w-32">Valor Total</th>
                <th className="p-2 w-10 sm:w-12 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {carrinho.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-2">
                    <p className="font-bold text-gray-800 text-xs sm:text-sm leading-tight">{item.insumo.nome}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">1 Vol = {item.insumo.qtdPacote || 1} {item.insumo.unidade}</p>
                  </td>
                  <td className="p-2">
                    <input type="text" value={item.lote} onChange={(e) => atualizarItem(item.id, 'lote', e.target.value)} className="w-full p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" placeholder="N/A" />
                  </td>
                  <td className="p-2">
                    <div className="space-y-1">
                      <input type="date" value={item.validade} onChange={(e) => atualizarItem(item.id, 'validade', e.target.value)} disabled={item.isIndefinida} className={`w-full p-1.5 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs ${item.isIndefinida ? 'bg-gray-100 text-gray-400 border-gray-200' : (!item.validade ? 'border-red-300 bg-red-50' : 'border-gray-200')}`} />
                      <label className="flex items-center text-[9px] sm:text-[10px] text-gray-500 cursor-pointer font-medium leading-none">
                        <input type="checkbox" checked={item.isIndefinida} onChange={() => toggleValidadeIndefinida(item.id, item.isIndefinida)} className="mr-1 w-2.5 h-2.5 rounded text-blue-600" />
                        S/ Validade
                      </label>
                    </div>
                  </td>
                  <td className="p-2">
                    <input type="number" min="1" value={item.qtd || ''} onChange={(e) => atualizarItem(item.id, 'qtd', Number(e.target.value))} className="w-full p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white text-center font-bold" />
                  </td>
                  <td className="p-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-[10px] sm:text-xs font-medium">R$</span>
                      <input type="text" value={item.valorTotalStr === '' ? '' : Number(item.valorTotalStr).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; atualizarItem(item.id, 'valorTotalStr', val); }} className="w-full pl-5 sm:pl-6 pr-1 py-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-[10px] sm:text-xs bg-white font-bold" placeholder="0,00" />
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => removerDoCarrinho(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Remover da lista">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {carrinho.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                     <ShoppingCart className="mx-auto text-gray-300 mb-3" size={40} />
                     <p className="text-gray-500 font-medium text-sm">A sua nota de entrada está vazia.</p>
                     <p className="text-gray-400 text-xs mt-1">Busque os insumos na barra acima para adicioná-los à lista.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {carrinho.length > 0 && (
          <div className="bg-blue-50/50 border-t border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div>
               <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Total da Entrada</p>
               <p className="text-3xl font-black text-gray-900">R$ {valorTotalEntrada.toFixed(2).replace('.', ',')}</p>
               <p className="text-xs text-gray-500 mt-1 font-medium">{carrinho.length} item(ns) na lista aguardando salvar</p>
             </div>
             <button onClick={() => handleFinalizarEntrada(false)} disabled={loading} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-70">
                {loading ? <span className="animate-pulse">Salvando Estoque...</span> : <><CheckCircle size={24} className="mr-2"/> Confirmar Entrada de Mercadoria</>}
             </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} />
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Autorização Necessária</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Esta compra excederá o estoque máximo. Digite o PIN de um Administrador ou Gerente para liberar.</p>
            
            <input 
              type="tel"
              autoComplete="off"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-blue-100 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all mb-6"
              placeholder="****"
              style={{ WebkitTextSecurity: 'disc' } as any}
            />
            
            <div className="flex space-x-3">
              <button onClick={() => { setShowPinModal(false); setPendingCart(false); }} className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="flex-1 p-3 text-white bg-blue-600 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}