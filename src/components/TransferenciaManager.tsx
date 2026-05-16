import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario, LoteDados } from '../types';
import { ArrowRightLeft, Search, CheckCircle, AlertTriangle, CheckSquare, History, User, Clock } from 'lucide-react';

export default function TransferenciaManager({ currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ultimasTransferencias, setUltimasTransferencias] = useState<any[]>([]);
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

    const transRef = ref(db, 'historico_transferencias');
    const unsubTrans = onValue(transRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const filtrado = list.filter(t => t.timestamp >= hoje.getTime()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
        setUltimasTransferencias(filtrado);
      } else {
        setUltimasTransferencias([]);
      }
    });

    return () => {
      unsubInsumos();
      unsubFunc();
      unsubTrans();
    };
  }, []);

  const confirmWithPin = (action: (func: Funcionario) => Promise<void>) => {
    setPendingAction(() => action);
    setPin('');
    setShowPinModal(true);
  };

  const handlePinSubmit = async () => {
    const func = funcionarios.find(f => String(f.pin) === pin);
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
      setQuantidades({ ...quantidades, [insumo.id]: 0 });
    }
    setSelecionados(newSel);
  };

  const handleTransferirSelecionados = () => {
    confirmWithPin(async (func: Funcionario) => {
      if (selecionados.size === 0) return;

      const itensValidos = Array.from(selecionados).filter(id => quantidades[id] && quantidades[id] > 0);
      if (itensValidos.length === 0) {
        showToast('Informe a quantidade de pelo menos um insumo para transferir.', 'error');
        return;
      }

      let sucessoCount = 0;
      let linkedCount = 0;
      let errosCount = 0;
      
      const promessas = Array.from(selecionados).map(async (id) => {
        const numVolumesTransferir = quantidades[id];
        if (!numVolumesTransferir || numVolumesTransferir <= 0) return; // Pula insumos com qtd inválida
        const insumo = insumos.find(i => i.id === id);
        if (!insumo) return;

        const qtdPacote = Number(insumo.qtdPacote || 1);
        const rawUnitsToTransfer = qtdPacote > 1 ? numVolumesTransferir * qtdPacote : numVolumesTransferir;
        const unitsToTransfer = Number(rawUnitsToTransfer.toFixed(4));
        const linkedId = (insumo as any).insumoVinculado;
        const isVariavel = (insumo as any).isVariavel;
        const insumoRef = ref(db, `insumos/${id}`);


        const result = await runTransaction(insumoRef, (currentData) => {
          if (currentData) {
            const rawEstEstacionario = Number(currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0);
            const rawEstRotativo = Number(currentData.estoqueRotativo ?? currentData.estoqueAtual ?? 0);
            const estEstacionario = Number(rawEstEstacionario.toFixed(4));
            const estRotativo = Number(rawEstRotativo.toFixed(4));

            if (estEstacionario >= unitsToTransfer - 0.001) {
              currentData.estoqueEstacionario = Number(Math.max(0, estEstacionario - unitsToTransfer).toFixed(4));
              if (!linkedId) {
                if (isVariavel) {
                  currentData.estoqueRotativo = unitsToTransfer;
                } else {
                  currentData.estoqueRotativo = Number((estRotativo + unitsToTransfer).toFixed(4));
                }
              }

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
                  const lQtd = Number(Number(l.quantidade || 0).toFixed(4));
                  if (lQtd <= qtdRestante) {
                    qtdRestante = Number((qtdRestante - lQtd).toFixed(4));
                    delete currentData.lotes[l.id];
                  } else {
                    currentData.lotes[l.id].quantidade = Number((lQtd - qtdRestante).toFixed(4));
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
          if (linkedId) {
            const linkedRef = ref(db, `insumos/${linkedId}`);
            await runTransaction(linkedRef, (linkedData) => {
              if (linkedData) {
                const rawEstRotativo = Number(linkedData.estoqueRotativo ?? linkedData.estoqueAtual ?? 0);
                if (isVariavel) {
                  linkedData.estoqueRotativo = unitsToTransfer;
                } else {
                  linkedData.estoqueRotativo = Number((rawEstRotativo + unitsToTransfer).toFixed(4));
                }
              }
              return linkedData;
            });
            linkedCount++;
          }
          const transRef = ref(db, 'historico_transferencias');
          await set(push(transRef), {
            insumoId: id,
            nomeInsumo: insumo.nome,
            quantidade: unitsToTransfer,
            direcao: 'Estacionado -> Rotativo',
            funcionarioId: func.id,
            funcionarioNome: func.nome,
            timestamp: Date.now()
          });
          sucessoCount++;
        } else {
          errosCount++;
        }
      });

      await Promise.all(promessas);

      if (sucessoCount > 0) {
        if (linkedCount > 0) {
          showToast(`${sucessoCount} insumos transferidos! (${linkedCount} unidades base processadas)`, 'success');
        } else {
          showToast(`${sucessoCount} insumos transferidos com sucesso!`, 'success');
        }
        const novasQtds = { ...quantidades };
        selecionados.forEach(id => novasQtds[id] = 0);
        setQuantidades(novasQtds);
        setSelecionados(new Set());
      }

      if (errosCount > 0) {
        setTimeout(() => {
          showToast(`${errosCount} insumo(s) não puderam ser transferidos. Verifique se há saldo suficiente.`, 'error');
        }, sucessoCount > 0 ? 3000 : 0);
      }
    });
  };

  const isGestor = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c))
      : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(currentUser.cargo as string)
  );

  const insumosPermitidos = insumos.filter(i => isGestor || !(i as any).restrito);
  const tiposExistentes = Array.from(new Set(insumosPermitidos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const filteredInsumos = insumosPermitidos.filter(i => {
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <ArrowRightLeft className="mr-2 text-indigo-600" size={20} />
            Transferência de Estoque
          </h3>
          <p className="text-sm text-gray-500 mt-1">Mova insumos do Estoque Estacionado para o Rotativo. Informe a quantidade exata a transferir.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
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
          const estEstacionario = Number(insumo.estoqueEstacionario ?? (insumo as any).estoqueAtual ?? 0);
          let estRotativo = Number(insumo.estoqueRotativo ?? (insumo as any).estoqueAtual ?? 0);
          if ((insumo as any).insumoVinculado) {
              const linked = insumos.find(i => i.id === (insumo as any).insumoVinculado);
              if (linked) estRotativo = Number(linked.estoqueRotativo ?? (linked as any).estoqueAtual ?? 0);
          }
          const qtdPacote = Number(insumo.qtdPacote || 1);
          const maxVal = qtdPacote > 1 ? Number((estEstacionario / qtdPacote).toFixed(4)) : estEstacionario;
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
                <span className="text-gray-500">Rotativo: <span className="font-bold text-orange-500">{estRotativo}{insumo.unidade}</span> {(insumo as any).isVariavel && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold uppercase">Variável</span>}</span>
              </div>
            </div>
            <div className="flex">
              <input type="number" step="any" min="0.01" max={maxVal} value={quantidades[insumo.id] || ''} onChange={(e) => {
                const val = Number(e.target.value);
                setQuantidades({ ...quantidades, [insumo.id]: val });
                const newSel = new Set(selecionados);
                if (val > 0) newSel.add(insumo.id);
                else newSel.delete(insumo.id);
                setSelecionados(newSel);
              }} placeholder={inputPlaceholder} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-center" />
            </div>
          </div>
        )})}
      </div>

      {selecionados.size > 0 && (
        <div className="bg-indigo-50/50 border-t border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-xl">
           <div className="flex-1">
             <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Itens Selecionados</p>
             <p className="text-3xl font-black text-gray-900">{selecionados.size} insumo(s)</p>
             <p className="text-xs text-gray-500 mt-1 font-medium">Prontos para transferência ao estoque rotativo</p>
           </div>
           <button onClick={handleTransferirSelecionados} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg hover:shadow-xl">
              <CheckSquare size={24} className="mr-2"/> Transferir Todos
           </button>
        </div>
      )}

      {ultimasTransferencias.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col max-h-[400px] animate-in fade-in duration-300">
          <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4"><History size={20} className="mr-2 text-indigo-600"/> Log de Transferências (Hoje)</h3>
          <div className="overflow-y-auto pr-2 space-y-3">
            {ultimasTransferencias.map(t => (
              <div key={t.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{t.quantidade}x {t.nomeInsumo} <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{t.direcao || 'Estacionado -> Rotativo'}</span></p>
                  <p className="text-xs text-gray-500 flex items-center mt-1"><User size={12} className="mr-1"/> {t.funcionarioNome}</p>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100 flex items-center"><Clock size={12} className="mr-1"/> {new Date(t.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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