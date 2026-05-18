import { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario } from '../types';
import { Bot, Loader2, Sparkles, Plus, Trash2, Calendar, MessageSquare, Briefcase, CheckCircle, AlertTriangle, UserCircle, Save, Plane, Clock, Power, ShieldOff, ShieldCheck, Fingerprint, MapPin } from 'lucide-react';

const validarCPF = (cpf: string): boolean => {
  let apenasNumeros = "";
  for (let i = 0; i < cpf.length; i++) {
    const charCode = cpf.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) apenasNumeros += cpf[i];
  }
  
  if (apenasNumeros.length !== 11) return false;
  
  let tudoIgual = true;
  for (let i = 1; i < 11; i++) {
    if (apenasNumeros[i] !== apenasNumeros[0]) { tudoIgual = false; break; }
  }
  if (tudoIgual) return false;

  let peso1 = 0, peso2 = 0;
  for (let i = 0; i < 9; i++) {
    const valorDigito = apenasNumeros.charCodeAt(i) - 48;
    peso1 += valorDigito * (10 - i);
    peso2 += valorDigito * (11 - i);
  }

  let digito1 = (peso1 * 10) % 11;
  if (digito1 === 10 || digito1 === 11) digito1 = 0;
  if (digito1 !== (apenasNumeros.charCodeAt(9) - 48)) return false;

  let digito2 = ((peso2 + digito1 * 2) * 10) % 11;
  if (digito2 === 10 || digito2 === 11) digito2 = 0;

  return digito2 === (apenasNumeros.charCodeAt(10) - 48);
};

