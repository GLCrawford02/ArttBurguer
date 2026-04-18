import { useEffect, useState } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario, Produto } from '../types';
import { AlertTriangle, Package, TrendingUp, Search, CalendarClock, Trash2, CheckCircle, ShoppingBag } from 'lucide-react';

export default function Dashboard() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<((func: Funcionario) => Promise<void>) | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
        }));
        list.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena de A a Z
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });

    const produtosRef = ref(db, 'produtos');
    const unsubProdutos = onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProdutos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setProdutos([]);
      }
    });

    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFuncionarios(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setFuncionarios([]);
      }
    });

    return () => {
      unsubInsumos();
      unsubProdutos();
      unsubFunc();
    };
  }, []);

  // O alerta de estoque baixo agora considera o Estacionário
  const baixos = insumos.filter(i => (i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) <= (i.alertaMinimo || 0));
  const excedentes = insumos.filter(i => i.estoqueMaximo && (i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) > i.estoqueMaximo);

  const isVencido = (item: any) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (item.lotes) {
      return Object.values(item.lotes).some((l: any) => {
        if (!l.validade) return false;
        const dataValidade = new Date(`${l.validade}T00:00:00`);
        return dataValidade.getTime() < hoje.getTime();
      });
    } else if (item.validade) {
      const dataValidade = new Date(`${item.validade}T00:00:00`);
      return dataValidade.getTime() < hoje.getTime();
    }
    return false;
  };

  const isLotExpired = (validade?: string) => {
    if (!validade) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(`${validade}T00:00:00`).getTime() < hoje.getTime();
  };

  const handlePinSubmit = async () => {
    const func = funcionarios.find(f => f.pin === pin);
    if (!func) {
      showToast('PIN inválido!', 'error');
      return;
    }
    if (func.cargo !== 'Administrador' && func.cargo !== 'Gerente') {
      showToast('Autorização negada! Requer Gerente ou Administrador.', 'error');
      return;
    }
    setShowPinModal(false);
    if (pendingAction) {
      await pendingAction(func);
    }
  };

  const descartarLote = (itemId: string, loteId: string, quantidade: number, nomeLote: string) => {
    if (!confirm(`Deseja descartar ${quantidade} unidades do lote ${nomeLote || 'N/A'}? O estoque atual será reduzido.`)) return;

    setPendingAction(() => async (func: Funcionario) => {
      const itemRef = ref(db, `insumos/${itemId}`);
      let descartou = false;
      const insumo = insumos.find(i => i.id === itemId);

      await runTransaction(itemRef, (currentData) => {
        if (currentData) {
          if (currentData.lotes && currentData.lotes[loteId]) {
            currentData.estoqueEstacionario = Math.max(0, (currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0) - quantidade);
            delete currentData.lotes[loteId];
            descartou = true;
          } else if (!currentData.lotes && loteId === 'legado') {
            currentData.estoqueEstacionario = Math.max(0, (currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0) - quantidade);
            currentData.validade = null;
            currentData.lote = null;
            descartou = true;
          }
        }
        return currentData;
      });

      if (descartou && insumo) {
        await set(push(ref(db, 'historico_descartes')), {
          insumoId: itemId,
          nomeInsumo: insumo.nome,
          quantidade,
          lote: nomeLote || 'N/A',
          funcionarioId: func.id,
          funcionarioNome: func.nome,
          timestamp: Date.now()
        });
      }
      showToast('Lote descartado com sucesso!', 'success');
    });
    setPin('');
    setShowPinModal(true);
  };

  const filteredInsumos = insumos.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchTipo;
  });

  const validadeProxima: any[] = [];
  
  insumos.forEach(i => {
    const diasAviso = (i as any).diasAvisoValidade !== undefined ? (i as any).diasAvisoValidade : 7;
    
    if (i.lotes) {
      Object.values(i.lotes).forEach((l: any) => {
        if (!l.validade) return;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataValidade = new Date(`${l.validade}T00:00:00`);
        const diffTime = dataValidade.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= diasAviso) {
          validadeProxima.push({ ...i, loteSpec: l });
        }
      });
    } else if ((i as any).validade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataValidade = new Date(`${(i as any).validade}T00:00:00`);
      const diffTime = dataValidade.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= diasAviso) {
        const q = i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0;
        validadeProxima.push({ ...i, loteSpec: { lote: (i as any).lote, validade: (i as any).validade, quantidade: q } });
      }
    }
  });

  // Pega os tipos únicos existentes para o select de filtro
  const tiposExistentes = Array.from(new Set(insumos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

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
      <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Insumos</p>
            <p className="text-2xl font-bold">{insumos.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Produtos</p>
            <p className="text-2xl font-bold text-purple-600">{produtos.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Estoque Baixo</p>
            <p className="text-2xl font-bold text-red-600">{baixos.length}</p>
          </div>
        </div>
      </div>

      {(validadeProxima.length > 0 || baixos.length > 0 || excedentes.length > 0) && (
        <div className="flex flex-col md:flex-row flex-wrap gap-4">
          {validadeProxima.length > 0 && (
            <div className="flex-1 min-w-[300px] bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CalendarClock className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Alertas de Validade (Vencidos ou Próximos de Vencer)</h3>
                  <div className="mt-2 text-sm text-red-700 max-h-[150px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {validadeProxima.map((item, idx) => (
                        <li key={`${item.id}-${idx}`}>
                          <span className="font-bold">{item.nome}</span> - Lote: {item.loteSpec.lote || 'N/A'} - Validade: {new Date(`${item.loteSpec.validade}T00:00:00`).toLocaleDateString('pt-BR')} <span className="font-semibold text-xs">({item.loteSpec.quantidade}{item.unidade})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {baixos.length > 0 && (
            <div className="flex-1 min-w-[300px] bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Alertas de Reposição Necessária</h3>
                  <div className="mt-2 text-sm text-red-700 max-h-[150px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {baixos.map(i => {
                        const estEstacionario = i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0;
                        return (
                          <li key={i.id}>
                            <span className="font-bold">{i.nome}:</span> {formatarQtdJSX(estEstacionario, i.qtdPacote || 1, i.unidade)} no Estacionário (Mínimo: {i.alertaMinimo})
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {excedentes.length > 0 && (
            <div className="flex-1 min-w-[300px] bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Alerta de Estoque Excedente (Armazenamento Extra)</h3>
                  <div className="mt-2 text-sm text-blue-700 max-h-[150px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {excedentes.map(i => {
                        const estEstacionario = i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0;
                        return (
                          <li key={i.id}>
                            <span className="font-bold">{i.nome}:</span> {formatarQtdJSX(estEstacionario, i.qtdPacote || 1, i.unidade)} (Máximo: {i.estoqueMaximo})
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-gray-800">Lista de Insumos</h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select 
              value={filtroTipoUso} 
              onChange={(e) => setFiltroTipoUso(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">Todos os Tipos</option>
              {tiposExistentes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
            </select>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
              />
            </div>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Insumo</th>
              <th className="px-6 py-3">Tipo</th>
              <th className="px-6 py-3">Rotativo</th>
              <th className="px-6 py-3">Estacionário</th>
              <th className="px-6 py-3">Preço Unit.</th>
              <th className="px-6 py-3">Validade</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInsumos.map(i => {
              return (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors text-sm">
                <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                <td className="px-6 py-4">
                  {(i as any).tipoUso ? <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full uppercase">{(i as any).tipoUso}</span> : <span className="text-gray-400 text-xs">-</span>}
                </td>
                <td className="px-6 py-4 text-orange-600 font-bold">{(i.estoqueRotativo ?? (i as any).estoqueAtual ?? 0)} {i.unidade}</td>
                <td className="px-6 py-4 text-indigo-600 font-bold">
                  {formatarQtdJSX((i.estoqueEstacionario ?? 0), i.qtdPacote || 1, i.unidade)}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  R$ {(i.precoPacote / (i.qtdPacote || 1)).toFixed(3).replace('.', ',')} / {i.unidade}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {i.lotes ? (
                    <div className="space-y-1">
                      {Object.entries(i.lotes).map(([loteId, l]: [string, any], idx: number) => (
                        <div key={idx} className={`text-xs flex items-center justify-between border-b border-gray-50 pb-1 ${isLotExpired(l.validade) ? 'text-red-600 font-medium' : ''}`}>
                          <span>{l.validade ? new Date(`${l.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}{l.lote && l.lote !== 'N/A' && ` (L: ${l.lote})`}</span>
                          <div className="flex items-center">
                            <span className={`font-bold ml-3 ${isLotExpired(l.validade) ? 'text-red-600' : 'text-gray-500'}`}>{l.quantidade}{i.unidade}</span>
                            {isLotExpired(l.validade) && (
                              <button 
                                onClick={() => descartarLote(i.id, loteId, l.quantidade, l.lote)} 
                                className="ml-2 text-red-500 hover:text-red-700 bg-red-50 p-1 rounded" 
                                title="Descartar Lote Vencido"
                              >
                                 <Trash2 size={12}/>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className={isLotExpired((i as any).validade) ? 'text-red-600 font-medium' : ''}>
                        {(i as any).validade ? new Date(`${(i as any).validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                      </span>
                      {isLotExpired((i as any).validade) && (
                        <button
                          onClick={() => descartarLote(i.id, 'legado', (i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0), (i as any).lote)}
                          className="ml-2 text-red-500 hover:text-red-700 bg-red-50 p-1 rounded" 
                          title="Descartar Lote Vencido"
                        >
                           <Trash2 size={12}/>
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {(i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) <= (i.alertaMinimo || 0) ? (
                      <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-600 rounded-full">BAIXO</span>
                    ) : i.estoqueMaximo && (i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0) > i.estoqueMaximo ? (
                      <span className="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-600 rounded-full">EXCEDENTE</span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-600 rounded-full">OK</span>
                    )}
                    {isVencido(i) && (
                      <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full">VENCIDO</span>
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
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full border-t-4 border-red-500">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2 flex flex-col items-center">
               <AlertTriangle size={32} className="text-red-500 mb-2" /> Autorização Necessária
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">Apenas Gerentes ou Administradores podem autorizar o descarte de insumos. Digite o PIN.</p>
            
            <input 
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 transition-all mb-6"
              placeholder="****"
            />
            
            <div className="flex space-x-3">
              <button onClick={() => { setShowPinModal(false); setPendingAction(null); }} className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="flex-1 p-3 text-white bg-red-600 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
