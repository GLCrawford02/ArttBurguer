import { useState, useEffect, useRef } from 'react';
import { ref, onValue, runTransaction, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario } from '../types';
import { ArrowRight, Search, CheckCircle, AlertTriangle, History, User, Clock, Package, Scan } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';
import { logInfo, logWarn, logError, startTimer } from '../utils/logger';
import { loadDraft, saveDraft, clearDraft } from '../hooks/useDraftCache';

export default function TransferenciaManager({ currentUser: _currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingTransfer, setPendingTransfer] = useState<{ insumo: Insumo; qty: number; tipo: 'container' | 'variavel' | 'simples' } | null>(null);
  const [barcodeFocusId, setBarcodeFocusId] = useState<string | null>(null);
  const [barcodeVincularModal, setBarcodeVincularModal] = useState<{ code: string } | null>(null);
  const [barcodeVincularSearch, setBarcodeVincularSearch] = useState('');
  const [barcodeVincularId, setBarcodeVincularId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Record<string, 'container' | 'variavel' | 'simples'>>({});
  const [bulkPinModal, setBulkPinModal] = useState(false);
  const [bulkPin, setBulkPin] = useState('');

  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinModalRef = useRef(false);
  const allInsumosRef = useRef<Insumo[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const draft = loadDraft<{ quantities: any, selecionados: any }>('transferencia', _currentUser?.id);
    if (draft) {
      if (draft.quantities) setQuantities(draft.quantities);
      if (draft.selecionados) setSelecionados(draft.selecionados);
    }
  }, [_currentUser?.id]);

  useEffect(() => {
    const isEmpty = Object.keys(quantities).length === 0 && Object.keys(selecionados).length === 0;
    if (isEmpty) {
      clearDraft('transferencia', _currentUser?.id);
    } else {
      saveDraft('transferencia', _currentUser?.id, { quantities, selecionados });
    }
  }, [quantities, selecionados, _currentUser?.id]);

  useEffect(() => {
    const unsubs = [
      onValue(ref(db, 'insumos'), snap => {
        const data = snap.val();
        if (data) setInsumos(Object.entries(data).map(([id, v]: [string, any]) => ({ id, ...v } as Insumo)));
        else setInsumos([]);
      }),
      onValue(ref(db, 'funcionarios'), snap => {
        const data = snap.val();
        if (data) setFuncionarios(Object.entries(data).map(([id, v]: [string, any]) => ({ id, ...v } as Funcionario)));
        else setFuncionarios([]);
      }),
      onValue(ref(db, 'historico_transferencias'), snap => {
        if (!snap.val()) { setHistory([]); return; }
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const list = Object.entries(snap.val())
          .map(([id, v]: any) => ({ id, ...v }))
          .filter((t: any) => t.timestamp >= hoje.getTime())
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .slice(0, 50);
        setHistory(list);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => { pinModalRef.current = pinModal; }, [pinModal]);
  useEffect(() => { allInsumosRef.current = insumos; }, [insumos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pinModalRef.current) return;
      const target = e.target as HTMLInputElement;
      if (target.tagName === 'INPUT' && target.type === 'number') return;

      const now = Date.now();

      if (e.key === 'Enter') {
        const code = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';
        if (code.length >= 3) {
          const all = allInsumosRef.current;
          const found = all.find(i => i.codigoBarras === code || i.sku === code);
          if (found && found.transferivel) {
            setBarcodeFocusId(found.id);
            setSearch('');
            setTimeout(() => {
              document.getElementById(`card-${found.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (document.getElementById(`qty-${found.id}`) as HTMLInputElement | null)?.focus();
            }, 80);
            setTimeout(() => setBarcodeFocusId(null), 3000);
          } else {
            setBarcodeVincularModal({ code });
            setBarcodeVincularSearch('');
            setBarcodeVincularId(null);
          }
        }
        return;
      }

      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeDiff > 100 && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }

      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
      barcodeTimeoutRef.current = setTimeout(() => { barcodeBufferRef.current = ''; }, 500);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    };
  }, []);

  // Segue a cadeia do container até a unidade base
  function resolveChain(insumo: Insumo): Insumo[] {
    const chain: Insumo[] = [insumo];
    let current = insumo;
    for (let depth = 0; depth < 5; depth++) {
      const nextId = current.insumoVinculado;
      if (!nextId) break;
      const next = insumos.find(i => i.id === nextId);
      if (!next) break;
      chain.push(next);
      current = next;
    }
    return chain;
  }

  // Acha quem quebra NESSE produto (o container pai)
  function findParent(insumo: Insumo): Insumo | null {
    return insumos.find(i => i.insumoVinculado === insumo.id) ?? null;
  }

  // Quantas unidades base 1 desse container produz ao ser transferido
  function unitsPerItem(insumo: Insumo): number {
    const chain = resolveChain(insumo);
    return chain.slice(0, -1).reduce((acc, item) => acc * Number(item.qtdPacote || 1), 1);
  }

  // Label do nível: usa tipoUso se disponível, senão detecta pela cadeia
  function getLevelLabel(insumo: Insumo): string {
    if (insumo.tipoUso) return insumo.tipoUso.toUpperCase();
    const linked = insumos.find(i => i.id === insumo.insumoVinculado);
    return linked?.insumoVinculado ? 'CAIXA' : 'PACOTE';
  }

  // Containers: têm insumoVinculado E transferivel = true
  const containers = insumos
    .filter(i => !!i.insumoVinculado && !!i.transferivel)
    .filter(i =>
      normalizeString(i.nome).includes(normalizeString(search)) ||
      normalizeString(i.sku).includes(normalizeString(search))
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Variáveis: isVariavel = true, transferivel = true
  // executeVariavelTransfer já trata com e sem pai — a condição de "sem pai" ocultava produtos válidos
  const variaveis = insumos
    .filter(i => !!i.isVariavel && !!i.transferivel)
    .filter(i =>
      normalizeString(i.nome).includes(normalizeString(search)) ||
      normalizeString(i.sku).includes(normalizeString(search))
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Transferíveis simples: sem insumoVinculado, sem isVariavel, mas com transferivel=true
  const transferiveis = insumos
    .filter(i => !!i.transferivel && !i.insumoVinculado && !i.isVariavel)
    .filter(i =>
      normalizeString(i.nome).includes(normalizeString(search)) ||
      normalizeString(i.sku).includes(normalizeString(search))
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Remove qty unidades dos lotes em ordem FIFO (validade mais próxima primeiro)
  function fifoDeductLotes(data: any, qty: number) {
    if (!data.lotes) return;
    let remaining = qty;
    const lotesArr = Object.entries(data.lotes)
      .map(([id, l]: [string, any]) => ({ id, ...l }))
      .sort((a: any, b: any) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });
    for (const lote of lotesArr) {
      if (remaining <= 0) break;
      const lQtd = Number(lote.quantidade || 0);
      if (lQtd <= remaining) {
        remaining = Number((remaining - lQtd).toFixed(4));
        delete data.lotes[lote.id];
      } else {
        data.lotes[lote.id].quantidade = Number((lQtd - remaining).toFixed(4));
        remaining = 0;
      }
    }
    if (data.lotes && Object.keys(data.lotes).length === 0) data.lotes = null;
  }

  function initiateTransfer(insumo: Insumo, tipo: 'container' | 'variavel' | 'simples' = 'container') {
    const qty = parseFloat(quantities[insumo.id] || '0');
    if (!qty || qty <= 0) return;
    setPendingTransfer({ insumo, qty, tipo });
    setPin('');
    setPinModal(true);
  }

  function toggleSelecionado(id: string, tipo: 'container' | 'variavel' | 'simples') {
    setSelecionados(prev => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: tipo };
    });
  }

  async function handleBulkPinConfirm() {
    const func = funcionarios.find(f => String(f.pin) === bulkPin);
    if (!func) {
      showToast('PIN inválido!', 'error');
      logWarn('Transferencia', 'PIN inválido no lote de transferências');
      return;
    }
    logInfo('Transferencia', 'PIN autorizado para lote', { operador: func.nome, itens: Object.keys(selecionados).length });
    setBulkPinModal(false);
    setBulkPin('');
    for (const [id, tipo] of Object.entries(selecionados)) {
      const insumo = insumos.find(i => i.id === id);
      const qty = parseFloat(quantities[id] || '0');
      if (!insumo || !qty || qty <= 0) continue;
      if (tipo === 'variavel') await executeVariavelTransfer(func, { insumo, qty });
      else if (tipo === 'simples') await executeSimples(func, { insumo, qty });
      else await executeTransfer(func, { insumo, qty });
    }
    setSelecionados({});
  }

  async function executeVariavelTransfer(funcionario: Funcionario, override?: { insumo: Insumo; qty: number }) {
    if (!override && !pendingTransfer) return;
    const { insumo, qty } = override ?? pendingTransfer!;

    const ownStock = Number(insumo.estoqueEstacionario ?? 0);
    const parent = findParent(insumo);       // ex: Pacote
    const grandParent = parent ? findParent(parent) : null; // ex: Caixa

    setLoadingIds(prev => new Set(prev).add(insumo.id));
    const timerVar = startTimer();
    try {
      if (ownStock >= qty) {
        // Sem container pai — debita do próprio estacionado
        await runTransaction(ref(db, `insumos/${insumo.id}`), data => {
          if (data) {
            data.estoqueEstacionario = Number(Math.max(0, (Number(data.estoqueEstacionario ?? 0)) - qty).toFixed(4));
            fifoDeductLotes(data, qty);
            data.estoqueRotativo = 1;
          }
          return data;
        });
        showToast(`${qty} ${insumo.unidade} retiradas. ${insumo.nome} disponível.`);

      } else if (parent) {
        // qty = unidades do PAI (ex: 2 Pacotes)
        const parentStock = Number(parent.estoqueEstacionario ?? 0);
        const grandParentQtdPacote = grandParent ? Number(grandParent.qtdPacote || 1) : 0;
        const grandParentStock = grandParent ? Number(grandParent.estoqueEstacionario ?? 0) : 0;

        // Total disponível em unidades do pai (próprio + via avô)
        const totalDisponivel = parentStock + grandParentStock * grandParentQtdPacote;
        if (totalDisponivel < qty) {
          showToast(`Estoque insuficiente. Total disponível: ${totalDisponivel} ${parent.unidade}`, 'error');
          return;
        }

        // Quantas caixas (avô) precisam ser abertas?
        let autoBreakAvos = 0;
        if (parentStock < qty && grandParent) {
          const deficit = qty - parentStock;
          autoBreakAvos = Math.ceil(deficit / grandParentQtdPacote);
        }

        // 1. Abrir avôs (ex: Caixas → Pacotes)
        if (autoBreakAvos > 0 && grandParent) {
          await runTransaction(ref(db, `insumos/${grandParent.id}`), data => {
            if (data) {
              data.estoqueEstacionario = Number(Math.max(0, (Number(data.estoqueEstacionario ?? 0)) - autoBreakAvos).toFixed(4));
              fifoDeductLotes(data, autoBreakAvos);
            }
            return data;
          });
        }

        // 2. Atualizar estacionado do pai (ganho do avô − o que saiu)
        const pacotesGanhos = autoBreakAvos * grandParentQtdPacote;
        await runTransaction(ref(db, `insumos/${parent.id}`), data => {
          if (data) {
            const current = Number(data.estoqueEstacionario ?? 0);
            data.estoqueEstacionario = Number(Math.max(0, current + pacotesGanhos - qty).toFixed(4));
            fifoDeductLotes(data, qty);
          }
          return data;
        });

        // 3. Adicionar unidades reais ao rotativo (variável com cadeia recebe unidades, não flag 1)
        const unitsToAdd = qty * Number(parent.qtdPacote || 1);
        await runTransaction(ref(db, `insumos/${insumo.id}`), data => {
          if (data) data.estoqueRotativo = Number(((Number(data.estoqueRotativo ?? 0)) + unitsToAdd).toFixed(4));
          return data;
        });

        const msg = autoBreakAvos > 0
          ? `${autoBreakAvos}× ${grandParent!.nome} abertos automaticamente → ${qty} ${parent.unidade} transferidos → +${unitsToAdd} ${insumo.unidade} no rotativo.`
          : `${qty} ${parent.unidade} de ${parent.nome} transferidos → +${unitsToAdd} ${insumo.unidade} no rotativo.`;
        showToast(msg);

      } else {
        showToast(`Sem estoque disponível para ${insumo.nome}.`, 'error');
        return;
      }

      await set(push(ref(db, 'historico_transferencias')), {
        insumoId: insumo.id,
        nomeInsumo: insumo.nome,
        quantidade: qty,
        direcao: 'Variável — Estacionado → Rotativo',
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        timestamp: Date.now(),
      });
      logInfo('Transferencia', 'Transferência variável concluída', { operador: funcionario.nome, insumo: insumo.nome, qty }, timerVar());

      setQuantities(prev => ({ ...prev, [insumo.id]: '' }));
      setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
    } catch (err) {
      logError('Transferencia', 'Erro na transferência variável', { insumo: insumo.nome, qty, err: String(err) }, timerVar());
      console.error(err);
      showToast('Erro ao transferir. Tente novamente.', 'error');
    } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(insumo.id); return next; });
    }
  }

  async function executeTransfer(funcionario: Funcionario, override?: { insumo: Insumo; qty: number }) {
    if (!override && !pendingTransfer) return;
    const { insumo, qty } = override ?? pendingTransfer!;

    const chain = resolveChain(insumo);
    if (chain.length < 2) {
      showToast('Produto base não configurado. Verifique o cadastro.', 'error');
      return;
    }

    const baseUnit = chain[chain.length - 1];
    const unitsToAdd = qty * unitsPerItem(insumo);
    const parent = findParent(insumo);

    const available = Number(insumo.estoqueEstacionario ?? 0);
    let autoBreakCaixas = 0;
    let parentQtdPacote = 0;

    // Verifica se precisa abrir containers pai
    if (available < qty) {
      if (!parent) {
        showToast(`Estoque insuficiente. Disponível: ${available} ${insumo.unidade}`, 'error');
        return;
      }
      parentQtdPacote = Number(parent.qtdPacote || 1);
      const deficit = qty - available;
      const caixasNecessarias = Math.ceil(deficit / parentQtdPacote);
      const parentStock = Number(parent.estoqueEstacionario ?? 0);
      if (parentStock < caixasNecessarias) {
        showToast(
          `Estoque insuficiente. Pacotes: ${available}, Caixas: ${parentStock}× ${parent.nome} (${parentStock * parentQtdPacote} pacotes equivalentes)`,
          'error'
        );
        return;
      }
      autoBreakCaixas = caixasNecessarias;
    }

    setLoadingIds(prev => new Set(prev).add(insumo.id));
    const timerCont = startTimer();
    try {
      // 1. Abater do container pai (auto-quebra)
      if (autoBreakCaixas > 0 && parent) {
        await runTransaction(ref(db, `insumos/${parent.id}`), data => {
          if (data) {
            data.estoqueEstacionario = Number(Math.max(0, (Number(data.estoqueEstacionario ?? 0)) - autoBreakCaixas).toFixed(4));
            fifoDeductLotes(data, autoBreakCaixas);
          }
          return data;
        });
      }

      // 2. Atualizar estacionado deste container (resultado líquido)
      const pacotesGanhos = autoBreakCaixas * parentQtdPacote;
      await runTransaction(ref(db, `insumos/${insumo.id}`), data => {
        if (data) {
          const current = Number(data.estoqueEstacionario ?? 0);
          data.estoqueEstacionario = Number(Math.max(0, current + pacotesGanhos - qty).toFixed(4));
          fifoDeductLotes(data, qty);
        }
        return data;
      });

      // 3. Adicionar ao rotativo da unidade base (sempre soma as unidades reais)
      await runTransaction(ref(db, `insumos/${baseUnit.id}`), data => {
        if (data) data.estoqueRotativo = Number(((Number(data.estoqueRotativo ?? 0)) + unitsToAdd).toFixed(4));
        return data;
      });

      // 4. Log de histórico
      await set(push(ref(db, 'historico_transferencias')), {
        insumoId: insumo.id,
        nomeInsumo: insumo.nome,
        quantidade: qty,
        unidadesBaseAdicionadas: unitsToAdd,
        produtoBaseNome: baseUnit.nome,
        autoBreakCaixas,
        nomeCaixa: parent?.nome ?? null,
        direcao: 'Estacionado → Rotativo',
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        timestamp: Date.now(),
      });

      const msgOk = autoBreakCaixas > 0
        ? `${autoBreakCaixas}× ${parent!.nome} aberta(s). ${qty} ${insumo.unidade} → +${unitsToAdd} ${baseUnit.unidade} no rotativo de "${baseUnit.nome}".`
        : `${qty} ${insumo.unidade} de ${insumo.nome} → +${unitsToAdd} ${baseUnit.unidade} no rotativo de "${baseUnit.nome}".\nVeja na aba Rotativo do Balanço.`;
      logInfo('Transferencia', 'Transferência (container) concluída', { operador: funcionario.nome, insumo: insumo.nome, qty, unitsToAdd, autoBreakCaixas }, timerCont());
      showToast(msgOk);
      setQuantities(prev => ({ ...prev, [insumo.id]: '' }));
      setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
    } catch (err) {
      logError('Transferencia', 'Erro na transferência (container)', { insumo: insumo.nome, qty, err: String(err) }, timerCont());
      console.error(err);
      showToast('Erro ao transferir. Tente novamente.', 'error');
    } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(insumo.id); return next; });
    }
  }

  async function executeSimples(funcionario: Funcionario, override?: { insumo: Insumo; qty: number }) {
    if (!override && !pendingTransfer) return;
    const { insumo, qty } = override ?? pendingTransfer!;
    const available = Number(insumo.estoqueEstacionario ?? 0);
    if (available < qty) {
      showToast(`Estoque insuficiente. Estacionado: ${available} ${insumo.unidade}`, 'error');
      return;
    }
    setLoadingIds(prev => new Set(prev).add(insumo.id));
    const timerSimp = startTimer();
    try {
      await runTransaction(ref(db, `insumos/${insumo.id}`), data => {
        if (data) {
          data.estoqueEstacionario = Number(Math.max(0, (Number(data.estoqueEstacionario ?? 0)) - qty).toFixed(4));
          fifoDeductLotes(data, qty);
          data.estoqueRotativo = Number(((Number(data.estoqueRotativo ?? 0)) + qty).toFixed(4));
        }
        return data;
      });
      await set(push(ref(db, 'historico_transferencias')), {
        insumoId: insumo.id,
        nomeInsumo: insumo.nome,
        quantidade: qty,
        unidadesBaseAdicionadas: qty,
        produtoBaseNome: insumo.nome,
        autoBreakCaixas: 0,
        nomeCaixa: null,
        direcao: 'Estacionado → Rotativo',
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        timestamp: Date.now(),
      });
      logInfo('Transferencia', 'Transferência simples concluída', { operador: funcionario.nome, insumo: insumo.nome, qty }, timerSimp());
      showToast(`+${qty} ${insumo.unidade} adicionadas ao rotativo de ${insumo.nome}.`);
      setQuantities(prev => ({ ...prev, [insumo.id]: '' }));
      setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
    } catch (err) {
      logError('Transferencia', 'Erro na transferência simples', { insumo: insumo.nome, qty, err: String(err) }, timerSimp());
      console.error(err);
      showToast('Erro ao transferir. Tente novamente.', 'error');
    } finally {
      setLoadingIds(prev => { const next = new Set(prev); next.delete(insumo.id); return next; });
    }
  }

  function handlePinConfirm() {
    const func = funcionarios.find(f => String(f.pin) === pin);
    if (!func) {
      showToast('PIN inválido!', 'error');
      logWarn('Transferencia', 'PIN inválido digitado na transferência', { insumo: pendingTransfer?.insumo?.nome });
      return;
    }
    logInfo('Transferencia', 'PIN autorizado', { operador: func.nome, insumo: pendingTransfer?.insumo?.nome, qty: pendingTransfer?.qty, tipo: pendingTransfer?.tipo });
    setPinModal(false);
    if (pendingTransfer?.tipo === 'variavel') {
      executeVariavelTransfer(func);
    } else if (pendingTransfer?.tipo === 'simples') {
      executeSimples(func);
    } else {
      executeTransfer(func);
    }
  }

  async function salvarVinculoBarcode() {
    if (!barcodeVincularModal || !barcodeVincularId) return;
    await update(ref(db, `insumos/${barcodeVincularId}`), { codigoBarras: barcodeVincularModal.code });
    showToast(`Código ${barcodeVincularModal.code} vinculado com sucesso!`);
    setBarcodeVincularModal(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ArrowRight className="text-orange-500" size={20} />
            Transferência — Estacionado → Rotativo
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Transfira Pacotes ou Caixas para a cozinha. Caixas são abertas automaticamente se precisar.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {Object.keys(selecionados).length > 0 && (
            <button
              onClick={() => { setBulkPin(''); setBulkPinModal(true); }}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors whitespace-nowrap flex items-center gap-2 shrink-0"
            >
              <CheckCircle size={14} />
              Transferir Marcados ({Object.keys(selecionados).length})
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-full shrink-0">
            <Scan size={12} />
            <span>Leitor de código ativo</span>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-sm w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {containers.map(insumo => {
          const chain = resolveChain(insumo);
          const baseUnit = chain[chain.length - 1];
          const parent = findParent(insumo);
          const estacionado = Number(insumo.estoqueEstacionario ?? 0);
          const parentStock = parent ? Number(parent.estoqueEstacionario ?? 0) : 0;
          const parentQtd = parent ? Number(parent.qtdPacote || 1) : 0;
          const maxDisponivel = estacionado + parentStock * parentQtd;
          const upItem = unitsPerItem(insumo);
          const level = getLevelLabel(insumo);
          const qty = parseFloat(quantities[insumo.id] || '0');
          const isLoading = loadingIds.has(insumo.id);
          const excede = qty > maxDisponivel && qty > 0;

          const levelColor =
            level === 'CAIXA' ? 'bg-blue-100 text-blue-700' :
            level === 'PACOTE' ? 'bg-amber-100 text-amber-700' :
            'bg-purple-100 text-purple-700';

          return (
            <div key={insumo.id} id={`card-${insumo.id}`} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-all duration-300 ${selecionados[insumo.id] ? 'border-orange-400 ring-2 ring-orange-200' : barcodeFocusId === insumo.id ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-100'}`}>
              {/* Título */}
              <div className="flex items-start gap-2 flex-wrap">
                {qty > 0 && !excede && (
                  <input type="checkbox" checked={!!selecionados[insumo.id]} onChange={() => toggleSelecionado(insumo.id, 'container')} className="mt-1 shrink-0 accent-orange-500 w-4 h-4 cursor-pointer" title="Marcar para transferência em lote" />
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-0.5 shrink-0 ${levelColor}`}>
                  {level}
                </span>
                {baseUnit.isVariavel && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-0.5 shrink-0 bg-purple-100 text-purple-700">
                    variável
                  </span>
                )}
                <p className="font-bold text-gray-900 leading-snug">{insumo.nome}</p>
              </div>

              {/* Estoque */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estacionado</span>
                  <span className="font-bold text-gray-800">{estacionado} {insumo.unidade}</span>
                </div>
                {parent && (
                  <div className="flex justify-between text-xs text-blue-600 border-t border-blue-50 pt-1.5">
                    <span>Via {parent.nome}</span>
                    <span className="font-semibold">+{parentStock * parentQtd} {insumo.unidade} disponíveis</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-400 border-t border-gray-100 pt-1.5">
                  <span>Rotativo ({baseUnit.nome})</span>
                  <span className="font-semibold text-orange-500">
                    {Number(baseUnit.estoqueRotativo ?? 0)} {baseUnit.unidade}
                  </span>
                </div>
              </div>

              {/* Cadeia */}
              <div className="flex items-center gap-1 flex-wrap text-xs text-gray-400">
                {chain.map((item, idx) => (
                  <span key={item.id} className="flex items-center gap-1">
                    {idx > 0 && <ArrowRight size={10} className="text-gray-300 shrink-0" />}
                    <span className={idx === chain.length - 1 ? 'text-orange-600 font-semibold' : ''}>
                      {item.nome}{idx < chain.length - 1 ? ` ×${item.qtdPacote ?? '?'}` : ''}
                    </span>
                  </span>
                ))}
              </div>

              {/* Input + botão */}
              <div className="flex gap-2">
                <input
                  id={`qty-${insumo.id}`}
                  type="number"
                  min="0"
                  step="1"
                  value={quantities[insumo.id] || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const q = parseFloat(val || '0');
                    setQuantities(prev => ({ ...prev, [insumo.id]: val }));
                    if (q > 0 && q <= maxDisponivel) {
                      setSelecionados(prev => ({ ...prev, [insumo.id]: 'container' }));
                    } else {
                      setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
                    }
                  }}
                  placeholder={`Qtd (${insumo.unidade})`}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 text-center transition-colors ${
                    excede ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-orange-400'
                  }`}
                />
                <button
                  onClick={() => initiateTransfer(insumo)}
                  disabled={isLoading || !qty || qty <= 0 || excede}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isLoading ? '...' : 'Transferir'}
                </button>
              </div>

              {qty > 0 && !excede && (
                <p className="text-xs text-gray-400 -mt-2">
                  → <strong className="text-gray-600">{qty * upItem} {baseUnit.unidade}</strong> entram no rotativo
                </p>
              )}
              {excede && (
                <p className="text-xs text-red-500 -mt-2">
                  Máximo disponível: {maxDisponivel} {insumo.unidade}
                </p>
              )}
            </div>
          );
        })}

        {transferiveis.map(insumo => {
          const estacionado = Number(insumo.estoqueEstacionario ?? 0);
          const rotativo = Number(insumo.estoqueRotativo ?? 0);
          const qty = parseFloat(quantities[insumo.id] || '0');
          const isLoading = loadingIds.has(insumo.id);
          const excede = qty > estacionado && qty > 0;
          return (
            <div key={insumo.id} id={`card-${insumo.id}`} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-all duration-300 ${selecionados[insumo.id] ? 'border-orange-400 ring-2 ring-orange-200' : barcodeFocusId === insumo.id ? 'border-green-400 ring-2 ring-green-300' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                {qty > 0 && !excede && (
                  <input type="checkbox" checked={!!selecionados[insumo.id]} onChange={() => toggleSelecionado(insumo.id, 'simples')} className="shrink-0 accent-orange-500 w-4 h-4 cursor-pointer" title="Marcar para transferência em lote" />
                )}
                <p className="font-bold text-gray-900">{insumo.nome}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Estacionado</span>
                  <span className="font-bold text-gray-800">{estacionado} {insumo.unidade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rotativo</span>
                  <span className="font-bold text-orange-500">{rotativo} {insumo.unidade}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  id={`qty-${insumo.id}`}
                  type="number" min="0" step="1"
                  value={quantities[insumo.id] || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const q = parseFloat(val || '0');
                    setQuantities(prev => ({ ...prev, [insumo.id]: val }));
                    if (q > 0 && q <= estacionado) {
                      setSelecionados(prev => ({ ...prev, [insumo.id]: 'simples' }));
                    } else {
                      setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
                    }
                  }}
                  placeholder={`Qtd (${insumo.unidade})`}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 text-center transition-colors ${excede ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-orange-400'}`}
                />
                <button
                  onClick={() => initiateTransfer(insumo, 'simples')}
                  disabled={isLoading || !qty || qty <= 0 || excede}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isLoading ? '...' : 'Transferir'}
                </button>
              </div>
              {excede && <p className="text-xs text-red-500 -mt-2">Máximo: {estacionado} {insumo.unidade}</p>}
            </div>
          );
        })}

        {variaveis.map(insumo => {
              const ownStock = Number(insumo.estoqueEstacionario ?? 0);
              const emUso = Number(insumo.estoqueRotativo ?? 0) >= 1;
              const parent = findParent(insumo);
              const grandParent = parent ? findParent(parent) : null;
              const parentStock = parent ? Number(parent.estoqueEstacionario ?? 0) : 0;
              const grandParentStock = grandParent ? Number(grandParent.estoqueEstacionario ?? 0) : 0;
              const grandParentQtd = grandParent ? Number(grandParent.qtdPacote || 1) : 0;
              // Total em unidades do pai (direto + via avô)
              const totalParentDisp = parent ? parentStock + grandParentStock * grandParentQtd : 0;
              const displayStock = parent ? totalParentDisp : ownStock;
              const displayUnit = parent ? parent.unidade : insumo.unidade;
              const displayNome = parent ? parent.nome : 'Estacionado';
              const qty = parseFloat(quantities[insumo.id] || '0');
              const isLoading = loadingIds.has(insumo.id);
              const excede = qty > displayStock && qty > 0;

              return (
                <div key={insumo.id} id={`card-${insumo.id}`} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-all duration-300 ${selecionados[insumo.id] ? 'border-orange-400 ring-2 ring-orange-200' : barcodeFocusId === insumo.id ? 'border-green-400 ring-2 ring-green-300' : 'border-purple-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {qty > 0 && !excede && (
                        <input type="checkbox" checked={!!selecionados[insumo.id]} onChange={() => toggleSelecionado(insumo.id, 'variavel')} className="mt-1 shrink-0 accent-orange-500 w-4 h-4 cursor-pointer" title="Marcar para transferência em lote" />
                      )}
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-purple-100 text-purple-700">VARIÁVEL</span>
                        <p className="font-bold text-gray-900 leading-snug mt-1">{insumo.nome}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${emUso ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {emUso ? '✓ Em uso' : '✗ Esgotado'}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
                    {parent ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{parent.nome}</span>
                          <span className="font-bold text-gray-800">{parentStock} {parent.unidade}</span>
                        </div>
                        {grandParent && (
                          <div className="flex justify-between text-xs text-blue-600 border-t border-blue-50 pt-1.5">
                            <span>Via {grandParent.nome} ({grandParentStock} cx × {grandParentQtd})</span>
                            <span className="font-semibold">+{grandParentStock * grandParentQtd} {parent.unidade}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 border-t border-gray-100 pt-1.5">
                          Total: {totalParentDisp} {parent.unidade} disponíveis
                          {grandParent && grandParentStock > 0 && parentStock < qty
                            ? ' — caixas abertas automaticamente se necessário'
                            : ''}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Estacionado</span>
                          <span className="font-bold text-gray-800">{ownStock} {insumo.unidade}</span>
                        </div>
                        <p className="text-xs text-gray-400">Após transferir → rotativo marcado como disponível (1)</p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      id={`qty-${insumo.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={quantities[insumo.id] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const q = parseFloat(val || '0');
                        setQuantities(prev => ({ ...prev, [insumo.id]: val }));
                        if (q > 0 && q <= displayStock) {
                          setSelecionados(prev => ({ ...prev, [insumo.id]: 'variavel' }));
                        } else {
                          setSelecionados(prev => { const n = { ...prev }; delete n[insumo.id]; return n; });
                        }
                      }}
                      placeholder={`Qtd (${displayUnit}) de ${displayNome}`}
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 text-center transition-colors ${excede ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-purple-400'}`}
                    />
                    <button
                      onClick={() => initiateTransfer(insumo, 'variavel')}
                      disabled={isLoading || !qty || qty <= 0 || excede}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {isLoading ? '...' : 'Transferir'}
                    </button>
                  </div>
                  {excede && (
                    <p className="text-xs text-red-500 -mt-2">Máximo: {displayStock} {displayUnit}</p>
                  )}
                </div>
              );
            })}

        {containers.length === 0 && transferiveis.length === 0 && variaveis.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">Nenhum produto para transferência.</p>
            <p className="text-xs mt-1">Marque "Transferível" no cadastro dos insumos para que apareçam aqui.</p>
          </div>
        )}
      </div>

      {/* Histórico do dia */}
      {history.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h4 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
            <History size={18} className="text-gray-400" />
            Transferências de Hoje
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {history.map(t => (
              <div key={t.id} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg text-sm gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 truncate">
                    {t.quantidade}× {t.nomeInsumo}
                    <span className="ml-2 text-xs font-normal text-gray-500">→ {t.unidadesBaseAdicionadas} {t.produtoBaseNome}</span>
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 flex-wrap">
                    <User size={11} /> {t.funcionarioNome}
                    {t.autoBreakCaixas > 0 && (
                      <span className="ml-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {t.autoBreakCaixas}× {t.nomeCaixa} abertas
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                  <Clock size={11} />
                  {new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg text-white font-semibold flex items-center gap-2 z-50 max-w-sm text-sm ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Modal vincular código de barras */}
      {barcodeVincularModal && (() => {
        const filtrado = insumos
          .filter(i => normalizeString(i.nome).includes(normalizeString(barcodeVincularSearch)) || normalizeString(i.sku).includes(normalizeString(barcodeVincularSearch)))
          .slice(0, 8);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                <Scan size={18} className="text-orange-500" />
                Código não cadastrado
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Código lido: <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{barcodeVincularModal.code}</span>
                <br />Selecione o produto correspondente para vincular:
              </p>
              <input
                autoFocus
                type="text"
                placeholder="Buscar produto..."
                value={barcodeVincularSearch}
                onChange={e => { setBarcodeVincularSearch(e.target.value); setBarcodeVincularId(null); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400 mb-2"
              />
              <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
                {filtrado.map(i => (
                  <button
                    key={i.id}
                    onClick={() => setBarcodeVincularId(i.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${barcodeVincularId === i.id ? 'bg-orange-500 text-white font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    {i.nome}
                    {i.codigoBarras && <span className="ml-2 text-[10px] opacity-60 font-mono">({i.codigoBarras})</span>}
                  </button>
                ))}
                {filtrado.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado.</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setBarcodeVincularModal(null)}
                  className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarVinculoBarcode}
                  disabled={!barcodeVincularId}
                  className="flex-1 p-3 text-white bg-orange-500 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors"
                >
                  Vincular
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal PIN — Transferência em lote */}
      {bulkPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-1">Transferir Marcados</h3>
            <p className="text-sm text-center text-orange-600 font-semibold mb-1">
              {Object.keys(selecionados).length} produto(s) selecionado(s)
            </p>
            <p className="text-sm text-gray-500 text-center mb-5">Digite seu PIN para autorizar todos.</p>
            <input
              type="tel"
              autoComplete="off"
              maxLength={4}
              autoFocus
              value={bulkPin}
              onChange={e => setBulkPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && bulkPin.length === 4 && handleBulkPinConfirm()}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-orange-400 mb-4 transition-colors"
              placeholder="••••"
              style={{ WebkitTextSecurity: 'disc' } as any}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setBulkPinModal(false); setBulkPin(''); }}
                className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkPinConfirm}
                disabled={bulkPin.length !== 4}
                className="flex-1 p-3 text-white bg-orange-500 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal PIN */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-1">Confirmar Transferência</h3>
            {pendingTransfer && (
              <p className="text-sm text-center text-orange-600 font-semibold mb-1">
                {pendingTransfer.qty}× {pendingTransfer.insumo.nome}
              </p>
            )}
            <p className="text-sm text-gray-500 text-center mb-5">Digite seu PIN para autorizar.</p>
            <input
              type="tel"
              autoComplete="off"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handlePinConfirm()}
              className="w-full text-center text-3xl tracking-[1em] font-mono p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-orange-400 mb-4 transition-colors"
              placeholder="••••"
              style={{ WebkitTextSecurity: 'disc' } as any}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setPinModal(false); setPendingTransfer(null); }}
                className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePinConfirm}
                disabled={pin.length !== 4}
                className="flex-1 p-3 text-white bg-orange-500 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
