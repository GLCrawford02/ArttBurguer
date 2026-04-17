import { useState, useEffect } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario } from '../types';
import { ShoppingCart, Plus, Search, CheckCircle } from 'lucide-react';

export default function ComprasManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [lotes, setLotes] = useState<Record<string, string>>({});
  const [validades, setValidades] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingInsumo, setPendingInsumo] = useState<Insumo | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInsumos(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
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

  const gerarLoteData = () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear()).slice(-2);
    return `${dia}${mes}${ano}`;
  };

  const registrarCompra = async (insumo: Insumo, isConfirmedAdmin = false) => {
    const qtdVolumes = quantidades[insumo.id];
    if (!qtdVolumes || qtdVolumes <= 0) return;

    const qtdAdicionar = qtdVolumes * (insumo.qtdPacote || 1); // Multiplica os volumes pela Qtd na Caixa (1 se Unidade)
    const novoEstoque = (insumo.estoqueEstacionario ?? (insumo as any).estoqueAtual ?? 0) + qtdAdicionar;

    if (insumo.estoqueMaximo && novoEstoque > insumo.estoqueMaximo && !isConfirmedAdmin) {
      setPendingInsumo(insumo);
      setPin('');
      setShowPinModal(true);
      return;
    }

    const lote = lotes[insumo.id] || gerarLoteData();
    const validade = validades[insumo.id] || '';

    const insumoRef = ref(db, `insumos/${insumo.id}`);
    const result = await runTransaction(insumoRef, (currentData) => {
      if (currentData) {
        currentData.estoqueEstacionario = (currentData.estoqueEstacionario ?? currentData.estoqueAtual ?? 0) + qtdAdicionar;
        
        if (lote || validade) {
          if (!currentData.lotes) currentData.lotes = {};
          const newLoteId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
          currentData.lotes[newLoteId] = {
            lote: lote || 'N/A',
            validade: validade || '',
            quantidade: qtdAdicionar
          };
        }
      }
      return currentData;
    });

    if (result.committed) {
      // Salvar no histórico de compras financeiro
      const custoTotalCompra = qtdVolumes * (insumo.precoPacote || 0);
      const historicoRef = push(ref(db, 'historico_compras'));
      await set(historicoRef, {
        insumoId: insumo.id,
        nome: insumo.nome,
        qtdPacotes: qtdVolumes,
        custoTotal: custoTotalCompra,
        lote,
        validade,
        timestamp: Date.now()
      });
      
      showToast(`Estoque de ${insumo.nome} reabastecido (+${qtdVolumes} ${(insumo.qtdPacote || 1) > 1 ? 'CX' : 'UN'} = +${qtdAdicionar}${insumo.unidade}) com sucesso!`, 'success');
      setQuantidades({ ...quantidades, [insumo.id]: 0 }); // Limpa o campo
      setLotes({ ...lotes, [insumo.id]: '' });
      setValidades({ ...validades, [insumo.id]: '' });
    } else {
      showToast(`Erro ao registrar a compra de ${insumo.nome}. Tente novamente.`, 'error');
    }
  };

  const handlePinSubmit = async () => {
    const admin = funcionarios.find(f => f.pin === pin && f.cargo === 'Administrador');
    if (!admin) {
      showToast('PIN inválido ou funcionário não é Administrador!', 'error');
      return;
    }
    setShowPinModal(false);
    if (pendingInsumo) {
      await registrarCompra(pendingInsumo, true);
      setPendingInsumo(null);
    }
  };

  const tiposExistentes = Array.from(new Set(insumos.map(i => (i as any).tipoUso).filter(Boolean))).sort();

  const filteredInsumos = insumos.filter(i => {
    const matchSearch = (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchTipo;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ShoppingCart className="mr-2 text-blue-600" size={20} />
              Reabastecimento de Estoque
            </h3>
          <p className="text-sm text-gray-500 mt-1">Informe a quantidade de caixas ou unidades compradas. O sistema multiplicará pela quantidade da caixa automaticamente (se for unidade, a quantidade será a mesma).</p>
          </div>
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
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
        {filteredInsumos.map(insumo => (
          <div key={insumo.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 leading-tight">{insumo.nome}</h4>
              <p className="text-xs font-mono text-gray-400">{(insumo as any).sku || 'Sem SKU'}</p>
              <p className="text-sm text-gray-500">Est. Estacionário: <span className="font-bold">{insumo.estoqueEstacionario ?? (insumo as any).estoqueAtual ?? 0} {insumo.unidade}</span></p>
              <p className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-2 py-1 rounded font-medium border border-blue-100">1 {(insumo.qtdPacote || 1) > 1 ? 'CX' : 'UN'} = {insumo.qtdPacote || 1} {insumo.unidade}</p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={`Lote (padrão: ${gerarLoteData()})`}
                  value={lotes[insumo.id] || ''}
                  onChange={(e) => setLotes({ ...lotes, [insumo.id]: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <input
                  type="date"
                  value={validades[insumo.id] || ''}
                  onChange={(e) => setValidades({ ...validades, [insumo.id]: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="1"
                  value={quantidades[insumo.id] || ''}
                  onChange={(e) => setQuantidades({ ...quantidades, [insumo.id]: Number(e.target.value) })}
                  placeholder="Qtd (CX/UN)"
                  className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => registrarCompra(insumo)}
                  className="bg-green-600 text-white p-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center"
                  title="Adicionar ao Estoque"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} />
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Autorização de Administrador</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Esta compra excederá o estoque máximo do insumo. Digite o PIN de um Administrador para liberar.</p>
            
            <input 
              type="password" 
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-blue-100 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all mb-6"
              placeholder="****"
            />
            
            <div className="flex space-x-3">
              <button onClick={() => { setShowPinModal(false); setPendingInsumo(null); }} className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="flex-1 p-3 text-white bg-blue-600 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}