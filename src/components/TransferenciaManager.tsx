import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario, LoteDados } from '../types';
import { ArrowRightLeft, Search, CheckCircle, AlertTriangle, CheckSquare } from 'lucide-react';

export default function TransferenciaManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
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
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
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
      unsubFunc();
    };
  }, []);

  const confirmWithPin = (action: (func: Funcionario) => Promise<void>) => {
    setPendingAction(() => action);
    setPin('');
    setShowPinModal(true);
  };

  const handlePinSubmit = async () => {
    const func = funcionarios.find(f => f.pin === pin);
    if (!func) {
      showToast('PIN inválido!', 'error');
      return;
    }
    setShowPinModal(false);
    if (pendingAction) {
      await pendingAction(func);
    }
  };

  const toggleSelect = (insumo: Insumo) => {
    const newSel = new Set(selecionados);
    if (newSel.has(insumo.id)) {
      newSel.delete(insumo.id);
      setQuantidades({ ...quantidades, [insumo.id]: 0 });
    } else {
      newSel.add(insumo.id);
      const estEstacionario = insumo.estoqueEstacionario ?? (insumo as any).estoqueAtual ?? 0;
      const qtdPacote = insumo.qtdPacote || 1;
      const maxVal = qtdPacote > 1 ? Math.floor(estEstacionario / qtdPacote) : estEstacionario;
      setQuantidades({ ...quantidades, [insumo.id]: maxVal });
    }
    setSelecionados(newSel);
  };

  const handleTransfer = (insumo: Insumo) => {
    confirmWithPin(async (func: Funcionario) => {
      const numVolumesTransferir = quantidades[insumo.id];
      if (!numVolumesTransferir || numVolumesTransferir <= 0) {
        showToast('Informe a quantidade para transferir.', 'error');
        return;
      }
      const qtdPacote = insumo.qtdPacote || 1;
      const unitsToTransfer = qtdPacote > 1 ? numVolumesTransferir * qtdPacote : numVolumesTransferir;

      const insumoRef = ref(db, `insumos/${insumo.id}`);

      const result = await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          const estEstacionario = currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0;
          const estRotativo = currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0;
          if (estEstacionario >= unitsToTransfer) {
            currentData.estoqueEstacionario = estEstacionario - unitsToTransfer;
            currentData.estoqueRotativo = estRotativo + unitsToTransfer;


            if (currentData.lotes) {
              let qtdRestante = unitsToTransfer;
              const lotesArray = Object.entries(currentData.lotes).map(([id, l]) => ({ id, ...(l as LoteDados) }));
              
              lotesArray.sort((a, b) => {
                if (!a.validade) return 1;
                if (!b.validade) return -1;
                return new Date(a.validade).getTime() - new Date(b.validade).getTime();
              });

              for (const l of lotesArray) {
                if (qtdRestante <= 0) break;
                if (l.quantidade <= qtdRestante) {
                  qtdRestante -= l.quantidade;
                  delete currentData.lotes[l.id];
                } else {
                  currentData.lotes[l.id].quantidade -= qtdRestante;
                  qtdRestante = 0;
                }
              }
            }

            return currentData;
          } else {
            return undefined; // Aborta a transação por falta de estoque
          }
        }
        return currentData;
      });

      if (result.committed) {
        const transRef = ref(db, 'historico_transferencias');
        await set(push(transRef), {
          insumoId: insumo.id,
          nomeInsumo: insumo.nome,
          quantidade: unitsToTransfer,
          funcionarioId: func.id,
          funcionarioNome: func.nome,
          timestamp: Date.now()
        });
        showToast(`${unitsToTransfer} ${insumo.unidade} de ${insumo.nome} transferido para o Estoque Rotativo!`, 'success');
        setQuantidades({ ...quantidades, [insumo.id]: 0 });
      } else {
        showToast(`Erro: Quantidade insuficiente no Estoque Estacionado!`, 'error');
      }
    });
  };

  const handleTransferirSelecionados = () => {
    confirmWithPin(async (func: Funcionario) => {
      if (selecionados.size === 0) return;
      let sucessoCount = 0;
      
      const promessas = Array.from(selecionados).map(async (id) => {
        const numVolumesTransferir = quantidades[id];
        if (!numVolumesTransferir || numVolumesTransferir <= 0) return; // Pula insumos com qtd inválida
        const insumo = insumos.find(i => i.id === id);
        if (!insumo) return;

        const qtdPacote = insumo.qtdPacote || 1;
        const unitsToTransfer = qtdPacote > 1 ? numVolumesTransferir * qtdPacote : numVolumesTransferir;
        const insumoRef = ref(db, `insumos/${id}`);

        const result = await runTransaction(insumoRef, (currentData) => {
          if (currentData) {
            const estEstacionario = currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0;
            const estRotativo = currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0;
            if (estEstacionario >= unitsToTransfer) {
              currentData.estoqueEstacionario = estEstacionario - unitsToTransfer;
              currentData.estoqueRotativo = estRotativo + unitsToTransfer;


              if (currentData.lotes) {
                let qtdRestante = unitsToTransfer;
                const lotesArray = Object.entries(currentData.lotes).map(([id, l]) => ({ id, ...(l as LoteDados) }));
                
                lotesArray.sort((a, b) => {
                  if (!a.validade) return 1;
                  if (!b.validade) return -1;
                  return new Date(a.validade).getTime() - new Date(b.validade).getTime();
                });

                for (const l of lotesArray) {
                  if (qtdRestante <= 0) break;
                  if (l.quantidade <= qtdRestante) {
                    qtdRestante -= l.quantidade;
                    delete currentData.lotes[l.id];
                  } else {
                    currentData.lotes[l.id].quantidade -= qtdRestante;
                    qtdRestante = 0;
                  }
                }
              }

              return currentData;
            } else {
              return undefined; // Aborta a transação por falta de estoque
            }
          }
          return currentData;
        });
        
        if (result.committed) {
          const transRef = ref(db, 'historico_transferencias');
          await set(push(transRef), {
            insumoId: id,
            nomeInsumo: insumo.nome,
            quantidade: unitsToTransfer,
            funcionarioId: func.id,
            funcionarioNome: func.nome,
            timestamp: Date.now()
          });
          sucessoCount++;
        }
      });

      await Promise.all(promessas);

      if (sucessoCount > 0) {
        showToast(`${sucessoCount} insumos transferidos para o Rotativo!`, 'success');
        const novasQtds = { ...quantidades };
        selecionados.forEach(id => novasQtds[id] = 0);
        setQuantidades(novasQtds);
        setSelecionados(new Set());
      }
    });
  };

  const tiposExistentes = Array.from(new Set(insumos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const filteredInsumos = insumos.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchTipo;
  });


  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtd} {unid})</span></span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <ArrowRightLeft className="mr-2 text-indigo-600" size={20} />
            Transferência de Estoque
          </h3>
        <p className="text-sm text-gray-500 mt-1">Mova insumos do Estoque Estacionado para o Rotativo. Informe a quantidade exata a transferir.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {selecionados.size > 0 && (
            <button
              onClick={handleTransferirSelecionados}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center shadow-sm w-full sm:w-auto justify-center"
            >
              <CheckSquare size={18} className="mr-2" />
              Transferir Selecionados ({selecionados.size})
            </button>
          )}
          <select 
            value={filtroTipoUso} 
            onChange={(e) => setFiltroTipoUso(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white w-full sm:w-auto"
          >
            <option value="">Todos os Tipos</option>
            {tiposExistentes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
          </select>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full sm:w-64" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
        {filteredInsumos.map(insumo => {
          const estEstacionario = insumo.estoqueEstacionario ?? (insumo as any).estoqueAtual ?? 0;
          const estRotativo = insumo.estoqueRotativo ?? (insumo as any).estoqueAtual ?? 0;
          const qtdPacote = insumo.qtdPacote || 1;
          const maxVal = qtdPacote > 1 ? (estEstacionario / qtdPacote) : estEstacionario;
          const inputPlaceholder = qtdPacote > 1 ? `Qtd (Volumes)` : `Qtd (${insumo.unidade})`;
          
          return (
          <div key={insumo.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-900 text-lg leading-tight">{insumo.nome}</h4>
                <input
                  type="checkbox"
                  checked={selecionados.has(insumo.id)}
                  onChange={() => toggleSelect(insumo)}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0 ml-2"
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-500">Estacionado: <span className="font-bold text-indigo-600">{formatarQtdJSX(estEstacionario, insumo.qtdPacote || 1, insumo.unidade)}</span></span>
                <span className="text-gray-500">Rotativo: <span className="font-bold text-orange-500">{estRotativo}{insumo.unidade}</span></span>
              </div>
            </div>
            <div className="flex space-x-2">
              <input type="number" step="any" min="0.01" max={maxVal} value={quantidades[insumo.id] || ''} onChange={(e) => setQuantidades({ ...quantidades, [insumo.id]: Number(e.target.value) })} placeholder={inputPlaceholder} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button onClick={() => handleTransfer(insumo)} disabled={!quantidades[insumo.id] || quantidades[insumo.id] > maxVal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                Transferir
              </button>
            </div>
          </div>
        )})}
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span className="whitespace-pre-line">{toast.message}</span></div>)}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Autorização Necessária</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Digite seu PIN de 4 dígitos para confirmar a transferência.</p>
            
            <input 
              type="tel"
              autoComplete="off"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-indigo-100 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all mb-6"
              placeholder="****"
              style={{ WebkitTextSecurity: 'disc' } as any}
            />
            
            <div className="flex space-x-3">
              <button onClick={() => { setShowPinModal(false); setPendingAction(null); }} className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="flex-1 p-3 text-white bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}