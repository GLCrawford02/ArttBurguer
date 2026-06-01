import { useState, useEffect } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { Calendar, ChevronLeft, ChevronRight, Save, X, CheckCircle, Users, Clock, Copy, Trash2, Download } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';
import ExcelJS from 'exceljs';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TURNOS_PRESET = [
  { label: 'Manhã (07-15h)', entrada: '07:00', saida: '15:00' },
  { label: 'Tarde (14-22h)', entrada: '14:00', saida: '22:00' },
  { label: 'Noite (17-23h)', entrada: '17:00', saida: '23:00' },
  { label: 'Integral (08-18h)', entrada: '08:00', saida: '18:00' },
  { label: 'Folga', entrada: '', saida: '' },
];

interface Turno {
  entrada: string;
  saida: string;
  turno?: string;
}

interface EscalaSemana {
  [funcionarioId: string]: {
    [diaSemana: number]: Turno;
  };
}

const getISOWeek = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const dia = d.getDay();
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
};

const calcHoras = (entrada: string, saida: string): number => {
  if (!entrada || !saida) return 0;
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = saida.split(':').map(Number);
  let minutos = (sh * 60 + sm) - (eh * 60 + em);
  if (minutos < 0) minutos += 24 * 60;
  return minutos / 60;
};

export default function EscalaManager({ currentUser }: { currentUser?: any }) {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [escala, setEscala] = useState<EscalaSemana>({});
  const [semanaBase, setSemanaBase] = useState<Date>(getWeekStart(new Date()));
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editando, setEditando] = useState<{ funcId: string; dia: number } | null>(null);
  const [turnoEdit, setTurnoEdit] = useState<Turno>({ entrada: '', saida: '' });
  const [filtroFunc, setFiltroFunc] = useState('');
  const [copiandoDe, setCopiandoDe] = useState<string | null>(null);

  const chaveEscala = `${semanaBase.getFullYear()}-W${String(getISOWeek(semanaBase)).padStart(2, '0')}`;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsubFunc = onValue(ref(db, 'funcionarios'), snap => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, v]: any) => ({ id, ...v })).filter((f: any) => f.ativo !== false);
        list.sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || ''));
        setFuncionarios(list);
      } else setFuncionarios([]);
    });
    return unsubFunc;
  }, []);

  useEffect(() => {
    const unsubEscala = onValue(ref(db, `escalas/${chaveEscala}`), snap => {
      setEscala(snap.val() || {});
    });
    return unsubEscala;
  }, [chaveEscala]);

  const semanaAnterior = () => {
    const d = new Date(semanaBase);
    d.setDate(d.getDate() - 7);
    setSemanaBase(d);
  };
  const proximaSemana = () => {
    const d = new Date(semanaBase);
    d.setDate(d.getDate() + 7);
    setSemanaBase(d);
  };
  const irParaHoje = () => setSemanaBase(getWeekStart(new Date()));

  const getDiaData = (diaIndex: number): Date => {
    const d = new Date(semanaBase);
    d.setDate(d.getDate() + diaIndex);
    return d;
  };

  const getTurno = (funcId: string, dia: number): Turno | null => escala[funcId]?.[dia] || null;

  const abrirEdicao = (funcId: string, dia: number) => {
    const t = getTurno(funcId, dia);
    setTurnoEdit(t || { entrada: '', saida: '' });
    setEditando({ funcId, dia });
  };

  const salvarTurno = async () => {
    if (!editando) return;
    const { funcId, dia } = editando;
    if (!turnoEdit.entrada && !turnoEdit.saida) {
      await remove(ref(db, `escalas/${chaveEscala}/${funcId}/${dia}`));
    } else {
      await set(ref(db, `escalas/${chaveEscala}/${funcId}/${dia}`), turnoEdit);
    }
    setEditando(null);
    showToast('Turno salvo!');
  };

  const removerTurno = async (funcId: string, dia: number) => {
    await remove(ref(db, `escalas/${chaveEscala}/${funcId}/${dia}`));
    showToast('Turno removido.');
  };

  const copiarSemana = async (deChave: string) => {
    const snap = await new Promise<any>(resolve => onValue(ref(db, `escalas/${deChave}`), resolve, { onlyOnce: true }));
    const dadosOrigin = snap.val();
    if (!dadosOrigin) { showToast('Semana de origem sem escala.', 'error'); return; }
    await set(ref(db, `escalas/${chaveEscala}`), dadosOrigin);
    showToast('Escala copiada com sucesso!');
    setCopiandoDe(null);
  };

  const exportarEscala = () => {
    const funcsFiltrados = funcionarios.filter(f => !filtroFunc || normalizeString(f.nome).includes(normalizeString(filtroFunc)));
    const linhas: string[][] = [
      ['Funcionário', ...DIAS_FULL.map((d, i) => `${d} (${getDiaData(i).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`), 'Total h/Sem']
    ];
    funcsFiltrados.forEach(f => {
      const row: string[] = [f.nome];
      let totalH = 0;
      for (let d = 0; d < 7; d++) {
        const t = getTurno(f.id, d);
        if (t?.entrada) {
          const h = calcHoras(t.entrada, t.saida);
          totalH += h;
          row.push(`${t.entrada}-${t.saida}`);
        } else {
          row.push('Folga');
        }
      }
      row.push(`${totalH.toFixed(1)}h`);
      linhas.push(row);
    });
    const csv = linhas.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `escala_${chaveEscala}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isHoje = (diaIndex: number): boolean => {
    const hoje = new Date();
    const diaData = getDiaData(diaIndex);
    return diaData.toDateString() === hoje.toDateString();
  };

  const funcsFiltrados = funcionarios.filter(f => !filtroFunc || normalizeString(f.nome).includes(normalizeString(filtroFunc)));

  const totalHorasPorFunc = (funcId: string): number => {
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const t = getTurno(funcId, d);
      if (t?.entrada) total += calcHoras(t.entrada, t.saida);
    }
    return total;
  };

  const semanaAtualStr = `${getDiaData(0).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${getDiaData(6).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const isCurrentWeek = getWeekStart(new Date()).toDateString() === semanaBase.toDateString();

  const TurnoCell = ({ funcId, dia }: { funcId: string; dia: number }) => {
    const t = getTurno(funcId, dia);
    const horas = t?.entrada ? calcHoras(t.entrada, t.saida) : 0;
    return (
      <td className={`px-1 py-1 text-center border-r border-gray-100 last:border-0 ${isHoje(dia) ? 'bg-indigo-50' : ''}`}>
        <button onClick={() => abrirEdicao(funcId, dia)} className="w-full group relative">
          {t?.entrada ? (
            <div className="bg-indigo-100 text-indigo-700 rounded-lg px-1.5 py-1 text-xs font-bold leading-tight hover:bg-indigo-200 transition-colors">
              <div>{t.entrada}</div>
              <div className="text-indigo-500">{t.saida}</div>
              <div className="text-[9px] text-indigo-400">{horas.toFixed(1)}h</div>
            </div>
          ) : (
            <div className="text-gray-300 text-xs hover:bg-gray-100 rounded-lg p-2 transition-colors group-hover:text-gray-500">
              +
            </div>
          )}
        </button>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Escala de Turnos</h3>
            <p className="text-sm text-gray-500">Planejamento semanal de horários por funcionário.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" placeholder="Filtrar funcionário..." value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 w-44" />
          <button onClick={exportarEscala} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors">
            <Download size={15}/> Exportar
          </button>
          <button onClick={() => setCopiandoDe(chaveEscala)} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-200 transition-colors">
            <Copy size={15}/> Copiar Semana
          </button>
        </div>
      </div>

      {/* Navegação de semana */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <button onClick={semanaAnterior} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="font-black text-gray-800">{semanaAtualStr}</p>
          <p className="text-xs text-gray-400">{chaveEscala}</p>
          {isCurrentWeek && <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Semana Atual</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button onClick={irParaHoje} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors">Hoje</button>
          )}
          <button onClick={proximaSemana} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Tabela de escala */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="px-4 py-3 w-40">Funcionário</th>
              {DIAS.map((dia, i) => (
                <th key={i} className={`px-1 py-3 text-center border-r border-gray-100 last:border-0 ${isHoje(i) ? 'bg-indigo-50 text-indigo-600' : ''}`}>
                  <div>{dia}</div>
                  <div className={`text-[10px] font-normal ${isHoje(i) ? 'text-indigo-500 font-bold' : 'text-gray-400'}`}>
                    {getDiaData(i).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-gray-500 w-16">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {funcsFiltrados.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Nenhum funcionário encontrado.</td></tr>
            ) : funcsFiltrados.map(f => {
              const totalH = totalHorasPorFunc(f.id);
              return (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-xs shrink-0">
                        {f.nome?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{f.nome}</p>
                        <p className="text-[10px] text-gray-400 truncate">{Array.isArray(f.cargo) ? f.cargo[0] : f.cargo || 'Atendente'}</p>
                      </div>
                    </div>
                  </td>
                  {[0,1,2,3,4,5,6].map(dia => <TurnoCell key={dia} funcId={f.id} dia={dia} />)}
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-black ${totalH >= 40 ? 'text-emerald-600' : totalH > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                      {totalH > 0 ? `${totalH.toFixed(0)}h` : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo de horas */}
      {funcsFiltrados.some(f => totalHorasPorFunc(f.id) > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {funcsFiltrados.filter(f => totalHorasPorFunc(f.id) > 0).map(f => {
            const h = totalHorasPorFunc(f.id);
            return (
              <div key={f.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 truncate">{f.nome}</p>
                <p className={`text-xl font-black ${h >= 44 ? 'text-orange-600' : h >= 40 ? 'text-emerald-600' : 'text-indigo-600'}`}>{h.toFixed(1)}h</p>
                <p className="text-xs text-gray-400">{h >= 44 ? 'Hora extra' : h >= 40 ? 'Carga completa' : 'Carga parcial'}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edição de turno */}
      {editando && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-800">Editar Turno</h3>
                <p className="text-xs text-gray-500">
                  {funcionarios.find(f => f.id === editando.funcId)?.nome} · {DIAS_FULL[editando.dia]}, {getDiaData(editando.dia).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setEditando(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Presets */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Turnos rápidos</p>
                <div className="grid grid-cols-2 gap-2">
                  {TURNOS_PRESET.map((tp, i) => (
                    <button key={i} onClick={() => setTurnoEdit({ entrada: tp.entrada, saida: tp.saida })} className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-colors ${turnoEdit.entrada === tp.entrada && turnoEdit.saida === tp.saida ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                      {tp.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Entrada/Saída manual */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Entrada</label>
                  <input type="time" value={turnoEdit.entrada} onChange={e => setTurnoEdit(p => ({ ...p, entrada: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Saída</label>
                  <input type="time" value={turnoEdit.saida} onChange={e => setTurnoEdit(p => ({ ...p, saida: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                </div>
              </div>
              {turnoEdit.entrada && turnoEdit.saida && (
                <p className="text-sm text-center text-indigo-600 font-bold">
                  {calcHoras(turnoEdit.entrada, turnoEdit.saida).toFixed(1)} horas de trabalho
                </p>
              )}
              <div className="flex gap-2 pt-1">
                {getTurno(editando.funcId, editando.dia) && (
                  <button onClick={() => { removerTurno(editando.funcId, editando.dia); setEditando(null); }} className="flex items-center gap-1 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
                    <Trash2 size={14}/> Remover
                  </button>
                )}
                <button onClick={salvarTurno} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                  <Save size={16}/> Salvar Turno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de copiar semana */}
      {copiandoDe !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-800">Copiar Escala de Outra Semana</h3>
              <button onClick={() => setCopiandoDe(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18}/></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Digite a chave da semana de origem (ex: 2025-W22) para copiar a escala para a semana atual.</p>
            <input
              type="text"
              placeholder="2025-W22"
              value={copiandoDe === chaveEscala ? '' : copiandoDe}
              onChange={e => setCopiandoDe(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-center text-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setCopiandoDe(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={() => copiandoDe && copiarSemana(copiandoDe)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                <Copy size={15}/> Copiar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20}/>{toast.message}
        </div>
      )}
    </div>
  );
}
