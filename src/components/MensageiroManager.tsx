import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../firebase';
import { MessageCircle, Send, Clock, CheckCircle, AlertTriangle, X, Users, User } from 'lucide-react';

export default function MensageiroManager({ currentUser }: { currentUser?: any }) {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [agendadas, setAgendadas] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);

  const [modoDestinatario, setModoDestinatario] = useState<'todos' | 'cargo' | 'individual'>('todos');
  const [cargoSelecionado, setCargoSelecionado] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [modoEnvio, setModoEnvio] = useState<'imediato' | 'agendado'>('imediato');
  const [dataAgendada, setDataAgendada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const u1 = onValue(ref(db, 'funcionarios'), snap => {
      const val = snap.val();
      const list = val
        ? Object.entries(val).map(([id, v]: any) => ({ id, ...v })).filter((f: any) => f.telefone && f.ativo !== false)
        : [];
      setFuncionarios(list);
    });
    const u2 = onValue(ref(db, 'mensagens_agendadas'), snap => {
      const val = snap.val();
      const list = val
        ? Object.entries(val).map(([id, v]: any) => ({ id, ...v })).filter((m: any) => m.status === 'agendada').sort((a: any, b: any) => a.agendadoPara - b.agendadoPara)
        : [];
      setAgendadas(list);
    });
    const u3 = onValue(query(ref(db, 'mensageiro_historico'), orderByChild('timestamp'), limitToLast(40)), snap => {
      const val = snap.val();
      const list = val
        ? Object.entries(val).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.timestamp - a.timestamp)
        : [];
      setHistorico(list);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  // Verifica agendamentos a cada 30s e move os vencidos para fila_mensagens
  useEffect(() => {
    const dispatch = async () => {
      const agora = Date.now();
      for (const msg of agendadas) {
        if (msg.agendadoPara <= agora) {
          for (const dest of (msg.destinatarios || [])) {
            let tel = (dest.telefone || '').replace(/\D/g, '');
            if (!tel.startsWith('55') && tel.length >= 10) tel = '55' + tel;
            if (tel.length >= 12) {
              await set(push(ref(db, 'fila_mensagens')), {
                telefone: tel,
                mensagem: msg.mensagem,
                status: 'pendente',
                timestamp: Date.now(),
                origem: 'mensageiro',
                remetente: msg.remetenteNome || '',
              });
            }
          }
          await update(ref(db, `mensagens_agendadas/${msg.id}`), { status: 'enviada' });
        }
      }
    };
    dispatch();
    const interval = setInterval(dispatch, 30000);
    return () => clearInterval(interval);
  }, [agendadas]);

  const todosOsCargos = Array.from(
    new Set(funcionarios.flatMap(f => Array.isArray(f.cargo) ? f.cargo : [f.cargo || '']))
  ).filter(Boolean).sort() as string[];

  const getDestinatarios = () => {
    if (modoDestinatario === 'todos') return funcionarios;
    if (modoDestinatario === 'cargo' && cargoSelecionado) {
      return funcionarios.filter(f => {
        const cargos = Array.isArray(f.cargo) ? f.cargo : [f.cargo || ''];
        return cargos.includes(cargoSelecionado);
      });
    }
    if (modoDestinatario === 'individual') return funcionarios.filter(f => selecionados.includes(f.id));
    return [];
  };

  const destinatarios = getDestinatarios();

  const handleEnviar = async () => {
    if (!mensagem.trim()) return showToast('Digite uma mensagem.', 'error');
    if (destinatarios.length === 0) return showToast('Nenhum destinatário selecionado.', 'error');
    if (modoEnvio === 'agendado') {
      if (!dataAgendada) return showToast('Selecione data e hora para o agendamento.', 'error');
      if (new Date(dataAgendada).getTime() <= Date.now()) return showToast('O horário deve ser no futuro.', 'error');
    }

    setEnviando(true);
    try {
      const destDados = destinatarios.map(f => ({ id: f.id, nome: f.nome, telefone: f.telefone }));
      const agendadoPara = modoEnvio === 'agendado' ? new Date(dataAgendada).getTime() : null;

      await set(push(ref(db, 'mensageiro_historico')), {
        mensagem: mensagem.trim(),
        destinatariosNomes: destDados.map(d => d.nome),
        totalDestinatarios: destDados.length,
        remetenteId: currentUser?.id || '',
        remetenteNome: currentUser?.nome || 'Sistema',
        modoEnvio,
        agendadoPara: agendadoPara || null,
        timestamp: Date.now(),
        status: modoEnvio === 'agendado' ? 'agendado' : 'enviado',
      });

      if (modoEnvio === 'imediato') {
        for (const dest of destDados) {
          let tel = (dest.telefone || '').replace(/\D/g, '');
          if (!tel.startsWith('55') && tel.length >= 10) tel = '55' + tel;
          if (tel.length >= 12) {
            await set(push(ref(db, 'fila_mensagens')), {
              telefone: tel,
              mensagem: mensagem.trim(),
              status: 'pendente',
              timestamp: Date.now(),
              origem: 'mensageiro',
              remetente: currentUser?.nome || 'Sistema',
            });
          }
        }
        showToast(`Mensagem enfileirada para ${destDados.length} funcionário(s)!`);
      } else {
        await set(push(ref(db, 'mensagens_agendadas')), {
          mensagem: mensagem.trim(),
          destinatarios: destDados,
          agendadoPara,
          status: 'agendada',
          remetenteNome: currentUser?.nome || 'Sistema',
          timestamp: Date.now(),
        });
        showToast(`Agendado para ${new Date(agendadoPara!).toLocaleString('pt-BR')} — ${destDados.length} destinatário(s).`);
      }

      setMensagem('');
      setDataAgendada('');
      setModoEnvio('imediato');
      setModoDestinatario('todos');
      setSelecionados([]);
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const handleCancelarAgendada = async (id: string) => {
    if (confirm('Cancelar esta mensagem agendada?')) {
      await update(ref(db, `mensagens_agendadas/${id}`), { status: 'cancelada' });
      showToast('Mensagem cancelada.');
    }
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const minDatetime = new Date(Date.now() + 2 * 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
          <MessageCircle size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Mensageiro Interno</h2>
          <p className="text-sm text-gray-500">Envie mensagens WhatsApp para funcionários — imediatamente ou agendado.</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">

        {/* Destinatários */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Para quem?</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setModoDestinatario('todos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modoDestinatario === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Users size={14} /> Todos ({funcionarios.length})
            </button>
            <button
              onClick={() => setModoDestinatario('cargo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modoDestinatario === 'cargo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Por Cargo
            </button>
            <button
              onClick={() => setModoDestinatario('individual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modoDestinatario === 'individual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <User size={14} /> Selecionar
            </button>
          </div>

          {modoDestinatario === 'cargo' && (
            <select
              value={cargoSelecionado}
              onChange={e => setCargoSelecionado(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Selecione um cargo...</option>
              {todosOsCargos.map(c => {
                const count = funcionarios.filter(f => (Array.isArray(f.cargo) ? f.cargo : [f.cargo]).includes(c)).length;
                return <option key={c} value={c}>{c} ({count} funcionário{count !== 1 ? 's' : ''})</option>;
              })}
            </select>
          )}

          {modoDestinatario === 'individual' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {funcionarios.map(f => (
                <label
                  key={f.id}
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors ${selecionados.includes(f.id) ? 'bg-blue-50 border border-blue-300' : 'border border-transparent hover:bg-gray-50'}`}
                >
                  <input type="checkbox" checked={selecionados.includes(f.id)} onChange={() => toggleSelecionado(f.id)} className="text-blue-600 rounded" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{f.nome}</p>
                    <p className="text-xs text-gray-400">{Array.isArray(f.cargo) ? f.cargo.join(', ') : f.cargo}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {destinatarios.length > 0 && (
            <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium">
              {destinatarios.length} destinatário{destinatarios.length !== 1 ? 's' : ''}:{' '}
              {destinatarios.slice(0, 4).map(f => f.nome).join(', ')}
              {destinatarios.length > 4 ? ` +${destinatarios.length - 4} mais` : ''}
            </div>
          )}
        </div>

        {/* Mensagem */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mensagem</label>
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Ex: Reunião às 14h na loja. Todos os atendentes presentes."
            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y text-sm"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{mensagem.length} caracteres</p>
        </div>

        {/* Modo de envio */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Quando enviar?</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setModoEnvio('imediato')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modoEnvio === 'imediato' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Send size={14} /> Agora
            </button>
            <button
              onClick={() => setModoEnvio('agendado')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modoEnvio === 'agendado' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Clock size={14} /> Agendar
            </button>
          </div>
          {modoEnvio === 'agendado' && (
            <input
              type="datetime-local"
              value={dataAgendada}
              onChange={e => setDataAgendada(e.target.value)}
              min={minDatetime}
              className="p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          )}
        </div>

        <button
          onClick={handleEnviar}
          disabled={enviando || !mensagem.trim() || destinatarios.length === 0}
          className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex justify-center items-center disabled:opacity-50 shadow-sm"
        >
          {enviando
            ? 'Processando...'
            : modoEnvio === 'agendado'
            ? <><Clock size={16} className="mr-2" /> Agendar Mensagem</>
            : <><Send size={16} className="mr-2" /> Enviar Mensagem</>
          }
        </button>
      </div>

      {/* Agendadas pendentes */}
      {agendadas.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center">
            <Clock size={18} className="mr-2 text-orange-500" />
            Mensagens Agendadas ({agendadas.length})
          </h3>
          <div className="space-y-3">
            {agendadas.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-orange-700">{new Date(m.agendadoPara).toLocaleString('pt-BR')}</span>
                    <span className="text-xs text-gray-400">· {m.destinatarios?.length} destinatário{m.destinatarios?.length !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{m.mensagem}</p>
                  <p className="text-xs text-gray-400 mt-1">Agendado por {m.remetenteNome}</p>
                </div>
                <button onClick={() => handleCancelarAgendada(m.id)} className="text-red-400 hover:text-red-600 shrink-0 p-1">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Histórico de Envios</h3>
          <div className="space-y-2">
            {historico.map(h => (
              <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${h.status === 'enviado' ? 'bg-green-500' : h.status === 'agendado' ? 'bg-orange-400' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                    <span className="text-xs font-bold text-gray-500">
                      {h.remetenteNome} → {h.totalDestinatarios} pessoa{h.totalDestinatarios !== 1 ? 's' : ''}
                    </span>
                    {h.agendadoPara && (
                      <span className="text-xs text-orange-500">⏰ {new Date(h.agendadoPara).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{h.mensagem}</p>
                  {h.destinatariosNomes?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {h.destinatariosNomes.slice(0, 4).join(', ')}
                      {h.destinatariosNomes.length > 4 ? ` +${h.destinatariosNomes.length - 4}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-xl shadow-xl text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={18} /> : <AlertTriangle className="mr-2" size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
