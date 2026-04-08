import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

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

    return { faturamento, custoProdutosVendidos, gastosCompras, lucroBruto, qtdVendas: vendasHoje.length };
  };

  const { faturamento, custoProdutosVendidos, gastosCompras, lucroBruto, qtdVendas } = calcularFechamento();

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
    </div>
  );
}