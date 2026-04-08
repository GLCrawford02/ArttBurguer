import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, ProdutoFinal, IngredienteReceita } from '../types';
import { Plus, Trash2, Save, Calculator, ShoppingCart } from 'lucide-react';

export default function ProdutosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<ProdutoFinal[]>([]);
  const [nomeProduto, setNomeProduto] = useState('');
  const [ingredientesSelecionados, setIngredientesSelecionados] = useState<IngredienteReceita[]>([]);
  
  // Para adicionar ingrediente à ficha técnica
  const [tempInsumoId, setTempInsumoId] = useState('');
  const [tempQtd, setTempQtd] = useState(0);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos_finais');

    onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      }
    });

    onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProdutos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
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
    const produtosRef = ref(db, 'produtos_finais');
    const newProdutoRef = push(produtosRef);
    await set(newProdutoRef, {
      nome: nomeProduto,
      ingredientes: ingredientesSelecionados,
      custoTotal: custoTotalFicha
    });
    setNomeProduto('');
    setIngredientesSelecionados([]);
  };

  const excluirProduto = async (id: string) => {
    if (confirm('Excluir este produto?')) {
      await remove(ref(db, `produtos_finais/${id}`));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cadastro de Ficha Técnica */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Calculator className="mr-2 text-blue-600" size={20} />
          Nova Ficha Técnica
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

          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <p className="text-sm font-bold text-gray-700">Adicionar Insumo à Receita</p>
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
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <ShoppingCart className="mr-2 text-blue-600" size={20} />
          Produtos Cadastrados
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {produtos.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900">{p.nome}</h4>
                <p className="text-sm text-green-600 font-medium">Custo: R$ {p.custoTotal.toFixed(2)}</p>
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
          {produtos.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">Nenhum produto cadastrado ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
