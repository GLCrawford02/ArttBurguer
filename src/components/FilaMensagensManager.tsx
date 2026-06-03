import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../firebase';
import { Inbox, Phone, Trash2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

type StatusFilter = 'todos' | 'pendente' | 'enviado' | 'falha';

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  enviado:  'bg-green-100 text-green-800',
  falha:    'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  enviado:  'Enviado',
  falha:    'Falha',
};

export default function FilaMensagensManager() {
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('todos');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const q = query(ref(db, 'fila_mensagens'), orderByChild('timestamp'), limitToLast(300));
    return onValue(q, snap => {
      const val = snap.val();
      const list = val
        ? Object.entries(val).map(([id, v]: any) => ({ id, ...v })).sort((a: any, b: any) => b.timestamp - a.timestamp)
        : [];
      setMensagens(list);
    });
  }, []);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioHoje = hoje.getTime();

  const pendentes      = mensagens.filter(m => m.status === 'pendente').length;
  const enfileiradosHoje = mensagens.filter(m => (m.status === 'pendente' || m.status === 'enviado') && m.timestamp >= inicioHoje).length;
  const falhas         = mensagens.filter(m => m.status === 'falha').length;

  const visible = filter === 'todos' ? mensagens : mensagens.filter(m => m.status === filter);

  const handleExcluir = async (id: string) => {
    if (confirm('Remover esta mensagem da fila permanentemente?')) {
      await remove(ref(db, `fila_mensagens/${id}`));
      showToast('Mensagem removida.');
    }
  };

  const handleRetry = async (id: string) => {
    await update(ref(db, `fila_mensagens/${id}`), { status: 'pendente' });
    showToast('Reenfileirada para reenvio.');
  };

  const FILTERS: [StatusFilter, string][] = [
    ['todos',    `Todos (${mensagens.length})`],
    ['pendente', `Pendentes (${pendentes})`],
    ['enviado',  `Enviados (${mensagens.filter(m => m.status === 'enviado').length})`],
    ['falha',    `Falhas (${falhas})`],
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-indigo-100 p-3 rounded-xl mr-4 text-indigo-600">
          <Inbox size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Fila de Envio</h2>
          <p className="text-sm text-gray-500">Todas as mensagens WhatsApp geradas pelo sistema em tempo real.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-3xl font-black text-yellow-500">{pendentes}</p>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">Pendentes</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-3xl font-black text-green-500">{enfileiradosHoje}</p>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">Enfileirados hoje</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-3xl font-black text-red-500">{falhas}</p>
          <p className="text-xs font-bold text-gray-500 uppercase mt-1">Falhas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              filter === val
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="bg-white rounded-xl p-14 text-center text-gray-400 border border-dashed border-gray-200">
            <Inbox size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma mensagem encontrada.</p>
          </div>
        ) : (
          visible.map(m => (
            <div key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
              <div className="shrink-0 bg-gray-100 rounded-full p-2 mt-0.5">
                <Phone size={15} className="text-gray-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-gray-700">{m.telefone}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[m.status] || m.status}
                  </span>
                  {m.origem && (
                    <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                      {m.origem}
                    </span>
                  )}
                  {m.remetente && (
                    <span className="text-[11px] text-gray-400">por {m.remetente}</span>
                  )}
                  <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                    {new Date(m.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-line">{m.mensagem}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {m.status === 'falha' && (
                  <button
                    onClick={() => handleRetry(m.id)}
                    title="Tentar novamente"
                    className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                  >
                    <RefreshCw size={15} />
                  </button>
                )}
                {(m.status === 'pendente' || m.status === 'falha') && (
                  <button
                    onClick={() => handleExcluir(m.id)}
                    title="Remover da fila"
                    className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-xl shadow-xl text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={18} /> : <AlertTriangle className="mr-2" size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
