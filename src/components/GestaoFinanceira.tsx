import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { TrendingUp, TrendingDown, CheckCircle, Clock, Plus, Trash2, Pencil, CalendarClock } from 'lucide-react';

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

export default function GestaoFinanceira({ activeTab }: { activeTab: 'dashboard_fin' | 'pagar' | 'receber' | 'fornecedores' | 'calendario' }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
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

  useEffect(() => {
    const fornRef = ref(db, 'fornecedores');
    const pagarRef = ref(db, 'contas_pagar');
    const receberRef = ref(db, 'contas_receber');

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

    return () => { unsubF(); unsubP(); unsubR(); };
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
    const todas = [
      ...contasPagar.map(c => ({ ...c, _tipoConta: 'pagar' })),
      ...contasReceber.map(c => ({ ...c, _tipoConta: 'receber' }))
    ].sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
         <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><CalendarClock className="mr-2 text-indigo-500"/> Calendário de Agendamentos</h3>
         <div className="space-y-4">
           {todas.map((c: any) => (
             <div key={`${c._tipoConta}-${c.id}`} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border-l-4 ${c._tipoConta === 'pagar' ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500'}`}>
               <div className="flex items-center mb-2 sm:mb-0">
                 {c._tipoConta === 'pagar' ? <TrendingDown className="text-red-500 mr-4" size={24}/> : <TrendingUp className="text-blue-500 mr-4" size={24}/>}
                 <div>
                   <p className="font-bold text-gray-800">{c.descricao}</p>
                   <p className="text-xs text-gray-500 flex items-center mt-1"><Clock size={12} className="mr-1"/> Vencimento: {formatarData(c.vencimento)}</p>
                 </div>
               </div>
               <div className="text-left sm:text-right">
                 <p className={`font-black ${c._tipoConta === 'pagar' ? 'text-red-600' : 'text-blue-600'}`}>{formatarMoeda(c.valor)}</p>
                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${c.status.includes('Pendente') ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>{c.status}</span>
               </div>
             </div>
           ))}
           {todas.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum agendamento encontrado.</p>}
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