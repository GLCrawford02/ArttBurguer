import React, { useState, useEffect } from 'react';
import { ref, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, IngredienteReceita } from '../types';
import { Calculator, Search, CheckCircle, AlertTriangle, Plus, Trash2, X, Sparkles, Bot, Loader2, Settings, Pencil } from 'lucide-react';

export default function ModalProduto({ isOpen, onClose, produtoEdit, insumos, produtos, categoriasDb, showToast, embalagensPadrao }: any) {
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<IngredienteReceita[]>([]);
  
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [novaCategoriaForm, setNovaCategoriaForm] = useState('');

  const [criarDuplo, setCriarDuplo] = useState(false);
  const [cadastroMode, setCadastroMode] = useState<'manual' | 'ia'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  const [tempInsumoId, setTempInsumoId] = useState('');
  const [tempQtd, setTempQtd] = useState(0);
  const [searchInsumoReceita, setSearchInsumoReceita] = useState('');
  const [showInsumoReceitaDropdown, setShowInsumoReceitaDropdown] = useState(false);

  const [tiposMontagem, setTiposMontagem] = useState<{id: string, nome: string}[]>([]);
  const [pontosCarne, setPontosCarne] = useState<{id: string, nome: string}[]>([]);
  const [adicionais, setAdicionais] = useState<{id: string, nome: string, preco: number, insumoId?: string | null, quantidade?: number}[]>([]);
  const [novaMontagem, setNovaMontagem] = useState('');
  const [novoPonto, setNovoPonto] = useState('');
  const [novoAdicionalNome, setNovoAdicionalNome] = useState('');
  const [novoAdicionalPreco, setNovoAdicionalPreco] = useState('');
  const [novoAdicionalInsumoId, setNovoAdicionalInsumoId] = useState('');
  const [novoAdicionalQtd, setNovoAdicionalQtd] = useState('');
  const [showAdicionalDropdown, setShowAdicionalDropdown] = useState(false);
  const [restricoes, setRestricoes] = useState<{id: string, nome: string, insumoId: string | null}[]>([]);
  const [novaRestricao, setNovaRestricao] = useState('');
  const [novaRestricaoInsumoId, setNovaRestricaoInsumoId] = useState('');
  const [showRestricaoDropdown, setShowRestricaoDropdown] = useState(false);
  const [produtoCopiaId, setProdutoCopiaId] = useState('');
  const [searchProdutoCopia, setSearchProdutoCopia] = useState('');
  const [showProdutoCopiaDropdown, setShowProdutoCopiaDropdown] = useState(false);
  const [searchCategoria, setSearchCategoria] = useState('');
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [editModeIng, setEditModeIng] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (produtoEdit) {
      setNomeProduto(produtoEdit.nome || '');
      setCategoria((produtoEdit as any).categoria || '');
      setSearchCategoria((produtoEdit as any).categoria || '');
      setPrecoVenda(String((produtoEdit as any).precoVenda || ''));
      setIngredientesSelecionados(produtoEdit.ingredientes || []);
      setTiposMontagem((produtoEdit as any).opcoes?.tiposMontagem || []);
      setPontosCarne((produtoEdit as any).opcoes?.pontosCarne || []);
      setAdicionais((produtoEdit as any).opcoes?.adicionais || []);
      setRestricoes((produtoEdit as any).opcoes?.restricoesLivres || []);
      setCadastroMode('manual');
    } else {
      setNomeProduto('');
      setCategoria('');
      setSearchCategoria('');
      setPrecoVenda('');
      setIngredientesSelecionados([]);
      setTiposMontagem([]);
      setPontosCarne([]);
      setAdicionais([]);
      setRestricoes([]);
      setCriarDuplo(false);
      setCadastroMode('manual');
    }
    setSearchProdutoCopia('');
    setProdutoCopiaId('');
    setEditModeIng({});
  }, [produtoEdit, isOpen]);

  if (!isOpen) return null;

  const calcularCustoIngrediente = (ing: IngredienteReceita) => {
    const insumo = insumos.find((i: Insumo) => i.id === ing.insumoId);
    if (!insumo || !(insumo.qtdPacote || 1)) return 0;
    return (insumo.precoPacote / (insumo.qtdPacote || 1)) * ing.quantidade;
  };

  const custoTotalFicha = ingredientesSelecionados.reduce((acc, ing) => acc + calcularCustoIngrediente(ing), 0);

  const addIngrediente = () => {
    if (!tempInsumoId || tempQtd <= 0) return;
    const existente = ingredientesSelecionados.find(i => i.insumoId === tempInsumoId);
    if (existente) {
      setIngredientesSelecionados(ingredientesSelecionados.map(i => i.insumoId === tempInsumoId ? { ...i, quantidade: i.quantidade + tempQtd } : i));
    } else {
      setIngredientesSelecionados([...ingredientesSelecionados, { insumoId: tempInsumoId, quantidade: tempQtd }]);
    }
    setTempInsumoId('');
    setTempQtd(0);
    setSearchInsumoReceita('');
  };

  const removeIngrediente = (index: number) => {
    setIngredientesSelecionados(ingredientesSelecionados.filter((_, i) => i !== index));
    setEditModeIng({});
  };

  const handleUpdateIngrediente = (idx: number, newQtd: number) => {
    const newIngs = [...ingredientesSelecionados];
    newIngs[idx].quantidade = newQtd;
    setIngredientesSelecionados(newIngs);
    setEditModeIng(prev => { const n = {...prev}; delete n[idx]; return n; });
  };

  const handleAddCategoria = async () => {
    if (!novaCategoriaForm.trim()) return;
    await set(push(ref(db, 'categorias_produtos')), { nome: novaCategoriaForm.trim() });
    setNovaCategoriaForm('');
  };

  const handleDeleteCategoria = async (id: string) => {
    if (window.confirm('Excluir esta categoria?')) {
      await remove(ref(db, `categorias_produtos/${id}`));
    }
  };

  const handleAddMontagem = () => {
    if (!novaMontagem.trim()) return;
    setTiposMontagem([...tiposMontagem, { id: Date.now().toString(), nome: novaMontagem.trim() }]);
    setNovaMontagem('');
  };
  const handleRemoveMontagem = (id: string) => setTiposMontagem(tiposMontagem.filter(i => i.id !== id));

  const handleAddPonto = () => {
    if (!novoPonto.trim()) return;
    setPontosCarne([...pontosCarne, { id: Date.now().toString(), nome: novoPonto.trim() }]);
    setNovoPonto('');
  };
  const handleRemovePonto = (id: string) => setPontosCarne(pontosCarne.filter(i => i.id !== id));

  const handleAddAdicional = () => {
    if (!novoAdicionalNome.trim()) return;
    setAdicionais([...adicionais, { id: Date.now().toString(), nome: novoAdicionalNome.trim(), preco: Number(novoAdicionalPreco) || 0, insumoId: novoAdicionalInsumoId || null, quantidade: Number(novoAdicionalQtd) || 1 }]);
    setNovoAdicionalNome('');
    setNovoAdicionalPreco('');
    setNovoAdicionalInsumoId('');
    setNovoAdicionalQtd('');
  };
  const handleRemoveAdicional = (id: string) => setAdicionais(adicionais.filter(i => i.id !== id));

  const handleAddRestricao = () => {
    if (!novaRestricao.trim()) return;
    setRestricoes([...restricoes, { id: Date.now().toString(), nome: novaRestricao.trim(), insumoId: novaRestricaoInsumoId || null }]);
    setNovaRestricao('');
    setNovaRestricaoInsumoId('');
  };
  const handleRemoveRestricao = (id: string) => setRestricoes(restricoes.filter(i => i.id !== id));

  const handleCopiarOpcoes = () => {
    if (!produtoCopiaId) return;
    const p = produtos.find((x: Produto) => x.id === produtoCopiaId);
    if (p && (p as any).opcoes) {
      setTiposMontagem((p as any).opcoes.tiposMontagem || []);
      setPontosCarne((p as any).opcoes.pontosCarne || []);
      setAdicionais((p as any).opcoes.adicionais || []);
      setRestricoes((p as any).opcoes.restricoesLivres || []);
      showToast('Opções copiadas com sucesso!', 'success');
    } else {
      showToast('Este produto não possui opções cadastradas.', 'error');
    }
  };

  const salvarProduto = async () => {
    const missingFields = [];
    if (!nomeProduto) missingFields.push('Nome do Produto');
    if (!categoria) missingFields.push('Categoria');
    if (ingredientesSelecionados.length === 0) missingFields.push('Composição (Pelo menos 1 ingrediente)');

    if (missingFields.length > 0) {
      return showToast(`Preencha os campos obrigatórios:\n- ${missingFields.join('\n- ')}`, 'error');
    }

    if (criarDuplo && !produtoEdit) {
      const temDelivery = produtos.find((p: Produto) => (p.nome || '').trim().toLowerCase() === `/ ${nomeProduto}`.trim().toLowerCase());
      const temSalao = produtos.find((p: Produto) => (p.nome || '').trim().toLowerCase() === `% ${nomeProduto}`.trim().toLowerCase());
      if (temDelivery || temSalao) return showToast('Já existe um produto de Salão/Delivery com este nome.', 'error');
    } else {
      const duplicado = produtos.find((p: Produto) => p.id !== produtoEdit?.id && (p.nome || '').trim().toLowerCase() === nomeProduto.trim().toLowerCase());
      if (duplicado) return showToast('Já existe um produto cadastrado com este nome.', 'error');
    }
    
    try {
      const opcoesData = { tiposMontagem, pontosCarne, adicionais, restricoesLivres: restricoes };
      const produtosRef = ref(db, 'produtos');
      
      if (produtoEdit) {
        await update(ref(db, `produtos/${produtoEdit.id}`), {
          nome: nomeProduto, categoria, ingredientes: ingredientesSelecionados,
          custoTotal: custoTotalFicha || 0, precoVenda: Number(precoVenda) || 0, opcoes: opcoesData
        });
      } else if (criarDuplo) {
        const hasConfig = (embalagensPadrao?.delivery?.length > 0 || embalagensPadrao?.salao?.length > 0);

        const buildIngsByIds = (extras: {insumoId: string, quantidade: number}[]) => {
          const novos = ingredientesSelecionados.map(ing => ({ ...ing }));
          extras.forEach(extra => {
            if (!extra.insumoId) return;
            const existente = novos.find(i => i.insumoId === extra.insumoId);
            if (existente) existente.quantidade += extra.quantidade;
            else novos.push({ insumoId: extra.insumoId, quantidade: extra.quantidade });
          });
          return novos;
        };

        const buildIngsByNames = (extras: {nome: string, qtd: number}[]) => {
          const getId = (nomeBuscado: string) => insumos.find((i: Insumo) => (i.nome || '').trim().toLowerCase() === (nomeBuscado || '').trim().toLowerCase())?.id;
          const novos = ingredientesSelecionados.map(ing => ({ ...ing }));
          extras.forEach(extra => {
            const id = getId(extra.nome);
            if (id) {
              const existente = novos.find(i => i.insumoId === id);
              if (existente) existente.quantidade += extra.qtd;
              else novos.push({ insumoId: id, quantidade: extra.qtd });
            }
          });
          return novos;
        };

        const ingDelivery = hasConfig
          ? buildIngsByIds(embalagensPadrao.delivery || [])
          : buildIngsByNames([{ nome: 'CH3', qtd: 1 }, { nome: 'Papel laminado', qtd: 1 }, { nome: 'Lacre', qtd: 1 }, { nome: 'Adesivo nominal', qtd: 1 }, { nome: 'Sacola', qtd: 1 }, { nome: 'Sache Ketchup', qtd: 1 }, { nome: 'Sache Maionese', qtd: 1 }, { nome: 'Guardanapo', qtd: 1 }]);
        const ingSalao = hasConfig
          ? buildIngsByIds(embalagensPadrao.salao || [])
          : buildIngsByNames([{ nome: 'Palito Golf', qtd: 1 }, { nome: 'Papel acoplado', qtd: 1 }]);
        const calcCusto = (ings: IngredienteReceita[]) => ings.reduce((acc, ing) => acc + calcularCustoIngrediente(ing), 0);

        await set(push(produtosRef), { nome: `/ ${nomeProduto}`, categoria, ingredientes: ingDelivery, custoTotal: calcCusto(ingDelivery) || 0, precoVenda: Number(precoVenda) || 0, opcoes: opcoesData });
        await set(push(produtosRef), { nome: `% ${nomeProduto}`, categoria, ingredientes: ingSalao, custoTotal: calcCusto(ingSalao) || 0, precoVenda: Number(precoVenda) || 0, opcoes: opcoesData });
      } else {
        await set(push(produtosRef), {
          nome: nomeProduto, categoria, ingredientes: ingredientesSelecionados,
          custoTotal: custoTotalFicha || 0, precoVenda: Number(precoVenda) || 0, opcoes: opcoesData
        });
      }
      showToast(produtoEdit ? 'Produto atualizado com sucesso!' : 'Produto salvo com sucesso!', 'success');
      onClose();
    } catch (error: any) {
      showToast('Erro ao salvar produto: ' + error.message, 'error');
    }
  };

  const hasEmbalagemConfig = (embalagensPadrao?.delivery?.length > 0 || embalagensPadrao?.salao?.length > 0);
  const insumosFaltantes: string[] = hasEmbalagemConfig
    ? [...new Set([...(embalagensPadrao?.delivery || []), ...(embalagensPadrao?.salao || [])].map((e: any) => e.insumoId))]
        .filter((id: string) => !insumos.find((i: Insumo) => i.id === id))
        .map(() => 'Insumo removido do sistema')
    : ['Palito Golf', 'Papel acoplado', 'Papel laminado', 'CH3', 'Lacre', 'Adesivo nominal', 'Sacola', 'Sache Ketchup', 'Sache Maionese', 'Guardanapo']
        .filter(nome => !insumos.some((i: Insumo) => (i.nome || '').trim().toLowerCase() === nome.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-50 rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-w-5xl max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Calculator className="mr-2 text-blue-600" size={20} />
            {produtoEdit ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <div className="flex items-center gap-2">
            {!produtoEdit && (
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setCadastroMode('manual')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${cadastroMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Manual</button>
                <button onClick={() => setCadastroMode('ia')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center ${cadastroMode === 'ia' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><Sparkles size={12} className="mr-1"/> IA</button>
              </div>
            )}
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"><X size={20} /></button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {cadastroMode === 'manual' || produtoEdit ? (
            <div className="space-y-6">
            {/* Informações Principais */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2">Informações Principais</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="space-y-1 sm:col-span-6">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome do Produto</label>
                  <input type="text" value={nomeProduto} onChange={e => setNomeProduto(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="Ex: Smash Burger Duplo" />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <div className="flex justify-between items-end"><label className="text-xs font-bold text-gray-500 uppercase">Categoria</label><button type="button" onClick={() => setShowCategoriasModal(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase leading-none pb-0.5">Gerenciar</button></div>
                  <div className="relative w-full">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
                      <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                      <input type="text" value={searchCategoria} onChange={e => { setSearchCategoria(e.target.value); setCategoria(e.target.value); setShowCategoriaDropdown(true); }} onFocus={() => setShowCategoriaDropdown(true)} onBlur={() => setTimeout(() => setShowCategoriaDropdown(false), 200)} className="w-full p-2 outline-none rounded-lg text-sm bg-transparent" placeholder="Buscar ou digitar..." />
                    </div>
                    {showCategoriaDropdown && categoriasDb.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {categoriasDb.filter((c: any) => c.nome.toLowerCase().includes(searchCategoria.toLowerCase())).map((c: any) => (
                          <div key={c.id} onClick={() => { setCategoria(c.nome); setSearchCategoria(c.nome); setShowCategoriaDropdown(false); }} className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{c.nome}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">Preço de Venda</label>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                    <input type="text" value={precoVenda === '' ? '' : Number(precoVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setPrecoVenda(val); }} className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="0,00" />
                  </div>
                </div>
              </div>
              {!produtoEdit && (
                <div className="pt-2"><label className="flex items-center space-x-2 cursor-pointer w-fit"><input type="checkbox" checked={criarDuplo} onChange={(e) => setCriarDuplo(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" /><span className="text-xs font-bold text-gray-600 cursor-pointer" title="Embalagens de salão e delivery serão adicionadas automaticamente a cada ficha correspondente">Criar SKUs Delivery (/) e Salão (%) com embalagens automáticas</span></label>{criarDuplo && insumosFaltantes.length > 0 && (<div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start mt-2"><AlertTriangle className="text-yellow-600 mr-2 shrink-0 mt-0.5" size={16} /><div><p className="text-xs font-bold text-yellow-800">Insumos de embalagem faltando!</p><p className="text-xs font-mono text-yellow-600 mt-1">{insumosFaltantes.join(', ')}</p></div></div>)}</div>
              )}
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2">Composição (Ficha Técnica)</h4>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                <p className="text-sm font-bold text-gray-700">Adicionar Insumo à Receita</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative w-full">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-colors h-full"><Search size={16} className="ml-3 text-gray-400 shrink-0" /><input type="text" value={searchInsumoReceita} onChange={e => { setSearchInsumoReceita(e.target.value); setTempInsumoId(''); setShowInsumoReceitaDropdown(true); }} onFocus={() => setShowInsumoReceitaDropdown(true)} onBlur={() => setTimeout(() => setShowInsumoReceitaDropdown(false), 200)} className="w-full p-2 outline-none rounded-lg text-sm bg-transparent" placeholder="Buscar insumo para a receita..." /></div>
                    {showInsumoReceitaDropdown && (<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">{(() => { const embIds = new Set([...(embalagensPadrao?.delivery || []), ...(embalagensPadrao?.salao || [])].map((e: any) => e.insumoId)); return insumos.filter((i: Insumo) => !embIds.has(i.id)).filter((i: Insumo) => i.nome.toLowerCase().includes(searchInsumoReceita.toLowerCase())).map((i: Insumo) => (<div key={i.id} onClick={() => { setTempInsumoId(i.id); setSearchInsumoReceita(i.nome); setShowInsumoReceitaDropdown(false); }} className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center"><span className="font-medium text-gray-800">{i.nome}</span><span className="text-gray-400 text-xs ml-2">{i.unidade}</span></div>)); })()}</div>)}
                  </div>
                  <div className="flex space-x-2"><input type="number" value={tempQtd} onChange={e => setTempQtd(Number(e.target.value))} className="w-24 p-2 border border-gray-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500" placeholder="Qtd" /><button onClick={addIngrediente} className="flex-1 bg-gray-800 text-white p-2 rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors shadow-sm">Adicionar à Lista</button></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="divide-y divide-gray-100 border border-gray-200 bg-white rounded-lg max-h-[300px] overflow-y-auto">
                  {ingredientesSelecionados.map((ing, idx) => {
                    const insumo = insumos.find((i: Insumo) => i.id === ing.insumoId);
                    const isEditing = editModeIng[idx];
                    return (
                      <div key={idx} className="flex justify-between items-center p-3 text-sm">
                        <span className="font-medium text-gray-800">{insumo?.nome} {!isEditing && <span className="text-gray-500 font-normal ml-1">- {ing.quantidade}{insumo?.unidade}</span>}</span>
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-500 font-medium">R$ {calcularCustoIngrediente(ing).toFixed(2)}</span>
                          {!isEditing ? (<button onClick={() => setEditModeIng(prev => ({...prev, [idx]: true}))} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Settings size={16} /></button>) : (<div className="flex items-center space-x-2 animate-in fade-in zoom-in duration-200"><input type="number" step="any" value={ing.quantidade || ''} onChange={(e) => handleUpdateIngrediente(idx, Number(e.target.value))} className="w-20 p-1 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs" /><button onClick={() => removeIngrediente(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Remover"><Trash2 size={16} /></button><button onClick={() => setEditModeIng(prev => ({...prev, [idx]: false}))} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded transition-colors" title="Concluir Edição"><X size={16} /></button></div>)}
                        </div>
                      </div>
                    );
                  })}
                  {ingredientesSelecionados.length === 0 && (<p className="p-4 text-center text-gray-400 text-sm italic">Nenhum ingrediente adicionado</p>)}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                <h4 className="text-sm font-bold text-gray-700">Opções Adicionais</h4>
                <div className="flex items-center space-x-2">
                  <div className="relative w-64"><div className="flex items-center border border-gray-200 rounded text-xs bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500"><Search size={12} className="ml-1.5 text-gray-400 shrink-0" /><input type="text" value={searchProdutoCopia} onChange={e => { setSearchProdutoCopia(e.target.value); setProdutoCopiaId(''); setShowProdutoCopiaDropdown(true); }} onFocus={() => setShowProdutoCopiaDropdown(true)} onBlur={() => setTimeout(() => setShowProdutoCopiaDropdown(false), 200)} className="w-full p-1.5 outline-none rounded bg-transparent" placeholder="Copiar de outro produto..." /></div>{showProdutoCopiaDropdown && (<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-xl max-h-48 overflow-y-auto">{produtos.filter((p: Produto) => p.id !== produtoEdit?.id && (p as any).opcoes && p.nome.toLowerCase().includes(searchProdutoCopia.toLowerCase())).map((p: Produto) => (<div key={p.id} onClick={() => { setProdutoCopiaId(p.id); setSearchProdutoCopia(p.nome); setShowProdutoCopiaDropdown(false); }} className="p-2 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{p.nome}</span></div>))}</div>)}</div>
                  <button onClick={handleCopiarOpcoes} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors">Copiar</button>
                </div>
              </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg"><p className="text-xs font-bold text-gray-700 uppercase mb-2">Tipos de Montagem</p><div className="flex space-x-2 mb-3"><input type="text" value={novaMontagem} onChange={e => setNovaMontagem(e.target.value)} placeholder="Ex: No Prato" className="flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" /><button onClick={handleAddMontagem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus size={16}/></button></div><div className="space-y-1 max-h-32 overflow-y-auto">{tiposMontagem.map(t => (<div key={t.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border border-gray-100"><span>{t.nome}</span><div className="flex space-x-1"><button onClick={() => { setNovaMontagem(t.nome); handleRemoveMontagem(t.id); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded h-fit" title="Editar"><Pencil size={12}/></button><button onClick={() => handleRemoveMontagem(t.id)} className="text-red-500 hover:bg-red-100 p-1 rounded h-fit" title="Excluir"><Trash2 size={12}/></button></div></div>))}</div></div>
                <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg"><p className="text-xs font-bold text-gray-700 uppercase mb-2">Ponto da Carne</p><div className="flex space-x-2 mb-3"><input type="text" value={novoPonto} onChange={e => setNovoPonto(e.target.value)} placeholder="Ex: Mal Passada" className="flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" /><button onClick={handleAddPonto} className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"><Plus size={16}/></button></div><div className="space-y-1 max-h-32 overflow-y-auto">{pontosCarne.map(t => (<div key={t.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border border-gray-100"><span>{t.nome}</span><div className="flex space-x-1"><button onClick={() => { setNovoPonto(t.nome); handleRemovePonto(t.id); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded h-fit" title="Editar"><Pencil size={12}/></button><button onClick={() => handleRemovePonto(t.id)} className="text-red-500 hover:bg-red-100 p-1 rounded h-fit" title="Excluir"><Trash2 size={12}/></button></div></div>))}</div></div>
                <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg"><p className="text-xs font-bold text-gray-700 uppercase mb-2">Adicionais (Cobrados)</p><div className="flex flex-col gap-2 mb-3"><div className="relative"><input type="text" value={novoAdicionalNome} onChange={e => { setNovoAdicionalNome(e.target.value); setNovoAdicionalInsumoId(''); setShowAdicionalDropdown(true); }} onFocus={() => setShowAdicionalDropdown(true)} onBlur={() => setTimeout(() => setShowAdicionalDropdown(false), 200)} placeholder="Ex: Bacon" className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" />{showAdicionalDropdown && novoAdicionalNome && (<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-xl max-h-48 overflow-y-auto">{insumos.filter((i: Insumo) => i.nome.toLowerCase().includes(novoAdicionalNome.toLowerCase())).map((i: Insumo) => (<div key={i.id} onMouseDown={() => { setNovoAdicionalNome(i.nome); setNovoAdicionalInsumoId(i.id); setShowAdicionalDropdown(false); }} className="p-2 text-xs hover:bg-green-50 cursor-pointer border-b border-gray-50 flex justify-between items-center"><span className="font-medium text-gray-800">{i.nome}</span><span className="text-gray-400 text-[10px]">{i.unidade}</span></div>))}<div onMouseDown={() => setShowAdicionalDropdown(false)} className="p-2 text-[10px] hover:bg-gray-50 cursor-pointer text-green-600 font-bold italic">Usar texto livre: "{novoAdicionalNome}"</div></div>)}</div><div className="flex space-x-2"><input type="number" value={novoAdicionalPreco} onChange={e => setNovoAdicionalPreco(e.target.value)} placeholder="R$ 0,00" className="flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" /><input type="number" step="any" value={novoAdicionalQtd} onChange={e => setNovoAdicionalQtd(e.target.value)} placeholder="Qtd" title="Quantidade consumida do insumo" className="w-16 p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" /><button onClick={handleAddAdicional} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700"><Plus size={16}/></button></div></div><div className="space-y-1 max-h-32 overflow-y-auto">{adicionais.map((t: any) => (<div key={t.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border border-gray-100"><div><span>{t.nome} {t.insumoId && <span className="text-[9px] bg-green-100 text-green-600 px-1 rounded-sm ml-1">Estoque ({t.quantidade})</span>}</span><strong className="text-green-600 block mt-0.5">R$ {t.preco.toFixed(2)}</strong></div><div className="flex space-x-1 items-start"><button onClick={() => { setNovoAdicionalNome(t.nome); setNovoAdicionalPreco(t.preco); setNovoAdicionalQtd(t.quantidade || ''); setNovoAdicionalInsumoId(t.insumoId || ''); handleRemoveAdicional(t.id); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded h-fit" title="Editar"><Pencil size={12}/></button><button onClick={() => handleRemoveAdicional(t.id)} className="text-red-500 hover:bg-red-100 p-1 rounded h-fit" title="Excluir"><Trash2 size={12}/></button></div></div>))}</div></div>
            <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg"><p className="text-xs font-bold text-gray-700 uppercase mb-2">Restrições (Sem)</p><div className="flex space-x-2 mb-3"><div className="relative flex-1"><input type="text" value={novaRestricao} onChange={e => { setNovaRestricao(e.target.value); setNovaRestricaoInsumoId(''); setShowRestricaoDropdown(true); }} onFocus={() => setShowRestricaoDropdown(true)} onBlur={() => setTimeout(() => setShowRestricaoDropdown(false), 200)} placeholder="Ex: Cebola" className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white" />{showRestricaoDropdown && novaRestricao && (<div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-xl max-h-48 overflow-y-auto">{insumos.filter((i: Insumo) => i.nome.toLowerCase().includes(novaRestricao.toLowerCase())).map((i: Insumo) => (<div key={i.id} onMouseDown={() => { setNovaRestricao(i.nome); setNovaRestricaoInsumoId(i.id); setShowRestricaoDropdown(false); }} className="p-2 text-xs hover:bg-orange-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{i.nome}</span></div>))}<div onMouseDown={() => setShowRestricaoDropdown(false)} className="p-2 text-[10px] hover:bg-gray-50 cursor-pointer text-orange-600 font-bold italic">Usar texto livre: "{novaRestricao}"</div></div>)}</div><button onClick={handleAddRestricao} className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600"><Plus size={16}/></button></div><div className="space-y-1 max-h-32 overflow-y-auto">{restricoes.map(t => (<div key={t.id} className="flex justify-between items-center bg-white p-2 rounded text-xs border border-gray-100"><span>{t.nome} {t.insumoId && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded-sm ml-1" title="Vinculado ao Estoque">Estoque</span>}</span><div className="flex space-x-1 items-start"><button onClick={() => { setNovaRestricao(t.nome); setNovaRestricaoInsumoId(t.insumoId || ''); handleRemoveRestricao(t.id); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded h-fit" title="Editar"><Pencil size={12}/></button><button onClick={() => handleRemoveRestricao(t.id)} className="text-red-500 hover:bg-red-100 p-1 rounded h-fit" title="Excluir"><Trash2 size={12}/></button></div></div>))}</div></div>
              </div>
            </div>
            
            <div className="pt-4 border-t flex gap-4 items-center">
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase font-bold">Custo Total Produção</p>
                <p className="text-2xl font-bold text-green-600">R$ {custoTotalFicha.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm">Cancelar</button>
                <button onClick={salvarProduto} disabled={!nomeProduto || ingredientesSelecionados.length === 0} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">{produtoEdit ? 'Atualizar Produto' : 'Salvar Produto'}</button>
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg space-y-3">
               <h3 className="font-bold text-purple-800 flex items-center mb-1"><Bot size={18} className="mr-2"/> Assistente IA</h3>
               <div className="bg-white p-3 rounded border border-purple-100 shadow-sm text-xs text-gray-600"><p className="font-bold text-purple-800 mb-1">Ordem de preenchimento (separado por vírgula):</p><p>Nome, Categoria, Preço Venda, Ingredientes (Nome Insumo:Quantidade | Nome Insumo:Quantidade)</p></div>
               <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Smash Duplo, Hambúrguer, 35.90, Pão Brioche:1 | Carne:0.150 | Queijo Prato:0.040" className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm min-h-[140px] resize-y bg-white font-mono" />
               <button onClick={()=>{}} disabled={isGenerating} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-70 shadow-sm">
                 {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Cadastrando...</> : <><Sparkles size={18} className="mr-2"/> Cadastrar Produtos</>}
               </button>
            </div>
          )}
        </div>
      </div>
      
      {showCategoriasModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2"><h3 className="text-lg font-bold text-gray-800">Categorias de Produtos</h3><button onClick={() => setShowCategoriasModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button></div>
            <div className="flex space-x-2"><input type="text" value={novaCategoriaForm} onChange={e => setNovaCategoriaForm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategoria()} placeholder="Ex: Combos, Bebidas..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" /><button onClick={handleAddCategoria} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm">Adicionar</button></div>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">{categoriasDb.map((c: any) => (<div key={c.id} className="flex justify-between items-center p-3 hover:bg-gray-50"><span className="text-sm font-medium text-gray-700">{c.nome}</span><button onClick={() => handleDeleteCategoria(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button></div>))}</div>
          </div>
        </div>
      )}
    </div>
  );
}