import { useState, useEffect } from 'react';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Item } from '../types';
import { Scale, Save, Download, CalendarClock } from 'lucide-react';

export default function BalancoManager() {
  const [insumos, setInsumos] = useState<Item[]>([]);
  const [novosEstoques, setNovosEstoques] = useState<Record<string, string>>({});
  const [filtroVencimento, setFiltroVencimento] = useState(false);

  useEffect(() => {
    const insumosRef = ref(db, 'itens');
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

  const handleAjuste = async (insumo: Item) => {
    const novoValor = novosEstoques[insumo.id];
    if (novoValor === undefined || novoValor === '') return;
    
    await set(ref(db, `itens/${insumo.id}/estoqueAtual`), Number(novoValor));
    alert(`Balanço concluído! O estoque de ${insumo.nome} agora é ${novoValor}${insumo.unidade}.`);
    
    setNovosEstoques(prev => {
      const newState = { ...prev };
      delete newState[insumo.id];
      return newState;
    });
  };

  const handleAjusteLote = async (insumo: Item, loteId: string, isLegacy: boolean = false) => {
    const key = `${insumo.id}|${loteId}`;
    const novoValorStr = novosEstoques[key];
    if (novoValorStr === undefined || novoValorStr === '') return;
    const novoValor = Number(novoValorStr);

    const insumoRef = ref(db, `itens/${insumo.id}`);
    await runTransaction(insumoRef, (currentData) => {
      if (currentData) {
        if (!isLegacy && currentData.lotes && currentData.lotes[loteId]) {
          const oldQtd = currentData.lotes[loteId].quantidade;
          currentData.lotes[loteId].quantidade = novoValor;
          currentData.estoqueAtual = Math.max(0, (currentData.estoqueAtual || 0) - oldQtd + novoValor);
          
          if (novoValor === 0) delete currentData.lotes[loteId]; // Remove lote se zerar
        } else if (isLegacy) {
          currentData.estoqueAtual = novoValor;
          if (novoValor === 0) {
            currentData.validade = null;
            currentData.lote = null;
          }
        }
      }
      return currentData;
    });

    alert(`Lote ajustado com sucesso!`);
    setNovosEstoques(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const isProximoVencimento = (item: Item) => {
    const diasAviso = item.diasAvisoValidade !== undefined ? item.diasAvisoValidade : 7;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (item.lotes) {
      return Object.values(item.lotes).some((l: any) => l.validade && (new Date(`${l.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso);
    } else if (item.validade) {
      return (new Date(`${item.validade}T00:00:00`).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= diasAviso;
    }
    return false;
  };

  const insumosExibidos = filtroVencimento ? insumos.filter(isProximoVencimento) : insumos;

  const exportarExcel = () => {
    const headers = ['Item', 'Estoque no Sistema', 'Unidade', 'Preco Unitario (R$)', 'Detalhes dos Lotes (Qtd/Validade/Lote)'];
    const rows = insumosExibidos.map(i => [
      i.nome,
      i.estoqueAtual,
      i.unidade,
      (i.precoPacote / i.qtdPacote).toFixed(3).replace('.', ','),
      i.lotes
        ? Object.values(i.lotes).map((l: any) => `${l.quantidade}${i.unidade} (Val: ${l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'} | Lote: ${l.lote || 'N/A'})`).join(' ; ')
        : i.validade || i.lote
        ? `${i.estoqueAtual}${i.unidade} (Val: ${i.validade ? new Date(`${i.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'} | Lote: ${i.lote || 'N/A'})`
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
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">Distribuição por Lotes</th>
              <th className="px-6 py-3">Estoque no Sistema</th>
              <th className="px-6 py-3">Estoque Real (Contagem)</th>
              <th className="px-6 py-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {insumosExibidos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                <td className="px-6 py-4 text-gray-600">
                  {i.lotes ? (
                    <div className="space-y-2">
                      {Object.entries(i.lotes).map(([loteId, l]: [string, any], idx: number) => {
                        const key = `${i.id}|${loteId}`;
                        return (
                          <div key={idx} className="text-xs flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0 gap-4">
                            <div className="flex-1">
                              <span>{l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{l.lote && l.lote !== 'N/A' && ` (L: ${l.lote})`}</span>
                              <span className="font-bold ml-2 text-gray-500">{l.quantidade}{i.unidade}</span>
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
                        <span className="font-bold ml-2 text-gray-500">{i.estoqueAtual}{i.unidade}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input 
                          type="number" 
                          value={novosEstoques[`${i.id}|legado`] !== undefined ? novosEstoques[`${i.id}|legado`] : ''} 
                          onChange={(e) => setNovosEstoques({...novosEstoques, [`${i.id}|legado`]: e.target.value})} 
                          placeholder={String(i.estoqueAtual)} 
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
                <td className="px-6 py-4 text-gray-600 font-bold">{i.estoqueAtual} {i.unidade}</td>
                <td className="px-6 py-4">
                  {!i.lotes && !i.validade && !i.lote ? (
                    <div className="flex items-center space-x-2">
                      <input type="number" value={novosEstoques[i.id] !== undefined ? novosEstoques[i.id] : ''} onChange={(e) => setNovosEstoques({...novosEstoques, [i.id]: e.target.value})} placeholder={String(i.estoqueAtual)} className="w-24 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
                      <span className="text-gray-500 text-sm font-medium">{i.unidade}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-orange-500 font-medium">Ajuste nos lotes ao lado</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {!i.lotes && !i.validade && !i.lote && (
                    <button onClick={() => handleAjuste(i)} disabled={novosEstoques[i.id] === undefined || novosEstoques[i.id] === ''} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
                      <Save size={16} className="mr-2" /> Ajustar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}