export default function GestaoEquipeManager({ activeView = 'gestao' }: { activeView?: 'gestao' | 'ia' }) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [gestaoData, setGestaoData] = useState<Record<string, any>>({});
  const [selectedFuncId, setSelectedFuncId] = useState<string | null>(null);
  const [subView, setSubView] = useState<'geral' | 'horarios' | 'status'>('geral');
  const [cpf, setCpf] = useState('');
  
  const [horarios, setHorarios] = useState<Record<string, { entrada: string, saida: string }>>({
    segunda: { entrada: '', saida: '' }, terca: { entrada: '', saida: '' },
    quarta: { entrada: '', saida: '' }, quinta: { entrada: '', saida: '' },
    sexta: { entrada: '', saida: '' }, sabado: { entrada: '', saida: '' },
    domingo: { entrada: '', saida: '' },
  });
  const [novoPontoData, setNovoPontoData] = useState('');
  const [novoPontoEntrada, setNovoPontoEntrada] = useState('');
  const [novoPontoSaida, setNovoPontoSaida] = useState('');
  const [periodoFiltro, setPeriodoFiltro] = useState<'semana' | 'mes' | 'mes_anterior' | 'tudo'>('mes');

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  const [encargos, setEncargos] = useState('');
  const [novaFaltaData, setNovaFaltaData] = useState('');
  const [novaFaltaMotivo, setNovaFaltaMotivo] = useState('');
  const [novoFeedbackData, setNovoFeedbackData] = useState('');
  const [novoFeedbackTexto, setNovoFeedbackTexto] = useState('');
  const [novaFolgaDataInicio, setNovaFolgaDataInicio] = useState('');
  const [novaFolgaDataFim, setNovaFolgaDataFim] = useState('');
  const [novaFolgaMotivo, setNovaFolgaMotivo] = useState('');

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
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

    const gestaoRef = ref(db, 'gestao_equipe');
    const unsubGestao = onValue(gestaoRef, snap => {
      if (snap.val()) setGestaoData(snap.val());
      else setGestaoData({});
    });

    return () => { unsubFunc(); unsubGestao(); };
  }, []);

  const formatCpf = (v: string) => {
    if (!v) return '';
    v = v.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return v;
  };

  useEffect(() => {
    if (selectedFuncId && funcionarios.length > 0) {
      const data = gestaoData[selectedFuncId] || {};
      const func = funcionarios.find(f => f.id === selectedFuncId);
      setEncargos(data.encargos || '');
      setCpf(formatCpf(func ? (func as any).cpf || '' : ''));
      setHorarios(data.horarios || {
        segunda: { entrada: '', saida: '' }, terca: { entrada: '', saida: '' },
        quarta: { entrada: '', saida: '' }, quinta: { entrada: '', saida: '' },
        sexta: { entrada: '', saida: '' }, sabado: { entrada: '', saida: '' },
        domingo: { entrada: '', saida: '' },
      });
    }
  }, [selectedFuncId, gestaoData, funcionarios]);

  const salvarEncargos = async () => {
    if (!selectedFuncId) return;
    await update(ref(db, `gestao_equipe/${selectedFuncId}`), { encargos });
    showToast('Encargos e funções atualizados!', 'success');
  };

  const salvarHorarios = async () => {
    if (!selectedFuncId) return;
    await update(ref(db, `gestao_equipe/${selectedFuncId}`), { horarios });
    showToast('Quadro de horários atualizado!', 'success');
  };

  const addPonto = async () => {
    if (!selectedFuncId || !novoPontoData || !novoPontoEntrada) return;
    await set(push(ref(db, `gestao_equipe/${selectedFuncId}/ponto`)), {
      data: novoPontoData,
      entrada: novoPontoEntrada,
      saida: novoPontoSaida,
      timestamp: Date.now()
    });
    setNovoPontoData('');
    setNovoPontoEntrada('');
    setNovoPontoSaida('');
    showToast('Ponto registrado.', 'success');
  };

  const removePonto = async (pontoId: string) => {
    if (confirm('Deseja remover este registro de ponto?')) {
      await remove(ref(db, `gestao_equipe/${selectedFuncId}/ponto/${pontoId}`));
    }
  };

  const salvarCpf = async () => {
    if (!selectedFuncId) return;
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo && !validarCPF(cpfLimpo)) {
      showToast('O CPF digitado é inválido.', 'error');
      return;
    }
    await update(ref(db, `funcionarios/${selectedFuncId}`), { cpf: cpfLimpo });
    showToast('CPF vinculado com sucesso!', 'success');
  };

  const toggleAtivo = async () => {
    if (!selectedFuncId || !selectedFunc) return;
    const isAtivo = (selectedFunc as any).ativo !== false;
    if (isAtivo) {
      if (!cpf) return showToast('Vincule o CPF antes de inativar para proteger os registros em um possível retorno.', 'error');
      if (confirm('Deseja realmente inativar este colaborador? O PIN de acesso será apagado.')) {
        await update(ref(db, `funcionarios/${selectedFuncId}`), { ativo: false, pin: null, cpf: cpf.replace(/\D/g, '') });
        showToast('Colaborador inativado com sucesso.', 'success');
        setSubView('geral');
      }
    } else {
      if (confirm('Deseja reativar este colaborador?')) {
        await update(ref(db, `funcionarios/${selectedFuncId}`), { ativo: true });
        showToast('Colaborador reativado! Defina um novo PIN na aba Equipe.', 'success');
      }
    }
  };

  const addFalta = async () => {
    if (!selectedFuncId || !novaFaltaData || !novaFaltaMotivo) return;
    await set(push(ref(db, `gestao_equipe/${selectedFuncId}/faltas`)), {
      data: novaFaltaData,
      motivo: novaFaltaMotivo,
      timestamp: Date.now()
    });
    setNovaFaltaData('');
    setNovaFaltaMotivo('');
    showToast('Falta registrada.', 'success');
  };

  const addFeedback = async () => {
    if (!selectedFuncId || !novoFeedbackData || !novoFeedbackTexto) return;
    await set(push(ref(db, `gestao_equipe/${selectedFuncId}/feedbacks`)), {
      data: novoFeedbackData,
      texto: novoFeedbackTexto,
      timestamp: Date.now()
    });
    setNovoFeedbackData('');
    setNovoFeedbackTexto('');
    showToast('Feedback registrado.', 'success');
  };

  const addFolga = async () => {
    if (!selectedFuncId || !novaFolgaDataInicio || !novaFolgaDataFim || !novaFolgaMotivo) return;
    if (novaFolgaDataFim < novaFolgaDataInicio) return showToast('Data fim não pode ser antes do início.', 'error');
    await set(push(ref(db, `gestao_equipe/${selectedFuncId}/folgas`)), {
      dataInicio: novaFolgaDataInicio,
      dataFim: novaFolgaDataFim,
      motivo: novaFolgaMotivo,
      timestamp: Date.now()
    });
    setNovaFolgaDataInicio('');
    setNovaFolgaDataFim('');
    setNovaFolgaMotivo('');
    showToast('Período de ausência registrado.', 'success');
  };

  const removeFalta = async (faltaId: string) => {
    if (confirm('Deseja remover o registro desta falta?')) {
      await remove(ref(db, `gestao_equipe/${selectedFuncId}/faltas/${faltaId}`));
    }
  };

  const removeFeedback = async (feedbackId: string) => {
    if (confirm('Deseja remover este feedback?')) {
      await remove(ref(db, `gestao_equipe/${selectedFuncId}/feedbacks/${feedbackId}`));
    }
  };

  const removeFolga = async (folgaId: string) => {
    if (confirm('Deseja remover este registro de ausência?')) {
      await remove(ref(db, `gestao_equipe/${selectedFuncId}/folgas/${folgaId}`));
    }
  };

  const handleAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setAiResponse('');
    const teamContext = funcionarios.filter(f => {
      const cargos = Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente'];
      return (f as any).ativo !== false && !cargos.every(c => c === 'Administrador' || c === 'Gerente' || c === 'Dono' || c === 'TI');
    }).map(f => {
      const g = gestaoData[f.id] || {};
      const cargosStr = Array.isArray(f.cargo) ? f.cargo.join(', ') : (f.cargo || 'Não definido');
      
      const folgasFunc = g.folgas ? Object.values(g.folgas) as any[] : [];
      const hoje = new Date().toISOString().split('T')[0];
      const folgaAtual = folgasFunc.find(folga => folga.dataInicio <= hoje && folga.dataFim >= hoje);
      const statusFolga = folgaAtual ? `[AUSENTE: ${folgaAtual.motivo}]` : 'Ativo';
      const horariosStr = g.horarios ? Object.entries(g.horarios).filter(([_, v]: any) => v.entrada).map(([d, v]: any) => `${d.substring(0,3)}: ${v.entrada}-${v.saida}`).join(', ') : 'Não definidos';

      return `- ${f.nome} (Cargos: ${cargosStr}) | Status: ${statusFolga} | Horários: ${horariosStr} | Funções: ${g.encargos || 'Não especificadas'}`;
    }).join('\n');

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um gestor especialista em recursos humanos e operações de hamburguerias. O administrador relatará um problema operacional na equipe (ex: funcionário faltou, grande demanda, necessidade de realocação). Sugira uma solução prática e imediata focada na operação do restaurante, distribuindo tarefas baseando-se no perfil da equipe ativa atual informada abaixo. Não invente funcionários. Seja direto, prático e divida a solução em passos claros.\n\nEquipe Atual:\n${teamContext}`
            },
            { role: 'user', content: aiPrompt }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Erro na IA');
      setAiResponse(data.choices?.[0]?.message?.content || 'Sem resposta');
    } catch (error: any) {
      showToast('Erro ao consultar a IA: ' + error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedFunc = funcionarios.find(f => f.id === selectedFuncId);
  const selectedFuncData = gestaoData[selectedFuncId || ''] || {};

  const faltas = selectedFuncData.faltas ? Object.entries(selectedFuncData.faltas).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp) : [];
  const feedbacks = selectedFuncData.feedbacks ? Object.entries(selectedFuncData.feedbacks).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp) : [];
  const folgas = selectedFuncData.folgas ? Object.entries(selectedFuncData.folgas).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp) : [];
  const pontos = selectedFuncData.ponto ? Object.entries(selectedFuncData.ponto).map(([id, val]: any) => ({ id, ...val })).sort((a, b) => b.timestamp - a.timestamp) : [];

  // Helpers para banco de horas
  const horaParaMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + (mm || 0); };
  const minParaStr = (m: number) => { const abs = Math.abs(m); return `${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`; };
  const getDataPonto = (p: any): Date => {
    if (p.id && /^\d{4}-\d{2}-\d{2}$/.test(p.id)) return new Date(p.id + 'T12:00:00');
    if (p.data?.includes('/')) { const [d, m, y] = p.data.split('/'); return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`); }
    if (p.data?.includes('-')) return new Date(p.data + 'T12:00:00');
    return new Date(p.timestamp);
  };
  const calcMinTrabalhados = (p: any) => {
    const chegada = p.chegada?.hora || p.entrada;
    const saida = p.saida_final?.hora || p.saida;
    if (!chegada || !saida) return 0;
    let total = horaParaMin(saida) - horaParaMin(chegada);
    if (p.saida_almoco?.hora && p.volta_almoco?.hora) total -= horaParaMin(p.volta_almoco.hora) - horaParaMin(p.saida_almoco.hora);
    return Math.max(0, total);
  };
  const calcMinEsperados = (date: Date) => {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const h = horarios[dias[date.getDay()]];
    if (!h?.entrada || !h?.saida) return 0;
    return Math.max(0, horaParaMin(h.saida) - horaParaMin(h.entrada));
  };
  const pontosFiltrados = (() => {
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
    return pontos.filter(p => {
      const d = getDataPonto(p);
      if (periodoFiltro === 'tudo') return true;
      if (periodoFiltro === 'semana') { const s = new Date(hoje); s.setDate(hoje.getDate() - hoje.getDay()); s.setHours(0,0,0,0); return d >= s && d <= hoje; }
      if (periodoFiltro === 'mes') return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      if (periodoFiltro === 'mes_anterior') { const a = new Date(hoje.getFullYear(), hoje.getMonth() - 1); return d.getMonth() === a.getMonth() && d.getFullYear() === a.getFullYear(); }
      return true;
    }).sort((a, b) => getDataPonto(b).getTime() - getDataPonto(a).getTime());
  })();
  const totalMinTrab = pontosFiltrados.reduce((acc, p) => acc + calcMinTrabalhados(p), 0);
  const totalMinEsp = pontosFiltrados.reduce((acc, p) => acc + calcMinEsperados(getDataPonto(p)), 0);
  const saldoMin = totalMinTrab - totalMinEsp;

  const funcionariosGerenciaveis = funcionarios.filter(f => {
    const cargos = Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente'];
    return !cargos.every(c => c === 'Administrador' || c === 'Gerente' || c === 'Dono' || c === 'TI');
  });

  return (
    <div className="animate-in fade-in duration-300">
      {activeView === 'gestao' && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center"><UserCircle className="mr-2 text-blue-600" size={24}/> Perfis da Equipe</h3>
        
        <div className="flex overflow-x-auto gap-2 pb-3 mb-2 border-b border-gray-100">
          {funcionariosGerenciaveis.map(f => (
            <button key={f.id} onClick={() => { setSelectedFuncId(f.id); setSubView('geral'); }} className={`flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${(f as any).ativo === false ? 'opacity-60' : ''} ${selectedFuncId === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
              {f.nome} {(f as any).ativo === false && '(Inativo)'}
            </button>
          ))}
        </div>
        
        {selectedFuncId && selectedFunc ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
              <button onClick={() => setSubView('geral')} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${subView === 'geral' ? 'bg-gray-100 text-gray-800 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Desempenho e Faltas</button>
              <button onClick={() => setSubView('horarios')} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${subView === 'horarios' ? 'bg-gray-100 text-gray-800 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Horários e Ponto</button>
              <button onClick={() => setSubView('status')} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors ${subView === 'status' ? 'bg-gray-100 text-gray-800 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Status e Desligamento</button>
            </div>

            {subView === 'geral' && (
            <div className="space-y-6 animate-in fade-in">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h4 className="font-bold text-indigo-800 flex items-center"><MessageSquare className="mr-2 text-indigo-600" size={18}/> Vínculo WhatsApp (Robô)</h4>
                    <p className="text-xs text-indigo-600 mt-1">Status da comunicação deste funcionário com o robô.</p>
                </div>
                <div>
                    {(selectedFunc as any).whatsappId ? (
                        <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center shadow-sm">
                            <CheckCircle size={16} className="text-green-500 mr-2" />
                            <span className="text-xs font-mono text-gray-600">{(selectedFunc as any).whatsappId}</span>
                        </div>
                    ) : (
                        <div className="bg-white px-3 py-1.5 rounded-lg border border-orange-200 flex items-center shadow-sm">
                            <AlertTriangle size={16} className="text-orange-500 mr-2" />
                            <span className="text-xs font-bold text-orange-700">Pendente (Pedir para enviar "vincular")</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-700 flex items-center mb-3"><Briefcase className="mr-2 text-blue-500" size={18}/> Funções e Encargos</h4>
              <p className="text-xs text-gray-500 mb-2">Descreva as responsabilidades exatas de {selectedFunc.nome} para que a IA possa mapear as tarefas.</p>
              <textarea value={encargos} onChange={e => setEncargos(e.target.value)} placeholder="Ex: Fica na chapa durante a noite, responsável por limpar o freezer, etc." className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[100px] resize-y bg-white" />
              <div className="flex justify-end mt-2"><button onClick={salvarEncargos} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center"><Save size={16} className="mr-2"/> Salvar Encargos</button></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                <h4 className="font-bold text-gray-700 flex items-center mb-4"><Calendar className="mr-2 text-orange-500" size={18}/> Faltas</h4>
                <div className="flex flex-col gap-2 mb-4"><input type="date" value={novaFaltaData} onChange={e => setNovaFaltaData(e.target.value)} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white" /><div className="flex gap-2"><input type="text" value={novaFaltaMotivo} onChange={e => setNovaFaltaMotivo(e.target.value)} placeholder="Motivo..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white" /><button onClick={addFalta} className="bg-orange-100 text-orange-600 px-3 py-2 rounded-lg font-bold hover:bg-orange-200 transition-colors flex items-center justify-center"><Plus size={16}/></button></div></div>
                <div className="space-y-2 flex-1 max-h-[200px] overflow-y-auto pr-1">
                  {faltas.map(f => (<div key={f.id} className="flex justify-between items-start bg-white p-3 rounded-lg border border-gray-200 text-sm"><div><span className="font-bold text-gray-800">{f.data.split('-').reverse().join('/')}</span><p className="text-gray-500 mt-0.5 text-xs">{f.motivo}</p></div><button onClick={() => removeFalta(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={14}/></button></div>))}
                  {faltas.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Nenhuma falta registrada.</p>}
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                <h4 className="font-bold text-gray-700 flex items-center mb-4"><MessageSquare className="mr-2 text-green-500" size={18}/> Feedbacks</h4>
                <div className="flex flex-col gap-2 mb-4"><input type="date" value={novoFeedbackData} onChange={e => setNovoFeedbackData(e.target.value)} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white" /><div className="flex gap-2"><input type="text" value={novoFeedbackTexto} onChange={e => setNovoFeedbackTexto(e.target.value)} placeholder="Anotação..." className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white" /><button onClick={addFeedback} className="bg-green-100 text-green-600 px-3 py-2 rounded-lg font-bold hover:bg-green-200 transition-colors flex items-center justify-center"><Plus size={16}/></button></div></div>
                <div className="space-y-2 flex-1 max-h-[200px] overflow-y-auto pr-1">
                  {feedbacks.map(f => (<div key={f.id} className="flex justify-between items-start bg-white p-3 rounded-lg border border-gray-200 text-sm"><div><span className="font-bold text-gray-800">{f.data.split('-').reverse().join('/')}</span><p className="text-gray-500 mt-0.5 text-xs">{f.texto}</p></div><button onClick={() => removeFeedback(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={14}/></button></div>))}
                  {feedbacks.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Nenhum feedback registrado.</p>}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                <h4 className="font-bold text-gray-700 flex items-center mb-4"><Plane className="mr-2 text-purple-500" size={18}/> Férias / Folgas</h4>
                <div className="flex flex-col gap-2 mb-4"><div className="flex gap-2"><input type="date" value={novaFolgaDataInicio} onChange={e => setNovaFolgaDataInicio(e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-xs bg-white" title="Data Início" /><input type="date" value={novaFolgaDataFim} onChange={e => setNovaFolgaDataFim(e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-xs bg-white" title="Data Fim" /></div><div className="flex gap-2"><select value={novaFolgaMotivo} onChange={e => setNovaFolgaMotivo(e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"><option value="">Selecione...</option><option value="Férias">Férias</option><option value="Folga Programada">Folga Programada</option><option value="Licença">Licença / Atestado</option></select><button onClick={addFolga} className="bg-purple-100 text-purple-600 px-3 py-2 rounded-lg font-bold hover:bg-purple-200 transition-colors flex items-center justify-center"><Plus size={16}/></button></div></div>
                <div className="space-y-2 flex-1 max-h-[200px] overflow-y-auto pr-1">
                  {folgas.map(f => (<div key={f.id} className="flex justify-between items-start bg-white p-3 rounded-lg border border-gray-200 text-sm"><div><span className="font-bold text-gray-800">{f.dataInicio.split('-').reverse().join('/')} até {f.dataFim.split('-').reverse().join('/')}</span><p className="text-gray-500 mt-0.5 text-xs">{f.motivo}</p></div><button onClick={() => removeFolga(f.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={14}/></button></div>))}
                  {folgas.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Nenhuma folga registrada.</p>}
                </div>
              </div>
            </div>
            </div>
            )}

            {subView === 'horarios' && (
              <div className="space-y-6 animate-in fade-in">

                {/* Linha 1: Quadro de Horários + Adicionar Ponto Manual */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-700 flex items-center mb-4"><Clock className="mr-2 text-indigo-500" size={18}/> Quadro de Horários</h4>
                    <div className="space-y-3">
                      {['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'].map(dia => (
                        <div key={dia} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100">
                          <span className="text-sm font-bold text-gray-600 capitalize w-20">{dia}</span>
                          <div className="flex items-center gap-2 flex-1 ml-4">
                            <input type="time" value={horarios[dia]?.entrada || ''} onChange={e => setHorarios({...horarios, [dia]: {...horarios[dia], entrada: e.target.value}})} className="w-full p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50" />
                            <span className="text-gray-400 text-xs">às</span>
                            <input type="time" value={horarios[dia]?.saida || ''} onChange={e => setHorarios({...horarios, [dia]: {...horarios[dia], saida: e.target.value}})} className="w-full p-1.5 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={salvarHorarios} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center"><Save size={16} className="mr-2"/> Salvar Horários</button>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                    <h4 className="font-bold text-gray-700 flex items-center mb-3"><Plus className="mr-2 text-emerald-500" size={18}/> Adicionar / Corrigir Ponto</h4>
                    <p className="text-xs text-gray-500 mb-3">Use para inserir ou corrigir manualmente um registro que não foi batido pelo app.</p>
                    <div className="flex flex-col gap-2">
                      <input type="date" value={novoPontoData} onChange={e => setNovoPontoData(e.target.value)} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white" />
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Entrada</label><input type="time" value={novoPontoEntrada} onChange={e => setNovoPontoEntrada(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white" /></div>
                        <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Saída</label><input type="time" value={novoPontoSaida} onChange={e => setNovoPontoSaida(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white" /></div>
                      </div>
                      <button onClick={addPonto} disabled={!novoPontoData || !novoPontoEntrada} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center text-sm disabled:opacity-50"><Plus size={15} className="mr-1.5"/> Adicionar Registro</button>
                    </div>
                  </div>
                </div>

                {/* Linha 2: Banco de Horas (largura total) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Header + Período */}
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h4 className="font-bold text-gray-800 flex items-center"><Clock className="mr-2 text-blue-600" size={20}/> Banco de Horas</h4>
                    <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 text-xs font-bold">
                      {(['semana', 'mes', 'mes_anterior', 'tudo'] as const).map(p => (
                        <button key={p} onClick={() => setPeriodoFiltro(p)} className={`px-3 py-1.5 rounded-md transition-colors ${periodoFiltro === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                          {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mês' : p === 'mes_anterior' ? 'Mês anterior' : 'Tudo'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cards de resumo */}
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                    <div className="p-4 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Horas Trabalhadas</p>
                      <p className="text-2xl font-black text-blue-600">{minParaStr(totalMinTrab)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{pontosFiltrados.length} dia(s) registrado(s)</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Horas Esperadas</p>
                      <p className="text-2xl font-black text-gray-600">{minParaStr(totalMinEsp)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Conforme quadro de horários</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Saldo</p>
                      <p className={`text-2xl font-black ${saldoMin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {saldoMin >= 0 ? '+' : '-'}{minParaStr(saldoMin)}
                      </p>
                      <p className={`text-[10px] mt-0.5 font-bold ${saldoMin >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {saldoMin >= 0 ? 'Horas extras' : 'Horas devendo'}
                      </p>
                    </div>
                  </div>

                  {/* Tabela de registros */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Data</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Chegada</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">S. Almoço</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">V. Almoço</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Saída</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Trabalhado</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Esperado</th>
                          <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase">Saldo</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pontosFiltrados.map(p => {
                          const date = getDataPonto(p);
                          const minTrab = calcMinTrabalhados(p);
                          const minEsp = calcMinEsperados(date);
                          const saldo = minTrab - minEsp;
                          const chegada = p.chegada?.hora || p.entrada || '—';
                          const saidaAlm = p.saida_almoco?.hora || '—';
                          const voltaAlm = p.volta_almoco?.hora || '—';
                          const saida = p.saida_final?.hora || p.saida || '—';
                          const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                          const dataLabel = `${diasSemana[date.getDay()]}, ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

                          return (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-bold text-gray-800 text-sm">{dataLabel}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`font-bold text-xs px-2 py-1 rounded ${chegada !== '—' ? 'bg-green-100 text-green-700' : 'text-gray-300'}`}>{chegada}</span>
                                  {p.chegada?.lat && <a href={`https://maps.google.com/maps?q=${p.chegada.lat},${p.chegada.lng}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium"><MapPin size={9}/> ver local</a>}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`font-bold text-xs px-2 py-1 rounded ${saidaAlm !== '—' ? 'bg-orange-100 text-orange-700' : 'text-gray-300'}`}>{saidaAlm}</span>
                                  {p.saida_almoco?.lat && <a href={`https://maps.google.com/maps?q=${p.saida_almoco.lat},${p.saida_almoco.lng}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium"><MapPin size={9}/> ver local</a>}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`font-bold text-xs px-2 py-1 rounded ${voltaAlm !== '—' ? 'bg-blue-100 text-blue-700' : 'text-gray-300'}`}>{voltaAlm}</span>
                                  {p.volta_almoco?.lat && <a href={`https://maps.google.com/maps?q=${p.volta_almoco.lat},${p.volta_almoco.lng}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium"><MapPin size={9}/> ver local</a>}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className={`font-bold text-xs px-2 py-1 rounded ${saida !== '—' ? 'bg-red-100 text-red-700' : 'text-gray-300'}`}>{saida}</span>
                                  {p.saida_final?.lat && <a href={`https://maps.google.com/maps?q=${p.saida_final.lat},${p.saida_final.lng}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium"><MapPin size={9}/> ver local</a>}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center font-black text-blue-700">{minTrab > 0 ? minParaStr(minTrab) : '—'}</td>
                              <td className="px-3 py-3 text-center text-gray-500 font-medium">{minEsp > 0 ? minParaStr(minEsp) : '—'}</td>
                              <td className="px-3 py-3 text-center">
                                {minTrab > 0 && minEsp > 0 ? (
                                  <span className={`font-black text-xs px-2 py-1 rounded-full ${saldo >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {saldo >= 0 ? '+' : '-'}{minParaStr(saldo)}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <button onClick={() => removePonto(p.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={13}/></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {pontosFiltrados.length === 0 && (
                      <div className="py-12 text-center text-gray-400">
                        <Clock size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum registro de ponto no período selecionado.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {subView === 'status' && (
              <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-700 flex items-center mb-2"><Fingerprint className="mr-2 text-blue-500" size={20}/> Documentação</h4>
                  <p className="text-sm text-gray-500 mb-4">Vincule o CPF do colaborador para garantir que, em caso de desligamento, o histórico (faltas, ponto, etc.) continue associado a ele caso retorne no futuro.</p>
                  <div className="flex gap-3">
                    <input type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" className="flex-1 p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider bg-white" />
                    <button onClick={salvarCpf} className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center shadow-sm"><Save size={18} className="mr-2"/> Salvar CPF</button>
                  </div>
                </div>
              
                <div className={`p-6 rounded-xl border ${(selectedFunc as any).ativo !== false ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <h4 className={`font-bold flex items-center mb-2 ${(selectedFunc as any).ativo !== false ? 'text-red-700' : 'text-green-700'}`}>
                    {(selectedFunc as any).ativo !== false ? <ShieldOff className="mr-2" size={20}/> : <ShieldCheck className="mr-2" size={20}/>}
                    {(selectedFunc as any).ativo !== false ? 'Desligamento / Inativação' : 'Reativar Colaborador'}
                  </h4>
                  <p className={`text-sm mb-6 ${(selectedFunc as any).ativo !== false ? 'text-red-600/80' : 'text-green-600/80'}`}>
                    {(selectedFunc as any).ativo !== false ? 'Ao inativar, o PIN de acesso será permanentemente excluído e o colaborador não poderá mais acessar o sistema ou o KDS. O histórico continuará salvo.' : 'Este colaborador está inativo. Ao reativá-lo, será necessário atribuir um novo PIN de acesso pela aba "Equipe".'}
                  </p>
                  <button onClick={toggleAtivo} className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center transition-colors shadow-sm ${(selectedFunc as any).ativo !== false ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                    <Power size={24} className="mr-2"/> {(selectedFunc as any).ativo !== false ? 'Inativar Colaborador' : 'Reativar Colaborador'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl"><p>Selecione um funcionário acima para gerenciar os dados.</p></div>
        )}
      </div>
      )}
      {activeView === 'ia' && (
      <div className="bg-gradient-to-br from-gray-900 to-indigo-950 p-6 rounded-xl shadow-lg border border-gray-800 text-white flex flex-col min-h-[500px]">
        <h3 className="text-xl font-bold mb-2 flex items-center"><Bot className="mr-2 text-indigo-400"/> Gestor IA</h3>
        <p className="text-gray-400 text-sm mb-6">A IA analisa as funções que você cadastrou para cada membro da equipe. Relate uma ausência, pico de movimento ou demissão, e veja uma sugestão tática imediata de cobertura.</p>
        
        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: O João que fica na chapa ligou dizendo que está passando mal e não vem hoje. A casa costuma ficar cheia de sexta. Como reorganizo a operação?" className="w-full p-4 bg-white/5 border border-indigo-500/30 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[140px] resize-y text-white placeholder-gray-500 mb-4 font-mono leading-relaxed" />
        <button onClick={handleAI} disabled={isGenerating || !aiPrompt.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3.5 rounded-lg font-bold transition-colors flex items-center justify-center disabled:opacity-50 shadow-md">
          {isGenerating ? <><Loader2 size={18} className="animate-spin mr-2"/> Analisando Equipe...</> : <><Sparkles size={18} className="mr-2"/> Solicitar Solução da IA</>}
        </button>
        
        {aiResponse && (<div className="mt-6 flex-1 bg-black/30 border border-indigo-500/20 p-5 rounded-lg overflow-y-auto"><h4 className="font-bold text-indigo-300 mb-3 text-xs uppercase tracking-widest border-b border-indigo-500/20 pb-2">Estratégia Operacional</h4><div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{aiResponse}</div></div>)}
      </div>
      )}

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}