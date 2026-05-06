import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario } from '../types';
import { CheckSquare, Calendar, Clock, User, Plus, Trash2, CheckCircle, AlertTriangle, Check, X, BarChart2, Flag, Tags, RotateCw, Users } from 'lucide-react';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  responsavelId?: string;
  responsaveisIds?: string[];
  dataAgendada: string;
  horaAgendada: string;
  status: 'pendente' | 'concluida';
  timestamp: number;
  notificadoWhatsApp?: boolean;
  prioridade?: 'Baixa' | 'Média' | 'Alta';
  categoria?: string;
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal';
}

export default function TarefasManager() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  const [activeTab, setActiveTab] = useState<'lista' | 'produtividade'>('lista');
  
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Média' | 'Alta'>('Média');
  const [categoria, setCategoria] = useState('Limpeza');
  const [isNovaCategoria, setIsNovaCategoria] = useState(false);
  const [recorrencia, setRecorrencia] = useState<'Nenhuma' | 'Diária' | 'Semanal'>('Nenhuma');
  
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {

    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        setFuncionarios(list.filter(f => f.ativo !== false));
      }
    });


    const tarefasRef = ref(db, 'tarefas');
    const unsubTarefas = onValue(tarefasRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));

        list.sort((a, b) => {
          const dateA = new Date(`${a.dataAgendada || '1970-01-01'}T${a.horaAgendada || '00:00'}`);
          const dateB = new Date(`${b.dataAgendada || '1970-01-01'}T${b.horaAgendada || '00:00'}`);
          return dateA.getTime() - dateB.getTime();
        });
        setTarefas(list);
      } else {
        setTarefas([]);
      }
    });

    return () => { unsubFunc(); unsubTarefas(); };
  }, []);

  const salvarTarefa = async () => {
    if (!titulo || responsaveisIds.length === 0 || !dataAgendada || !horaAgendada) {
      showToast('Preencha título, selecione pelo menos um responsável, data e hora.', 'error');
      return;
    }

    try {
      await set(push(ref(db, 'tarefas')), {
        titulo,
        descricao,
        responsaveisIds,
        dataAgendada,
        horaAgendada,
        prioridade,
        categoria,
        recorrencia,
        status: 'pendente',
        notificadoWhatsApp: false,
        timestamp: Date.now()
      });
      
      showToast('Tarefa delegada com sucesso!', 'success');
      setTitulo(''); setDescricao(''); setResponsaveisIds([]); setDataAgendada(''); setHoraAgendada('');
      setCategoria('Limpeza'); setIsNovaCategoria(false);
      setShowForm(false);
    } catch (error: any) {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  };

  const toggleStatus = async (tarefa: Tarefa) => {
    const novoStatus = tarefa.status === 'pendente' ? 'concluida' : 'pendente';
    await update(ref(db, `tarefas/${tarefa.id}`), { status: novoStatus });
    

    if (novoStatus === 'concluida' && tarefa.recorrencia && tarefa.recorrencia !== 'Nenhuma') {
      const d = new Date(`${tarefa.dataAgendada}T12:00:00`);
      if (tarefa.recorrencia === 'Diária') d.setDate(d.getDate() + 1);
      else if (tarefa.recorrencia === 'Semanal') d.setDate(d.getDate() + 7);
      
      const nextDateStr = d.toISOString().split('T')[0];
      
      const novaTarefa = { ...tarefa };
      delete (novaTarefa as any).id;
      novaTarefa.status = 'pendente';
      novaTarefa.dataAgendada = nextDateStr;
      novaTarefa.notificadoWhatsApp = false;
      novaTarefa.timestamp = Date.now();
      
      await set(push(ref(db, 'tarefas')), novaTarefa);
      showToast(`Próxima recorrência agendada automaticamente para ${nextDateStr.split('-').reverse().join('/')}`, 'success');
    }
  };

  const excluirTarefa = async (id: string) => {
    if (confirm('Deseja excluir esta tarefa?')) {
      await remove(ref(db, `tarefas/${id}`));
      showToast('Tarefa excluída', 'success');
    }
  };

  const pendentes = tarefas.filter(t => t.status === 'pendente');
  const concluidas = tarefas.filter(t => t.status === 'concluida');

  // Calculo de Produtividade
  const userStats = funcionarios.map(f => {
    const userTasks = tarefas.filter(t => (t.responsaveisIds && t.responsaveisIds.includes(f.id)) || t.responsavelId === f.id);
    const pends = userTasks.filter(t => t.status === 'pendente').length;
    const concs = userTasks.filter(t => t.status === 'concluida').length;
    return { ...f, pendentes: pends, concluidas: concs, total: pends + concs };
  }).filter(f => f.total > 0).sort((a, b) => b.concluidas - a.concluidas);

  const getPrioColor = (p?: string) => {
    if (p === 'Alta') return 'bg-red-100 text-red-700 border-red-200';
    if (p === 'Média') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
            <CheckSquare size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tasks & Delegações</h2>
            <p className="text-sm text-gray-500">Programe tarefas para a equipe (Limpeza, Auditoria, Produção).</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center">
          {showForm ? <><X size={20} className="mr-2" /> Cancelar</> : <><Plus size={20} className="mr-2" /> Nova Task</>}
        </button>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('lista')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Quadro de Tarefas</button>
        <button onClick={() => setActiveTab('produtividade')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'produtividade' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Produtividade e Relatório</button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Nova Delegação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Título da Tarefa</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Ex: Limpar a coifa e chapa" />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Users size={14} className="mr-1"/> Responsáveis</label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                {funcionarios.map(f => (
                  <label key={f.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
                    <input type="checkbox" checked={responsaveisIds.includes(f.id)} onChange={e => {
                      if (e.target.checked) setResponsaveisIds([...responsaveisIds, f.id]);
                      else setResponsaveisIds(responsaveisIds.filter(id => id !== f.id));
                    }} className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">{f.nome} <span className="text-xs text-gray-400">({Array.isArray(f.cargo) ? f.cargo[0] : f.cargo})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Calendar size={14} className="mr-1"/> Data</label>
                <input type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Clock size={14} className="mr-1"/> Hora Limite</label>
                <input type="time" value={horaAgendada} onChange={e => setHoraAgendada(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:col-span-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Flag size={14} className="mr-1"/> Prioridade</label>
                <select value={prioridade} onChange={e => setPrioridade(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                  <option value="Baixa">🟢 Baixa</option><option value="Média">🟡 Média</option><option value="Alta">🔴 Alta</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Tags size={14} className="mr-1"/> Categoria</label>
                {isNovaCategoria ? (
                  <div className="flex">
                    <input autoFocus type="text" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Nome da categoria..." className="w-full p-2 border border-gray-200 rounded-l-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white" />
                    <button onClick={() => { setIsNovaCategoria(false); setCategoria('Limpeza'); }} className="bg-gray-100 hover:bg-gray-200 border border-l-0 border-gray-200 rounded-r-lg px-2 text-gray-500 transition-colors" title="Cancelar">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <select value={categoria} onChange={e => {
                    if (e.target.value === 'NOVA_CATEGORIA') { setIsNovaCategoria(true); setCategoria(''); } 
                    else { setCategoria(e.target.value); }
                  }} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                    {Array.from(new Set(['Limpeza', 'Auditoria', 'Produção', 'Outros', ...tarefas.map(t => t.categoria).filter(Boolean)])).map(c => (
                      <option key={c as string} value={c as string}>{c as string}</option>
                    ))}
                    <option value="NOVA_CATEGORIA" className="font-bold text-blue-600">+ Nova Categoria...</option>
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><RotateCw size={14} className="mr-1"/> Recorrência</label>
                <select value={recorrencia} onChange={e => setRecorrencia(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                  <option value="Nenhuma">Só uma vez</option><option value="Diária">Repetir todo dia</option><option value="Semanal">Repetir por semana</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Instruções / Descrição (Opcional)</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]" placeholder="Detalhes de como a tarefa deve ser feita..." />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={salvarTarefa} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">Delegar Tarefa</button>
          </div>
        </div>
      )}

      {activeTab === 'lista' ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendentes */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 border-b-2 border-orange-200 pb-2">Pendentes ({pendentes.length})</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {pendentes.map(tarefa => {
              const ids = tarefa.responsaveisIds || (tarefa.responsavelId ? [tarefa.responsavelId] : []);
              const respNomes = ids.map(id => funcionarios.find(f => f.id === id)?.nome?.split(' ')[0] || '?').join(', ');
              return (
                <div key={tarefa.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-orange-400">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 leading-tight">{tarefa.titulo}</h4>
                      <div className="flex gap-2 mt-1.5 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPrioColor(tarefa.prioridade)}`}>{tarefa.prioridade || 'Normal'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-gray-100 text-gray-600">{tarefa.categoria || 'Geral'}</span>
                        {tarefa.recorrencia && tarefa.recorrencia !== 'Nenhuma' && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-600 flex items-center"><RotateCw size={10} className="mr-1"/> {tarefa.recorrencia}</span>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => toggleStatus(tarefa)} className="p-1.5 bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 rounded transition-colors" title="Marcar como concluída"><Check size={18} /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  {tarefa.descricao && <p className="text-sm text-gray-500 mt-1">{tarefa.descricao}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center"><Users size={12} className="mr-1"/> {respNomes}</span>
                    <span className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded flex items-center"><Clock size={12} className="mr-1"/> {tarefa.dataAgendada ? tarefa.dataAgendada.split('-').reverse().join('/') : 'S/ Data'} às {tarefa.horaAgendada || 'S/ Hora'}</span>
                  </div>
                </div>
              );
            })}
            {pendentes.length === 0 && <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center">Nenhuma tarefa pendente.</p>}
          </div>
        </div>

        {/* Concluídas */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 border-b-2 border-green-200 pb-2">Concluídas ({concluidas.length})</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {concluidas.map(tarefa => {
              const ids = tarefa.responsaveisIds || (tarefa.responsavelId ? [tarefa.responsavelId] : []);
              const respNomes = ids.map(id => funcionarios.find(f => f.id === id)?.nome?.split(' ')[0] || '?').join(', ');
              return (
                <div key={tarefa.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 border-l-4 border-l-green-500 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-600 line-through">{tarefa.titulo}</h4>
                    <div className="flex space-x-2">
                      <button onClick={() => toggleStatus(tarefa)} className="p-1.5 text-green-600 rounded" title="Voltar para pendente"><CheckCircle size={18} /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs font-bold text-gray-400">
                    <span className="flex items-center"><Users size={12} className="mr-1"/> {respNomes}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
        /* Aba Relatório Produtividade */
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in">
          <h3 className="font-bold text-gray-800 mb-6 flex items-center"><BarChart2 className="mr-2 text-indigo-500"/> Produtividade da Equipe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {userStats.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center min-w-0 flex-1 mr-4">
                  <div className="bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 flex-shrink-0">
                    {u.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-gray-800 truncate">{u.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{Array.isArray(u.cargo) ? u.cargo[0] : u.cargo}</p>
                  </div>
                </div>
                <div className="flex space-x-4 text-center flex-shrink-0">
                  <div>
                    <p className="text-xl font-black text-orange-500 leading-none">{u.pendentes}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Faltam</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-green-500 leading-none">{u.concluidas}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Feitas</p>
                  </div>
                </div>
              </div>
            ))}
            {userStats.length === 0 && <p className="text-gray-400 italic">Nenhum dado de produtividade disponível.</p>}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}