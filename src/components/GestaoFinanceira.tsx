import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { TrendingUp, TrendingDown, CheckCircle, Clock, Plus, Trash2, Pencil, CalendarClock, ChevronLeft, ChevronRight, Repeat, X, PieChart, CheckSquare, Sparkles, Loader2, Bot } from 'lucide-react';
import ModalContas from './ModalContas';
import TabFornecedores from './TabFornecedores';

interface Fornecedor {
  id: string;
  nome: string;
  telefone: string;
}

interface ContaPagar {
  id?: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Pago';
  tipo: string;
  fornecedorId: string;
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  fimRecorrencia?: string;
}

interface ContaReceber {
  id?: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Recebido';
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  fimRecorrencia?: string;
}

interface Agendamento {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  descricao: string;
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual';
  fimRecorrencia?: string;
}

export default function GestaoFinanceira({ activeTab, currentUser }: { activeTab: 'dashboard_fin' | 'pagar' | 'receber' | 'fornecedores' | 'calendario', currentUser?: any }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [historicoVendas, setHistoricoVendas] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState<'pagar' | 'receber' | null>(null);
  const [itemEdit, setItemEdit] = useState<any>(null);

  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [categoriasDespesa, setCategoriasDespesa] = useState<{id: string, nome: string}[]>([]);
  const [novaCategoriaForm, setNovaCategoriaForm] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState<string | null>(null);
  const [editCategoriaNome, setEditCategoriaNome] = useState('');
  
  const [showIaModal, setShowIaModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  useEffect(() => {
    const fornRef = ref(db, 'fornecedores');
    const pagarRef = ref(db, 'contas_pagar');
    const receberRef = ref(db, 'contas_receber');
    const tarefasRef = ref(db, 'tarefas');
    const funcRef = ref(db, 'funcionarios');
    const vendasRef = ref(db, 'historico_vendas');

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

    const unsubT = onValue(tarefasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setTarefas(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setTarefas([]);
      setLoading(false);
    });

    const unsubFunc = onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => {
          const cargoA = Array.isArray(a.cargo) ? a.cargo[0] || 'Atendente' : a.cargo || 'Atendente';
          const cargoB = Array.isArray(b.cargo) ? b.cargo[0] || 'Atendente' : b.cargo || 'Atendente';
          const cargoCompare = cargoA.localeCompare(cargoB);
          if (cargoCompare !== 0) return cargoCompare;
          return (a.nome || '').localeCompare(b.nome || '');
        });
        setFuncionarios(list);
      } else setFuncionarios([]);
    });

    const unsubVendas = onValue(vendasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setHistoricoVendas(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setHistoricoVendas([]);
    });

    const catRef = ref(db, 'categorias_despesa');
    const unsubCat = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCategoriasDespesa(list);
      } else setCategoriasDespesa([]);
    });

    return () => { unsubF(); unsubP(); unsubR(); unsubT(); unsubFunc(); unsubVendas(); unsubCat(); };
  }, []);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForms = () => {
    setItemEdit(null);
    setModalAberto(null);
  };

  useEffect(() => { resetForms(); }, [activeTab]);

  const handleCadastroIA = async () => {
    if (!aiPrompt.trim()) return showToast('Descreva as despesas ou receitas.', 'error');
    setIsGenerating(true);
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
        body: JSON.stringify({
          model: 'grok-3-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Você é um assistente financeiro. Extraia os lançamentos do texto. Responda APENAS com um array JSON.
Formato:
[{
  "tipoConta": "pagar" ou "receber",
  "descricao": "Nome da despesa ou receita",
  "valor": numero,
  "vencimento": "YYYY-MM-DD" (se omitido, use a data de hoje: ${hoje}),
  "status": "Pago", "Recebido" ou "Pendente",
  "tipoDespesa": "Nome da Categoria" (ex: Impostos, Insumos - Apenas se for "pagar")
}]`
            },
            { role: 'user', content: aiPrompt }
          ]
        })
      });
      const data = await response.json();
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('Resposta inválida da IA.');
      const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const lancamentos = JSON.parse(cleanJson);
      let p=0, r=0;
      for (const item of lancamentos) {
        if (item.tipoConta === 'pagar') { await set(push(ref(db, 'contas_pagar')), { descricao: item.descricao, valor: Number(item.valor), vencimento: item.vencimento || hoje, status: item.status || 'Pendente', tipo: item.tipoDespesa || 'Outros', fornecedorId: '', recorrencia: 'Nenhuma', fimRecorrencia: '' }); p++; }
        else { await set(push(ref(db, 'contas_receber')), { descricao: item.descricao, valor: Number(item.valor), vencimento: item.vencimento || hoje, status: item.status || 'Pendente', recorrencia: 'Nenhuma', fimRecorrencia: '' }); r++; }
      }
      showToast(`Cadastrado: ${p} a pagar e ${r} a receber!`, 'success');
      setAiPrompt('');
      setShowIaModal(false);
    } catch (e: any) { showToast('Erro IA: ' + e.message, 'error'); } 
    finally { setIsGenerating(false); }
  };

  const handleAddCategoria = async () => {
    if (!novaCategoriaForm.trim()) return;
    try {
      await set(push(ref(db, 'categorias_despesa')), { nome: novaCategoriaForm.trim() });
      setNovaCategoriaForm('');
    } catch (e: any) {
      showToast('Erro ao salvar categoria: ' + e.message, 'error');
    }
  };

  const handleEditCategoria = (c: any) => {
    setEditCategoriaId(c.id);
    setEditCategoriaNome(c.nome);
  };

  const handleSaveEditCategoria = async () => {
    if (!editCategoriaNome.trim() || !editCategoriaId) return;
    try {
      await update(ref(db, `categorias_despesa/${editCategoriaId}`), { nome: editCategoriaNome.trim() });
      setEditCategoriaId(null);
      setEditCategoriaNome('');
    } catch (e: any) {
      showToast('Erro ao atualizar categoria: ' + e.message, 'error');
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await remove(ref(db, `categorias_despesa/${id}`));
      } catch (e: any) {
        showToast('Erro ao excluir categoria: ' + e.message, 'error');
      }
    }
  };

  const excluir = async (caminho: string) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) await remove(ref(db, caminho));
  };


  const formatarMoeda = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const formatarData = (d: string) => { const [ano, mes, dia] = d.split('-'); return `${dia}/${mes}/${ano}`; };
  const hoje = new Date().toISOString().split('T')[0];


  const renderDashboard = () => {
    const pagarPendente = contasPagar.filter(c => c.status === 'Pendente').reduce((acc, c) => acc + c.valor, 0);
    const pagarPago = contasPagar.filter(c => c.status === 'Pago').reduce((acc, c) => acc + c.valor, 0);
    const receberPendente = contasReceber.filter(c => c.status === 'Pendente').reduce((acc, c) => acc + c.valor, 0);
    
    const totalVendasPDV = historicoVendas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    const receberRecebido = contasReceber.filter(c => c.status === 'Recebido').reduce((acc, c) => acc + c.valor, 0) + totalVendasPDV;

    const totalPagarGeral = contasPagar.reduce((a,b) => a + b.valor, 0);
    const categoriasUsadas = categoriasDespesa.map(cat => ({
      ...cat,
      total: contasPagar.filter(c => c.tipo === cat.nome).reduce((a,b)=>a+b.valor,0)
    })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

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
            <p className="text-sm font-bold text-gray-500 flex items-center"><CheckCircle size={16} className="mr-2 text-green-500"/> Receita Total (PDV + Lançamentos)</p>
            <h4 className="text-2xl font-black text-green-600 mt-2" title={`R$ ${totalVendasPDV.toFixed(2).replace('.', ',')} originados do PDV`}>{formatarMoeda(receberRecebido)}</h4>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><PieChart size={20} className="mr-2 text-indigo-500"/> Gastos por Categoria (A Pagar)</h3>
           {categoriasUsadas.length > 0 ? (
             <div className="space-y-4">
               {categoriasUsadas.map(cat => {
                 const percent = totalPagarGeral > 0 ? (cat.total / totalPagarGeral) * 100 : 0;
                 return (
                   <div key={cat.id}>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="font-bold text-gray-700">{cat.nome}</span>
                       <span className="text-gray-500 font-medium">{formatarMoeda(cat.total)} <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 ml-1">{percent.toFixed(1)}%</span></span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-2">
                       <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
                     </div>
                   </div>
                 )
               })}
             </div>
           ) : (
             <p className="text-sm text-gray-400">Nenhum gasto categorizado no momento.</p>
           )}
        </div>
      </div>
    );
  };

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
      const t = tarefas.filter(c => c.dataAgendada === dateStr);
      return { p, r, t };
    };

    const selectedEvents = selectedDate ? eventosDoDia(selectedDate) : { p: [], r: [], t: [] as any[] };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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
              const { p, r, t } = eventosDoDia(date);
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
                    {t.length > 0 && <span className="text-[9px] sm:text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium truncate" title={`${t.length} tarefas`}>{t.length} tarefas</span>}
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
                      <div className="flex space-x-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); setItemEdit(c); setModalAberto('pagar'); }} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md bg-white border border-blue-100 shadow-sm"><Pencil size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); excluir(`contas_pagar/${c.id}`); }} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md bg-white border border-red-100 shadow-sm"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedEvents.r.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-center"><TrendingUp size={16} className="text-blue-500 mr-2"/><span className="font-bold text-gray-800 text-sm">{c.descricao}</span></div>
                    <div className="text-right flex items-center space-x-3">
                      <span className="font-bold text-blue-600 text-sm">{formatarMoeda(c.valor)}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c.status === 'Recebido' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{c.status}</span>
                      <div className="flex space-x-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); setItemEdit(c); setModalAberto('receber'); }} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md bg-white border border-blue-100 shadow-sm"><Pencil size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); excluir(`contas_receber/${c.id}`); }} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md bg-white border border-red-100 shadow-sm"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedEvents.t.map((tar: any) => (
                  <div key={tar.id} className={`flex justify-between items-center p-3 border rounded-lg ${tar.status === 'concluida' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-purple-50 border-purple-100'}`}>
                    <div className="flex items-center"><CheckSquare size={16} className={`${tar.status === 'concluida' ? 'text-gray-400' : 'text-purple-500'} mr-2 min-w-4`}/>
                      <div>
                        <span className={`font-bold text-sm ${tar.status === 'concluida' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{tar.titulo}</span>
                        {tar.recorrencia && tar.recorrencia !== 'Nenhuma' && <span className="ml-2 text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full"><Repeat size={10} className="inline mr-1"/>{tar.recorrencia}{tar.fimRecorrencia ? ` até ${formatarData(tar.fimRecorrencia)}` : ''}</span>}
                        {tar.horaAgendada && <span className="text-xs font-bold text-purple-600 ml-2 bg-purple-100 px-1.5 py-0.5 rounded">{tar.horaAgendada}</span>}
                        {tar.descricao && <p className="text-xs text-gray-600 mt-1 line-clamp-1">{tar.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => { window.location.hash = 'tarefas'; }} className="text-blue-500 hover:text-blue-700 bg-white p-1.5 rounded-md shadow-sm border border-blue-100" title="Ver nas Tarefas"><CheckSquare size={16}/></button>
                      <button onClick={() => excluir(`tarefas/${tar.id}`)} className="text-red-500 hover:text-red-700 bg-white p-1.5 rounded-md shadow-sm border border-red-100" title="Excluir"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {selectedEvents.p.length === 0 && selectedEvents.r.length === 0 && selectedEvents.t.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">Nenhum evento programado para este dia.</p>
                )}
              </div>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-300">
      {activeTab === 'dashboard_fin' && renderDashboard()}
      {activeTab === 'fornecedores' && <TabFornecedores fornecedores={fornecedores} loading={loading} showToast={showToast} excluir={excluir} />}
      
      {activeTab === 'calendario' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setModalAberto('pagar')} className="bg-red-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors shadow-sm flex items-center"><TrendingDown size={18} className="mr-2"/> Lançar Despesa (A Pagar)</button>
            <button onClick={() => setModalAberto('receber')} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm flex items-center"><TrendingUp size={18} className="mr-2"/> Lançar Receita (A Receber)</button>
            <button onClick={() => { window.location.hash = 'tarefas'; setTimeout(() => window.dispatchEvent(new CustomEvent('openNewTask')), 150); }} className="bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors shadow-sm flex items-center"><CheckSquare size={18} className="mr-2"/> Nova Tarefa</button>
            <button onClick={() => setShowIaModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-sm flex items-center"><Sparkles size={18} className="mr-2"/> Assistente IA</button>
          </div>
          {renderCalendario()}
        </div>
      )}

      <ModalContas
        isOpen={modalAberto === 'pagar' || modalAberto === 'receber'}
        onClose={resetForms}
        tipoConta={modalAberto as 'pagar' | 'receber'}
        contas={modalAberto === 'pagar' ? contasPagar : contasReceber}
        categoriasDespesa={categoriasDespesa}
        fornecedores={fornecedores}
        funcionarios={funcionarios}
        currentUser={currentUser}
        onManageCategorias={() => setShowCategoriasModal(true)}
        showToast={showToast}
        excluir={excluir}
        itemEdit={itemEdit}
        setItemEdit={setItemEdit}
        loading={loading}
      />

      {showCategoriasModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Tipos de Despesa</h3>
              <button onClick={() => setShowCategoriasModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={novaCategoriaForm} onChange={e => setNovaCategoriaForm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategoria()} placeholder="Ex: Impostos, Folha..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm" />
              <button onClick={handleAddCategoria} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors text-sm">Adicionar</button>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {categoriasDespesa.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
                  {editCategoriaId === c.id ? (
                    <div className="flex w-full space-x-2">
                      <input type="text" value={editCategoriaNome} onChange={e => setEditCategoriaNome(e.target.value)} className="flex-1 p-1 border border-red-300 rounded outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white" autoFocus />
                      <button onClick={handleSaveEditCategoria} className="text-green-600 hover:bg-green-50 px-2 rounded font-bold text-sm">Salvar</button>
                      <button onClick={() => setEditCategoriaId(null)} className="text-gray-500 hover:bg-gray-100 px-2 rounded font-bold text-sm">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-700">{c.nome}</span>
                      <div className="flex space-x-1">
                        <button onClick={() => handleEditCategoria(c)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Pencil size={16}/></button>
                        <button onClick={() => handleDeleteCategoria(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {categoriasDespesa.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhum tipo cadastrado.</p>}
            </div>
          </div>
        </div>
      )}

      {showIaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800 flex items-center"><Bot size={20} className="mr-2 text-indigo-600"/> Lançamento Inteligente</h3>
              <button onClick={() => setShowIaModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="bg-indigo-50 p-3 rounded border border-indigo-100 shadow-sm text-xs text-indigo-800">
              <p>Descreva os pagamentos ou recebimentos e a IA organizará tudo no calendário. Exemplo:</p>
              <p className="font-mono mt-1">"Comprei 150 de insumos e já paguei. Tem 200 de luz para pagar amanhã. Recebi 300 de ifood hoje."</p>
            </div>
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Descreva seus lançamentos aqui..."
              className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[120px] resize-y bg-gray-50"
            />
            <button onClick={handleCadastroIA} disabled={isGenerating} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70">
              {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Analisando...</> : <><Sparkles size={18} className="mr-2"/> Lançar Contas Automaticamente</>}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} /><span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}