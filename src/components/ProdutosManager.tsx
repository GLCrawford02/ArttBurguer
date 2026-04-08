import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Item, Produto, IngredienteReceita } from '../types';
import { Plus, Trash2, Save, Calculator, ShoppingCart, Search } from 'lucide-react';

export default function ProdutosManager() {
  const [insumos, setInsumos] = useState<Item[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoria, setCategoria] = useState('Hambúrguer');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<IngredienteReceita[]>([]);
  
  // Para adicionar ingrediente à ficha técnica
  const [tempInsumoId, setTempInsumoId] = useState('');
  const [tempQtd, setTempQtd] = useState(0);

  useEffect(() => {
    const insumosRef = ref(db, 'itens');
    const produtosRef = ref(db, 'produtos');

    onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena Insumos de A a Z
        setInsumos(list);
      }
    });

    onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena Produtos de A a Z
        setProdutos(list);
      } else {
        setProdutos([]);
      }
    });
  }, []);

  const calcularCustoIngrediente = (ing: IngredienteReceita) => {
    const insumo = insumos.find(i => i.id === ing.insumoId);
    if (!insumo) return 0;
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
    const produtosRef = ref(db, 'produtos');
    const newProdutoRef = push(produtosRef);
    await set(newProdutoRef, {
      nome: nomeProduto,
      categoria,
      ingredientes: ingredientesSelecionados,
      custoTotal: custoTotalFicha,
      precoVenda: Number(precoVenda) || 0
    });
    setNomeProduto('');
    setCategoria('Hambúrguer');
    setPrecoVenda('');
    setIngredientesSelecionados([]);
  };

  const excluirProduto = async (id: string) => {
    if (confirm('Excluir este produto?')) {
      await remove(ref(db, `produtos/${id}`));
    }
  };

  const filteredProdutos = produtos.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cadastro de Ficha Técnica */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Calculator className="mr-2 text-blue-600" size={20} />
          Novo Produto
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
            <p className="text-sm font-bold text-gray-700">Adicionar Item à Receita</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={tempInsumoId}
                onChange={e => setTempInsumoId(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg outline-none"
              >
                <option value="">Selecione...</option>
                {insumos.map(i => (
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

          <div className="pt-4 border-t flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Custo Total Produção</p>
              <p className="text-2xl font-bold text-green-600">R$ {custoTotalFicha.toFixed(2)}</p>
            </div>
            <button
              onClick={salvarProduto}
              disabled={!nomeProduto || ingredientesSelecionados.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Salvar Produto
            </button>
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
            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-bold text-gray-900">{p.nome}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full uppercase">{((p as any).categoria) || 'Outros'}</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">Custo: <span className="text-red-500">R$ {p.custoTotal.toFixed(2)}</span> | Venda: <span className="text-green-600">R$ {((p as any).precoVenda || 0).toFixed(2)}</span></p>
                <p className="text-xs text-gray-400">{p.ingredientes.length} ingredientes</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => excluirProduto(p.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredProdutos.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
