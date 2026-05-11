import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario } from '../types';
import { CheckSquare, Calendar, Clock, Plus, Trash2, CheckCircle, AlertTriangle, Check, X, BarChart2, Flag, Tags, RotateCw, Users, Link as LinkIcon, Bell, AlertCircle, Pencil, Search } from 'lucide-react';

export interface Tarefa {
  id: string;
  codigo?: string;
  titulo: string;
  descricao: string;
  url?: string;
  responsavelId?: string; 
  responsaveisIds?: string[]; 
  dataAgendada: string;
  horaAgendada: string;
  urgente?: boolean;
  status: 'pendente' | 'concluida';
  timestamp: number;
  dataConclusao?: number;
  notificadoWhatsApp?: boolean;
  notificadoAntecipado?: boolean;
  prioridade?: 'Nenhuma' | 'Baixa' | 'Média' | 'Alta';
  sinalizado?: boolean;
  categoria?: string;
  recorrencia?: 'Nenhuma' | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Anual' | 'Personalizado';
  recorrenciaCustomValor?: number;
  recorrenciaCustomUnidade?: 'dia' | 'semana' | 'mes' | 'ano';
  terminarRepeticao?: 'nunca' | 'em_data';
  dataFimRepeticao?: string;
  lembreteAntecipado?: number; // minutos
  criadoPor?: string | null;
}

