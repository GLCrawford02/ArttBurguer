import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, runTransaction, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, IngredienteReceita } from '../types';
import { Plus, Trash2, Save, Calculator, ShoppingCart, Search, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

export default function ProdutosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoria, setCategoria] = useState('Hambúrguer');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<IngredienteReceita[]>([]);
  
  const [criarDuplo, setCriarDuplo] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Para adicionar ingrediente à ficha técnica
  const [expandedProdutoId, setExpandedProdutoId] = useState<string | null>(null);
  const [tempInsumoId, setTempInsumoId] = useState('');
  const [tempQtd, setTempQtd] = useState(0);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos');

    onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); // Ordena Insumos de A a Z
        setInsumos(list);
      }
    });

    onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); // Ordena Produtos de A a Z
        setProdutos(list);
      } else {
        setProdutos([]);
      }
    });
  }, []);

  const calcularCustoIngrediente = (ing: IngredienteReceita) => {
    const insumo = insumos.find(i => i.id === ing.insumoId);
    if (!insumo || !insumo.qtdPacote) return 0;
    return (insumo.precoPacote / insumo.qtdPacote) * ing.quantidade;
  };

  const custoTotalFicha = ingredientesSelecionados.reduce((acc, ing) => acc + calcularCustoIngrediente(ing), 0);

  const addIngrediente = () => {
    if (!tempInsumoId || tempQtd <= 0) return;
    setIngredientesSelecionados([...ingredientesSelecionados, { insumoId: tempInsumoId, quantidade: tempQtd }]);
    setTempInsumoId('');
    setTempQtd(0);
  };

  const removeIngrediente = (index: number) => {
    setIngredientesSelecionados(ingredientesSelecionados.filter((_, i) => i !== index));
  };

  const salvarProduto = async () => {
    if (!nomeProduto || ingredientesSelecionados.length === 0) return;
    
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
        // Função para buscar o ID do insumo pelo nome ignorando maiúsculas/minúsculas e espaços
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
  
        // Constrói a lista de ingredientes mesclando a receita base com as embalagens
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
      setCategoria('Hambúrguer');
      setPrecoVenda('');
      setIngredientesSelecionados([]);
      setCriarDuplo(false);
  
      showToast(editId ? 'Produto atualizado com sucesso!' : 'Produto salvo com sucesso!', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('Erro ao salvar produto: ' + error.message, 'error');
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditId(produto.id);
    setNomeProduto(produto.nome);
    setCategoria((produto as any).categoria || 'Hambúrguer');
    setPrecoVenda(String((produto as any).precoVenda || ''));
    setIngredientesSelecionados(produto.ingredientes || []);
    setCriarDuplo(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNomeProduto('');
    setCategoria('Hambúrguer');
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cadastro de Ficha Técnica */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Calculator className="mr-2 text-blue-600" size={20} />
          {editId ? 'Editar Produto' : 'Novo Produto'}
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Nome do Hambúrguer</label>
            <input
              type="text"
              value={nomeProduto}
              onChange={e => setNomeProduto(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Smash Burger Duplo"
            />
            {!editId && (
              <>
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
              </>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Hambúrguer">Hambúrguer</option>
              <option value="Porção">Porção</option>
              <option value="Bebida">Bebida</option>
              <option value="Sobremesa">Sobremesa</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Preço de Venda (R$)</label>
            <input
              type="number"
              step="0.01"
              value={precoVenda}
              onChange={e => setPrecoVenda(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Por quanto vai vender?"
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <p className="text-sm font-bold text-gray-700">Adicionar Insumo à Receita</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={tempInsumoId}
                onChange={e => setTempInsumoId(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg outline-none"
              >
                <option value="">Selecione...</option>
                {insumos
                  .filter(i => !embalagensNecessarias.some(emb => emb.toLowerCase() === (i.nome || '').trim().toLowerCase()))
                  .map(i => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                ))}
              </select>
              <input
                type="number"
                value={tempQtd}
                onChange={e => setTempQtd(Number(e.target.value))}
                className="p-2 border border-gray-200 rounded-lg outline-none"
                placeholder="Qtd"
              />
            </div>
            <button
              onClick={addIngrediente}
              className="w-full bg-gray-800 text-white p-2 rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors"
            >
              Adicionar à Lista
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700">Ingredientes da Receita</p>
            <div className="divide-y divide-gray-100 border rounded-lg">
              {ingredientesSelecionados.map((ing, idx) => {
                const insumo = insumos.find(i => i.id === ing.insumoId);
                return (
                  <div key={idx} className="flex justify-between items-center p-3 text-sm">
                    <span>{insumo?.nome} - {ing.quantidade}{insumo?.unidade}</span>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-500">R$ {calcularCustoIngrediente(ing).toFixed(2)}</span>
                      <button onClick={() => removeIngrediente(idx)} className="text-red-500">
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

          <div className="pt-4 border-t flex gap-2 items-center">
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-bold">Custo Total Produção</p>
              <p className="text-2xl font-bold text-green-600">R$ {custoTotalFicha.toFixed(2)}</p>
            </div>
            <button
              onClick={salvarProduto}
              disabled={!nomeProduto || ingredientesSelecionados.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {editId ? 'Atualizar Produto' : 'Salvar Produto'}
            </button>
            {editId && (
              <button
                onClick={handleCancelEdit}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Produtos e Venda */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <ShoppingCart className="mr-2 text-blue-600" size={20} />
            Produtos Cadastrados
          </h3>
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
        
        <div className="grid grid-cols-1 gap-4">
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
