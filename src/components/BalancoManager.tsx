import { useState, useEffect } from 'react';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Scale, Save, Download, CalendarClock, CheckCircle, Search, Settings, X, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import CalculadoraFlutuante from './CalculadoraFlutuante';

export default function BalancoManager({ currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [novosEstoques, setNovosEstoques] = useState<Record<string, string>>({});
  const [novosCustos, setNovosCustos] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'estacionado' | 'rotativo'>('estacionado');
  const [historicoBalanco, setHistoricoBalanco] = useState<any[]>([]);
  const [filtroVencimento, setFiltroVencimento] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const handleToggleEdit = (key: string) => {
    setEditMode(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cancelarEdicao = (key: string) => {
    setEditMode(prev => { const n = {...prev}; delete n[key]; return n; });
    setNovosEstoques(prev => { const n = {...prev}; delete n[key]; return n; });
    setNovosCustos(prev => { const n = {...prev}; delete n[key]; return n; });
  };

  const handleSalvarTudo = async () => {
    const chavesPendentes = Array.from(new Set([...Object.keys(novosEstoques), ...Object.keys(novosCustos)]));
    if (chavesPendentes.length === 0) return;

    const insumosAfetados = new Set(chavesPendentes.map(k => k.split('|')[0]));
    const novosHistoricos: any[] = [];

    for (const insumoId of insumosAfetados) {
      const insumo = insumos.find(i => i.id === insumoId);
      if (!insumo) continue;

      const insumoRef = ref(db, `insumos/${insumoId}`);
      const result = await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          const rotKey = `${insumoId}|rot`;
          if (novosEstoques[rotKey] !== undefined && novosEstoques[rotKey] !== '') {
            currentData.estoqueRotativo = Number(Number(novosEstoques[rotKey]).toFixed(4));
            novosHistoricos.push({
              id: Math.random().toString(36), insumoId, nome: insumo.nome, unidade: insumo.unidade,
              tipo: 'Rotativo', qtdAntiga: Number(insumo.estoqueRotativo ?? 0),
              qtdNova: currentData.estoqueRotativo, timestamp: Date.now()
            });
          }

          const legadoKey = `${insumoId}|legado`;
          const novoValorLegado = novosEstoques[legadoKey];
          const novoCustoLegado = novosCustos[legadoKey];
          let estUpdate = false;
          
          if (novoValorLegado !== undefined && novoValorLegado !== '') {
            const oldQtd = Number(insumo.estoqueEstacionario ?? 0);
            currentData.estoqueEstacionario = Number(Number(novoValorLegado).toFixed(4));
            if (currentData.estoqueEstacionario === 0) { currentData.validade = null; currentData.lote = null; }
            estUpdate = true;
            novosHistoricos.push({
              id: Math.random().toString(36), insumoId, nome: insumo.nome, unidade: insumo.unidade,
              tipo: 'Estacionado', detalhe: 'Geral (Sem Lote)', qtdAntiga: oldQtd, qtdNova: currentData.estoqueEstacionario,
              valorAntigo: undefined, valorNovo: novoCustoLegado !== undefined && novoCustoLegado !== '' ? Number(novoCustoLegado) : undefined, timestamp: Date.now()
            });
          }
          
          if (novoCustoLegado !== undefined && novoCustoLegado !== '') {
            const estacionario = novoValorLegado !== undefined && novoValorLegado !== '' ? Number(novoValorLegado) : Number(currentData.estoqueEstacionario ?? 0);
            const qtdPacote = Number(currentData.qtdPacote || 1);
            const totalVols = estacionario / qtdPacote;
            currentData.precoPacote = totalVols > 0 ? Number((Number(novoCustoLegado) / totalVols).toFixed(4)) : 0;
            if (!estUpdate) {
               novosHistoricos.push({
                 id: Math.random().toString(36), insumoId, nome: insumo.nome, unidade: insumo.unidade,
                 tipo: 'Estacionado', detalhe: 'Geral (Sem Lote)', qtdAntiga: estacionario, qtdNova: estacionario,
                 valorAntigo: undefined, valorNovo: Number(novoCustoLegado), timestamp: Date.now()
               });
            }
          }

          if (currentData.lotes) {
            let novoEstacionarioCalculado = Number(Number(currentData.estoqueEstacionario ?? 0).toFixed(4));
            let atualizouLotes = false;

            for (const loteId in currentData.lotes) {
              const key = `${insumoId}|${loteId}`;
              const nEstoque = novosEstoques[key];
              const nCusto = novosCustos[key];
              
              if ((nEstoque !== undefined && nEstoque !== '') || (nCusto !== undefined && nCusto !== '')) {
                const oldQtd = Number(Number(currentData.lotes[loteId].quantidade || 0).toFixed(4));
                const oldCusto = Number((currentData.lotes[loteId] as any).valorTotalLote || 0);
                
                let nQtd = oldQtd;
                let nVal = oldCusto;

                if (nEstoque !== undefined && nEstoque !== '') {
                  nQtd = Number(Number(nEstoque).toFixed(4));
                  currentData.lotes[loteId].quantidade = nQtd;
                  novoEstacionarioCalculado = Number(Math.max(0, novoEstacionarioCalculado - oldQtd + nQtd).toFixed(4));
                  atualizouLotes = true;
                }
                
                if (nCusto !== undefined && nCusto !== '') {
                  nVal = Number(nCusto);
                  (currentData.lotes[loteId] as any).valorTotalLote = nVal;
                  atualizouLotes = true;
                }

                novosHistoricos.push({
                  id: Math.random().toString(36), insumoId, nome: insumo.nome, unidade: insumo.unidade,
                  tipo: 'Estacionado', detalhe: currentData.lotes[loteId].lote || 'N/A', qtdAntiga: oldQtd, qtdNova: nQtd,
                  valorAntigo: oldCusto, valorNovo: nVal, timestamp: Date.now()
                });

                if (nQtd === 0) delete currentData.lotes[loteId];
              }
            }

            if (atualizouLotes) {
               currentData.estoqueEstacionario = novoEstacionarioCalculado;
               let totalValorLotes = 0;
               let totalQtdLotes = 0;
               Object.values(currentData.lotes || {}).forEach((l: any) => {
                 totalValorLotes += Number(l.valorTotalLote || 0);
                 totalQtdLotes += Number(l.quantidade || 0);
               });
               const qtdPacote = Number(currentData.qtdPacote || 1);
               const totalVols = totalQtdLotes / qtdPacote;
               currentData.precoPacote = totalVols > 0 ? Number((totalValorLotes / totalVols).toFixed(4)) : 0;
            }
          }
        }
        return currentData;
      });
    }

    setHistoricoBalanco(prev => [...novosHistoricos, ...prev]);
    showToast(`Balanço de ${insumosAfetados.size} insumo(s) salvo com sucesso!`, 'success');
    setNovosEstoques({});
    setNovosCustos({});
    setEditMode({});
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

  const isGestor = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c))
      : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(currentUser.cargo as string)
  );

  const insumosPermitidos = insumos.filter(i => isGestor || !(i as any).restrito);
  const tiposExistentes = Array.from(new Set(insumosPermitidos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const insumosExibidos = insumosPermitidos.filter(i => {
    const matchSearch = searchTerm
      ? i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    const matchVencimento = filtroVencimento ? isProximoVencimento(i) : true;
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchVencimento && matchTipo;
  });

  const sortedInsumosExibidos = [...insumosExibidos].sort((a, b) => {
    if (!sortConfig) return a.nome.localeCompare(b.nome);
    const { key, direction } = sortConfig;
    
    let valA: any = '';
    let valB: any = '';

    if (key === 'nome') {
       valA = a.nome.toLowerCase();
       valB = b.nome.toLowerCase();
    } else if (key === 'estoque') {
       if (activeTab === 'estacionado') {
         valA = Number(a.estoqueEstacionario ?? 0);
         valB = Number(b.estoqueEstacionario ?? 0);
       } else {
         valA = Number(a.estoqueRotativo ?? 0);
         valB = Number(b.estoqueRotativo ?? 0);
       }
    }
    
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const exportarExcel = () => {
    const headers = ['Insumo', 'Estoque Rotativo', 'Estoque Estacionado', 'Unidade', 'Preco Unitario (R$)', 'Detalhes dos Lotes (Estacionado)'];
    const rows = insumosExibidos.map(i => [
      i.nome,
      Number(i.estoqueRotativo ?? 0),
      Number(i.estoqueEstacionario ?? 0),
      i.unidade,
      (Number(i.precoPacote || 0) / Number(i.qtdPacote || 1)).toFixed(3).replace('.', ','),
      i.lotes
        ? Object.values(i.lotes).map((l: any) => `${Number(l.quantidade || 0)}${i.unidade} (Val: ${l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'} | Lote: ${l.lote || 'N/A'})`).join(' ; ')
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


  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    const qtdFormatada = Number(qtd.toFixed(4));
    if (pacote <= 1) return <span>{qtdFormatada} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = Number((qtd % pacote).toFixed(4));
    
    if (vols === 0) return <span>{qtdFormatada} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtdFormatada} {unid})</span></span>;
  };

  const chavesPendentes = Array.from(new Set([...Object.keys(novosEstoques), ...Object.keys(novosCustos)]));

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="flex-1 flex items-center">
          <div className="bg-purple-100 p-3 rounded-xl mr-4 text-purple-600">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Auditoria e Balanço de Estoque</h3>
            <p className="text-sm text-gray-500">Faça a contagem física (real) na cozinha e ajuste os valores desatualizados do sistema.</p>
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit mt-3">
              <button onClick={() => setActiveTab('estacionado')} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'estacionado' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Estacionado (Físico / Prateleira)</button>
              <button onClick={() => setActiveTab('rotativo')} className={`px-4 py-1.5 rounded-md font-bold text-sm transition-colors ${activeTab === 'rotativo' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Rotativo (Cozinha)</button>
            </div>
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
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-100 select-none">
              <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('nome')}><div className="flex items-center">Insumo {sortConfig?.key === 'nome' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
              {activeTab === 'estacionado' ? (
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('estoque')}><div className="flex items-center">Estoque Estacionado (Lotes / Físico) {sortConfig?.key === 'estoque' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
              ) : (
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('estoque')}><div className="flex items-center">Estoque Rotativo (Em uso na Cozinha) {sortConfig?.key === 'estoque' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedInsumosExibidos.map(i => {
              const rotativo = Number(i.estoqueRotativo ?? 0);
              const estacionario = Number(i.estoqueEstacionario ?? 0);
              return (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors text-sm">
                <td className="px-6 py-4 font-medium text-gray-900 align-top w-1/3">
                  {i.nome}
                  <p className="text-xs font-mono text-gray-400 mt-1">{(i as any).sku || 'Sem SKU'}</p>
                </td>
                <td className="px-6 py-4 text-gray-600 align-top">
                  {activeTab === 'estacionado' ? (
                  i.lotes ? (
                    <div className="space-y-2">
                      {Object.entries(i.lotes || {}).map(([loteId, l]: [string, any], idx: number) => {
                        const key = `${i.id}|${loteId}`;
                        return (
                          <div key={idx} className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                            <div className="flex-1">
                              <span>{l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{l.lote && l.lote !== 'N/A' && ` (L: ${l.lote})`}</span>
                              <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(Number(l.quantidade || 0), Number(i.qtdPacote || 1), i.unidade)}</span>
                              {l.valorTotalLote !== undefined && <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">R$ {Number(l.valorTotalLote).toFixed(2)}</span>}
                            </div>
                            {!editMode[key] ? (
                              <button onClick={() => handleToggleEdit(key)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={novosEstoques[key] !== undefined ? novosEstoques[key] : ''} 
                                  onChange={(e) => setNovosEstoques({...novosEstoques, [key]: e.target.value})} 
                                  placeholder={`Qtd (${l.quantidade})`} 
                                  className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" 
                                  title="Nova Quantidade"
                                />
                                <div className="relative" title="Novo Valor Total do Lote">
                                  <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                                  <input 
                                    type="text"
                                    value={novosCustos[key] !== undefined ? (novosCustos[key] === '' ? '' : Number(novosCustos[key]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''}
                                    onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [key]: val}); }}
                                    placeholder={(l.valorTotalLote || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                                  />
                                </div>
                                <button 
                                  onClick={() => cancelarEdicao(key)} 
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors"
                                  title="Cancelar"
                                ><X size={14}/></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : i.validade || i.lote ? (
                    <div className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                      <div className="flex-1">
                        <span className="text-gray-500">{i.validade ? new Date(`${i.validade}T00:00:00`).toLocaleDateString('pt-BR') : 'Estoque Geral (S/ Lote)'}{i.lote && i.lote !== 'N/A' && ` (L: ${i.lote})`}</span>
                        <span className="font-bold ml-2 text-gray-500">{formatarQtdJSX(estacionario, Number(i.qtdPacote || 1), i.unidade)}</span>
                      </div>
                      {!editMode[`${i.id}|legado`] ? (
                        <button onClick={() => handleToggleEdit(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <input 
                            type="number" 
                            step="any"
                            value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} 
                            onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} 
                            placeholder={`Qtd (${estacionario})`} 
                            className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" 
                            title="Nova Quantidade"
                          />
                          <div className="relative" title="Novo Valor Total do Estoque">
                            <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                            <input 
                              type="text"
                              value={novosCustos[`${i.id}|legado`] !== undefined ? (novosCustos[`${i.id}|legado`] === '' ? '' : Number(novosCustos[`${i.id}|legado`]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''}
                              onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [`${i.id}|legado`]: val}); }}
                              placeholder="Valor Total"
                              className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                            />
                          </div>
                          <button 
                            onClick={() => cancelarEdicao(`${i.id}|legado`)} 
                            className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors"
                            title="Cancelar"
                          ><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  ) : (
                      <div className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                        <div className="flex-1">
                          <span className="text-gray-500">Estoque Geral (Sem lote)</span>
                          <span className="font-bold ml-2 text-indigo-600">{formatarQtdJSX(estacionario, Number(i.qtdPacote || 1), i.unidade)}</span>
                        </div>
                        {!editMode[`${i.id}|legado`] ? (
                          <button onClick={() => handleToggleEdit(`${i.id}|legado`)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Editar"><Settings size={14}/></button>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center gap-1 animate-in fade-in zoom-in duration-200">
                            <input 
                              type="number" 
                              step="any"
                              value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} 
                              onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} 
                              placeholder={`Qtd (${estacionario})`} 
                              className="w-20 p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs" 
                              title="Nova Quantidade"
                            />
                            <div className="relative" title="Novo Valor Total do Estoque">
                              <span className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-[10px] font-medium">R$</span>
                              <input 
                                type="text"
                                value={novosCustos[`${i.id}|legado`] !== undefined ? (novosCustos[`${i.id}|legado`] === '' ? '' : Number(novosCustos[`${i.id}|legado`]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : ''}
                                onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setNovosCustos({...novosCustos, [`${i.id}|legado`]: val}); }}
                                placeholder="Valor Total"
                                className="w-24 p-1.5 pl-5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                              />
                            </div>
                            <button 
                              onClick={() => cancelarEdicao(`${i.id}|legado`)} 
                              className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors"
                              title="Cancelar"
                            ><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-orange-600">{formatarQtdJSX(rotativo, Number(i.qtdPacote || 1), i.unidade)}</span>
                      {!editMode[`${i.id}|rot`] ? (
                        <button onClick={() => handleToggleEdit(`${i.id}|rot`)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Editar"><Settings size={16}/></button>
                      ) : (
                        <div className="flex items-center space-x-1 animate-in fade-in zoom-in duration-200">
                          <input 
                            type="number" step="any" 
                            value={novosEstoques[`${i.id}|rot`] !== undefined ? novosEstoques[`${i.id}|rot`] : ''} 
                            onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|rot`]: e.target.value})} 
                            placeholder={`Qtd (${rotativo})`} 
                            className="w-24 p-2 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-orange-500 text-sm" 
                            title="Nova Quantidade" 
                          />
                          <button onClick={() => cancelarEdicao(`${i.id}|rot`)} className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 rounded transition-colors" title="Cancelar"><X size={16}/></button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>

      {chavesPendentes.length > 0 && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgb(0,0,0,0.1)] z-40 animate-in slide-in-from-bottom duration-300">
          <div className="w-full mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
               <p className="font-black text-gray-800 text-lg">{chavesPendentes.length} item(ns) alterado(s)</p>
               <p className="text-sm text-gray-500">Revise suas alterações e clique em Salvar para aplicar.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={() => { setNovosEstoques({}); setNovosCustos({}); setEditMode({}); }} className="flex-1 sm:flex-none px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSalvarTudo} className="flex-1 sm:flex-none px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-sm hover:bg-green-700 transition-colors flex items-center justify-center">
                <Save size={18} className="mr-2"/> Salvar Balanço
              </button>
            </div>
          </div>
        </div>
      )}

      {historicoBalanco.length > 0 && (
        <div className="mt-8 mb-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Resumo de Alterações (Nesta Sessão)</h3>
            <button onClick={() => setHistoricoBalanco([])} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">Limpar Histórico</button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-white sticky top-0 shadow-sm text-[10px] uppercase text-gray-500 font-bold">
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Local (Aba)</th>
                  <th className="px-4 py-3">Qtd Antiga</th>
                  <th className="px-4 py-3">Qtd Nova</th>
                  <th className="px-4 py-3">Dif. Qtd</th>
                  <th className="px-4 py-3">Valor Antigo</th>
                  <th className="px-4 py-3">Valor Novo</th>
                  <th className="px-4 py-3">Dif. Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...historicoBalanco].sort((a, b) => a.nome.localeCompare(b.nome)).map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{h.nome}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{h.tipo} {h.detalhe ? `(${h.detalhe})` : ''}</td>
                    <td className="px-4 py-3 text-gray-500">{h.qtdAntiga} {h.unidade}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{h.qtdNova} {h.unidade}</td>
                    <td className={`px-4 py-3 font-bold ${h.qtdNova - h.qtdAntiga > 0 ? 'text-emerald-600' : h.qtdNova - h.qtdAntiga < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {h.qtdNova - h.qtdAntiga > 0 ? '+' : ''}{(h.qtdNova - h.qtdAntiga).toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{h.valorAntigo !== undefined ? `R$ ${h.valorAntigo.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 font-medium">{h.valorNovo !== undefined ? `R$ ${h.valorNovo.toFixed(2)}` : '-'}</td>
                    <td className={`px-4 py-3 font-bold ${h.valorNovo !== undefined && h.valorAntigo !== undefined ? (h.valorNovo - h.valorAntigo > 0 ? 'text-emerald-600' : h.valorNovo - h.valorAntigo < 0 ? 'text-red-600' : 'text-gray-400') : 'text-gray-400'}`}>
                      {h.valorNovo !== undefined && h.valorAntigo !== undefined ? `${h.valorNovo - h.valorAntigo > 0 ? '+' : ''}R$ ${(h.valorNovo - h.valorAntigo).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    {toast && (
      <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
        <CheckCircle className="mr-2" size={20} />
        <span className="whitespace-pre-line">{toast.message}</span>
      </div>
    )}

    <CalculadoraFlutuante />
    </div>
  );
}