import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { TrendingUp, TrendingDown, CheckCircle, Clock, Plus, Trash2, Pencil, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';

interface Fornecedor {
  id: string;
  nome: string;
  telefone: string;
}

interface ContaPagar {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Pago';
  tipo: 'Fixa' | 'Variável';
  fornecedorId: string;
}

interface ContaReceber {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Recebido';
}

interface Agendamento {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  descricao: string;
}

export default function GestaoFinanceira({ activeTab }: { activeTab: 'dashboard_fin' | 'pagar' | 'receber' | 'fornecedores' | 'calendario' }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Estados dos Formulários
  const [editId, setEditId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [statusPagar, setStatusPagar] = useState<'Pendente' | 'Pago'>('Pendente');
  const [statusReceber, setStatusReceber] = useState<'Pendente' | 'Recebido'>('Pendente');
  const [tipoPagar, setTipoPagar] = useState<'Fixa' | 'Variável'>('Variável');
  const [fornecedorId, setFornecedorId] = useState('');

  const [nomeForn, setNomeForn] = useState('');
  const [telForn, setTelefoneForn] = useState('');

  // Estados do Calendário e Agendamentos
  const [tituloAg, setTituloAg] = useState('');
  const [dataAg, setDataAg] = useState('');
  const [horaAg, setHoraAg] = useState('');
  const [descAg, setDescAg] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const fornRef = ref(db, 'fornecedores');
    const pagarRef = ref(db, 'contas_pagar');
    const receberRef = ref(db, 'contas_receber');
    const agendRef = ref(db, 'agendamentos');

    const unsubF = onValue(fornRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setFornecedores(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setFornecedores([]);
    });

    const unsubP = onValue(pagarRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setContasPagar(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setContasPagar([]);
    });

    const unsubR = onValue(receberRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setContasReceber(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setContasReceber([]);
    });

    const unsubA = onValue(agendRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setAgendamentos(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setAgendamentos([]);
    });

    return () => { unsubF(); unsubP(); unsubR(); unsubA(); };
  }, []);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForms = () => {
    setEditId(null);
    setDescricao(''); setValor(''); setVencimento('');
    setStatusPagar('Pendente'); setStatusReceber('Pendente');
    setTipoPagar('Variável'); setFornecedorId('');
    setNomeForn(''); setTelefoneForn('');
    setTituloAg(''); setDataAg(''); setHoraAg(''); setDescAg('');
  };

  useEffect(() => { resetForms(); }, [activeTab]);

  // ================= Funções CRUD =================
  const salvarFornecedor = async () => {
    if (!nomeForn) return showToast('Nome é obrigatório', 'error');
    if (editId) await update(ref(db, `fornecedores/${editId}`), { nome: nomeForn, telefone: telForn });
    else await set(push(ref(db, 'fornecedores')), { nome: nomeForn, telefone: telForn });
    showToast(editId ? 'Fornecedor atualizado!' : 'Fornecedor salvo com sucesso!');
    resetForms();
  };

  const salvarContaPagar = async () => {
    if (!descricao || !valor || !vencimento) return showToast('Preencha todos os campos!', 'error');
    const data = { descricao, valor: Number(valor), vencimento, status: statusPagar, tipo: tipoPagar, fornecedorId };
    if (editId) await update(ref(db, `contas_pagar/${editId}`), data);
    else await set(push(ref(db, 'contas_pagar')), data);
    showToast(editId ? 'Conta atualizada!' : 'Conta a pagar registrada!');
    resetForms();
  };

  const salvarContaReceber = async () => {
    if (!descricao || !valor || !vencimento) return showToast('Preencha todos os campos!', 'error');
    const data = { descricao, valor: Number(valor), vencimento, status: statusReceber };
    if (editId) await update(ref(db, `contas_receber/${editId}`), data);
    else await set(push(ref(db, 'contas_receber')), data);
    showToast(editId ? 'Conta atualizada!' : 'Conta a receber registrada!');
    resetForms();
  };

  const salvarAgendamento = async () => {
    if (!tituloAg || !dataAg) return showToast('Título e Data são obrigatórios!', 'error');
    await set(push(ref(db, 'agendamentos')), {
      titulo: tituloAg, data: dataAg, horario: horaAg, descricao: descAg
    });
    showToast('Agendamento registrado!');
    resetForms();
  };

  const alternarStatus = async (tipo: 'pagar' | 'receber', id: string, novoStatus: string) => {
    await update(ref(db, `contas_${tipo}/${id}`), { status: novoStatus });
  };

  const excluir = async (caminho: string) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) await remove(ref(db, caminho));
  };

  // ================= Helpers =================
  const formatarMoeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatarData = (d: string) => { const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const hoje = new Date().toISOString().split('T')[0];

  // ================= Renders (Visualizações) =================
  const renderDashboard = () => {
    const pagarPendente = contasPagar.filter(c => c.status === 'Pendente').reduce((acc, c) => acc + c.valor, 0);
    const pagarPago = contasPagar.filter(c => c.status === 'Pago').reduce((acc, c) => acc + c.valor, 0);
    const receberPendente = contasReceber.filter(c => c.status === 'Pendente').reduce((acc, c) => acc + c.valor, 0);
    const receberRecebido = contasReceber.filter(c => c.status === 'Recebido').reduce((acc, c) => acc + c.valor, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
            <p className="text-sm font-bold text-gray-500 flex items-center"><TrendingDown size={16} className="mr-2 text-red-500"/> A Pagar (Pendente)</p>
            <h4 className="text-2xl font-black text-red-600 mt-2">{formatarMoeda(pagarPendente)}</h4>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-500 flex items-center"><CheckCircle size={16} className="mr-2 text-gray-400"/> Total Pago</p>
            <h4 className="text-2xl font-black text-gray-700 mt-2">{formatarMoeda(pagarPago)}</h4>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
            <p className="text-sm font-bold text-gray-500 flex items-center"><TrendingUp size={16} className="mr-2 text-blue-500"/> A Receber (Pendente)</p>
            <h4 className="text-2xl font-black text-blue-600 mt-2">{formatarMoeda(receberPendente)}</h4>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100">
            <p className="text-sm font-bold text-gray-500 flex items-center"><CheckCircle size={16} className="mr-2 text-green-500"/> Total Recebido</p>
            <h4 className="text-2xl font-black text-green-600 mt-2">{formatarMoeda(receberRecebido)}</h4>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-4">Resumo por Tipo (Despesas a Pagar)</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="p-4 bg-gray-50 rounded-lg">
               <p className="text-sm text-gray-500 font-bold">Despesas Fixas</p>
               <p className="text-xl font-bold text-gray-800 mt-1">{formatarMoeda(contasPagar.filter(c => c.tipo === 'Fixa').reduce((a,b)=>a+b.valor,0))}</p>
             </div>
             <div className="p-4 bg-gray-50 rounded-lg">
               <p className="text-sm text-gray-500 font-bold">Despesas Variáveis</p>
               <p className="text-xl font-bold text-gray-800 mt-1">{formatarMoeda(contasPagar.filter(c => c.tipo === 'Variável').reduce((a,b)=>a+b.valor,0))}</p>
             </div>
           </div>
        </div>
      </div>
    );
  };

  const renderFormularioContas = (tipoConta: 'pagar' | 'receber') => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{editId ? 'Editar Conta' : `Nova Conta a ${tipoConta === 'pagar' ? 'Pagar' : 'Receber'}`}</h3>
        <input type="text" placeholder={`Descrição (Ex: ${tipoConta === 'pagar' ? 'Conta de Luz' : 'Venda Ifood'})`} value={descricao} onChange={e=>setDescricao(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
        <input type="number" placeholder="Valor (R$)" value={valor} onChange={e=>setValor(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
        <input type="date" value={vencimento} onChange={e=>setVencimento(e.target.value)} className={`w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 ${tipoConta === 'pagar' ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`} />
        
        {tipoConta === 'pagar' && (
          <>
            <select value={tipoPagar} onChange={e=>setTipoPagar(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500">
              <option value="Fixa">Despesa Fixa</option>
              <option value="Variável">Despesa Variável</option>
            </select>
            <select value={fornecedorId} onChange={e=>setFornecedorId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Sem Fornecedor</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <select value={statusPagar} onChange={e=>setStatusPagar(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500">
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
            </select>
          </>
        )}
        {tipoConta === 'receber' && (
          <select value={statusReceber} onChange={e=>setStatusReceber(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Pendente">Pendente</option>
            <option value="Recebido">Recebido</option>
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={tipoConta === 'pagar' ? salvarContaPagar : salvarContaReceber} className={`flex-1 text-white p-2 rounded-lg font-bold transition-colors ${tipoConta === 'pagar' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Salvar</button>
          {editId && <button onClick={resetForms} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
         <table className="w-full text-left min-w-[500px]">
           <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
             <tr>
               <th className="p-4">Descrição</th>
               <th className="p-4">Valor</th>
               <th className="p-4">Vencimento</th>
               <th className="p-4">Status</th>
               <th className="p-4 text-right">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-50 text-sm">
             {(tipoConta === 'pagar' ? contasPagar : contasReceber).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).map((c: any) => (
               <tr key={c.id} className="hover:bg-gray-50">
                 <td className="p-4 font-medium text-gray-800">{c.descricao} {tipoConta === 'pagar' && <span className="block text-xs text-gray-400">{c.tipo} {c.fornecedorId ? `| ${fornecedores.find(f=>f.id===c.fornecedorId)?.nome}` : ''}</span>}</td>
                 <td className={`p-4 font-bold ${tipoConta === 'pagar' ? 'text-red-600' : 'text-blue-600'}`}>{formatarMoeda(c.valor)}</td>
                 <td className={`p-4 ${c.vencimento < hoje && c.status === 'Pendente' ? 'text-red-500 font-bold' : 'text-gray-600'}`}>{formatarData(c.vencimento)}</td>
                 <td className="p-4">
                   <button onClick={()=>alternarStatus(tipoConta, c.id, c.status.includes('P') ? (tipoConta === 'pagar' ? 'Pago' : 'Recebido') : 'Pendente')} className={`px-2 py-1 rounded-full text-xs font-bold ${!c.status.includes('Pendente') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</button>
                 </td>
                 <td className="p-4 text-right flex justify-end space-x-2">
                   <button onClick={()=>{setEditId(c.id); setDescricao(c.descricao); setValor(String(c.valor)); setVencimento(c.vencimento); if(tipoConta === 'pagar'){setTipoPagar(c.tipo); setStatusPagar(c.status); setFornecedorId(c.fornecedorId||'');}else{setStatusReceber(c.status);} }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                   <button onClick={()=>excluir(`contas_${tipoConta}/${c.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                 </td>
               </tr>
             ))}
             {(tipoConta === 'pagar' ? contasPagar : contasReceber).length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">Nenhum registro.</td></tr>}
           </tbody>
         </table>
      </div>
    </div>
  );

  const renderFornecedores = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
        <input type="text" placeholder="Nome do Fornecedor" value={nomeForn} onChange={e=>setNomeForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="text" placeholder="Telefone / Contato" value={telForn} onChange={e=>setTelefoneForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <div className="flex gap-2">
          <button onClick={salvarFornecedor} className="flex-1 bg-purple-600 text-white p-2 rounded-lg font-bold hover:bg-purple-700 transition-colors">Salvar</button>
          {editId && <button onClick={resetForms} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
        </div>
      </div>
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
         <table className="w-full text-left min-w-[400px]">
           <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
             <tr><th className="p-4">Nome</th><th className="p-4">Contato</th><th className="p-4 text-right">Ações</th></tr>
           </thead>
           <tbody className="divide-y divide-gray-50 text-sm">
             {fornecedores.map(f => (
               <tr key={f.id} className="hover:bg-gray-50">
                 <td className="p-4 font-bold text-gray-800">{f.nome}</td>
                 <td className="p-4 text-gray-600">{f.telefone || '-'}</td>
                 <td className="p-4 text-right flex justify-end space-x-2">
                   <button onClick={()=>{setEditId(f.id); setNomeForn(f.nome); setTelefoneForn(f.telefone);}} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                   <button onClick={()=>excluir(`fornecedores/${f.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                 </td>
               </tr>
             ))}
             {fornecedores.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhum fornecedor registrado.</td></tr>}
           </tbody>
         </table>
      </div>
    </div>
  );

  const renderCalendario = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(`${year}-${pad(month + 1)}-${pad(i)}`);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const eventosDoDia = (dateStr: string) => {
      const p = contasPagar.filter(c => c.vencimento === dateStr);
      const r = contasReceber.filter(c => c.vencimento === dateStr);
      const a = agendamentos.filter(c => c.data === dateStr);
      return { p, r, a };
    };

    const selectedEvents = selectedDate ? eventosDoDia(selectedDate) : { p: [], r: [], a: [] };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <CalendarClock className="mr-2 text-indigo-500"/> Calendário Mensal
            </h3>
            <div className="flex items-center space-x-4 bg-gray-50 px-4 py-2 rounded-lg">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-200 rounded-full text-gray-600"><ChevronLeft size={20}/></button>
              <span className="font-bold text-gray-700 capitalize min-w-[120px] text-center">{monthNames[month]} {year}</span>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-200 rounded-full text-gray-600"><ChevronRight size={20}/></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-gray-500 mb-2">
            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {days.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="p-1 sm:p-2"></div>;
              const { p, r, a } = eventosDoDia(date);
              const isSelected = date === selectedDate;
              const isToday = date === hoje;

              return (
                <div 
                  key={date} 
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border rounded-lg cursor-pointer transition-colors overflow-hidden ${isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className={`text-right text-xs sm:text-sm font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{date.split('-')[2]}</div>
                  <div className="flex flex-col gap-1">
                    {p.length > 0 && <span className="text-[9px] sm:text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-medium truncate" title={`${p.length} a pagar`}>{p.length} pagar</span>}
                    {r.length > 0 && <span className="text-[9px] sm:text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium truncate" title={`${r.length} a receber`}>{r.length} rec.</span>}
                    {a.length > 0 && <span className="text-[9px] sm:text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium truncate" title={`${a.length} eventos`}>{a.length} agend.</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h4 className="font-bold text-gray-800 mb-4">Eventos de {formatarData(selectedDate)}</h4>
              <div className="space-y-3">
                {selectedEvents.p.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-lg">
                    <div className="flex items-center"><TrendingDown size={16} className="text-red-500 mr-2"/><span className="font-bold text-gray-800 text-sm">{c.descricao}</span></div>
                    <div className="text-right flex items-center space-x-3">
                      <span className="font-bold text-red-600 text-sm">{formatarMoeda(c.valor)}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c.status === 'Pago' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
                {selectedEvents.r.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center"><TrendingUp size={16} className="text-blue-500 mr-2"/><span className="font-bold text-gray-800 text-sm">{c.descricao}</span></div>
                    <div className="text-right flex items-center space-x-3">
                      <span className="font-bold text-blue-600 text-sm">{formatarMoeda(c.valor)}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c.status === 'Recebido' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
                {selectedEvents.a.map(ag => (
                  <div key={ag.id} className="flex justify-between items-center p-3 bg-purple-50 border border-purple-100 rounded-lg">
                    <div className="flex items-center"><Clock size={16} className="text-purple-500 mr-2 min-w-4"/>
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{ag.titulo}</span>
                        {ag.horario && <span className="text-xs font-bold text-purple-600 ml-2 bg-purple-100 px-1.5 py-0.5 rounded">{ag.horario}</span>}
                        {ag.descricao && <p className="text-xs text-gray-600 mt-1">{ag.descricao}</p>}
                      </div>
                    </div>
                    <button onClick={() => excluir(`agendamentos/${ag.id}`)} className="text-red-500 hover:text-red-700 bg-white p-1.5 rounded-md shadow-sm border border-red-100"><Trash2 size={16}/></button>
                  </div>
                ))}
                {selectedEvents.p.length === 0 && selectedEvents.r.length === 0 && selectedEvents.a.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">Nenhum evento programado para este dia.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4 sticky top-6">
           <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center"><Plus size={18} className="mr-2 text-purple-500"/> Novo Agendamento</h3>
           <input type="text" placeholder="Título (Ex: Reunião Fornecedor)" value={tituloAg} onChange={e=>setTituloAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
           <div className="grid grid-cols-2 gap-2">
             <input type="date" value={dataAg} onChange={e=>setDataAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
             <input type="time" value={horaAg} onChange={e=>setHoraAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
           </div>
           <textarea placeholder="Descrição ou observações..." value={descAg} onChange={e=>setDescAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none h-24 text-sm"></textarea>
           <button onClick={salvarAgendamento} className="w-full bg-purple-600 text-white p-2.5 rounded-lg font-bold hover:bg-purple-700 transition-colors text-sm shadow-sm">Salvar Agendamento</button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-300">
      {activeTab === 'dashboard_fin' && renderDashboard()}
      {activeTab === 'pagar' && renderFormularioContas('pagar')}
      {activeTab === 'receber' && renderFormularioContas('receber')}
      {activeTab === 'fornecedores' && renderFornecedores()}
      {activeTab === 'calendario' && renderCalendario()}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} /><span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}