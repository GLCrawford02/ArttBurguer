import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';
import { Bell, BellOff, AlertTriangle, Calendar, Package, TrendingDown, X, ChevronRight, Settings, CheckCircle } from 'lucide-react';

export interface Alerta {
  id: string;
  tipo: 'estoque_baixo' | 'vencimento' | 'conta_vencer' | 'conta_vencida';
  titulo: string;
  descricao: string;
  urgente: boolean;
  timestamp: number;
  lido?: boolean;
  itemId?: string;
}

const CORES = {
  estoque_baixo: 'text-orange-600 bg-orange-100',
  vencimento: 'text-red-600 bg-red-100',
  conta_vencer: 'text-yellow-600 bg-yellow-100',
  conta_vencida: 'text-red-700 bg-red-100',
};

const ICONES: Record<string, React.ReactNode> = {
  estoque_baixo: <Package size={16} />,
  vencimento: <AlertTriangle size={16} />,
  conta_vencer: <Calendar size={16} />,
  conta_vencida: <TrendingDown size={16} />,
};

export function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [lidosIds, setLidosIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const novosAlertas: Alerta[] = [];

    const unsubInsumos = onValue(ref(db, 'insumos'), snap => {
      const data = snap.val();
      if (!data) return;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const insumosAlertas: Alerta[] = [];

      Object.entries(data).forEach(([id, insumo]: [string, any]) => {
        const estRotativo = Number(insumo.estoqueRotativo ?? 0);
        const estEstacionario = Number(insumo.estoqueEstacionario ?? 0);
        const alertaMin = Number(insumo.alertaMinimo ?? 0);
        const diasAviso = Number(insumo.diasAvisoValidade ?? 7);

        if (alertaMin > 0 && (estRotativo + estEstacionario) <= alertaMin) {
          insumosAlertas.push({
            id: `estoque_${id}`,
            tipo: 'estoque_baixo',
            titulo: `Estoque baixo: ${insumo.nome}`,
            descricao: `${(estRotativo + estEstacionario).toFixed(2)} ${insumo.unidade} restantes (mínimo: ${alertaMin} ${insumo.unidade})`,
            urgente: (estRotativo + estEstacionario) === 0,
            timestamp: Date.now(),
            itemId: id,
          });
        }

        const checkValidade = (validade: string, nome: string, subId: string) => {
          if (!validade) return;
          const dataVal = new Date(`${validade}T00:00:00`);
          const diasRestantes = Math.ceil((dataVal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          if (diasRestantes <= diasAviso && diasRestantes >= 0) {
            insumosAlertas.push({
              id: `venc_${id}_${subId}`,
              tipo: 'vencimento',
              titulo: `Vencimento próximo: ${insumo.nome}`,
              descricao: diasRestantes === 0 ? `Vence HOJE!` : `Vence em ${diasRestantes} dia(s) — ${dataVal.toLocaleDateString('pt-BR')}`,
              urgente: diasRestantes <= 2,
              timestamp: Date.now(),
              itemId: id,
            });
          } else if (diasRestantes < 0) {
            insumosAlertas.push({
              id: `vencido_${id}_${subId}`,
              tipo: 'vencimento',
              titulo: `VENCIDO: ${insumo.nome}`,
              descricao: `Venceu em ${dataVal.toLocaleDateString('pt-BR')} (${Math.abs(diasRestantes)} dias atrás)`,
              urgente: true,
              timestamp: Date.now(),
              itemId: id,
            });
          }
        };

        if (insumo.lotes) {
          Object.entries(insumo.lotes).forEach(([loteId, lote]: [string, any]) => {
            checkValidade(lote.validade, insumo.nome, loteId);
          });
        } else if (insumo.validade) {
          checkValidade(insumo.validade, insumo.nome, 'legado');
        }
      });

      setAlertas(prev => {
        const semInsumos = prev.filter(a => !a.tipo.startsWith('estoque') && a.tipo !== 'vencimento');
        return [...semInsumos, ...insumosAlertas];
      });
    });

    const unsubContas = onValue(ref(db, 'contas_pagar'), snap => {
      const data = snap.val();
      if (!data) return;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const contasAlertas: Alerta[] = [];

      Object.entries(data).forEach(([id, conta]: [string, any]) => {
        if (conta.status === 'Pago') return;
        const venc = new Date(`${conta.vencimento}T00:00:00`);
        const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        if (diasRestantes < 0) {
          contasAlertas.push({
            id: `conta_vencida_${id}`,
            tipo: 'conta_vencida',
            titulo: `Conta vencida: ${conta.descricao}`,
            descricao: `Venceu em ${venc.toLocaleDateString('pt-BR')} — R$ ${Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            urgente: true,
            timestamp: Date.now(),
            itemId: id,
          });
        } else if (diasRestantes <= 3) {
          contasAlertas.push({
            id: `conta_vencer_${id}`,
            tipo: 'conta_vencer',
            titulo: `Conta a vencer: ${conta.descricao}`,
            descricao: diasRestantes === 0 ? `Vence HOJE — R$ ${Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `Vence em ${diasRestantes} dia(s) — R$ ${Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            urgente: diasRestantes <= 1,
            timestamp: Date.now(),
            itemId: id,
          });
        }
      });

      setAlertas(prev => {
        const semContas = prev.filter(a => a.tipo !== 'conta_vencer' && a.tipo !== 'conta_vencida');
        return [...semContas, ...contasAlertas];
      });
    });

    return () => { unsubInsumos(); unsubContas(); };
  }, []);

  const marcarLido = useCallback((id: string) => {
    setLidosIds(prev => new Set([...prev, id]));
  }, []);

  const marcarTodosLidos = useCallback(() => {
    setLidosIds(new Set(alertas.map(a => a.id)));
  }, [alertas]);

  const alertasNaoLidos = alertas.filter(a => !lidosIds.has(a.id));
  const alertasUrgentes = alertasNaoLidos.filter(a => a.urgente).length;

  return { alertas, alertasNaoLidos, alertasUrgentes, marcarLido, marcarTodosLidos };
}

export default function AlertasSino({
  alertas,
  alertasNaoLidos,
  alertasUrgentes,
  marcarLido,
  marcarTodosLidos,
}: {
  alertas: Alerta[];
  alertasNaoLidos: Alerta[];
  alertasUrgentes: number;
  marcarLido: (id: string) => void;
  marcarTodosLidos: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'urgentes'>('todos');

  const total = alertasNaoLidos.length;
  const alertasOrdenados = [...alertasNaoLidos].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0));
  const alertasFiltrados = filtro === 'urgentes' ? alertasOrdenados.filter(a => a.urgente) : alertasOrdenados;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(!aberto)}
        className={`relative p-2 rounded-xl transition-colors ${total > 0 ? 'hover:bg-orange-50 text-orange-600' : 'hover:bg-gray-100 text-gray-500'}`}
        title="Notificações"
      >
        {total > 0 ? <Bell size={20} /> : <Bell size={20} />}
        {total > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center ${alertasUrgentes > 0 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}>
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-in zoom-in-95 fade-in duration-150 origin-top-right max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={18} className={total > 0 ? 'text-orange-500' : 'text-gray-400'} />
                <h3 className="font-black text-gray-800 text-sm">Alertas do Sistema</h3>
                {alertasUrgentes > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alertasUrgentes} urgentes</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {total > 0 && (
                  <button onClick={marcarTodosLidos} className="text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors">Marcar todos</button>
                )}
                <button onClick={() => setAberto(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={16}/></button>
              </div>
            </div>

            {total > 0 && (
              <div className="flex bg-gray-100 p-1 mx-4 mt-3 rounded-xl">
                <button onClick={() => setFiltro('todos')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtro === 'todos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                  Todos ({alertasNaoLidos.length})
                </button>
                <button onClick={() => setFiltro('urgentes')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtro === 'urgentes' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'}`}>
                  Urgentes ({alertasUrgentes})
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto mt-3 pb-3">
              {alertasFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <CheckCircle size={36} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium">{total === 0 ? 'Nenhum alerta ativo' : 'Nenhum alerta urgente'}</p>
                </div>
              ) : (
                <div className="space-y-1 px-3">
                  {alertasFiltrados.map(alerta => (
                    <div
                      key={alerta.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer hover:bg-gray-50 ${alerta.urgente ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}
                      onClick={() => marcarLido(alerta.id)}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${CORES[alerta.tipo]}`}>
                        {ICONES[alerta.tipo]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-black truncate ${alerta.urgente ? 'text-red-800' : 'text-gray-800'}`}>{alerta.titulo}</p>
                          {alerta.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-full shrink-0">URGENTE</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{alerta.descricao}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); marcarLido(alerta.id); }} className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-200 rounded-lg transition-colors shrink-0">
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {total === 0 && alertas.filter(a => !alertasNaoLidos.includes(a)).length > 0 && (
              <div className="flex flex-col items-center py-6 text-gray-400">
                <CheckCircle size={32} className="mb-2 text-green-400" />
                <p className="text-sm font-bold text-gray-600">Tudo em dia!</p>
                <p className="text-xs text-gray-400">Sem alertas ativos no momento.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
