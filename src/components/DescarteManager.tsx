import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario } from '../types';
import { Search, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

interface ItemDescarte {
  id: string;
  insumo: Insumo;
  qtd: number;
  motivo: string;
  tipoEstoque: 'rotativo' | 'estacionario';
  tipoBaixa: 'unidade' | 'volume';
}

export default function DescarteManager({ currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lista, setLista] = useState<ItemDescarte[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsub = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
      setLoading(false);
    });

    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setFuncionarios(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      else setFuncionarios([]);
    });

    return () => { unsub(); unsubFunc(); };
  }, []);

  const adicionarALista = (insumo: Insumo) => {
    const idUnico = Math.random().toString(36).substring(2, 9);
    setLista([{ id: idUnico, insumo, qtd: 1, motivo: 'Validade', tipoEstoque: 'rotativo', tipoBaixa: 'unidade' }, ...lista]);
    setSearchTerm('');
  };

  const atualizarItem = (id: string, field: keyof ItemDescarte, value: any) => {
    setLista(lista.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removerItem = (id: string) => {
    setLista(lista.filter(item => item.id !== id));
  };

  const handleFinalizar = () => {
    if (lista.length === 0) return showToast('A lista está vazia.', 'error');
    for (const item of lista) {
      if (item.qtd <= 0) return showToast(`Informe uma quantidade válida para ${item.insumo.nome}.`, 'error');
      if (!item.motivo) return showToast(`Informe o motivo para ${item.insumo.nome}.`, 'error');
    }
    setPin('');
    setShowPinModal(true);
  };

  const handlePinSubmit = async () => {
    const func = funcionarios.find(f => String(f.pin) === pin);
    if (!func) return showToast('PIN inválido!', 'error');
    const isAdminOrGerente = Array.isArray(func.cargo) ? func.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c)) : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(func.cargo as string);
    if (!isAdminOrGerente) {
      showToast('Autorização negada! Requer Gerente ou Administrador.', 'error');
      return;
    }

    setShowPinModal(false);
    setLoading(true);

    let sucessos = 0;

    for (const item of lista) {
      const insumoRef = ref(db, `insumos/${item.insumo.id}`);
      let valorTotalItem = 0;
      
      await runTransaction(insumoRef, (currentData) => {
        if (currentData) {
          const pacote = Number(currentData.qtdPacote || 1);
          const preco = Number(currentData.precoPacote || 0);
          const custoUnitario = preco / pacote;
          const qtdDescarteReal = item.tipoBaixa === 'volume' ? item.qtd * pacote : item.qtd;
          
          valorTotalItem = qtdDescarteReal * custoUnitario;

          if (item.tipoEstoque === 'rotativo') {
            const atual = Number(currentData.estoqueRotativo ?? 0);
            currentData.estoqueRotativo = Math.max(0, Number((atual - qtdDescarteReal).toFixed(4)));
          } else {
            const atual = Number(currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0);
            currentData.estoqueEstacionario = Math.max(0, Number((atual - qtdDescarteReal).toFixed(4)));
          }
        }
        return currentData;
      });

      const pacoteHistorico = Number(item.insumo.qtdPacote || 1);
      const qtdDescarteRealHist = item.tipoBaixa === 'volume' ? item.qtd * pacoteHistorico : item.qtd;

      await set(push(ref(db, 'historico_descartes')), {
        insumoId: item.insumo.id,
        nomeInsumo: item.insumo.nome,
        quantidade: qtdDescarteRealHist,
        unidade: item.insumo.unidade || '',
        motivo: item.motivo,
        tipoEstoque: item.tipoEstoque,
        valorTotal: valorTotalItem,
        funcionarioId: currentUser?.id || 'unknown',
        funcionarioNome: currentUser?.nome || 'Desconhecido',
        autorizadoPorId: func.id,
        autorizadoPorNome: func.nome,
        timestamp: Date.now()
      });

      sucessos++;
    }

    setLoading(false);
    if (sucessos > 0) {
      showToast(`Baixa finalizada! ${sucessos} insumo(s) descartado(s).`, 'success');
      setLista([]);
    }
  };

  const valorTotalPerda = lista.reduce((acc, item) => {
    const pacote = Number(item.insumo.qtdPacote || 1);
    const preco = Number(item.insumo.precoPacote || 0);
    const qtdReal = item.tipoBaixa === 'volume' ? item.qtd * pacote : item.qtd;
    return acc + (qtdReal * (preco / pacote));
  }, 0);

  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <Trash2 className="mr-2 text-red-600" size={20} />
              Descarte de Estoque (Baixa)
            </h3>
            <p className="text-sm text-gray-500 mt-1">Registre perdas por validade, danos ou avarias. Requer autorização de um gestor.</p>
          </div>
        </div>
        
        <div className="mt-6 relative w-full lg:w-1/2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar insumo para dar baixa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 text-sm w-full transition-all bg-white"
          />
          
          {searchTerm && (
            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
               {insumos.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase())).map(i => (
                 <div key={i.id} onClick={() => adicionarALista(i)} className="p-3 hover:bg-red-50 cursor-pointer border-b border-gray-50 flex justify-between items-center transition-colors">
                    <div>
                       <p className="font-bold text-gray-800 text-sm">{i.nome}</p>
                       <p className="text-xs text-gray-500 mt-0.5">Rot: {formatarQtdJSX(Number(i.estoqueRotativo ?? 0), Number(i.qtdPacote || 1), i.unidade)} • Est: {formatarQtdJSX(Number(i.estoqueEstacionario ?? (i as any).estoqueAtual ?? 0), Number(i.qtdPacote || 1), i.unidade)}</p>
                    </div>
                    <Plus size={18} className="text-red-600 bg-red-100 p-1 rounded-full"/>
                 </div>
               ))}
               {insumos.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                 <p className="p-4 text-center text-sm text-gray-500">Nenhum insumo encontrado.</p>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-bold">
                <th className="p-3">Insumo</th>
                <th className="p-3 w-32">Local</th>
                <th className="p-3 w-36">Motivo</th>
                <th className="p-3 w-[140px] sm:w-[160px]">Quantidade</th>
                <th className="p-3 w-28">Perda (R$)</th>
                <th className="p-3 w-12 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {lista.map((item) => {
                const pacote = Number(item.insumo.qtdPacote || 1);
                const preco = Number(item.insumo.precoPacote || 0);
                const qtdReal = item.tipoBaixa === 'volume' ? item.qtd * pacote : item.qtd;
                const perda = qtdReal * (preco / pacote);
                return (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-3">
                    <p className="font-bold text-gray-800 text-xs sm:text-sm leading-tight">{item.insumo.nome}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Disp (Rot): {Number(item.insumo.estoqueRotativo ?? 0)} {item.insumo.unidade} | (Est): {Number(item.insumo.estoqueEstacionario ?? (item.insumo as any).estoqueAtual ?? 0)} {item.insumo.unidade}</p>
                  </td>
                  <td className="p-3">
                    <select value={item.tipoEstoque} onChange={(e) => atualizarItem(item.id, 'tipoEstoque', e.target.value)} className="w-full p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 text-xs bg-white">
                      <option value="rotativo">Rotativo</option>
                      <option value="estacionario">Estacionário</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select value={item.motivo} onChange={(e) => atualizarItem(item.id, 'motivo', e.target.value)} className="w-full p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 text-xs bg-white">
                      <option value="Validade">Venceu / Validade</option>
                      <option value="Caiu no chão">Caiu no chão</option>
                      <option value="Estragou">Estragou</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center space-x-1">
                        <input type="number" min="0.001" step="any" value={item.qtd || ''} onChange={(e) => atualizarItem(item.id, 'qtd', Number(e.target.value))} className="w-16 p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 text-xs bg-white text-center font-bold" />
                        {pacote > 1 ? (
                          <select value={item.tipoBaixa} onChange={(e) => atualizarItem(item.id, 'tipoBaixa', e.target.value)} className="flex-1 p-1.5 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 text-[10px] sm:text-xs bg-white text-gray-600 font-medium cursor-pointer">
                            <option value="unidade">{item.insumo.unidade}</option>
                            <option value="volume">Vol/Pacote</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500 font-medium px-1 truncate">{item.insumo.unidade}</span>
                        )}
                      </div>
                      {pacote > 1 && (
                        <div className="text-[10px] text-gray-500 text-center bg-gray-50 rounded px-1 py-0.5 border border-gray-100 mt-0.5">
                          Total: <span className="font-bold text-gray-700">{(item.tipoBaixa === 'volume' ? item.qtd * pacote : item.qtd)} {item.insumo.unidade}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-red-600 font-bold text-xs sm:text-sm">
                    R$ {perda.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => removerItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Remover da lista">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )})}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                     <Trash2 className="mx-auto text-gray-300 mb-3" size={40} />
                     <p className="text-gray-500 font-medium text-sm">Lista de descarte vazia.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lista.length > 0 && (
          <div className="bg-red-50/50 border-t border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex-1">
             <p className="text-sm font-bold text-red-600 uppercase tracking-wider">Perda Estimada</p>
             <p className="text-3xl font-black text-gray-900">R$ {valorTotalPerda.toFixed(2).replace('.', ',')}</p>
             <p className="text-xs text-gray-500 mt-1 font-medium">{lista.length} item(ns) na lista aguardando baixa</p>
           </div>
           <button onClick={handleFinalizar} disabled={loading} className="w-full sm:w-auto bg-red-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-70">
              {loading ? <span className="animate-pulse">Processando...</span> : <><CheckCircle size={24} className="mr-2"/> Solicitar Autorização e Baixar</>}
           </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} />
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full border-t-4 border-red-500">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2 flex flex-col items-center">
               <AlertTriangle size={32} className="text-red-500 mb-2" /> Autorização Necessária
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">Para confirmar a perda e abater o estoque, é necessário a autorização (PIN) de um Gerente ou Administrador.</p>
            
            <input 
              type="tel"
              autoComplete="off"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-red-100 rounded-xl outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 transition-all mb-6"
              placeholder="****"
              style={{ WebkitTextSecurity: 'disc' } as any}
            />
            
            <div className="flex space-x-3">
              <button onClick={() => setShowPinModal(false)} className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="flex-1 p-3 text-white bg-red-600 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                Autorizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}