import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { BarChart3, TrendingDown, Calendar, ArrowRightLeft, Trash2, DollarSign, Download, FileText } from 'lucide-react';
import { TransferenciaLog, DescarteLog, Insumo } from '../types';

interface CompraLog {
  id: string;
  insumoId: string;
  nome: string;
  qtdPacotes: number;
  qtdEmbalagens?: number;
  tipoEmbalagem?: string;
  qtdUnidadesAdicionadas?: number;
  unidadeBase?: string;
  custoTotal: number;
  fornecedorId?: string;
  fornecedorNome?: string;
  timestamp: number;
}

export default function RelatoriosManager() {
  const [activeTab, setActiveTab] = useState<'despesas' | 'transferencias' | 'descartes'>('despesas');
  const [historico, setHistorico] = useState<CompraLog[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaLog[]>([]);
  const [descartes, setDescartes] = useState<DescarteLog[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMesDescartes, setFiltroMesDescartes] = useState<string>('');

  useEffect(() => {
    const historicoRef = ref(db, 'historico_compras');
    const unsubHistorico = onValue(historicoRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHistorico(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setHistorico([]);
      }
    });

    const transRef = ref(db, 'historico_transferencias');
    const unsubTrans = onValue(transRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        list.sort((a, b) => b.timestamp - a.timestamp);
        setTransferencias(list);
      } else {
        setTransferencias([]);
      }
    });

    const descartesRef = ref(db, 'historico_descartes');
    const unsubDescartes = onValue(descartesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp); // Mais recentes primeiro
        setDescartes(list);
      } else {
        setDescartes([]);
      }
    });

    const insumosRef = ref(db, 'insumos');
    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setInsumos([]);
      }
      setLoading(false);
    });

    return () => {
      unsubHistorico();
      unsubTrans();
      unsubDescartes();
      unsubInsumos();
    };
  }, []);

  const calcularGastos = () => {
    const agora = new Date();
    const limite = new Date(agora);
    limite.setHours(6, 59, 59, 999);
    if (agora.getTime() <= limite.getTime()) {
      agora.setDate(agora.getDate() - 1);
    }
    agora.setHours(7, 0, 0, 0);
    const inicioHoje = agora.getTime();

    const inicioSemana = inicioHoje - (7 * 24 * 60 * 60 * 1000);
    const inicioQuinzena = inicioHoje - (15 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 7, 0, 0, 0).getTime();

    let gastos = { diario: 0, semanal: 0, quinzenal: 0, mensal: 0, fimDeSemana: 0 };

    historico.forEach(log => {
      const logDate = new Date(log.timestamp);
      const logTime = log.timestamp;
      const diaSemana = logDate.getDay();

      if (logTime >= inicioHoje) gastos.diario += log.custoTotal;
      if (logTime >= inicioSemana) gastos.semanal += log.custoTotal;
      if (logTime >= inicioQuinzena) gastos.quinzenal += log.custoTotal;
      if (logTime >= inicioMes) gastos.mensal += log.custoTotal;
      

      if (logTime >= inicioMes && (diaSemana === 0 || diaSemana === 6)) {
        gastos.fimDeSemana += log.custoTotal;
      }
    });

    return gastos;
  };

  const gastos = calcularGastos();

  const descartesFiltrados = filtroMesDescartes 
    ? descartes.filter(d => {
        const date = new Date(d.timestamp);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === filtroMesDescartes;
      })
    : descartes;

  const exportarExcel = () => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = '';

    if (activeTab === 'despesas') {
      headers = ['Data / Hora', 'Insumo', 'Fornecedor', 'Qtd Comprada', 'Custo Total (R$)'];
      rows = historico.map(h => [
        new Date(h.timestamp).toLocaleString('pt-BR'),
        h.nome,
        h.fornecedorNome || '-',
        `${h.qtdEmbalagens || h.qtdPacotes || 0} ${h.tipoEmbalagem || 'Volume(s)'} (${h.qtdUnidadesAdicionadas || '?'} ${h.unidadeBase || 'un'})`,
        h.custoTotal.toFixed(2).replace('.', ',')
      ]);
      filename = 'relatorio_despesas';
    } else if (activeTab === 'transferencias') {
      headers = ['Data / Hora', 'Funcionário', 'Insumo', 'Quantidade'];
      rows = transferencias.map(t => [
        new Date(t.timestamp).toLocaleString('pt-BR'),
        t.funcionarioNome,
        t.nomeInsumo,
        t.quantidade
      ]);
      filename = 'relatorio_transferencias';
    } else if (activeTab === 'descartes') {
      headers = ['Data / Hora', 'Feito por', 'Autorizado por', 'Insumo', 'Motivo', 'Quantidade / Local', 'Valor Perda (R$)'];
      rows = descartesFiltrados.map(d => [
        new Date(d.timestamp).toLocaleString('pt-BR'),
        d.funcionarioNome || '-',
        (d as any).autorizadoPorNome || d.funcionarioNome || '-',
        d.nomeInsumo,
        (d as any).motivo || (d.lote ? `Lote: ${d.lote}` : 'Outro'),
        `${d.quantidade} ${(d as any).unidade || ''} (${(d as any).tipoEstoque || 'estacionario'})`,
        ((d as any).valorTotal || 0).toFixed(2).replace('.', ',')
      ]);
      filename = 'relatorio_descartes';
    }

    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    window.print();
  };


  const valorEstoque = insumos.reduce((acc, i) => {
    const totalQtd = (i.estoqueEstacionario ?? 0) + (i.estoqueRotativo ?? 0);
    const custoUnitario = i.precoPacote / (i.qtdPacote || 1);
    return acc + (totalQtd * custoUnitario);
  }, 0);

  const CardRelatorio = ({ titulo, valor, descricao, colorType = 'red' }: { titulo: string, valor: number, descricao: string, colorType?: 'red' | 'emerald' }) => {
    const isRed = colorType === 'red';
    const Icon = isRed ? TrendingDown : DollarSign;
    const textColor = isRed ? 'text-red-600' : 'text-emerald-600';
    const bgColor = isRed ? 'bg-red-50' : 'bg-emerald-50';

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase">{titulo}</p>
            <h4 className={`text-2xl font-black ${textColor} mt-1`}>R$ {valor.toFixed(2)}</h4>
          </div>
          <div className={`p-2 ${bgColor} rounded-lg ${textColor}`}>
            <Icon size={20} />
          </div>
        </div>
        <p className="text-xs text-gray-400 flex items-center"><Calendar size={12} className="mr-1"/> {descricao}</p>
      </div>
    );
  };


  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtd} {unid})</span></span>;
  };

  return (
    <div className="space-y-6 print:space-y-0 print:block">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row items-start lg:items-center gap-4 print:border-none print:shadow-none print:p-0 print:mb-4">
        <div className="flex items-center flex-1">
          <div className={`p-3 rounded-xl mr-4 print:hidden ${activeTab === 'despesas' ? 'bg-blue-100 text-blue-600' : activeTab === 'transferencias' ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>
            {activeTab === 'despesas' && <BarChart3 size={24} />}
            {activeTab === 'transferencias' && <ArrowRightLeft size={24} />}
            {activeTab === 'descartes' && <Trash2 size={24} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">{activeTab === 'despesas' ? 'Relatório de Despesas' : activeTab === 'transferencias' ? 'Histórico de Transferências' : 'Histórico de Descartes'}</h3>
            <p className="text-sm text-gray-500 print:hidden">{activeTab === 'despesas' ? 'Acompanhamento de gastos com reposição de estoque.' : activeTab === 'transferencias' ? 'Registro de movimentações do estoque estacionado para o rotativo.' : 'Registro de descarte de insumos vencidos e autorizações.'}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto print:hidden">
          <div className="flex bg-gray-100 p-1 rounded-lg space-x-1 overflow-x-auto">
            <button onClick={() => setActiveTab('despesas')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'despesas' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Despesas</button>
            <button onClick={() => setActiveTab('transferencias')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'transferencias' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Transferências</button>
            <button onClick={() => setActiveTab('descartes')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'descartes' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Descartes</button>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center shadow-sm whitespace-nowrap">
              <Download size={16} className="mr-1" /> Excel
            </button>
            <button onClick={exportarPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors flex items-center justify-center shadow-sm whitespace-nowrap">
              <FileText size={16} className="mr-1" /> PDF
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'despesas' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
          <CardRelatorio titulo="Gasto Diário" valor={gastos.diario} descricao="Compras realizadas hoje" />
          <CardRelatorio titulo="Gasto Semanal" valor={gastos.semanal} descricao="Últimos 7 dias" />
          <CardRelatorio titulo="Fins de Semana" valor={gastos.fimDeSemana} descricao="Sábados e Domingos (Este mês)" />
          <CardRelatorio titulo="Gasto Quinzenal" valor={gastos.quinzenal} descricao="Últimos 15 dias" />
          <CardRelatorio titulo="Gasto Mensal" valor={gastos.mensal} descricao="Acumulado deste mês" />
          <CardRelatorio titulo="Capital em Estoque" valor={valorEstoque} descricao="Valor investido em mercadorias" colorType="emerald" />
        </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Data / Hora</th>
                  <th className="px-6 py-4">Fornecedor</th>
                  <th className="px-6 py-4">Insumo Comprado</th>
                  <th className="px-6 py-4">Quantidade</th>
                  <th className="px-6 py-4">Custo Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100).map(h => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(h.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{h.fornecedorNome || '-'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{h.nome}</td>
                    <td className="px-6 py-4 text-gray-800">{h.qtdEmbalagens || h.qtdPacotes || 0} {h.tipoEmbalagem || 'Volume(s)'}</td>
                    <td className="px-6 py-4 font-bold text-red-600">R$ {h.custoTotal.toFixed(2)}</td>
                  </tr>
                ))}
                {historico.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum registro de compra.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'transferencias' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100">
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Funcionário</th>
                <th className="px-6 py-4">Insumo</th>
                <th className="px-6 py-4">Quantidade Transferida</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                  </tr>
                ))}
              </tbody>
            ) : (
            <tbody className="divide-y divide-gray-100">
            {transferencias.map(t => {
              const insumo = insumos.find(i => i.id === t.insumoId);
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(t.timestamp).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{t.funcionarioNome}</td>
                  <td className="px-6 py-4 text-gray-800">{t.nomeInsumo}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600">
                    {insumo ? formatarQtdJSX(t.quantidade, insumo.qtdPacote || 1, insumo.unidade) : t.quantidade}
                  </td>
                </tr>
              );
            })}
              {transferencias.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Nenhuma transferência registrada.</td></tr>}
            </tbody>
            )}
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
            <h4 className="font-bold text-gray-800">Visão Geral de Perdas</h4>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-sm font-bold text-gray-500">Filtrar por Mês:</span>
              <input 
                type="month" 
                value={filtroMesDescartes}
                onChange={(e) => setFiltroMesDescartes(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
              {filtroMesDescartes && (
                <button onClick={() => setFiltroMesDescartes('')} className="text-sm text-gray-500 hover:text-red-500">
                  Limpar
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
            <CardRelatorio 
              titulo="Total em Perdas (Descarte)" 
              valor={descartesFiltrados.reduce((acc, d) => acc + ((d as any).valorTotal || 0), 0)} 
              descricao={filtroMesDescartes ? `Valor perdido em ${filtroMesDescartes.split('-')[1]}/${filtroMesDescartes.split('-')[0]}` : "Soma do valor de todas as baixas"} 
              colorType="red" 
            />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Data / Hora</th>
                  <th className="px-6 py-4">Feito por</th>
                  <th className="px-6 py-4">Autorizado por</th>
                  <th className="px-6 py-4">Insumo</th>
                  <th className="px-6 py-4">Motivo / Lote</th>
                  <th className="px-6 py-4">Qtd / Local</th>
                  <th className="px-6 py-4">Valor Perda</th>
                </tr>
              </thead>
              {loading ? (
                <tbody>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
                    </tr>
                  ))}
                </tbody>
              ) : (
              <tbody className="divide-y divide-gray-100">
              {descartesFiltrados.map(d => {
                const insumo = insumos.find(i => i.id === d.insumoId);
                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(d.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{d.funcionarioNome || '-'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{(d as any).autorizadoPorNome || d.funcionarioNome || '-'}</td>
                    <td className="px-6 py-4 text-gray-800">{d.nomeInsumo}</td>
                    <td className="px-6 py-4 text-gray-500">{(d as any).motivo || (d.lote ? `Lote: ${d.lote}` : 'Outro')}</td>
                    <td className="px-6 py-4 text-gray-800">
                      <span className="font-bold text-red-600">{insumo ? formatarQtdJSX(d.quantidade, insumo.qtdPacote || 1, insumo.unidade) : d.quantidade}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">{(d as any).tipoEstoque || 'Estacionário'}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-red-600">R$ {((d as any).valorTotal || 0).toFixed(2).replace('.', ',')}</td>
                  </tr>
                );
              })}
                {descartesFiltrados.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Nenhum descarte registrado neste período.</td></tr>}
              </tbody>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}