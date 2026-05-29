import { useEffect, useState } from 'react';
import { ref, onValue, runTransaction, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Funcionario, Produto } from '../types';
import { AlertTriangle, Package, Search, CalendarClock, CheckCircle, ShoppingBag, BellRing, X, Download, BarChart2, ChevronUp, ChevronDown } from 'lucide-react';

export default function Dashboard({ currentUser }: { currentUser?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<((func: Funcionario) => Promise<void>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'insumos' | 'produtos' | 'baixos' | 'excedentes' | 'vencimentos' | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

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
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
      setLoading(false);
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


  const isGestor = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c))
      : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(currentUser.cargo as string)
  );

  const insumosPermitidos = insumos.filter(i => isGestor || !(i as any).restrito);
  // Alerta só para o topo da cadeia de compra: itens que ninguém aponta como pai via insumoVinculado
  // (standalone BASE e CAIXA/topo de família). BASE← e PACOTE não alertam — se reabastecem por transferência.
  const isAlertavel = (i: any) => !insumos.some(x => (x as any).insumoVinculado === i.id);
  const baixos = insumosPermitidos.filter(i => isAlertavel(i) && (i.estoqueEstacionario ?? 0) <= (i.alertaMinimo || 0));
  const excedentes = insumosPermitidos.filter(i => i.estoqueMaximo && (i.estoqueEstacionario ?? 0) > i.estoqueMaximo);

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
    const func = funcionarios.find(f => String(f.pin) === pin);
    if (!func) {
      showToast('PIN inválido!', 'error');
      return;
    }
    const isAdminOrGerente = Array.isArray(func.cargo)
      ? func.cargo.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c))
      : ['Administrador', 'Gerente', 'Dono', 'TI'].includes(func.cargo as string);
    if (!isAdminOrGerente) {
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
            currentData.estoqueEstacionario = Math.max(0, (currentData.estoqueEstacionario ?? 0) - quantidade);
            delete currentData.lotes[loteId];
            descartou = true;
          } else if (!currentData.lotes && loteId === 'legado') {
            currentData.estoqueEstacionario = Math.max(0, (currentData.estoqueEstacionario ?? 0) - quantidade);
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

  const filteredInsumos = insumosPermitidos.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchTipo;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedInsumos = [...filteredInsumos].sort((a, b) => {
    if (!sortConfig) return a.nome.localeCompare(b.nome);
    const { key, direction } = sortConfig;
    
    let valA: any = '';
    let valB: any = '';

    if (key === 'nome') {
       valA = a.nome.toLowerCase();
       valB = b.nome.toLowerCase();
    } else if (key === 'tipo') {
       valA = ((a as any).tipoUso || '').toLowerCase();
       valB = ((b as any).tipoUso || '').toLowerCase();
    } else if (key === 'rotativo') {
       valA = Number(a.estoqueRotativo ?? 0);
       valB = Number(b.estoqueRotativo ?? 0);
    } else if (key === 'estacionado') {
       valA = Number(a.estoqueEstacionario ?? 0);
       valB = Number(b.estoqueEstacionario ?? 0);
    } else if (key === 'preco') {
       valA = Number(a.precoPacote) / Number(a.qtdPacote || 1);
       valB = Number(b.precoPacote) / Number(b.qtdPacote || 1);
    } else if (key === 'validade') {
       const getEarliest = (item: any) => {
          if (item.lotes) return Math.min(...Object.values(item.lotes).map((l: any) => l.validade ? new Date(`${l.validade}T00:00:00`).getTime() : Infinity));
          if ((item as any).validade) return new Date(`${(item as any).validade}T00:00:00`).getTime();
          return Infinity;
       };
       valA = getEarliest(a);
       valB = getEarliest(b);
    }
    
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const validadeProxima: any[] = [];
  
  insumosPermitidos.forEach(i => {
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
        const q = i.estoqueEstacionario ?? 0;
        validadeProxima.push({ ...i, loteSpec: { lote: (i as any).lote, validade: (i as any).validade, quantidade: q } });
      }
    }
  });

  validadeProxima.sort((a, b) => {
    const valA = a.loteSpec?.validade ? new Date(`${a.loteSpec.validade}T00:00:00`).getTime() : 0;
    const valB = b.loteSpec?.validade ? new Date(`${b.loteSpec.validade}T00:00:00`).getTime() : 0;
    return valA - valB;
  });

  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const isVencendo = (vencimento: string) => {
    if (!vencimento) return false;
    const dataVenc = new Date(`${vencimento}T00:00:00`);
    return dataVenc.getTime() <= amanha.getTime();
  };

  const formatarStatusVencimento = (vencimento: string) => {
    if (!vencimento) return '';
    const dataVenc = new Date(`${vencimento}T00:00:00`);
    const diffTime = dataVenc.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Atrasado (${Math.abs(diffDays)} dias)`;
    if (diffDays === 0) return 'Vence Hoje';
    if (diffDays === 1) return 'Vence Amanhã';
    return '';
  };

  const lembretesPagar = contasPagar.filter(c => c.status === 'Pendente' && isVencendo(c.vencimento));
  const lembretesReceber = contasReceber.filter(c => c.status === 'Pendente' && isVencendo(c.vencimento));


  const tiposExistentes = Array.from(new Set(insumos.map(i => (i as any).tipoUso).filter(Boolean))).sort();


  const formatarQtdJSX = (qtd: number, pacote: number, unid: string) => {
    if (pacote <= 1) return <span>{qtd} {unid}</span>;
    const vols = Math.floor(qtd / pacote);
    const resto = qtd % pacote;
    
    if (vols === 0) return <span>{qtd} {unid}</span>;
    return <span>{vols} Vol.{resto > 0 ? ` e ${resto} ${unid}` : ''} <span className="text-xs text-gray-500 font-normal ml-1">({qtd} {unid})</span></span>;
  };

  const exportarModalCSV = () => {
    if (!activeModal) return;

    let baseData: any[] = [];
    let filename = 'exportacao';
    if (activeModal === 'insumos') { baseData = insumos; filename = 'todos_insumos'; }
    else if (activeModal === 'produtos') { baseData = produtos; filename = 'todos_produtos'; }
    else if (activeModal === 'baixos') { baseData = baixos; filename = 'estoque_baixo'; }
    else if (activeModal === 'excedentes') { baseData = excedentes; filename = 'estoque_excedente'; }
    else if (activeModal === 'vencimentos') { baseData = validadeProxima; filename = 'vencimentos'; }

    const filtered = baseData.filter(item => {
      const nome = (item.nome || '').toLowerCase();
      const sku = ((item as any).sku || '').toLowerCase();
      const term = modalSearchTerm.toLowerCase();
      return nome.includes(term) || sku.includes(term);
    });

    if (filtered.length === 0) {
      showToast('Não há itens para exportar.', 'error');
      return;
    }

    let headers: string[] = [];
    let rows: any[] = [];

    if (activeModal === 'produtos') {
      headers = ['Nome do Produto', 'SKU', 'Categoria'];
      rows = filtered.map(item => [item.nome, (item as any).sku || '-', item.categoria || 'Outros']);
    } else if (activeModal === 'vencimentos') {
      headers = ['Nome do Insumo', 'SKU', 'Lote', 'Validade', 'Quantidade em Estoque'];
      rows = filtered.map(item => [item.nome, (item as any).sku || '-', item.loteSpec?.lote || 'N/A', item.loteSpec?.validade ? new Date(`${item.loteSpec.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-', `${item.loteSpec?.quantidade} ${item.unidade}`]);
    } else {
      headers = ['Nome do Insumo', 'SKU', 'Estoque Total', 'Alerta/Limite'];
      rows = filtered.map(item => {
         const est = item.estoqueEstacionario ?? 0;
         let minMax = '-';
         if (activeModal === 'baixos') minMax = `Mínimo: ${item.alertaMinimo}`;
         else if (activeModal === 'excedentes') minMax = `Máximo: ${item.estoqueMaximo}`;
         
         let estStr = `${est} ${item.unidade}`;
         if (item.qtdPacote && item.qtdPacote > 1) { const vols = Math.floor(est / item.qtdPacote); const resto = est % item.qtdPacote; if (vols > 0) estStr = `${vols} Vol.${resto > 0 ? ` e ${resto} ${item.unidade}` : ''} (${est} ${item.unidade})`; }
         return [item.nome, (item as any).sku || '-', estStr, minMax];
      });
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
    showToast('Exportação concluída!', 'success');
  };


  const getInicioDiaComercial = () => {
    const agora = new Date();
    const limite = new Date(agora);
    limite.setHours(6, 59, 59, 999);
    let baseDate = new Date(agora);
    if (agora.getTime() <= limite.getTime()) {
      baseDate.setDate(baseDate.getDate() - 1);
    }
    baseDate.setHours(7, 0, 0, 0);
    return baseDate;
  };

  const getLast7Days = () => {
    const days = [];
    const baseDate = getInicioDiaComercial();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  };
  const dias = getLast7Days();
  const vendasPorDia = dias.map(d => {
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    const total = vendas.filter(v => v.timestamp >= d.getTime() && v.timestamp < nextDay.getTime()).reduce((acc, v) => acc + (v.valorLiquido || v.valor || 0), 0);
    return { dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), total };
  });
  const maxVenda = Math.max(...vendasPorDia.map(v => v.total), 1);

  const getHojeComercialStr = () => {
    const baseDate = getInicioDiaComercial();
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const hojeDateStr = getHojeComercialStr();
  const agendaHoje = tarefas.filter(t => t.dataAgendada === hojeDateStr && t.status === 'pendente').sort((a, b) => (a.horaAgendada || '23:59').localeCompare(b.horaAgendada || '23:59'));
  
  const isDono = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.includes('Dono') || currentUser.cargo.includes('TI') : currentUser.cargo === 'Dono' || currentUser.cargo === 'TI');
  const isAdminOrDono = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono' || c === 'TI') 
      : currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono' || currentUser.cargo === 'TI'
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div onClick={() => setActiveModal('insumos')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:border-blue-500 transition-all">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Insumos</p>
            <p className="text-2xl font-bold">{insumos.length}</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('produtos')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:border-purple-500 transition-all">
          <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Produtos</p>
            <p className="text-2xl font-bold text-purple-600">{produtos.length}</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('baixos')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:border-red-500 transition-all">
          <div className="p-3 bg-red-100 rounded-lg text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Estoque Baixo</p>
            <p className="text-2xl font-bold text-red-600">{baixos.length}</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('excedentes')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:border-blue-500 transition-all">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Est. Excedente</p>
            <p className="text-2xl font-bold text-blue-600">{excedentes.length}</p>
          </div>
        </div>

        <div onClick={() => setActiveModal('vencimentos')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:border-orange-500 transition-all">
          <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
            <CalendarClock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Vencimentos</p>
            <p className="text-2xl font-bold text-orange-600">{validadeProxima.length}</p>
          </div>
        </div>
      </div>

      {(isDono && agendaHoje.length > 0 || validadeProxima.length > 0 || baixos.length > 0 || excedentes.length > 0 || (isDono && (lembretesPagar.length > 0 || lembretesReceber.length > 0))) && (
        <div className="flex flex-col md:flex-row flex-wrap gap-4">
          {isDono && agendaHoje.length > 0 && (
            <div className="flex-1 min-w-[300px] bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CalendarClock className="h-5 w-5 text-purple-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-purple-800">Sua Agenda de Hoje</h3>
                  <div className="mt-2 text-sm text-purple-700 max-h-[150px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-1">
                  {agendaHoje.map((tar: any) => (
                    <li key={tar.id}>
                      <span className="font-bold">{tar.titulo}</span> {tar.horaAgendada && `- ${tar.horaAgendada}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        const estEstacionario = i.estoqueEstacionario ?? 0;
                        return (
                          <li key={i.id}>
                            <span className="font-bold">{i.nome}:</span> {formatarQtdJSX(estEstacionario, i.qtdPacote || 1, i.unidade)} no Estacionado (Mínimo: {i.alertaMinimo})
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
                        const estEstacionario = i.estoqueEstacionario ?? 0;
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

          {isDono && (lembretesPagar.length > 0 || lembretesReceber.length > 0) && (
            <div className="flex-1 min-w-[300px] bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <BellRing className="h-5 w-5 text-orange-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">Lembretes Financeiros</h3>
                  <div className="mt-2 text-sm text-orange-700 max-h-[150px] overflow-y-auto pr-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {lembretesPagar.map(c => (
                        <li key={c.id}>
                          <span className="font-bold text-red-600">A Pagar:</span> {c.descricao} - R$ {Number(c.valor).toFixed(2).replace('.', ',')} <span className="font-bold text-orange-800">({formatarStatusVencimento(c.vencimento)})</span>
                        </li>
                      ))}
                      {lembretesReceber.map(c => (
                        <li key={c.id}>
                          <span className="font-bold text-blue-600">A Receber:</span> {c.descricao} - R$ {Number(c.valor).toFixed(2).replace('.', ',')} <span className="font-bold text-orange-800">({formatarStatusVencimento(c.vencimento)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center"><BarChart2 className="mr-2 text-green-500"/> Faturamento Diário (Últimos 7 Dias)</h3>
        </div>
        <div className="p-6">
          <div className="flex h-48 items-end gap-2 sm:gap-4">
            {vendasPorDia.map((v, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                <div className="w-full bg-green-100 rounded-t-md relative flex justify-center hover:bg-green-200 transition-colors" style={{ height: `${(v.total / maxVenda) * 100}%`, minHeight: v.total > 0 ? '4px' : '0' }}>
                   <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded transition-opacity whitespace-nowrap z-10">
                     R$ {v.total.toFixed(2)}
                   </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 mt-2 uppercase">{v.dia}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 w-full">
                  <div className="h-10 bg-gray-100 rounded-lg w-1/3 animate-pulse"></div>
                  <div className="h-10 bg-gray-100 rounded-lg w-1/6 animate-pulse"></div>
                  <div className="h-10 bg-gray-100 rounded-lg w-1/6 animate-pulse"></div>
                  <div className="h-10 bg-gray-100 rounded-lg w-1/4 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider select-none">
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('nome')}>
                  <div className="flex items-center">Insumo {sortConfig?.key === 'nome' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('tipo')}>
                  <div className="flex items-center">Tipo {sortConfig?.key === 'tipo' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rotativo')}>
                  <div className="flex items-center">Rotativo {sortConfig?.key === 'rotativo' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('estacionado')}>
                  <div className="flex items-center">Estacionado {sortConfig?.key === 'estacionado' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('preco')}>
                  <div className="flex items-center">Preço Unit. {sortConfig?.key === 'preco' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('validade')}>
                  <div className="flex items-center">Validade {sortConfig?.key === 'validade' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-3">
                  <div className="flex items-center">Status</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedInsumos.map(i => {
                return (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors text-sm">
                  <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                  <td className="px-6 py-4">
                    {(i as any).tipoUso ? <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full uppercase">{(i as any).tipoUso}</span> : <span className="text-gray-400 text-xs">-</span>}
                  </td>
                  <td className="px-6 py-4 text-orange-600 font-bold">{(i.estoqueRotativo ?? 0)} {i.unidade}</td>
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
                            onClick={() => descartarLote(i.id, 'legado', (i.estoqueEstacionario ?? 0), (i as any).lote)}
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
                      {isAlertavel(i) && (i.estoqueEstacionario ?? 0) <= (i.alertaMinimo || 0) ? (
                        <span className="px-2 py-1 text-xs font-bold bg-red-100 text-red-600 rounded-full">BAIXO</span>
                      ) : i.estoqueMaximo && (i.estoqueEstacionario ?? 0) > i.estoqueMaximo ? (
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
          )}
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

      {activeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setActiveModal(null); setModalSearchTerm(''); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">
                {activeModal === 'insumos' && 'Todos os Insumos'}
                {activeModal === 'produtos' && 'Todos os Produtos'}
                {activeModal === 'baixos' && 'Estoque Baixo (Reposição Necessária)'}
                {activeModal === 'excedentes' && 'Estoque Excedente'}
                {activeModal === 'vencimentos' && 'Próximos do Vencimento'}
              </h3>
              <button onClick={() => { setActiveModal(null); setModalSearchTerm(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou SKU..."
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button onClick={exportarModalCSV} className="flex items-center justify-center w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors whitespace-nowrap text-sm shadow-sm">
                <Download size={16} className="mr-2" /> Exportar Excel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                let baseData: any[] = [];
                if (activeModal === 'insumos') baseData = insumos;
                else if (activeModal === 'produtos') baseData = produtos;
                else if (activeModal === 'baixos') baseData = baixos;
                else if (activeModal === 'excedentes') baseData = excedentes;
                else if (activeModal === 'vencimentos') baseData = validadeProxima;

                const filtered = baseData.filter(item => {
                  const nome = (item.nome || '').toLowerCase();
                  const sku = ((item as any).sku || '').toLowerCase();
                  const term = modalSearchTerm.toLowerCase();
                  return nome.includes(term) || sku.includes(term);
                });

                if (filtered.length === 0) {
                  return <div className="p-8 text-center text-gray-500">Nenhum item encontrado.</div>;
                }

                return (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Item</th>
                        <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">SKU</th>
                        {activeModal === 'produtos' ? (
                          <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Categoria</th>
                        ) : activeModal === 'vencimentos' ? (
                          <>
                            <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Lote</th>
                            <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Validade</th>
                            <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Qtd.</th>
                          </>
                        ) : (
                          <th className="px-4 py-3 text-gray-500 font-bold uppercase text-xs tracking-wider">Estoque</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((item, idx) => (
                        <tr key={item.id + (item.loteSpec ? idx : '')} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-gray-800">{item.nome}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{(item as any).sku || '-'}</td>
                          {activeModal === 'produtos' ? (
                            <td className="px-4 py-3 text-gray-600">{item.categoria || 'Outros'}</td>
                          ) : activeModal === 'vencimentos' ? (
                            <>
                              <td className="px-4 py-3 text-gray-600">{item.loteSpec?.lote || 'N/A'}</td>
                              <td className="px-4 py-3 font-bold text-red-600">{item.loteSpec?.validade ? new Date(`${item.loteSpec.validade}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{item.loteSpec?.quantidade} {item.unidade}</td>
                            </>
                          ) : (
                            <td className="px-4 py-3 text-gray-600">
                              {formatarQtdJSX(item.estoqueEstacionario ?? 0, item.qtdPacote || 1, item.unidade)}
                              {activeModal === 'baixos' && <span className="ml-2 text-xs text-red-500 font-bold">(Mín: {item.alertaMinimo})</span>}
                              {activeModal === 'excedentes' && <span className="ml-2 text-xs text-blue-500 font-bold">(Máx: {item.estoqueMaximo})</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
