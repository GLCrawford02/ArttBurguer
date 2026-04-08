import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { BarChart3, TrendingDown, Calendar } from 'lucide-react';

interface CompraLog {
  id: string;
  insumoId: string;
  nome: string;
  qtdPacotes: number;
  custoTotal: number;
  timestamp: number;
}

export default function RelatoriosManager() {
  const [historico, setHistorico] = useState<CompraLog[]>([]);

  useEffect(() => {
    const historicoRef = ref(db, 'historico_compras');
    return onValue(historicoRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHistorico(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setHistorico([]);
      }
    });
  }, []);

  const calcularGastos = () => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const inicioSemana = inicioHoje - (7 * 24 * 60 * 60 * 1000); // Últimos 7 dias
    const inicioQuinzena = inicioHoje - (15 * 24 * 60 * 60 * 1000); // Últimos 15 dias
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime(); // Dia 1 do mês atual

    let gastos = { diario: 0, semanal: 0, quinzenal: 0, mensal: 0, fimDeSemana: 0 };

    historico.forEach(log => {
      const logDate = new Date(log.timestamp);
      const logTime = log.timestamp;
      const diaSemana = logDate.getDay(); // 0 = Domingo, 6 = Sábado

      if (logTime >= inicioHoje) gastos.diario += log.custoTotal;
      if (logTime >= inicioSemana) gastos.semanal += log.custoTotal;
      if (logTime >= inicioQuinzena) gastos.quinzenal += log.custoTotal;
      if (logTime >= inicioMes) gastos.mensal += log.custoTotal;
      
      // Calcula o gasto dos finais de semana (Sáb e Dom) dentro do mês atual
      if (logTime >= inicioMes && (diaSemana === 0 || diaSemana === 6)) {
        gastos.fimDeSemana += log.custoTotal;
      }
    });

    return gastos;
  };

  const gastos = calcularGastos();

  const CardRelatorio = ({ titulo, valor, descricao }: { titulo: string, valor: number, descricao: string }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase">{titulo}</p>
          <h4 className="text-2xl font-black text-red-600 mt-1">R$ {valor.toFixed(2)}</h4>
        </div>
        <div className="p-2 bg-red-50 rounded-lg text-red-600">
          <TrendingDown size={20} />
        </div>
      </div>
      <p className="text-xs text-gray-400 flex items-center"><Calendar size={12} className="mr-1"/> {descricao}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center">
        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
          <BarChart3 size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Relatório de Despesas</h3>
          <p className="text-sm text-gray-500">Acompanhamento de gastos com reposição de estoque.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardRelatorio titulo="Gasto Diário" valor={gastos.diario} descricao="Compras realizadas hoje" />
        <CardRelatorio titulo="Gasto Semanal" valor={gastos.semanal} descricao="Últimos 7 dias" />
        <CardRelatorio titulo="Fins de Semana" valor={gastos.fimDeSemana} descricao="Sábados e Domingos (Este mês)" />
        <CardRelatorio titulo="Gasto Quinzenal" valor={gastos.quinzenal} descricao="Últimos 15 dias" />
        <CardRelatorio titulo="Gasto Mensal" valor={gastos.mensal} descricao="Acumulado deste mês" />
      </div>
    </div>
  );
}