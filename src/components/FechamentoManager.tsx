import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';

interface VendaLog {
  id: string;
  produtoId: string;
  nome: string;
  quantidade: number;
  custoProducao: number;
  receitaVenda: number;
  timestamp: number;
}

interface CompraLog {
  id: string;
  custoTotal: number;
  timestamp: number;
}

export default function FechamentoManager() {
  const [vendas, setVendas] = useState<VendaLog[]>([]);
  const [compras, setCompras] = useState<CompraLog[]>([]);

  useEffect(() => {
    const vendasRef = ref(db, 'historico_vendas');
    const comprasRef = ref(db, 'historico_compras');

    onValue(vendasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setVendas(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
    });

    onValue(comprasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setCompras(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
    });
  }, []);

  const calcularFechamento = () => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();

    const vendasHoje = vendas.filter(v => v.timestamp >= inicioHoje);
    const comprasHoje = compras.filter(c => c.timestamp >= inicioHoje);

    const faturamento = vendasHoje.reduce((acc, v) => acc + v.receitaVenda, 0);
    const custoProdutosVendidos = vendasHoje.reduce((acc, v) => acc + v.custoProducao, 0);
    const gastosCompras = comprasHoje.reduce((acc, c) => acc + c.custoTotal, 0);
    
    const lucroBruto = faturamento - custoProdutosVendidos;

    const produtosVendidosMap: Record<string, { nome: string, quantidade: number, receita: number }> = {};
    vendasHoje.forEach(v => {
      const key = v.produtoId || v.nome;
      if (!produtosVendidosMap[key]) {
        produtosVendidosMap[key] = { nome: v.nome, quantidade: 0, receita: 0 };
      }
      produtosVendidosMap[key].quantidade += v.quantidade;
      produtosVendidosMap[key].receita += v.receitaVenda;
    });
    const produtosMaisVendidos = Object.values(produtosVendidosMap).sort((a, b) => b.quantidade - a.quantidade);

    return { faturamento, custoProdutosVendidos, gastosCompras, lucroBruto, qtdVendas: vendasHoje.length, produtosMaisVendidos };
  };

  const { faturamento, custoProdutosVendidos, gastosCompras, lucroBruto, qtdVendas, produtosMaisVendidos } = calcularFechamento();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center">
        <div className="bg-green-100 p-3 rounded-xl mr-4 text-green-600">
          <Wallet size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Fechamento de Caixa (Hoje)</h3>
          <p className="text-sm text-gray-500">Resumo financeiro das vendas e saídas de caixa do dia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase flex items-center"><TrendingUp size={16} className="mr-2 text-green-500"/> Faturamento</p>
          <h4 className="text-2xl font-black text-green-600 mt-2">R$ {faturamento.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">{qtdVendas} produções registradas</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase flex items-center"><TrendingDown size={16} className="mr-2 text-red-500"/> Custo Produtos</p>
          <h4 className="text-2xl font-black text-red-500 mt-2">R$ {custoProdutosVendidos.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">Custo dos ingredientes (CMV)</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase flex items-center"><DollarSign size={16} className="mr-2 text-blue-500"/> Lucro Bruto</p>
          <h4 className="text-2xl font-black text-blue-600 mt-2">R$ {lucroBruto.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">Faturamento descontando o custo</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase flex items-center"><TrendingDown size={16} className="mr-2 text-orange-500"/> Saída (Compras)</p>
          <h4 className="text-2xl font-black text-orange-500 mt-2">R$ {gastosCompras.toFixed(2)}</h4>
          <p className="text-xs text-gray-400 mt-1">Gastos com reabastecimento hoje</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center">
          <Package className="text-gray-400 mr-2" size={20} />
          <h4 className="text-lg font-bold text-gray-800">Produtos Mais Vendidos (Hoje)</h4>
        </div>
        {produtosMaisVendidos.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100">
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Receita Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produtosMaisVendidos.map((p, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-6 py-4 font-bold text-orange-600">{p.quantidade} un</td>
                  <td className="px-6 py-4 text-green-600 font-medium">R$ {p.receita.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-400">Nenhuma venda registrada hoje.</div>
        )}
      </div>
    </div>
  );
}