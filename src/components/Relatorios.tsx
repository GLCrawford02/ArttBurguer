import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Search, Calendar, ArrowDownRight, ArrowUpRight, Filter, FileText, Trash2 } from 'lucide-react';

export interface Movimentacao {
  id: string;
  tipo: 'entrada' | 'saida' | 'descarte';
  insumoId: string;
  nomeInsumo: string;
  quantidade: number;
  timestamp: number;
  funcionarioNome?: string;
  observacao?: string;
  lote?: string;
}

export default function Relatorios() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [buscaPesquisa, setBuscaPesquisa] = useState<string>('');

  useEffect(() => {
    let rawMovimentacoes: any[] = [];
    let rawDescartes: any[] = [];

    const consolidar = () => {
      const lista = [...rawMovimentacoes, ...rawDescartes];

      lista.sort((a, b) => b.timestamp - a.timestamp);
      setMovimentacoes(lista);
    };


    const movRef = ref(db, 'movimentacoes');
    const unsubMov = onValue(movRef, (snapshot) => {
      const data = snapshot.val();
      rawMovimentacoes = data 
        ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) 
        : [];
      consolidar();
    });


    const descarteRef = ref(db, 'historico_descartes');
    const unsubDescarte = onValue(descarteRef, (snapshot) => {
      const data = snapshot.val();
      rawDescartes = data 
        ? Object.entries(data).map(([id, val]: [string, any]) => ({ 
            id, 
            tipo: 'descarte',
            ...val 
          })) 
        : [];
      consolidar();
    });

    return () => {
      unsubMov();
      unsubDescarte();
    };
  }, []);


  const movimentacoesFiltradas = movimentacoes.filter(m => {
    const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
    const matchBusca = m.nomeInsumo?.toLowerCase().includes(buscaPesquisa.toLowerCase()) || 
                       m.funcionarioNome?.toLowerCase().includes(buscaPesquisa.toLowerCase());
    
    let matchDataInicio = true;
    let matchDataFim = true;
    
    if (dataInicio) {
      const inicio = new Date(`${dataInicio}T00:00:00`).getTime();
      matchDataInicio = m.timestamp >= inicio;
    }
    
    if (dataFim) {
      const fim = new Date(`${dataFim}T23:59:59`).getTime();
      matchDataFim = m.timestamp <= fim;
    }
    
    return matchTipo && matchBusca && matchDataInicio && matchDataFim;
  });

  const renderBadgeTipo = (tipo: string) => {
    switch(tipo) {
      case 'entrada': 
        return <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-max"><ArrowDownRight size={14}/> ENTRADA</span>;
      case 'saida': 
        return <span className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded-full flex items-center gap-1 w-max"><ArrowUpRight size={14}/> SAÍDA</span>;
      case 'descarte': 
        return <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full flex items-center gap-1 w-max"><Trash2 size={14}/> DESCARTE</span>;
      default: 
        return <span className="px-2 py-1 text-xs font-bold bg-gray-100 text-gray-700 rounded-full">{tipo?.toUpperCase()}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
          <FileText size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Relatórios de Movimentação</h2>
      </div>

      {/* Painel de Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Filter size={14} /> Tipo de Movimento
          </label>
          <select 
            value={filtroTipo} 
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
            <option value="descarte">Descartes</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar size={14} /> Data Inicial
          </label>
          <input 
            type="date" 
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar size={14} /> Data Final
          </label>
          <input 
            type="date" 
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Search size={14} /> Buscar
          </label>
          <input 
            type="text" 
            placeholder="Insumo ou Responsável..." 
            value={buscaPesquisa}
            onChange={(e) => setBuscaPesquisa(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Tabela de Resultados */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
                <th className="px-6 py-3">Data e Hora</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Insumo</th>
                <th className="px-6 py-3">Qtd.</th>
                <th className="px-6 py-3">Lote / Obs</th>
                <th className="px-6 py-3">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movimentacoesFiltradas.length > 0 ? (
                movimentacoesFiltradas.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors text-sm">
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(m.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4">
                      {renderBadgeTipo(m.tipo)}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{m.nomeInsumo}</td>
                    <td className="px-6 py-4 font-semibold text-gray-700">{m.quantidade}</td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {m.lote && m.lote !== 'N/A' ? <span className="block font-medium">Lote: {m.lote}</span> : null}
                      {m.observacao && <span className="block italic text-gray-500">{m.observacao}</span>}
                      {!m.lote && !m.observacao && '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{m.funcionarioNome || 'Sistema'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma movimentação encontrada para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}