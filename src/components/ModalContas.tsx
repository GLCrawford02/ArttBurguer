import { useState, useEffect } from 'react';
import { ref, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { TrendingDown, TrendingUp, Repeat, Pencil, Trash2, X, Search, ChevronUp, ChevronDown } from 'lucide-react';

export default function ModalContas({
  isOpen, onClose, tipoConta, contas, categoriasDespesa, fornecedores, funcionarios,
  currentUser, onManageCategorias, showToast, excluir, itemEdit, setItemEdit, loading
}: any) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [statusPagar, setStatusPagar] = useState<'Pendente' | 'Pago'>('Pendente');
  const [statusReceber, setStatusReceber] = useState<'Pendente' | 'Recebido'>('Pendente');
  const [tipoPagar, setTipoPagar] = useState<string>('');
  const [searchTipoPagar, setSearchTipoPagar] = useState('');
  const [showTipoPagarDropdown, setShowTipoPagarDropdown] = useState(false);
  const [fornecedorId, setFornecedorId] = useState('');
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [showFornecedorDropdown, setShowFornecedorDropdown] = useState(false);
  const [recorrencia, setRecorrencia] = useState<'Nenhuma' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual'>('Nenhuma');
  const [fimRecorrencia, setFimRecorrencia] = useState('');
  const [tipoLancamento, setTipoLancamento] = useState<'Unico' | 'Parcelado' | 'Recorrente'>('Unico');
  const [qtdParcelas, setQtdParcelas] = useState('2');
  const [parcelaInicial, setParcelaInicial] = useState('1');
  const [modoParcelamento, setModoParcelamento] = useState<'total' | 'parcela'>('total');
  const [valorParcela, setValorParcela] = useState('');
  const [gerarLembrete, setGerarLembrete] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [responsavelLembrete, setResponsavelLembrete] = useState('');
  const [horaLembrete, setHoraLembrete] = useState('08:00');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatarMoeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatarData = (d: string) => { const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (itemEdit) {
      setDescricao(itemEdit.descricao || '');
      setValor(String(itemEdit.valor || ''));
      setVencimento(itemEdit.vencimento || '');
      setRecorrencia(itemEdit.recorrencia || 'Nenhuma');
      setFimRecorrencia(itemEdit.fimRecorrencia || '');
      setObservacoes(itemEdit.observacoes || '');
      if (tipoConta === 'pagar') {
        setTipoPagar(itemEdit.tipo || '');
        setSearchTipoPagar(itemEdit.tipo || '');
        setStatusPagar(itemEdit.status || 'Pendente');
        setFornecedorId(itemEdit.fornecedorId || '');
        if (itemEdit.fornecedorId) {
          const f = fornecedores.find((forn: any) => forn.id === itemEdit.fornecedorId);
          setSearchFornecedor(f ? (f.nomeFantasia || f.nome) : '');
        } else {
          setSearchFornecedor('');
        }
      } else {
        setStatusReceber(itemEdit.status || 'Pendente');
      }
      setTipoLancamento('Unico');
      setModoParcelamento('total');
    } else {
      setDescricao(''); setValor(''); setVencimento('');
      setObservacoes('');
      setStatusPagar('Pendente'); setStatusReceber('Pendente');
      setTipoPagar(''); setFornecedorId('');
      setSearchFornecedor('');
      setSearchTipoPagar('');
      setRecorrencia('Nenhuma'); setFimRecorrencia('');
      setGerarLembrete(false); setResponsavelLembrete(''); setHoraLembrete('08:00');
      setTipoLancamento('Unico'); setQtdParcelas('2'); setParcelaInicial('1');
      setModoParcelamento('total'); setValorParcela('');
      setSearchTerm('');
    }
  }, [itemEdit, isOpen, tipoConta]);

  const salvarConta = async () => {
    const isValorValido = (tipoLancamento === 'Parcelado' && modoParcelamento === 'parcela') ? valorParcela : valor;
    if (!descricao || !isValorValido || !vencimento) return showToast('Preencha todos os campos!', 'error');
    if (gerarLembrete && !responsavelLembrete) return showToast('Selecione quem receberá o lembrete no WhatsApp!', 'error');
    
    const total = (tipoLancamento === 'Parcelado' && modoParcelamento === 'parcela') ? Number(valorParcela) * Number(qtdParcelas) : Number(valor);
    const statusFinal = tipoConta === 'pagar' ? statusPagar : statusReceber;
    const dbPath = `contas_${tipoConta}`;

    if (!itemEdit && tipoLancamento === 'Parcelado') {
      const parcelas = Number(qtdParcelas);
      const inicial = Number(parcelaInicial) || 1;
      
      let valorBaseParcela = 0;
      let resto = 0;
      if (modoParcelamento === 'total') {
         valorBaseParcela = Math.floor((total / parcelas) * 100) / 100;
         resto = Math.round((total - (valorBaseParcela * parcelas)) * 100) / 100;
      } else {
         valorBaseParcela = Number(valorParcela);
      }
      
      for(let i=inicial; i<=parcelas; i++) {
         const dataVenc = new Date(vencimento + 'T12:00:00');
         dataVenc.setMonth(dataVenc.getMonth() + (i - inicial));
         const dataStr = dataVenc.toISOString().split('T')[0];
         const valFinal = (i === parcelas && modoParcelamento === 'total') ? valorBaseParcela + resto : valorBaseParcela;
         
         const recData: any = { descricao: `${descricao} (${i}/${parcelas})`, valor: valFinal, vencimento: dataStr, status: statusFinal, recorrencia: 'Nenhuma', fimRecorrencia: '', observacoes };
         if (tipoConta === 'pagar') { recData.tipo = tipoPagar; recData.fornecedorId = fornecedorId; }
         await set(push(ref(db, dbPath)), recData);

         if (gerarLembrete) {
            await set(push(ref(db, 'tarefas')), {
              titulo: `${tipoConta === 'pagar' ? 'Pagar' : 'Receber'} Conta: ${descricao} (${i}/${parcelas})`,
              descricao: `Vencimento programado. Valor: R$ ${valFinal.toFixed(2).replace('.', ',')}`,
              responsaveisIds: [responsavelLembrete], dataAgendada: dataStr, horaAgendada: horaLembrete, prioridade: 'Alta', categoria: 'Financeiro', recorrencia: 'Nenhuma', status: 'pendente', notificadoWhatsApp: false, timestamp: Date.now(), criadoPor: currentUser?.id || null
            });
         }
      }
      showToast(`Conta parcelada a partir de ${inicial}/${parcelas}x registrada!`);
    } else {
      const rec = tipoLancamento === 'Recorrente' ? recorrencia : 'Nenhuma';
      const data: any = { descricao, valor: total, vencimento, status: statusFinal, recorrencia: itemEdit ? recorrencia : rec, fimRecorrencia, observacoes };
      if (tipoConta === 'pagar') { data.tipo = tipoPagar; data.fornecedorId = fornecedorId; }

      if (itemEdit) {
        await update(ref(db, `${dbPath}/${itemEdit.id}`), data);
        showToast('Conta atualizada!');
      } else {
        await set(push(ref(db, dbPath)), data);
        if (gerarLembrete) {
          await set(push(ref(db, 'tarefas')), {
            titulo: `${tipoConta === 'pagar' ? 'Pagar' : 'Receber'} Conta: ${descricao}`,
            descricao: `Vencimento programado. Valor: R$ ${total.toFixed(2).replace('.', ',')}`,
            responsaveisIds: [responsavelLembrete], dataAgendada: vencimento, horaAgendada: horaLembrete, prioridade: 'Alta', categoria: 'Financeiro', recorrencia: rec, status: 'pendente', notificadoWhatsApp: false, timestamp: Date.now(), criadoPor: currentUser?.id || null
          });
        }
        showToast('Conta registrada!');
      }
    }
    setItemEdit(null);
    setDescricao(''); setValor(''); setVencimento('');
    setObservacoes('');
    setStatusPagar('Pendente'); setStatusReceber('Pendente');
    setTipoPagar(''); setFornecedorId('');
    setSearchFornecedor('');
    setSearchTipoPagar('');
    setRecorrencia('Nenhuma'); setFimRecorrencia('');
    setGerarLembrete(false); setResponsavelLembrete(''); setHoraLembrete('08:00');
    setTipoLancamento('Unico'); setQtdParcelas('2'); setParcelaInicial('1');
    setModoParcelamento('total'); setValorParcela('');
    setSearchTerm('');
  };

  const alternarStatusLocal = async (id: string, novoStatus: string) => {
    await update(ref(db, `contas_${tipoConta}/${id}`), { status: novoStatus });
    const conta = contas.find((c: any) => c.id === id);
    if (conta && (novoStatus === 'Pago' || novoStatus === 'Recebido') && conta.recorrencia && conta.recorrencia !== 'Nenhuma') {
      const nextDate = new Date(conta.vencimento + 'T12:00:00');
      if (conta.recorrencia === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
      else if (conta.recorrencia === 'Semanal') nextDate.setDate(nextDate.getDate() + 7);
      else if (conta.recorrencia === 'Diária') nextDate.setDate(nextDate.getDate() + 1);
      else if (conta.recorrencia === 'Anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
      
      const nextVencimento = nextDate.toISOString().split('T')[0];
      const nextExists = contas.some((c: any) => c.descricao === conta.descricao && c.vencimento === nextVencimento && c.valor === conta.valor);
  
      if (!nextExists) {
        if (conta.fimRecorrencia && nextVencimento > conta.fimRecorrencia) {
          showToast(`Parcela final paga! Recorrência concluída.`, 'success');
        } else {
          const novaConta = { ...conta, status: 'Pendente', vencimento: nextVencimento };
          delete novaConta.id;
          await set(push(ref(db, `contas_${tipoConta}`)), novaConta);
          showToast(`Próxima recorrência gerada para ${formatarData(nextVencimento)}`, 'success');
        }
      }
    }
  };

  if (!isOpen) return null;
  const isAdminOrDono = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono' || c === 'TI') : (currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono' || currentUser.cargo === 'TI'));

  const filteredContas = contas.filter((c: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const matchDesc = (c.descricao || '').toLowerCase().includes(term);
    const matchTipo = (c.tipo || '').toLowerCase().includes(term);
    const forn = fornecedores.find((f:any)=>f.id===c.fornecedorId);
    const matchForn = forn ? (forn.nomeFantasia || forn.nome).toLowerCase().includes(term) : false;
    return matchDesc || matchTipo || matchForn;
  });

  const sortedContas = [...filteredContas].sort((a: any, b: any) => {
    if (!sortConfig) return a.vencimento.localeCompare(b.vencimento);
    const { key, direction } = sortConfig;
    let valA: any = ''; let valB: any = '';

    if (key === 'descricao') { valA = a.descricao.toLowerCase(); valB = b.descricao.toLowerCase(); }
    else if (key === 'valor') { valA = Number(a.valor); valB = Number(b.valor); }
    else if (key === 'vencimento') { valA = a.vencimento; valB = b.vencimento; }
    else if (key === 'status') { valA = a.status; valB = b.status; }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-50 rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-w-6xl max-h-[90vh]">
        <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            {tipoConta === 'pagar' ? <TrendingDown size={20} className="text-red-500 mr-2"/> : <TrendingUp size={20} className="text-blue-500 mr-2"/>}
            Gestão de Contas a {tipoConta === 'pagar' ? 'Pagar' : 'Receber'}
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{itemEdit ? 'Editar Conta' : `Nova Conta`}</h3>
              <input type="text" placeholder={`Descrição (Ex: ${tipoConta === 'pagar' ? 'Conta de Luz' : 'Venda Ifood'})`} value={descricao} onChange={e=>setDescricao(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Valor</label>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input type="text" placeholder="0,00" value={valor === '' ? '' : Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const d = e.target.value.replace(/\D/g, ''); setValor(d ? (parseInt(d, 10) / 100).toString() : ''); }} className={`w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Vencimento</label>
                  <input type="date" value={vencimento} onChange={e=>setVencimento(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo / Recorrência</label>
                  {isAdminOrDono ? (
                    !itemEdit ? (
                      <select value={tipoLancamento} onChange={e => setTipoLancamento(e.target.value as any)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}>
                        <option value="Unico">Único</option>
                        <option value="Parcelado">Parcelado</option>
                        <option value="Recorrente">Recorrente</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <select value={recorrencia} onChange={e=>setRecorrencia(e.target.value as any)} className={`w-full p-2 pl-8 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}>
                          <option value="Nenhuma">S/ Recorrência</option>
                          <option value="Diária">Diária</option>
                          <option value="Semanal">Semanal</option>
                          <option value="Mensal">Mensal</option>
                          <option value="Anual">Anual</option>
                        </select>
                        <Repeat size={16} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" />
                      </div>
                    )
                  ) : (
                    <input type="text" value="Único" disabled className="w-full p-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 outline-none" />
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Status</label>
                  {tipoConta === 'pagar' ? (
                    <select value={statusPagar} onChange={e=>setStatusPagar(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500">
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                    </select>
                  ) : (
                    <select value={statusReceber} onChange={e=>setStatusReceber(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Pendente">Pendente</option>
                      <option value="Recebido">Recebido</option>
                    </select>
                  )}
                </div>
              </div>

              {tipoLancamento === 'Parcelado' && !itemEdit && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex gap-4"><label className="flex items-center text-xs font-bold cursor-pointer"><input type="radio" checked={modoParcelamento === 'total'} onChange={() => setModoParcelamento('total')} className="mr-1" /> Valor Total da Compra</label><label className="flex items-center text-xs font-bold cursor-pointer"><input type="radio" checked={modoParcelamento === 'parcela'} onChange={() => setModoParcelamento('parcela')} className="mr-1" /> Informar Valor da Parcela</label></div>
                  <div className="flex flex-col sm:flex-row gap-3">
                     <div className="relative flex-1"><span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">R$</span><input type="text" disabled={modoParcelamento === 'total'} value={modoParcelamento === 'parcela' ? (valorParcela === '' ? '' : Number(valorParcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })) : (valor === '' ? '' : (Number(valor) / (Number(qtdParcelas) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))} onChange={e => { const d = e.target.value.replace(/\D/g, ''); setValorParcela(d ? (parseInt(d, 10) / 100).toString() : ''); }} className={`w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none bg-white focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} placeholder="0,00" /><label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500">Valor da Parcela</label></div>
                     <div className="flex gap-2 items-center flex-1">
                        <div className="relative flex-1"><label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500">Inicia em</label><input type="number" min="1" max={qtdParcelas} value={parcelaInicial} onChange={e => setParcelaInicial(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} /></div>
                        <span className="text-gray-400 font-bold">de</span>
                        <div className="relative flex-1"><label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500">Total Parc.</label><input type="number" min="2" max="120" value={qtdParcelas} onChange={e => setQtdParcelas(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} /></div>
                     </div>
                  </div>
                </div>
              )}

              {tipoLancamento === 'Recorrente' && !itemEdit && (
                <div className="flex gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Frequência</label>
                        <select value={recorrencia} onChange={e => setRecorrencia(e.target.value as any)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}>
                          <option value="Nenhuma">Selecione...</option><option value="Diária">Diária</option><option value="Semanal">Semanal</option><option value="Mensal">Mensal</option><option value="Anual">Anual</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Parar Em (Opcional)</label>
                        <input type="date" value={fimRecorrencia} onChange={e=>setFimRecorrencia(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
                    </div>
                </div>
              )}

              {itemEdit && recorrencia !== 'Nenhuma' && (
                  <div className="w-full sm:w-1/2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Parar Em (Opcional)</label>
                        <input type="date" value={fimRecorrencia} onChange={e=>setFimRecorrencia(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
                  </div>
              )}

              {tipoConta === 'pagar' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-end mb-1"><label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Despesa</label><button type="button" onClick={onManageCategorias} className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase leading-none pb-0.5">Gerenciar</button></div>
                    <div className="relative w-full">
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-red-500">
                        <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                        <input 
                          type="text" 
                          value={searchTipoPagar} 
                          onChange={e => { setSearchTipoPagar(e.target.value); setTipoPagar(e.target.value); setShowTipoPagarDropdown(true); }}
                          onFocus={() => setShowTipoPagarDropdown(true)}
                          onBlur={() => setTimeout(() => setShowTipoPagarDropdown(false), 200)}
                          className="w-full p-2 outline-none rounded-lg text-sm bg-transparent"
                          placeholder="Buscar ou digitar..."
                        />
                      </div>
                      {showTipoPagarDropdown && categoriasDespesa.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {categoriasDespesa.filter((c: any) => c.nome.toLowerCase().includes(searchTipoPagar.toLowerCase())).map((c: any) => (
                            <div key={c.id} onClick={() => { setTipoPagar(c.nome); setSearchTipoPagar(c.nome); setShowTipoPagarDropdown(false); }} className="p-2 text-sm hover:bg-red-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{c.nome}</span></div>
                          ))}
                          {categoriasDespesa.filter((c: any) => c.nome.toLowerCase().includes(searchTipoPagar.toLowerCase())).length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhum tipo encontrado</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Fornecedor</label>
                    <div className="relative w-full">
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-red-500">
                        <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                        <input 
                          type="text" 
                          value={searchFornecedor} 
                          onChange={e => { setSearchFornecedor(e.target.value); setFornecedorId(''); setShowFornecedorDropdown(true); }}
                          onFocus={() => setShowFornecedorDropdown(true)}
                          onBlur={() => setTimeout(() => setShowFornecedorDropdown(false), 200)}
                          className="w-full p-2 outline-none rounded-lg text-sm bg-transparent"
                          placeholder="Buscar fornecedor (Opcional)..."
                        />
                      </div>
                      {showFornecedorDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {fornecedores.filter((f: any) => (f.nomeFantasia || f.nome).toLowerCase().includes(searchFornecedor.toLowerCase())).map((f: any) => (
                            <div key={f.id} onClick={() => { setFornecedorId(f.id); setSearchFornecedor(f.nomeFantasia || f.nome); setShowFornecedorDropdown(false); }} className="p-2 text-sm hover:bg-red-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{f.nomeFantasia || f.nome}</span></div>
                          ))}
                          {fornecedores.filter((f: any) => (f.nomeFantasia || f.nome).toLowerCase().includes(searchFornecedor.toLowerCase())).length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhum fornecedor encontrado</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Observações (Opcional)</label>
                <textarea placeholder="Detalhes, Pix, chave de transferência, etc..." value={observacoes} onChange={e=>setObservacoes(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 resize-none ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} rows={2} />
              </div>
              
              {!itemEdit && (
                <div className="pt-4 border-t border-gray-100 space-y-3 mt-4"><label className="flex items-center space-x-2 cursor-pointer w-fit"><input type="checkbox" checked={gerarLembrete} onChange={e => setGerarLembrete(e.target.checked)} className="rounded focus:ring-2 w-4 h-4 cursor-pointer" /><span className="text-sm font-bold text-gray-700">Criar tarefa no WhatsApp</span></label>{gerarLembrete && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-in fade-in"><div><label className="text-xs font-bold text-gray-500 uppercase flex items-center">Responsável pelo Lembrete</label><select value={responsavelLembrete} onChange={e=>setResponsavelLembrete(e.target.value)} className="w-full p-2 mt-1 border border-gray-200 rounded-lg text-sm bg-white"><option value="">Selecione...</option>{funcionarios.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div><div><label className="text-xs font-bold text-gray-500 uppercase flex items-center">Horário do Disparo</label><input type="time" value={horaLembrete} onChange={e=>setHoraLembrete(e.target.value)} className="w-full p-2 mt-1 border border-gray-200 rounded-lg text-sm bg-white" /></div></div>)}</div>
              )}
              <div className="flex gap-2">
                <button onClick={salvarConta} className={`flex-1 text-white p-2 rounded-lg font-bold transition-colors ${tipoConta === 'pagar' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Salvar</button>
                {itemEdit && <button onClick={() => setItemEdit(null)} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
               <div className="p-4 border-b border-gray-100 flex justify-end">
                 <div className="relative w-full sm:w-64">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                   <input type="text" placeholder="Buscar lançamentos..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                 </div>
               </div>
               <div className="overflow-x-auto flex-1">
                 <table className="w-full text-left min-w-[500px]">
                   <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase select-none">
                     <tr>
                       <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('descricao')}><div className="flex items-center">Descrição {sortConfig?.key === 'descricao' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                       <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('valor')}><div className="flex items-center">Valor {sortConfig?.key === 'valor' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                       <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('vencimento')}><div className="flex items-center">Vencimento {sortConfig?.key === 'vencimento' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                       <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('status')}><div className="flex items-center">Status {sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div></th>
                       <th className="p-4 text-right">Ações</th>
                     </tr>
                   </thead>
                 {loading ? (
                   <tbody>{[...Array(5)].map((_, i) => (<tr key={i} className="animate-pulse border-b border-gray-50"><td className="p-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td><td className="p-4 flex justify-end"><div className="h-6 bg-gray-200 rounded w-12"></div></td></tr>))}</tbody>
                 ) : (
                 <tbody className="divide-y divide-gray-50 text-sm">
                   {sortedContas.map((c: any) => (
                     <tr key={c.id} className="hover:bg-gray-50">
                       <td className="p-4 font-medium text-gray-800">{c.descricao} {c.recorrencia && c.recorrencia !== 'Nenhuma' && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full"><Repeat size={10} className="inline mr-1"/>{c.recorrencia}{c.fimRecorrencia ? ` até ${formatarData(c.fimRecorrencia)}` : ''}</span>} {tipoConta === 'pagar' && <span className="block text-xs text-gray-400 mt-0.5">{c.tipo} {c.fornecedorId ? `| ${fornecedores.find((f:any)=>f.id===c.fornecedorId)?.nomeFantasia || fornecedores.find((f:any)=>f.id===c.fornecedorId)?.nome}` : ''}</span>}{c.observacoes && <span className="block text-[10px] text-gray-400 mt-0.5 italic" title={c.observacoes}>{c.observacoes.length > 50 ? c.observacoes.substring(0, 50) + '...' : c.observacoes}</span>}</td>
                       <td className={`p-4 font-bold ${tipoConta === 'pagar' ? 'text-red-600' : 'text-blue-600'}`}>{formatarMoeda(c.valor)}</td>
                       <td className={`p-4 ${c.vencimento < hoje && c.status === 'Pendente' ? 'text-red-500 font-bold' : 'text-gray-600'}`}>{formatarData(c.vencimento)}</td>
                       <td className="p-4"><button onClick={()=>alternarStatusLocal(c.id, c.status.includes('Pendente') ? (tipoConta === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente')} className={`px-2 py-1 rounded-full text-xs font-bold ${!c.status.includes('Pendente') ? 'bg-green-100 text-green-700' : (tipoConta === 'pagar' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}`}>{c.status}</button></td>
                       <td className="p-4 text-right flex justify-end space-x-2"><button onClick={()=>setItemEdit(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={()=>excluir(`contas_${tipoConta}/${c.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></td>
                     </tr>
                   ))}
                   {sortedContas.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">Nenhum registro encontrado.</td></tr>}
                 </tbody>
                 )}
               </table>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
