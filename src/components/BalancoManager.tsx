import { useState, useEffect } from 'react';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Scale, Save, Download, CalendarClock, CheckCircle, Search } from 'lucide-react';

export default function BalancoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [novosEstoques, setNovosEstoques] = useState<Record<string, string>>({});
  const [filtroVencimento, setFiltroVencimento] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena de A a Z
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const handleAjusteRotativo = async (insumo: Insumo) => {
    const key = `${insumo.id}|rot`;
    const novoValor = novosEstoques[key];
    if (novoValor === undefined || novoValor === '') return;
    await set(ref(db, `insumos/${insumo.id}/estoqueRotativo`), Number(novoValor));
    showToast(`Rotativo de ${insumo.nome} ajustado para ${novoValor}${insumo.unidade}.`, 'success');
    setNovosEstoques(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const handleAjusteEstacionario = async (insumo: Insumo) => {
    const key = `${insumo.id}|est`;
    const novoValor = novosEstoques[key];
    if (novoValor === undefined || novoValor === '') return;
    await set(ref(db, `insumos/${insumo.id}/estoqueEstacionario`), Number(novoValor));
    showToast(`Estacionado de ${insumo.nome} ajustado para ${novoValor}${insumo.unidade}.`, 'success');
    setNovosEstoques(prev => { const n = {...prev}; delete n[key]; return n; });
  };

  const handleAjusteLote = async (insumo: Insumo, loteId: string, isLegacy: boolean = false) => {
    const key = `${insumo.id}|${loteId}`;
    const novoValorStr = novosEstoques[key];
    if (novoValorStr === undefined || novoValorStr === '') return;
    const novoValor = Number(novoValorStr);

    const insumoRef = ref(db, `insumos/${insumo.id}`);
    await runTransaction(insumoRef, (currentData) => {
      if (currentData) {
        if (!isLegacy && currentData.lotes && currentData.lotes[loteId]) {
          const oldQtd = currentData.lotes[loteId].quantidade;
          currentData.lotes[loteId].quantidade = novoValor;
          currentData.estoqueEstacionario = Math.max(0, (currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0) - oldQtd + novoValor);
          
          if (novoValor === 0) delete currentData.lotes[loteId]; // Remove lote se zerar
        } else if (isLegacy) {
          currentData.estoqueEstacionario = novoValor;
          if (novoValor === 0) {
            currentData.validade = null;
            currentData.lote = null;
          }
        }
      }
      return currentData;
    });

    showToast(`Lote ajustado com sucesso!`, 'success');
    setNovosEstoques(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const isProximoVencimento = (insumo: Insumo) => {
    const diasAviso = insumo.diasAvisoValidade !== undefined ? insumo.diasAvisoValidade : 7;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (insumo.lotes) {
      return Object.values(insumo.lotes).some((l: any) => l.validade && (new Date(`${l.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso);
    } else if (insumo.validade) {
      return (new Date(`${insumo.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso;
    }
    return false;
  };

  const tiposExistentes = Array.from(new Set(insumos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const insumosExibidos = insumos.filter(i => {
    const matchSearch = searchTerm
      ? i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    const matchVencimento = filtroVencimento ? isProximoVencimento(i) : true;
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchVencimento && matchTipo;
  });

  const exportarExcel = () => {
    const headers = ['Insumo', 'Estoque Rotativo', 'Estoque Estacionado', 'Unidade', 'Preco Unitario (R$)', 'Detalhes dos Lotes (Estacionado)'];
    const rows = insumosExibidos.map(i => [
      i.nome,
      i.estoqueRotativo ?? (i as any).estoqueAtual ?? 0,
      i.estoqueEstacionario ?? 0,
      i.unidade,
      (i.precoPacote / (i.qtdPacote || 1)).toFixed(3).replace('.', ','),
      i.lotes
        ? Object.values(i.lotes).map((l: any) => `${l.quantidade}${i.unidade} (Val: ${l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'} | Lote: ${l.lote || 'N/A'})`).join(' ; ')
        : i.validade || i.lote
        ? `${i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0}${i.unidade} (Val: ${i.validade ? new Date(`${i.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'} | Lote: ${i.lote || 'N/A'})`
        : 'Sem lote registrado'
    ]);
    const csvContent = [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função inteligente para exibir caixas e unidades restantes
  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtd} {unid})</span></span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="flex-1 flex items-center">
          <div className="bg-purple-100 p-3 rounded-xl mr-4 text-purple-600">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Auditoria e Balanço de Estoque</h3>
            <p className="text-sm text-gray-500">Faça a contagem física (real) na cozinha e ajuste os valores desatualizados do sistema.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm w-full sm:w-56"
            />
          </div>
          <select 
            value={filtroTipoUso} 
            onChange={(e) => setFiltroTipoUso(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white w-full sm:w-auto"
          >
            <option value="">Todos os Tipos</option>
            {tiposExistentes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
          </select>
          <button 
            onClick={() => setFiltroVencimento(!filtroVencimento)} 
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors border flex items-center shadow-sm w-full sm:w-auto justify-center ${
              filtroVencimento 
                ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CalendarClock size={18} className="mr-2" />
            {filtroVencimento ? 'Mostrar Todos' : 'Próximos do Vencimento'}
          </button>
          <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors flex items-center shadow-sm w-full sm:w-auto justify-center">
            <Download size={18} className="mr-2 sm:block" /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Insumo</th>
              <th className="px-6 py-3">Distribuição por Lotes</th>
              <th className="px-6 py-3">Est. Rotativo (Cozinha)</th>
              <th className="px-6 py-3">Est. Estacionado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {insumosExibidos.map(i => {
              const rotativo = i.estoqueRotativo ?? (i as any).estoqueAtual ?? 0;
              const estacionario = i.estoqueEstacionario ?? 0;
              return (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors text-sm">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {i.nome}
                  <p className="text-xs font-mono text-gray-400 mt-1">{(i as any).sku || 'Sem SKU'}</p>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {i.lotes ? (
                    <div className="space-y-2">
                      {Object.entries(i.lotes).map(([loteId, l]: [string, any], idx: number) => {
                        const key = `${i.id}|${loteId}`;
                        return (
                          <div key={idx} className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                            <div className="flex-1">
                              <span>{l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{l.lote && l.lote !== 'N/A' && ` (L: ${l.lote})`}</span>
                              <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(l.quantidade, i.qtdPacote || 1, i.unidade)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <input 
                                type="number" 
                                value={novosEstoques[key] !== undefined ? novosEstoques[key] : ''} 
                                onChange={(e) => setNovosEstoques({...novosEstoques, [key]: e.target.value})} 
                                placeholder={String(l.quantidade)} 
                                className="w-16 p-1 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500" 
                              />
                              <button 
                                onClick={() => handleAjusteLote(i, loteId)} 
                                disabled={novosEstoques[key] === undefined || novosEstoques[key] === ''} 
                                className="bg-purple-100 text-purple-700 p-1.5 rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Ajustar este lote"
                              >
                                <Save size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : i.validade || i.lote ? (
                    <div className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                      <div className="flex-1">
                        <span>{i.validade ? new Date(`${i.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{i.lote && i.lote !== 'N/A' && ` (L: ${i.lote})`}</span>
                        <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(estacionario, i.qtdPacote || 1, i.unidade)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input 
                          type="number" 
                          value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} 
                          onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} 
                          placeholder={String(estacionario)} 
                          className="w-16 p-1 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500" 
                        />
                        <button 
                          onClick={() => handleAjusteLote(i, 'legado', true)} 
                          disabled={novosEstoques[`${i.id}|legado`] === undefined || novosEstoques[`${i.id}|legado`] === ''} 
                          className="bg-purple-100 text-purple-700 p-1.5 rounded hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Ajustar este lote"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Nenhum lote registrado</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-orange-600">{rotativo} {i.unidade}</span>
                    <div className="flex items-center space-x-1">
                      <input type="number" value={novosEstoques[`${i.id}|rot`] !== undefined ? novosEstoques[`${i.id}|rot`] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|rot`]: e.target.value})} placeholder={String(rotativo)} className="w-16 p-1 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-orange-500" />
                      <button onClick={() => handleAjusteRotativo(i)} disabled={novosEstoques[`${i.id}|rot`] === undefined || novosEstoques[`${i.id}|rot`] === ''} className="bg-orange-100 text-orange-700 p-1.5 rounded hover:bg-orange-200 disabled:opacity-50 transition-colors" title="Ajustar Rotativo"><Save size={14}/></button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-indigo-600">{formatarQtdJSX(estacionario, i.qtdPacote || 1, i.unidade)}</span>
                    {!i.lotes && !i.validade && !i.lote ? (
                      <div className="flex items-center space-x-1">
                        <input type="number" value={novosEstoques[`${i.id}|est`] !== undefined ? novosEstoques[`${i.id}|est`] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|est`]: e.target.value})} placeholder={String(estacionario)} className="w-16 p-1 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={() => handleAjusteEstacionario(i)} disabled={novosEstoques[`${i.id}|est`] === undefined || novosEstoques[`${i.id}|est`] === ''} className="bg-indigo-100 text-indigo-700 p-1.5 rounded hover:bg-indigo-200 disabled:opacity-50 transition-colors" title="Ajustar Estacionado"><Save size={14}/></button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Ajuste via lotes ao lado</span>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>

    {toast && (
      <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
        <CheckCircle className="mr-2" size={20} />
        <span className="whitespace-pre-line">{toast.message}</span>
      </div>
    )}
    </div>
  );
}