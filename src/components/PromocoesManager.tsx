import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Produto, Promocao, ItemCombo, IngredienteReceita } from '../types';
import { Tag, Trash2, Search, CheckCircle, AlertTriangle, Pencil, ChevronDown, ChevronUp } from 'lucide-react';

export default function PromocoesManager() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [nomePromocao, setNomePromocao] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState<ItemCombo[]>([]);
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [expandedPromocaoId, setExpandedPromocaoId] = useState<string | null>(null);
  const [tempProdutoId, setTempProdutoId] = useState('');
  const [tempQtd, setTempQtd] = useState(1);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const produtosRef = ref(db, 'produtos');
    const promocoesRef = ref(db, 'promocoes');

    onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutos(list);
      } else {
        setProdutos([]);
      }
    });

    onValue(promocoesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setPromocoes(list);
      } else {
        setPromocoes([]);
      }
    });
  }, []);

  const calcularCustoCombo = () => {
    return itensSelecionados.reduce((acc, item) => {
      const p = produtos.find(prod => prod.id === item.produtoId);
      return acc + ((p?.custoTotal || 0) * item.quantidade);
    }, 0);
  };

  const custoTotalCombo = calcularCustoCombo();

  const addItem = () => {
    if (!tempProdutoId || tempQtd <= 0) return;
    
    const existente = itensSelecionados.findIndex(i => i.produtoId === tempProdutoId);
    if (existente >= 0) {
      const novos = [...itensSelecionados];
      novos[existente].quantidade += tempQtd;
      setItensSelecionados(novos);
    } else {
      setItensSelecionados([...itensSelecionados, { produtoId: tempProdutoId, quantidade: tempQtd }]);
    }
    
    setTempProdutoId('');
    setTempQtd(1);
  };

  const removeItem = (index: number) => {
    setItensSelecionados(itensSelecionados.filter((_, i) => i !== index));
  };

  const salvarPromocao = async () => {
    if (!nomePromocao || itensSelecionados.length === 0) {
      showToast('Preencha o nome e adicione produtos.', 'error');
      return;
    }

    // Achata (combina) todas as fichas técnicas dos produtos do combo
    const mapIngredientes: Record<string, number> = {};
    itensSelecionados.forEach(item => {
      const p = produtos.find(prod => prod.id === item.produtoId);
      if (p && p.ingredientes) {
        p.ingredientes.forEach(ing => {
          mapIngredientes[ing.insumoId] = (mapIngredientes[ing.insumoId] || 0) + (ing.quantidade * item.quantidade);
        });
      }
    });
    
    const ingredientesFinal: IngredienteReceita[] = Object.entries(mapIngredientes).map(([insumoId, quantidade]) => ({ insumoId, quantidade }));

    const promocaoData = {
      nome: nomePromocao,
      itens: itensSelecionados,
      ingredientes: ingredientesFinal,
      custoTotal: custoTotalCombo,
      precoVenda: Number(precoVenda) || 0,
      dataInicio,
      dataFim,
      horarioInicio,
      horarioFim
    };

    try {
      if (editId) {
        await update(ref(db, `promocoes/${editId}`), promocaoData);
        showToast('Promoção atualizada!', 'success');
        setEditId(null);
      } else {
        await set(push(ref(db, 'promocoes')), promocaoData);
        showToast('Promoção salva com sucesso!', 'success');
      }

      setNomePromocao('');
      setPrecoVenda('');
      setItensSelecionados([]);
      setDataInicio('');
      setDataFim('');
      setHorarioInicio('');
      setHorarioFim('');
    } catch (error: any) {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  };

  const handleEdit = (promo: Promocao) => {
    setEditId(promo.id);
    setNomePromocao(promo.nome);
    setPrecoVenda(String(promo.precoVenda || ''));
    setItensSelecionados(promo.itens || []);
    setDataInicio(promo.dataInicio || '');
    setDataFim(promo.dataFim || '');
    setHorarioInicio(promo.horarioInicio || '');
    setHorarioFim(promo.horarioFim || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNomePromocao('');
    setPrecoVenda('');
    setItensSelecionados([]);
    setDataInicio('');
    setDataFim('');
    setHorarioInicio('');
    setHorarioFim('');
  };

  const excluirPromocao = async (id: string) => {
    if (confirm('Deseja excluir esta promoção?')) {
      await remove(ref(db, `promocoes/${id}`));
      showToast('Promoção excluída!', 'success');
    }
  };

  const filteredPromocoes = promocoes.filter(p => (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cadastro de Promoção */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Tag className="mr-2 text-purple-600" size={20} />
          {editId ? 'Editar Promoção / Combo' : 'Nova Promoção / Combo'}
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Nome da Promoção / Combo</label>
            <input type="text" value={nomePromocao} onChange={e => setNomePromocao(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: Combo Família" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Preço Promocional (R$)</label>
            <input type="number" step="0.01" value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Por quanto vai vender o combo?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Data Início (Opcional)</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Data Fim (Opcional)</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Horário Início (Opcional)</label>
              <input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Horário Fim (Opcional)</label>
              <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg space-y-4">
            <p className="text-sm font-bold text-purple-800">Adicionar Produtos ao Combo</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={tempProdutoId} onChange={e => setTempProdutoId(e.target.value)} className="p-2 border border-gray-200 rounded-lg outline-none">
                <option value="">Selecione um produto...</option>
                {produtos.map(p => (<option key={p.id} value={p.id}>{p.nome}</option>))}
              </select>
              <input type="number" min="1" value={tempQtd} onChange={e => setTempQtd(Number(e.target.value))} className="p-2 border border-gray-200 rounded-lg outline-none" placeholder="Quantidade" />
            </div>
            <button onClick={addItem} className="w-full bg-purple-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors">
              Adicionar ao Combo
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700">Itens Inclusos</p>
            <div className="divide-y divide-gray-100 border rounded-lg">
              {itensSelecionados.map((item, idx) => {
                const produto = produtos.find(p => p.id === item.produtoId);
                return (
                  <div key={idx} className="flex justify-between items-center p-3 text-sm">
                    <span><span className="font-bold">{item.quantidade}x</span> {produto?.nome || 'Produto Indisponível'}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-500">Custo: R$ {((produto?.custoTotal || 0) * item.quantidade).toFixed(2)}</span>
                      <button onClick={() => removeItem(idx)} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
              {itensSelecionados.length === 0 && (<p className="p-4 text-center text-gray-400 text-sm italic">Nenhum produto adicionado</p>)}
            </div>
          </div>

          <div className="pt-4 border-t flex gap-2 items-center">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Custo Total do Combo</p>
              <p className="text-2xl font-bold text-red-500">R$ {custoTotalCombo.toFixed(2)}</p>
            </div>
            <button onClick={salvarPromocao} disabled={!nomePromocao || itensSelecionados.length === 0} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {editId ? 'Atualizar Combo' : 'Salvar Combo'}
            </button>
            {editId && (<button onClick={handleCancelEdit} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors">Cancelar</button>)}
          </div>
        </div>
      </div>

      {/* Lista de Promoções */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center"><Tag className="mr-2 text-purple-600" size={20} /> Combos e Promoções</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar combo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm w-full sm:w-64" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {filteredPromocoes.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-purple-100 flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-2 mb-1"><h4 className="font-bold text-purple-900">{p.nome}</h4><span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full uppercase">PROMO</span></div>
                  <p className="text-sm text-gray-500 font-medium">Custo: <span className="text-red-500">R$ {(p.custoTotal || 0).toFixed(2)}</span> | Venda: <span className="text-green-600">R$ {(p.precoVenda || 0).toFixed(2)}</span></p>
                  {(p.dataInicio || p.dataFim || p.horarioInicio || p.horarioFim) && (
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                      {p.dataInicio && `De ${p.dataInicio.split('-').reverse().join('/')} `}
                      {p.dataFim && `até ${p.dataFim.split('-').reverse().join('/')} `}
                      {p.horarioInicio && `das ${p.horarioInicio} `}
                      {p.horarioFim && `às ${p.horarioFim}`}
                    </p>
                  )}
                  <div className="flex items-center mt-1"><button onClick={() => setExpandedPromocaoId(expandedPromocaoId === p.id ? null : p.id)} className="text-xs text-purple-600 hover:text-purple-800 font-bold flex items-center transition-colors">{(p.itens || []).length} produtos inclusos {expandedPromocaoId === p.id ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}</button></div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil size={18} /></button>
                  <button onClick={() => excluirPromocao(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>
              {expandedPromocaoId === p.id && (<div className="mt-4 pt-4 border-t border-purple-50"><p className="text-xs font-bold text-purple-500 uppercase mb-2">Composição:</p><ul className="space-y-1">{(p.itens || []).map((item, idx) => { const prod = produtos.find(prod => prod.id === item.produtoId); return (<li key={idx} className="text-sm flex justify-between"><span className="text-gray-700">{prod?.nome || 'Produto removido'}</span><span className="text-gray-500 font-medium">x{item.quantidade}</span></li>); })}</ul></div>)}
            </div>
          ))}
          {filteredPromocoes.length === 0 && (<div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">Nenhuma promoção encontrada.</p></div>)}
        </div>
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span className="whitespace-pre-line">{toast.message}</span></div>)}
    </div>
  );
}