import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, runTransaction, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, IngredienteReceita } from '../types';
import { Plus, Trash2, Save, Calculator, ShoppingCart, Search, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Pencil, Download, Upload, Sparkles, Bot, Loader2, X } from 'lucide-react';

export default function ProdutosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<IngredienteReceita[]>([]);
  
  const [categoriasDb, setCategoriasDb] = useState<{id: string, nome: string}[]>([]);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [novaCategoriaForm, setNovaCategoriaForm] = useState('');

  const [criarDuplo, setCriarDuplo] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [cadastroMode, setCadastroMode] = useState<'manual' | 'ia'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [expandedProdutoId, setExpandedProdutoId] = useState<string | null>(null);
  const [tempInsumoId, setTempInsumoId] = useState('');
  const [tempQtd, setTempQtd] = useState(0);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos');
    const categoriasRef = ref(db, 'categorias_produtos');

    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInsumos(list);
      }
    });

    const unsubProdutos = onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutos(list);
      } else {
        setProdutos([]);
      }
      setLoading(false);
    });

    const unsubCategorias = onValue(categoriasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategoriasDb(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setCategoriasDb([]);
      }
    });

    return () => {
      unsubInsumos();
      unsubProdutos();
      unsubCategorias();
    };
  }, []);

  const calcularCustoIngrediente = (ing: IngredienteReceita) => {
    const insumo = insumos.find(i => i.id === ing.insumoId);
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
  };

  const removeIngrediente = (index: number) => {
    setIngredientesSelecionados(ingredientesSelecionados.filter((_, i) => i !== index));
  };

  const handleAddCategoria = async () => {
    if (!novaCategoriaForm.trim()) return;
    await set(push(ref(db, 'categorias_produtos')), { nome: novaCategoriaForm.trim() });
    setNovaCategoriaForm('');
  };

  const handleDeleteCategoria = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      await remove(ref(db, `categorias_produtos/${id}`));
    }
  };

  const salvarProduto = async () => {
    const missingFields = [];
    if (!nomeProduto) missingFields.push('Nome do Produto');
    if (ingredientesSelecionados.length === 0) missingFields.push('Composição (Pelo menos 1 ingrediente na Ficha Técnica)');

    if (missingFields.length > 0) {
      showToast(`Preencha os campos obrigatórios:\n- ${missingFields.join('\n- ')}`, 'error');
      return;
    }

    if (criarDuplo && !editId) {
      const temDelivery = produtos.find(p => (p.nome || '').trim().toLowerCase() === `/ ${nomeProduto}`.trim().toLowerCase());
      const temSalao = produtos.find(p => (p.nome || '').trim().toLowerCase() === `% ${nomeProduto}`.trim().toLowerCase());
      if (temDelivery || temSalao) {
        showToast('Já existe um produto de Salão/Delivery com este nome.', 'error');
        return;
      }
    } else {
      const duplicado = produtos.find(p => p.id !== editId && (p.nome || '').trim().toLowerCase() === nomeProduto.trim().toLowerCase());
      if (duplicado) {
        showToast('Já existe um produto cadastrado com este nome.', 'error');
        return;
      }
    }
    
    try {
      const produtosRef = ref(db, 'produtos');
      
      if (editId) {
        await update(ref(db, `produtos/${editId}`), {
          nome: nomeProduto,
          categoria,
          ingredientes: ingredientesSelecionados,
          custoTotal: custoTotalFicha || 0,
          precoVenda: Number(precoVenda) || 0
        });
        setEditId(null);
      } else if (criarDuplo) {
        const getIdPorNome = (nomeBuscado: string) => 
          insumos.find(i => (i.nome || '').trim().toLowerCase() === (nomeBuscado || '').trim().toLowerCase())?.id;
        
        const extrasSalao = [
          { nome: 'Palito Golf', qtd: 1 },
          { nome: 'Embalagem Lanche', qtd: 1 }
        ];
        
        const extrasDelivery = [
          { nome: 'CH3', qtd: 1 },
          { nome: 'Embalagem Lanche', qtd: 1 },
          { nome: 'Lacre', qtd: 1 },
          { nome: 'Adesivo nominal', qtd: 1 },
          { nome: 'Sacola', qtd: 1 },
          { nome: 'Sache Ketchup', qtd: 1 },
          { nome: 'Sache Maionese', qtd: 1 },
          { nome: 'Guardanapo', qtd: 1 }
        ];
        const buildIngredientes = (extras: {nome: string, qtd: number}[]) => {
          const novos = ingredientesSelecionados.map(ing => ({ ...ing }));
          extras.forEach(extra => {
            const id = getIdPorNome(extra.nome);
            if (id) {
              const existente = novos.find(i => i.insumoId === id);
              if (existente) {
                existente.quantidade += extra.qtd;
              } else {
                novos.push({ insumoId: id, quantidade: extra.qtd });
              }
            }
          });
          return novos;
        };
  
        const calcCusto = (ings: IngredienteReceita[]) => ings.reduce((acc, ing) => acc + calcularCustoIngrediente(ing), 0);
  
        const ingDelivery = buildIngredientes(extrasDelivery);
        const ingSalao = buildIngredientes(extrasSalao);
  
        await set(push(produtosRef), { nome: `/ ${nomeProduto}`, categoria, ingredientes: ingDelivery, custoTotal: calcCusto(ingDelivery) || 0, precoVenda: Number(precoVenda) || 0 });
        await set(push(produtosRef), { nome: `% ${nomeProduto}`, categoria, ingredientes: ingSalao, custoTotal: calcCusto(ingSalao) || 0, precoVenda: Number(precoVenda) || 0 });
      } else {
        const newProdutoRef = push(produtosRef);
        await set(newProdutoRef, {
          nome: nomeProduto,
          categoria,
          ingredientes: ingredientesSelecionados,
          custoTotal: custoTotalFicha || 0,
          precoVenda: Number(precoVenda) || 0
        });
      }
  
      setNomeProduto('');
      setCategoria('');
      setPrecoVenda('');
      setIngredientesSelecionados([]);
      setCriarDuplo(false);
  
      showToast(editId ? 'Produto atualizado com sucesso!' : 'Produto salvo com sucesso!', 'success');
      setShowForm(false);
    } catch (error: any) {
      console.error(error);
      showToast('Erro ao salvar produto: ' + error.message, 'error');
    }
  };

  const handleCadastroIA = async () => {
    if (!aiPrompt.trim()) {
      showToast('Preencha os dados dos produtos que deseja cadastrar.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey}`
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Você é um assistente de cadastro de produtos. Extraia os produtos do texto do usuário, onde cada linha representa um produto com valores separados por vírgula na ordem:
Nome, Categoria (Hambúrguer, Porção, Bebida, Sobremesa, Outros), Preço de Venda, Ingredientes (Nome Insumo:Quantidade | Nome Insumo:Quantidade).
Não inclua crases, formatação markdown ou texto adicional, apenas o array JSON.
Formato esperado:
[{
  "nome": "Nome do Produto",
  "categoria": "Hambúrguer",
  "precoVenda": 35.90,
  "ingredientes": [
    { "nome": "Pão Brioche", "quantidade": 1 },
    { "nome": "Carne", "quantidade": 0.15 }
  ]
}]`
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ]
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || data.message || JSON.stringify(data) || 'Erro na API da IA');
      
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('Resposta inválida da IA.');

      const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const produtosExtraidos = JSON.parse(cleanJson);
      if (!Array.isArray(produtosExtraidos)) throw new Error('Formato retornado não é um array.');

      let adicionados = 0;
      let atualizados = 0;

      for (const item of produtosExtraidos) {
        const ingredientesParaSalvar: IngredienteReceita[] = [];
        if (item.ingredientes && Array.isArray(item.ingredientes)) {
          for (const ing of item.ingredientes) {
            const insumoEncontrado = insumos.find(ins => (ins.nome || '').toLowerCase().trim() === (ing.nome || '').toLowerCase().trim());
            if (insumoEncontrado && !isNaN(ing.quantidade)) {
              ingredientesParaSalvar.push({ insumoId: insumoEncontrado.id, quantidade: Number(ing.quantidade) });
            }
          }
        }

        const custoTotal = ingredientesParaSalvar.reduce((acc, ing) => {
          const insumo = insumos.find(ins => ins.id === ing.insumoId);
          if (!insumo) return acc;
          return acc + ((insumo.precoPacote / (insumo.qtdPacote || 1)) * ing.quantidade);
        }, 0);

        const produtoData = {
          nome: item.nome || 'Sem Nome',
          categoria: item.categoria || 'Hambúrguer',
          precoVenda: Number(item.precoVenda) || 0,
          custoTotal: custoTotal,
          ingredientes: ingredientesParaSalvar
        };

        const produtoExistente = produtos.find(p => (p.nome || '').toLowerCase().trim() === (item.nome || '').toLowerCase().trim());

        if (produtoExistente) {
          await update(ref(db, `produtos/${produtoExistente.id}`), produtoData);
          atualizados++;
        } else {
          await set(push(ref(db, 'produtos')), produtoData);
          adicionados++;
        }
      }
      
      showToast(`Sucesso! ${adicionados} cadastrados e ${atualizados} atualizados pela IA.`, 'success');
      setAiPrompt('');
      setCadastroMode('manual');
      setShowForm(false);
    } catch (error: any) {
      showToast('Erro ao processar com IA: ' + error.message, 'error');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditId(produto.id);
    setNomeProduto(produto.nome);
    setCategoria((produto as any).categoria || 'Hambúrguer');
    setPrecoVenda(String((produto as any).precoVenda || ''));
    setIngredientesSelecionados(produto.ingredientes || []);
    setCriarDuplo(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNomeProduto('');
    setCategoria('');
    setPrecoVenda('');
    setIngredientesSelecionados([]);
  };

  const excluirProduto = async (id: string) => {
    if (confirm('Deseja excluir este produto?')) {
      await remove(ref(db, `produtos/${id}`));
    }
  };

  const filteredProdutos = produtos.filter(p => (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const embalagensNecessarias = [
    'Palito Golf', 'Embalagem Lanche', 'CH3', 'Lacre',
    'Adesivo nominal', 'Sacola', 'Sache Ketchup', 'Sache Maionese', 'Guardanapo'
  ];
  const insumosFaltantes = embalagensNecessarias.filter(nome => !insumos.some(i => (i.nome || '').trim().toLowerCase() === nome.trim().toLowerCase()));

  const exportarProdutos = () => {
    const headers = ['Nome', 'Categoria', 'Preco Venda', 'Custo Total', 'Ingredientes (Nome:Qtd|Nome:Qtd)'];
    const rows = produtos.map(p => {
      const ingStr = (p.ingredientes || []).map(ing => {
        const insumo = insumos.find(i => i.id === ing.insumoId);
        return `${insumo?.nome || 'Desconhecido'}:${ing.quantidade}`;
      }).join('|');
      return [
        p.nome,
        (p as any).categoria || 'Hambúrguer',
        (p as any).precoVenda || 0,
        (p.custoTotal || 0).toFixed(2),
        ingStr
      ];
    });
    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `produtos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return showToast('Arquivo CSV vazio ou sem dados.', 'error');

        let adicionados = 0;
        let atualizados = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(';');
          if (row.length < 3) continue;

          const nome = row[0]?.trim();
          if (!nome) continue;

          const categoria = row[1]?.trim() || 'Hambúrguer';
          const precoVenda = Number(row[2]?.trim().replace(',', '.')) || 0;
          const ingredientesStr = row[4]?.trim() || '';

          const ingredientesParaSalvar: IngredienteReceita[] = [];
          if (ingredientesStr) {
            const ingList = ingredientesStr.split('|');
            for (const item of ingList) {
              const parts = item.split(':');
              if (parts.length >= 2) {
                const ingNome = parts[0].trim();
                const ingQtd = Number(parts[1].trim().replace(',', '.'));
                const insumoEncontrado = insumos.find(ins => (ins.nome || '').toLowerCase().trim() === ingNome.toLowerCase());
                if (insumoEncontrado && !isNaN(ingQtd)) {
                  ingredientesParaSalvar.push({ insumoId: insumoEncontrado.id, quantidade: ingQtd });
                }
              }
            }
          }

          const custoTotal = ingredientesParaSalvar.reduce((acc, ing) => {
            const insumo = insumos.find(ins => ins.id === ing.insumoId);
            if (!insumo) return acc;
            return acc + ((insumo.precoPacote / (insumo.qtdPacote || 1)) * ing.quantidade);
          }, 0);

          const produtoData = { nome, categoria, precoVenda, custoTotal, ingredientes: ingredientesParaSalvar };
          const produtoExistente = produtos.find(p => (p.nome || '').toLowerCase().trim() === nome.toLowerCase());

          if (produtoExistente) {
            await update(ref(db, `produtos/${produtoExistente.id}`), produtoData);
            atualizados++;
          } else {
            await set(push(ref(db, 'produtos')), produtoData);
            adicionados++;
          }
        }
        showToast(`Sucesso! ${adicionados} adicionados e ${atualizados} atualizados.`, 'success');
      } catch (error: any) {
        showToast('Erro ao importar: ' + error.message, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Base de Produtos</h2>
        <button onClick={() => { handleCancelEdit(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center">
          <Plus size={20} className="mr-2" /> Novo Produto
        </button>
      </div>

      {/* Cadastro de Ficha Técnica */}
      {showForm && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6 animate-in slide-in-from-top-4 duration-300">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Calculator className="mr-2 text-blue-600" size={20} />
            {editId ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <div className="flex items-center gap-2">
            {!editId && (
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setCadastroMode('manual')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${cadastroMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Manual</button>
                <button onClick={() => setCadastroMode('ia')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center ${cadastroMode === 'ia' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><Sparkles size={12} className="mr-1"/> IA Mágica</button>
              </div>
            )}
            <button onClick={() => { handleCancelEdit(); setShowForm(false); }} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"><X size={20} /></button>
          </div>
        </div>
        
        {cadastroMode === 'manual' || editId ? (
          <div className="space-y-6">
          {/* Informações Principais */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Informações Principais</h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="space-y-1 sm:col-span-6">
                <label className="text-xs font-bold text-gray-500 uppercase">Nome do Produto</label>
                <input
                  type="text"
                  value={nomeProduto}
                  onChange={e => setNomeProduto(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Ex: Smash Burger Duplo"
                />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <button type="button" onClick={() => setShowCategoriasModal(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase leading-none pb-0.5">Gerenciar</button>
                </div>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Selecione...</option>
                  {categoriasDb.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-3">
                <label className="text-xs font-bold text-gray-500 uppercase">Preço de Venda</label>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={precoVenda === '' ? '' : Number(precoVenda).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    onChange={e => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setPrecoVenda(val); }}
                    className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
            
            {!editId && (
              <div className="pt-2">
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="criarDuplo"
                    checked={criarDuplo}
                    onChange={(e) => setCriarDuplo(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="criarDuplo" className="text-xs font-bold text-gray-600 cursor-pointer" title="Embalagens de salão e delivery serão adicionadas automaticamente a cada ficha correspondente">
                    Criar SKUs Delivery (/) e Salão (%) com embalagens automáticas
                  </label>
                </div>
                
                {criarDuplo && insumosFaltantes.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start mt-2">
                    <AlertTriangle className="text-yellow-600 mr-2 flex-shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-xs font-bold text-yellow-800">Atenção: Insumos de embalagem faltando!</p>
                      <p className="text-xs text-yellow-700 mt-1">Os seguintes itens não foram encontrados no cadastro de insumos e <b>não serão adicionados</b>:</p>
                      <p className="text-xs font-mono text-yellow-600 mt-1">{insumosFaltantes.join(', ')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Composição (Ficha Técnica)</h4>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
              <p className="text-sm font-bold text-gray-700">Adicionar Insumo à Receita</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={tempInsumoId}
                  onChange={e => setTempInsumoId(e.target.value)}
                  className="p-2 border border-gray-200 rounded-lg outline-none bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {insumos
                    .filter(i => !embalagensNecessarias.some(emb => emb.toLowerCase() === (i.nome || '').trim().toLowerCase()))
                    .map(i => (
                    <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                  ))}
                </select>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={tempQtd}
                    onChange={e => setTempQtd(Number(e.target.value))}
                    className="w-24 p-2 border border-gray-200 rounded-lg outline-none bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Qtd"
                  />
                  <button
                    onClick={addIngrediente}
                    className="flex-1 bg-gray-800 text-white p-2 rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors shadow-sm"
                  >
                    Adicionar à Lista
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-700">Ingredientes da Receita</p>
              <div className="divide-y divide-gray-100 border border-gray-200 bg-white rounded-lg max-h-[300px] overflow-y-auto">
                {ingredientesSelecionados.map((ing, idx) => {
                  const insumo = insumos.find(i => i.id === ing.insumoId);
                  return (
                    <div key={idx} className="flex justify-between items-center p-3 text-sm">
                      <span className="font-medium text-gray-800">{insumo?.nome} <span className="text-gray-500 font-normal ml-1">- {ing.quantidade}{insumo?.unidade}</span></span>
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-500 font-medium">R$ {calcularCustoIngrediente(ing).toFixed(2)}</span>
                        <button onClick={() => removeIngrediente(idx)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {ingredientesSelecionados.length === 0 && (
                  <p className="p-4 text-center text-gray-400 text-sm italic">Nenhum ingrediente adicionado</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex gap-4 items-center">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Custo Total Produção</p>
              <p className="text-2xl font-bold text-green-600">R$ {custoTotalFicha.toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
                <button
                onClick={() => { handleCancelEdit(); setShowForm(false); }}
                  className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm"
                >
                  Cancelar
                </button>
              <button
                onClick={salvarProduto}
                disabled={!nomeProduto || ingredientesSelecionados.length === 0}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {editId ? 'Atualizar Produto' : 'Salvar Novo Produto'}
              </button>
            </div>
          </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center text-purple-800 font-bold text-sm">
                  <Bot size={18} className="mr-2"/> Assistente IA
                </div>
              </div>
              
              <div className="bg-white p-3 rounded border border-purple-100 shadow-sm text-xs text-gray-600">
                <p className="font-bold text-purple-800 mb-1">Ordem de preenchimento (separado por vírgula):</p>
                <p>Nome, Categoria (Hambúrguer, Porção, Bebida, etc), Preço Venda, Ingredientes (Nome Insumo:Quantidade | Nome Insumo:Quantidade)</p>
                <p className="font-mono text-purple-600 mt-2 bg-purple-50 p-1.5 rounded">Exemplo: Smash Duplo, Hambúrguer, 35.90, Pão Brioche:1 | Carne:0.150 | Queijo Prato:0.040</p>
              </div>

              <textarea 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Smash Duplo, Hambúrguer, 35.90, Pão Brioche:1 | Carne:0.150 | Queijo Prato:0.040&#10;Fritas P, Porção, 15.00, Batata Frita:0.150 | Sal:0.005"
                className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm min-h-[140px] resize-y bg-white leading-relaxed font-mono"
              />

              <button 
                onClick={handleCadastroIA} 
                disabled={isGenerating}
                className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-70 shadow-sm"
              >
                {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Lendo e Cadastrando...</> : <><Sparkles size={18} className="mr-2"/> Cadastrar Produtos Automaticamente</>}
              </button>
            </div>
          </div>
        )}
      </div>
    )}

      {/* Lista de Produtos e Venda */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <ShoppingCart className="mr-2 text-blue-600" size={20} />
            Produtos Cadastrados
          </h3>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <button onClick={exportarProdutos} className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
            <Download size={14} className="mr-1" /> Exportar CSV
          </button>
          <label htmlFor="import-csv-produtos" className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center cursor-pointer mb-2 sm:mb-0">
            <Upload size={14} className="mr-1" /> Importar CSV
          </label>
          <input type="file" accept=".csv" id="import-csv-produtos" className="hidden" onChange={handleFileUpload} />
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
            />
          </div>
          </div>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-[100px] animate-pulse flex flex-col justify-center gap-3">
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[450px] overflow-y-auto pr-2">
          {filteredProdutos.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-bold text-gray-900">{p.nome}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full uppercase">{((p as any).categoria) || 'Outros'}</span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Custo: <span className="text-red-500">R$ {(p.custoTotal || 0).toFixed(2)}</span> | Venda: <span className="text-green-600">R$ {((p as any).precoVenda || 0).toFixed(2)}</span></p>
                  <div className="flex items-center mt-1">
                    <button 
                      onClick={() => setExpandedProdutoId(expandedProdutoId === p.id ? null : p.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center transition-colors"
                    >
                      {(p.ingredientes || []).length} ingredientes {expandedProdutoId === p.id ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                    </button>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Produto">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => excluirProduto(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir Produto">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {expandedProdutoId === p.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Ficha Técnica:</p>
                  <ul className="space-y-1">
                    {(p.ingredientes || []).map((ing, idx) => {
                      const insumo = insumos.find(i => i.id === ing.insumoId);
                      return (<li key={idx} className="text-sm flex justify-between"><span className="text-gray-700">{insumo?.nome || 'Insumo não encontrado'}</span><span className="text-gray-500 font-medium">{ing.quantidade} {insumo?.unidade || ''}</span></li>);
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {filteredProdutos.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showCategoriasModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Categorias de Produtos</h3>
              <button onClick={() => setShowCategoriasModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={novaCategoriaForm} onChange={e => setNovaCategoriaForm(e.target.value)} placeholder="Ex: Combos, Bebidas..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <button onClick={handleAddCategoria} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm">Adicionar</button>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {categoriasDb.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">{c.nome}</span>
                  <button onClick={() => handleDeleteCategoria(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                </div>
              ))}
              {categoriasDb.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhuma categoria cadastrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