export default function TarefasManager({ currentUser }: { currentUser?: any }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  
  const [activeTab, setActiveTab] = useState<'lista' | 'produtividade'>('lista');
  
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [url, setUrl] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<'Nenhuma' | 'Baixa' | 'Média' | 'Alta'>('Nenhuma');
  const [sinalizado, setSinalizado] = useState(false);
  const [categoria, setCategoria] = useState('Limpeza');
  const [searchCategoria, setSearchCategoria] = useState('Limpeza');
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [categoriasDb, setCategoriasDb] = useState<{id: string, nome: string}[]>([]);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [novaCategoriaForm, setNovaCategoriaForm] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState<string | null>(null);
  const [editCategoriaNome, setEditCategoriaNome] = useState('');
  const [recorrencia, setRecorrencia] = useState<'Nenhuma' | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Anual' | 'Personalizado'>('Nenhuma');
  const [recorrenciaCustomValor, setRecorrenciaCustomValor] = useState(1);
  const [recorrenciaCustomUnidade, setRecorrenciaCustomUnidade] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia');
  const [terminarRepeticao, setTerminarRepeticao] = useState<'nunca' | 'em_data'>('nunca');
  const [dataFimRepeticao, setDataFimRepeticao] = useState('');
  const [lembreteAntecipado, setLembreteAntecipado] = useState<number>(0);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [selectedTask, setSelectedTask] = useState<Tarefa | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => {
          const cargoA = Array.isArray(a.cargo) ? a.cargo[0] || 'Atendente' : a.cargo || 'Atendente';
          const cargoB = Array.isArray(b.cargo) ? b.cargo[0] || 'Atendente' : b.cargo || 'Atendente';
          const cargoCompare = cargoA.localeCompare(cargoB);
          if (cargoCompare !== 0) return cargoCompare;
          return (a.nome || '').localeCompare(b.nome || '');
        });
        setFuncionarios(list.filter(f => f.ativo !== false)); // Apenas ativos
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

    const categoriasRef = ref(db, 'configuracoes/categorias_tarefas');
    let isFirstLoadCat = true;
    const unsubCategorias = onValue(categoriasRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, nome: val.nome }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCategoriasDb(list);
      } else {
        setCategoriasDb([]);
        if (isFirstLoadCat) {
          const defaults = ['Limpeza', 'Auditoria', 'Produção', 'Financeiro', 'Outros'];
          defaults.forEach(nome => push(ref(db, 'configuracoes/categorias_tarefas'), { nome }));
        }
      }
      isFirstLoadCat = false;
    });

    return () => { unsubFunc(); unsubTarefas(); unsubCategorias(); };
  }, []);

  useEffect(() => {
    const handleOpenNew = () => { resetForm(); setShowForm(true); };
    window.addEventListener('openNewTask', handleOpenNew);
    return () => window.removeEventListener('openNewTask', handleOpenNew);
  }, []);

  const handleAddCategoria = async () => {
    if (!novaCategoriaForm.trim()) return;
    await set(push(ref(db, 'configuracoes/categorias_tarefas')), { nome: novaCategoriaForm.trim() });
    setNovaCategoriaForm('');
  };

  const handleDeleteCategoria = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria? As tarefas que usam ela manterão o nome, mas ela sairá da lista.')) {
      await remove(ref(db, `configuracoes/categorias_tarefas/${id}`));
    }
  };

  const handleEditCategoria = (c: {id: string, nome: string}) => {
    setEditCategoriaId(c.id);
    setEditCategoriaNome(c.nome);
  };

  const handleSaveEditCategoria = async () => {
    if (!editCategoriaId || !editCategoriaNome.trim()) return;
    const oldCat = categoriasDb.find(c => c.id === editCategoriaId);
    await update(ref(db, `configuracoes/categorias_tarefas/${editCategoriaId}`), { nome: editCategoriaNome.trim() });
    
    if (oldCat && oldCat.nome !== editCategoriaNome.trim()) {
      for (const t of tarefas) {
        if (t.categoria === oldCat.nome) await update(ref(db, `tarefas/${t.id}`), { categoria: editCategoriaNome.trim() });
      }
    }
    setEditCategoriaId(null);
    setEditCategoriaNome('');
  };

  const resetForm = () => {
    setEditId(null);
    setTitulo(''); setDescricao(''); setUrl(''); setResponsaveisIds([]); setDataAgendada(''); setHoraAgendada('');
    setUrgente(false); setSinalizado(false); setPrioridade('Nenhuma'); setCategoria('Limpeza');
    setSearchCategoria('Limpeza');
    setRecorrencia('Nenhuma'); setRecorrenciaCustomValor(1); setRecorrenciaCustomUnidade('dia');
    setTerminarRepeticao('nunca'); setDataFimRepeticao(''); setLembreteAntecipado(0);
    setShowForm(false);
  };

  const salvarTarefa = async () => {
    if (!titulo || responsaveisIds.length === 0) {
      showToast('Preencha título e selecione pelo menos um responsável.', 'error');
      return;
    }

    const tarefaData = {
      titulo,
      descricao,
      url,
      responsaveisIds,
      responsavelId: responsaveisIds[0] || null, // Fallback para não quebrar o script legado de WhatsApp
      dataAgendada,
      horaAgendada,
      urgente,
      prioridade,
      sinalizado,
      categoria,
      recorrencia,
      recorrenciaCustomValor,
      recorrenciaCustomUnidade,
      terminarRepeticao,
      dataFimRepeticao,
      lembreteAntecipado,
      criadoPor: currentUser?.id || null,
    };

    try {
      if (editId) {
        await update(ref(db, `tarefas/${editId}`), tarefaData);
        showToast('Tarefa atualizada com sucesso!', 'success');
      } else {
        await set(push(ref(db, 'tarefas')), {
          ...tarefaData,
          codigo: Math.floor(1000 + Math.random() * 9000).toString(),
          status: 'pendente',
          notificadoWhatsApp: false, // Preparação para a API do Zap
          notificadoAntecipado: false,
          timestamp: Date.now()
        });
        showToast('Tarefa delegada com sucesso!', 'success');
      }
      
      resetForm();
    } catch (error: any) {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
  };

  const editarTarefa = (tarefa: Tarefa) => {
    setEditId(tarefa.id);
    setTitulo(tarefa.titulo || '');
    setDescricao(tarefa.descricao || '');
    setUrl(tarefa.url || '');
    setDataAgendada(tarefa.dataAgendada || '');
    setHoraAgendada(tarefa.horaAgendada || '');
    setUrgente(tarefa.urgente || false);
    setResponsaveisIds(tarefa.responsaveisIds || (tarefa.responsavelId ? [tarefa.responsavelId] : []));
    setPrioridade(tarefa.prioridade || 'Nenhuma');
    setSinalizado(tarefa.sinalizado || false);
    setCategoria(tarefa.categoria || 'Limpeza');
    setSearchCategoria(tarefa.categoria || 'Limpeza');
    setRecorrencia(tarefa.recorrencia || 'Nenhuma');
    setRecorrenciaCustomValor(tarefa.recorrenciaCustomValor || 1);
    setRecorrenciaCustomUnidade(tarefa.recorrenciaCustomUnidade || 'dia');
    setTerminarRepeticao(tarefa.terminarRepeticao || 'nunca');
    setDataFimRepeticao(tarefa.dataFimRepeticao || '');
    setLembreteAntecipado(tarefa.lembreteAntecipado || 0);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleStatus = async (tarefa: Tarefa) => {
    const novoStatus = tarefa.status === 'pendente' ? 'concluida' : 'pendente';
    
    const updates: any = { status: novoStatus };
    if (novoStatus === 'concluida') updates.dataConclusao = Date.now();
    else updates.dataConclusao = null;

    await update(ref(db, `tarefas/${tarefa.id}`), updates);
    
    // Lógica de Recorrência
    if (novoStatus === 'concluida' && tarefa.recorrencia && tarefa.recorrencia !== 'Nenhuma') {
      const d = new Date(`${tarefa.dataAgendada}T12:00:00`); // 12h para evitar fuso horário
      
      if (tarefa.recorrencia === 'Diária') d.setDate(d.getDate() + 1);
      else if (tarefa.recorrencia === 'Semanal') d.setDate(d.getDate() + 7);
      else if (tarefa.recorrencia === 'Quinzenal') d.setDate(d.getDate() + 14);
      else if (tarefa.recorrencia === 'Mensal') d.setMonth(d.getMonth() + 1);
      else if (tarefa.recorrencia === 'Anual') d.setFullYear(d.getFullYear() + 1);
      else if (tarefa.recorrencia === 'Personalizado') {
        const v = tarefa.recorrenciaCustomValor || 1;
        const u = tarefa.recorrenciaCustomUnidade || 'dia';
        if (u === 'dia') d.setDate(d.getDate() + v);
        else if (u === 'semana') d.setDate(d.getDate() + (v * 7));
        else if (u === 'mes') d.setMonth(d.getMonth() + v);
        else if (u === 'ano') d.setFullYear(d.getFullYear() + v);
      }
      
      const nextDateStr = d.toISOString().split('T')[0];
      
      let recreate = true;
      if (tarefa.terminarRepeticao === 'em_data' && tarefa.dataFimRepeticao) {
        if (nextDateStr > tarefa.dataFimRepeticao) recreate = false;
      }

      if (recreate) {
        const novaTarefa = { ...tarefa };
        delete (novaTarefa as any).id;
        delete novaTarefa.dataConclusao;
        novaTarefa.codigo = Math.floor(1000 + Math.random() * 9000).toString();
        novaTarefa.status = 'pendente';
        novaTarefa.dataAgendada = nextDateStr;
        novaTarefa.notificadoWhatsApp = false;
        novaTarefa.notificadoAntecipado = false;
        novaTarefa.criadoPor = tarefa.criadoPor || null;
        novaTarefa.timestamp = Date.now();
        
        await set(push(ref(db, 'tarefas')), novaTarefa);
        showToast(`Próxima recorrência agendada automaticamente para ${nextDateStr.split('-').reverse().join('/')}`, 'success');
      }
    }
  };

  const excluirTarefa = async (id: string) => {
    if (confirm('Deseja excluir esta tarefa?')) {
      await remove(ref(db, `tarefas/${id}`));
      showToast('Tarefa excluída', 'success');
    }
  };

  const isGlobalViewer = currentUser && (
    Array.isArray(currentUser.cargo) 
      ? currentUser.cargo.some((c: string) => ['Administrador', 'Dono', 'TI'].includes(c)) 
      : ['Administrador', 'Dono', 'TI'].includes(currentUser.cargo as string)
  );

  const tarefasVisiveis = tarefas.filter(t => {
    if (isGlobalViewer) return true;
    if (t.criadoPor === currentUser?.id) return true;
    if (t.responsaveisIds?.includes(currentUser?.id)) return true;
    if (t.responsavelId === currentUser?.id) return true;
    return false;
  });

  const pendentes = tarefasVisiveis.filter(t => t.status === 'pendente');
  const concluidas = tarefasVisiveis.filter(t => t.status === 'concluida');

  // Calculo de Produtividade
  const userStats = funcionarios.map(f => {
    const userTasks = tarefasVisiveis.filter(t => (t.responsaveisIds && t.responsaveisIds.includes(f.id)) || t.responsavelId === f.id);
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
        <button onClick={() => showForm ? resetForm() : setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center">
          {showForm ? <><X size={20} className="mr-2" /> Cancelar</> : <><Plus size={20} className="mr-2" /> Nova Task</>}
        </button>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('lista')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Quadro de Tarefas</button>
        <button onClick={() => setActiveTab('produtividade')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'produtividade' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Produtividade e Relatório</button>
      </div>

      {showForm && (
        <div className="bg-gray-100 p-4 sm:p-6 rounded-2xl shadow-inner space-y-6 animate-in slide-in-from-top-4">
          
          {/* 1. Cartão Principal: Titulo, Notas, URL */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full p-3 outline-none font-bold text-gray-800 placeholder-gray-400" placeholder="Título" autoFocus />
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full p-3 outline-none text-gray-600 text-sm placeholder-gray-400 min-h-[80px] resize-none" placeholder="Notas" />
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-3 outline-none text-blue-500 text-sm placeholder-gray-400" placeholder="URL" />
          </div>

          {/* 2. Responsáveis */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Responsáveis</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {funcionarios.map(f => (
                <label key={f.id} className="flex items-center space-x-3 cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                  <input type="checkbox" checked={responsaveisIds.includes(f.id)} onChange={e => {
                    if (e.target.checked) setResponsaveisIds([...responsaveisIds, f.id]);
                    else setResponsaveisIds(responsaveisIds.filter(id => id !== f.id));
                  }} className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-gray-700">{f.nome} <span className="text-xs text-gray-400">({Array.isArray(f.cargo) ? f.cargo[0] : f.cargo})</span></span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Data e Hora */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Data e Hora</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} className="w-full pl-10 p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="time" value={horaAgendada} onChange={e => setHoraAgendada(e.target.value)} className="w-full pl-10 p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <label className="flex items-center space-x-2 mt-3 cursor-pointer p-2 bg-red-50 rounded-lg border border-red-100 w-fit">
              <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} className="w-4 h-4 rounded text-red-500 focus:ring-red-500" />
              <span className="text-sm font-bold text-red-700 flex items-center"><AlertCircle size={16} className="mr-1"/> Urgente (Alarme)</span>
            </label>
          </div>

          {/* 4. Mais opções */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Mais Opções</h4>
            <div className="space-y-1">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-bold text-gray-500 flex items-center"><Tags size={14} className="mr-1"/> Categoria</label>
                <button type="button" onClick={() => setShowCategoriasModal(true)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase leading-none pb-0.5">Gerenciar</button>
              </div>
              <div className="relative w-full">
                <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                  <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                  <input 
                    type="text" 
                    value={searchCategoria} 
                    onChange={e => { setSearchCategoria(e.target.value); setCategoria(e.target.value); setShowCategoriaDropdown(true); }}
                    onFocus={() => setShowCategoriaDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCategoriaDropdown(false), 200)}
                    className="w-full p-2.5 outline-none rounded-lg text-sm bg-transparent font-medium"
                    placeholder="Buscar ou digitar..."
                  />
                </div>
                {showCategoriaDropdown && categoriasDb.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {categoriasDb.filter(c => c.nome.toLowerCase().includes(searchCategoria.toLowerCase())).map(c => (
                      <div key={c.id} onClick={() => { setCategoria(c.nome); setSearchCategoria(c.nome); setShowCategoriaDropdown(false); }} className="p-2 text-sm hover:bg-indigo-50 cursor-pointer border-b border-gray-50"><span className="font-medium text-gray-800">{c.nome}</span></div>
                    ))}
                    {categoriasDb.filter(c => c.nome.toLowerCase().includes(searchCategoria.toLowerCase())).length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhuma categoria encontrada</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Detalhes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Detalhes</h4>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Organização</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center space-x-2 cursor-pointer p-2 rounded-lg border transition-colors ${sinalizado ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  <input type="checkbox" checked={sinalizado} onChange={e => setSinalizado(e.target.checked)} className="hidden" />
                  <Flag size={16} className={sinalizado ? 'text-orange-500 fill-orange-500' : 'text-gray-400'} />
                  <span className={`text-sm font-bold ${sinalizado ? 'text-orange-700' : 'text-gray-600'}`}>Sinalizar</span>
                </label>
                
                <select value={prioridade} onChange={e => setPrioridade(e.target.value as any)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 font-medium text-center appearance-none">
                  <option value="Nenhuma">Prioridade: Nenhuma</option>
                  <option value="Baixa">🟢 Prioridade: Baixa</option>
                  <option value="Média">🟡 Prioridade: Média</option>
                  <option value="Alta">🔴 Prioridade: Alta</option>
                </select>
              </div>
              </div>

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><RotateCw size={14} className="mr-1"/> Repetição</label>
                <select value={recorrencia} onChange={e => setRecorrencia(e.target.value as any)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 font-medium">
                  <option value="Nenhuma">Nunca</option><option value="Diária">Diária</option><option value="Semanal">Semanal</option><option value="Quinzenal">Quinzenal</option><option value="Mensal">Mensal</option><option value="Anual">Anual</option><option value="Personalizado">Personalizado...</option>
                </select>
              </div>

              {recorrencia === 'Personalizado' && (
                <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                  <span className="text-sm font-medium text-indigo-800 ml-1">A cada</span>
                  <input type="number" min="1" value={recorrenciaCustomValor} onChange={e => setRecorrenciaCustomValor(Number(e.target.value))} className="w-16 p-1.5 text-center border border-indigo-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                  <select value={recorrenciaCustomUnidade} onChange={e => setRecorrenciaCustomUnidade(e.target.value as any)} className="flex-1 p-1.5 border border-indigo-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="dia">dia(s)</option><option value="semana">semana(s)</option><option value="mes">mês(es)</option><option value="ano">ano(s)</option>
                  </select>
                </div>
              )}

              {recorrencia !== 'Nenhuma' && (
                <div className="space-y-1 mt-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Terminar repetição</label>
                  <div className="flex gap-2">
                    <select value={terminarRepeticao} onChange={e => setTerminarRepeticao(e.target.value as any)} className="flex-1 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50">
                      <option value="nunca">Nunca</option><option value="em_data">Em Data</option>
                    </select>
                    {terminarRepeticao === 'em_data' && (
                      <input type="date" value={dataFimRepeticao} onChange={e => setDataFimRepeticao(e.target.value)} className="flex-1 p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center"><Bell size={14} className="mr-1"/> Lembrete Antecipado (WhatsApp)</label>
                <select value={lembreteAntecipado} onChange={e => setLembreteAntecipado(Number(e.target.value))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 font-medium">
                  <option value={0}>Nenhum</option><option value={5}>5 minutos antes</option><option value={10}>10 minutos antes</option><option value={15}>15 minutos antes</option><option value={30}>30 minutos antes</option><option value={60}>1 hora antes</option><option value={120}>2 horas antes</option><option value={1440}>1 dia antes</option>
                </select>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button onClick={salvarTarefa} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm">{editId ? 'Atualizar Tarefa' : 'Adicionar Tarefa'}</button>
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
                      <h4 className="font-bold text-gray-900 leading-tight flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setSelectedTask(tarefa)}>
                        {tarefa.sinalizado && <Flag size={14} className="text-orange-500 fill-orange-500 shrink-0" />}
                        {tarefa.codigo && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-200 shrink-0">#{tarefa.codigo}</span>}
                        {tarefa.titulo}
                      </h4>
                      <div className="flex gap-2 mt-1.5 mb-2">
                        {tarefa.prioridade && tarefa.prioridade !== 'Nenhuma' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPrioColor(tarefa.prioridade)}`}>{tarefa.prioridade}</span>}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-gray-100 text-gray-600">{tarefa.categoria || 'Geral'}</span>
                        {tarefa.recorrencia && tarefa.recorrencia !== 'Nenhuma' && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-50 text-blue-600 flex items-center"><RotateCw size={10} className="mr-1"/> {tarefa.recorrencia}</span>}
                      </div>
                      {tarefa.descricao && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{tarefa.descricao}</p>}
                      {tarefa.url && <a href={tarefa.url.startsWith('http') ? tarefa.url : `https://${tarefa.url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 flex items-center"><LinkIcon size={12} className="mr-1"/> Acessar Link</a>}
                    </div>
                    <div className="flex space-x-1 sm:space-x-2 shrink-0">
                      <button onClick={() => toggleStatus(tarefa)} className="p-1.5 bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600 rounded transition-colors" title="Marcar como concluída"><Check size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                      <button onClick={() => editarTarefa(tarefa)} className="p-1.5 bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Editar tarefa"><Pencil size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded transition-colors" title="Excluir tarefa"><Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded flex items-center"><Users size={12} className="mr-1"/> {respNomes}</span>
                    <span className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded flex items-center"><Clock size={12} className="mr-1"/> {tarefa.dataAgendada ? tarefa.dataAgendada.split('-').reverse().join('/') : 'S/ Data'} às {tarefa.horaAgendada || 'S/ Hora'}</span>
                    {tarefa.urgente && <span className="bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded flex items-center"><AlertCircle size={12} className="mr-1"/> Urgente</span>}
                    {tarefa.lembreteAntecipado ? <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-1 rounded flex items-center" title={`${tarefa.lembreteAntecipado}min antes`}><Bell size={12} className="mr-1"/> Lembrete</span> : null}
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
                    <h4 className="font-bold text-gray-600 line-through flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setSelectedTask(tarefa)}>
                      {tarefa.codigo && <span className="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-200 shrink-0">#{tarefa.codigo}</span>}
                      {tarefa.titulo}
                    </h4>
                    <div className="flex space-x-1 sm:space-x-2 shrink-0">
                      <button onClick={() => toggleStatus(tarefa)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-green-600 rounded transition-colors" title="Voltar para pendente"><CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                      <button onClick={() => excluirTarefa(tarefa.id)} className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded transition-colors" title="Excluir tarefa"><Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
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

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {selectedTask.sinalizado && <Flag size={18} className="text-orange-500 fill-orange-500" />}
                  {selectedTask.codigo && <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm font-mono border border-gray-300">#{selectedTask.codigo}</span>}
                  {selectedTask.titulo}
                </h3>
                <div className="flex gap-2 mt-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded border ${selectedTask.status === 'concluida' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {selectedTask.status === 'concluida' ? 'Concluída' : 'Pendente'}
                  </span>
                  {selectedTask.prioridade && selectedTask.prioridade !== 'Nenhuma' && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded border ${getPrioColor(selectedTask.prioridade)}`}>{selectedTask.prioridade}</span>
                  )}
                  <span className="text-xs font-bold px-2.5 py-1 rounded border bg-gray-100 text-gray-600">{selectedTask.categoria || 'Geral'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedTask.descricao && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Descrição</h4>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">{selectedTask.descricao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Agendamento</h4>
                  <div className="bg-orange-50 text-orange-700 p-3 rounded-lg border border-orange-100 flex flex-col gap-1 text-sm">
                    <span className="font-bold flex items-center"><Calendar size={14} className="mr-1.5"/> {selectedTask.dataAgendada ? selectedTask.dataAgendada.split('-').reverse().join('/') : 'Sem data'}</span>
                    <span className="font-bold flex items-center"><Clock size={14} className="mr-1.5"/> {selectedTask.horaAgendada || 'Sem hora'}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Repetição</h4>
                  <div className="bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-100 flex flex-col gap-1 text-sm h-full justify-center">
                    <span className="font-bold flex items-center"><RotateCw size={14} className="mr-1.5"/> {selectedTask.recorrencia && selectedTask.recorrencia !== 'Nenhuma' ? selectedTask.recorrencia : 'Apenas uma vez'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Responsáveis</h4>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const ids = selectedTask.responsaveisIds || (selectedTask.responsavelId ? [selectedTask.responsavelId] : []);
                    if (ids.length === 0) return <span className="text-sm text-gray-500">Nenhum responsável.</span>;
                    return ids.map(id => {
                      const func = funcionarios.find(f => f.id === id);
                      return (
                        <span key={id} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center border border-gray-200">
                          <Users size={14} className="mr-1.5 text-gray-500"/>
                          {func ? func.nome : 'Desconhecido'}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              {selectedTask.url && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Link Anexo</h4>
                  <a href={selectedTask.url.startsWith('http') ? selectedTask.url : `https://${selectedTask.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-3 rounded-lg flex items-center text-sm font-bold transition-colors break-all border border-blue-100">
                    <LinkIcon size={16} className="mr-2 shrink-0"/> {selectedTask.url}
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between">
               <button onClick={() => { setSelectedTask(null); editarTarefa(selectedTask); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center transition-colors">
                 <Pencil size={16} className="mr-2" /> Editar
               </button>
               <button onClick={() => { toggleStatus(selectedTask); setSelectedTask(null); }} className={`px-6 py-2 text-white rounded-lg text-sm font-bold flex items-center shadow-sm transition-colors ${selectedTask.status === 'concluida' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'}`}>
                 <CheckCircle size={16} className="mr-2" /> {selectedTask.status === 'concluida' ? 'Reabrir Tarefa' : 'Marcar como Concluída'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showCategoriasModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Categorias de Tarefas</h3>
              <button onClick={() => setShowCategoriasModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={novaCategoriaForm} onChange={e => setNovaCategoriaForm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategoria()} placeholder="Nova categoria..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button onClick={handleAddCategoria} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm">Adicionar</button>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {categoriasDb.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
                  {editCategoriaId === c.id ? (
                    <div className="flex w-full space-x-2">
                      <input type="text" value={editCategoriaNome} onChange={e => setEditCategoriaNome(e.target.value)} className="flex-1 p-1 border border-indigo-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white" autoFocus />
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
              {categoriasDb.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhuma categoria cadastrada.</p>}
            </div>
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