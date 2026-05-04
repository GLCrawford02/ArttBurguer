import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario } from '../types';
import { CheckSquare, Calendar, Clock, User, Plus, Trash2, CheckCircle, AlertTriangle, Check, X } from 'lucide-react';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  responsavelId: string;
  dataAgendada: string;
  horaAgendada: string;
  status: 'pendente' | 'concluida';
  timestamp: number;
  notificadoWhatsApp?: boolean;
}

export default function TarefasManager() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Buscar Funcionários
    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        setFuncionarios(list.filter(f => f.ativo !== false)); // Apenas ativos
      }
    });

    // Buscar Tarefas
    const tarefasRef = ref(db, 'tarefas');
    const unsubTarefas = onValue(tarefasRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        // Ordenar por data e hora mais próxima
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
    if (!titulo || !responsavelId || !dataAgendada || !horaAgendada) {
      showToast('Preencha título, responsável, data e hora.', 'error');
      return;
    }

    try {
      await set(push(ref(db, 'tarefas')), {
        titulo,
        descricao,
        responsavelId,
        dataAgendada,
        horaAgendada,
        status: 'pendente',
        notificadoWhatsApp: false, // Preparação para a API do Zap
        timestamp: Date.now()
      });
      
      showToast('Tarefa delegada com sucesso!', 'success');
      setTitulo(''); setDescricao(''); setResponsavelId(''); setDataAgendada(''); setHoraAgendada('');
      setShowForm(false);
    } catch (error: any) {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  };

  const toggleStatus = async (tarefa: Tarefa) => {
    const novoStatus = tarefa.status === 'pendente' ? 'concluida' : 'pendente';
    await update(ref(db, `tarefas/${tarefa.id}`), { status: novoStatus });
  };

  const excluirTarefa = async (id: string) => {
    if (confirm('Deseja excluir esta tarefa?')) {
      await remove(ref(db, `tarefas/${id}`));
      showToast('Tarefa excluída', 'success');
    }
  };

  const pendentes = tarefas.filter(t => t.status === 'pendente');
  const concluidas = tarefas.filter(t => t.status === 'concluida');

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

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Nova Delegação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Título da Tarefa</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="Ex: Limpar a coifa e chapa" />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><User size={14} className="mr-1"/> Responsável</label>
              <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white">
                <option value="">Selecione quem vai fazer...</option>
                {funcionarios.map(f => (<option key={f.id} value={f.id}>{f.nome} - {Array.isArray(f.cargo) ? f.cargo[0] : f.cargo}</option>))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Calendar size={14} className="mr-1"/> Data</label>
                <input type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Clock size={14} className="mr-1"/> Hora Limite</label>
                <input type="time" value={horaAgendada} onChange={e => setHoraAgendada(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendentes */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700 border-b-2 border-orange-200 pb-2">Pendentes ({pendentes.length})</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {pendentes.map(tarefa => {
              const resp = funcionarios.find(f => f.id === tarefa.responsavelId);
              return (
                <div key={tarefa.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-orange-400">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900">{tarefa.titulo}</h4>
                    <div className="flex space-x-2">
                      <button onClick={() => toggleStatus(tarefa)} className="p-1.5 bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 rounded transition-colors" title="Marcar como concluída"><Check size={18} /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  {tarefa.descricao && <p className="text-sm text-gray-500 mt-1">{tarefa.descricao}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center"><User size={12} className="mr-1"/> {resp?.nome || 'Desconhecido'}</span>
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
              const resp = funcionarios.find(f => f.id === tarefa.responsavelId);
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
                    <span className="flex items-center"><User size={12} className="mr-1"/> {resp?.nome || 'Desconhecido'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}