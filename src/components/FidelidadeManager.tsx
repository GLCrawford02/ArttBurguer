import { useState, useEffect } from 'react';
import { ref, onValue, update, set, push } from 'firebase/database';
import { db } from '../firebase';
import { Gift, Star, Users, Settings, Search, TrendingUp, Award, X, CheckCircle, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface ConfigFidelidade {
  ativo: boolean;
  pontosPorReal: number;
  reais_por_ponto: number;
  pontos_minimo_resgate: number;
  recompensas: Record<string, Recompensa>;
}

interface Recompensa {
  id?: string;
  nome: string;
  pontosNecessarios: number;
  descricao?: string;
  ativo: boolean;
}

interface PontosCliente {
  clienteId: string;
  clienteNome: string;
  pontos: number;
  totalGasto: number;
  historico?: Record<string, HistoricoFidelidade>;
}

interface HistoricoFidelidade {
  tipo: 'ganho' | 'resgate';
  pontos: number;
  descricao: string;
  timestamp: number;
  operadorId?: string;
  operadorNome?: string;
}

export default function FidelidadeManager({ currentUser, temPermissao }: { currentUser?: any, temPermissao?: any }) {
  const [config, setConfig] = useState<ConfigFidelidade>({
    ativo: true, pontosPorReal: 1, reais_por_ponto: 1,
    pontos_minimo_resgate: 100, recompensas: {}
  });
  const [clientes, setClientes] = useState<any[]>([]);
  const [pontosClientes, setPontosClientes] = useState<Record<string, PontosCliente>>({});
  const [activeView, setActiveView] = useState<'clientes' | 'config'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const [modalResgate, setModalResgate] = useState<{ clienteId: string; clienteNome: string; pontos: number } | null>(null);
  const [modalAjuste, setModalAjuste] = useState<{ clienteId: string; clienteNome: string; pontos: number } | null>(null);
  const [ajusteValor, setAjusteValor] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [novaRecompensa, setNovaRecompensa] = useState<Partial<Recompensa>>({ nome: '', pontosNecessarios: 0, descricao: '', ativo: true });
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsubConfig = onValue(ref(db, 'fidelidade_config'), snap => {
      const data = snap.val();
      if (data) setConfig(data);
    });
    const unsubClientes = onValue(ref(db, 'clientes'), snap => {
      const data = snap.val();
      setClientes(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubPontos = onValue(ref(db, 'fidelidade_pontos'), snap => {
      const data = snap.val();
      setPontosClientes(data || {});
    });
    return () => { unsubConfig(); unsubClientes(); unsubPontos(); };
  }, []);

  const salvarConfig = async () => {
    setSalvandoConfig(true);
    try {
      await set(ref(db, 'fidelidade_config'), config);
      showToast('Configurações salvas com sucesso!');
    } catch {
      showToast('Erro ao salvar configurações.', 'error');
    } finally {
      setSalvandoConfig(false);
    }
  };

  const adicionarRecompensa = async () => {
    if (!novaRecompensa.nome?.trim() || !novaRecompensa.pontosNecessarios) {
      showToast('Preencha nome e pontos necessários.', 'error');
      return;
    }
    const novoId = push(ref(db, 'fidelidade_config/recompensas')).key!;
    const updated = { ...config, recompensas: { ...(config.recompensas || {}), [novoId]: { ...novaRecompensa, ativo: true } as Recompensa } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setNovaRecompensa({ nome: '', pontosNecessarios: 0, descricao: '', ativo: true });
    showToast('Recompensa adicionada!');
  };

  const removerRecompensa = async (id: string) => {
    const updated = { ...config, recompensas: { ...(config.recompensas || {}) } };
    delete updated.recompensas[id];
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    showToast('Recompensa removida.');
  };

  const realizarResgate = async (clienteId: string, recompensaId: string) => {
    const recompensa = config.recompensas[recompensaId];
    const dadosPontos = pontosClientes[clienteId];
    if (!dadosPontos || dadosPontos.pontos < recompensa.pontosNecessarios) {
      showToast('Pontos insuficientes para este resgate.', 'error');
      return;
    }
    const novosPontos = dadosPontos.pontos - recompensa.pontosNecessarios;
    const historicoRef = push(ref(db, `fidelidade_pontos/${clienteId}/historico`));
    await update(ref(db, `fidelidade_pontos/${clienteId}`), { pontos: novosPontos });
    await set(historicoRef, {
      tipo: 'resgate', pontos: -recompensa.pontosNecessarios,
      descricao: `Resgate: ${recompensa.nome}`,
      timestamp: Date.now(),
      operadorId: currentUser?.id || '',
      operadorNome: currentUser?.nome || 'Sistema'
    });
    showToast(`Resgate de "${recompensa.nome}" realizado! -${recompensa.pontosNecessarios} pontos.`);
    setModalResgate(null);
  };

  const realizarAjuste = async () => {
    if (!modalAjuste || !ajusteValor || !ajusteMotivo.trim()) {
      showToast('Preencha valor e motivo do ajuste.', 'error');
      return;
    }
    const delta = Number(ajusteValor);
    if (isNaN(delta)) { showToast('Valor inválido.', 'error'); return; }
    const dadosAtuais = pontosClientes[modalAjuste.clienteId];
    const pontosAtuais = dadosAtuais?.pontos || 0;
    const novosPontos = Math.max(0, pontosAtuais + delta);
    const historicoRef = push(ref(db, `fidelidade_pontos/${modalAjuste.clienteId}/historico`));
    await update(ref(db, `fidelidade_pontos/${modalAjuste.clienteId}`), {
      pontos: novosPontos,
      clienteId: modalAjuste.clienteId,
      clienteNome: modalAjuste.clienteNome,
    });
    await set(historicoRef, {
      tipo: 'ganho', pontos: delta,
      descricao: `Ajuste manual: ${ajusteMotivo}`,
      timestamp: Date.now(),
      operadorId: currentUser?.id || '',
      operadorNome: currentUser?.nome || 'Sistema'
    });
    showToast(`Ajuste de ${delta > 0 ? '+' : ''}${delta} pontos aplicado!`);
    setModalAjuste(null);
    setAjusteValor('');
    setAjusteMotivo('');
  };

  const clientesFiltrados = clientes
    .filter(c => !searchTerm || c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || c.telefone?.includes(searchTerm))
    .map(c => ({ ...c, pontosDados: pontosClientes[c.id] }))
    .sort((a, b) => (b.pontosDados?.pontos || 0) - (a.pontosDados?.pontos || 0));

  const totalClientesComPontos = Object.keys(pontosClientes).length;
  const totalPontosEmCirculacao = Object.values(pontosClientes).reduce((acc, p) => acc + (p.pontos || 0), 0);
  const recompensasArray = Object.entries(config.recompensas || {}).map(([id, r]) => ({ id, ...r }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-100 p-3 rounded-xl text-yellow-600">
            <Star size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Programa de Fidelidade</h3>
            <p className="text-sm text-gray-500">Gerencie pontos e recompensas dos clientes cadastrados.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${config.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {config.ativo ? 'Programa Ativo' : 'Programa Inativo'}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setActiveView('clientes')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'clientes' ? 'bg-white text-yellow-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Clientes</button>
            <button onClick={() => setActiveView('config')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'config' ? 'bg-white text-yellow-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configurações</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes com Pontos', valor: totalClientesComPontos, icon: <Users size={18} className="text-blue-500"/>, cor: 'text-blue-600' },
          { label: 'Pontos em Circulação', valor: totalPontosEmCirculacao, icon: <Star size={18} className="text-yellow-500"/>, cor: 'text-yellow-600' },
          { label: 'Pontos por R$ 1,00', valor: config.pontosPorReal, icon: <TrendingUp size={18} className="text-green-500"/>, cor: 'text-green-600' },
          { label: 'Recompensas Ativas', valor: recompensasArray.filter(r => r.ativo).length, icon: <Gift size={18} className="text-purple-500"/>, cor: 'text-purple-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
              {k.icon}
            </div>
            <p className={`text-2xl font-black ${k.cor}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {activeView === 'clientes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm w-full" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {clientesFiltrados.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-30"/>
                <p>Nenhum cliente encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clientesFiltrados.map(c => {
                  const pontos = c.pontosDados?.pontos || 0;
                  const historico = c.pontosDados?.historico ? Object.entries(c.pontosDados.historico).map(([id, h]: any) => ({ id, ...h })).sort((a: any, b: any) => b.timestamp - a.timestamp) : [];
                  const resgataveis = recompensasArray.filter(r => r.ativo && r.pontosNecessarios <= pontos);
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-black text-sm shrink-0">
                            {c.nome?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{c.nome}</p>
                            <p className="text-xs text-gray-500">{c.telefone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <div className="text-right">
                            <p className={`font-black text-lg ${pontos > 0 ? 'text-yellow-600' : 'text-gray-300'}`}>{pontos}</p>
                            <p className="text-xs text-gray-400">pontos</p>
                          </div>
                          {resgataveis.length > 0 && (
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">{resgataveis.length} resgate(s)</span>
                          )}
                          <div className="flex gap-1">
                            <button onClick={() => setModalAjuste({ clienteId: c.id, clienteNome: c.nome, pontos })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ajustar pontos"><Settings size={15}/></button>
                            {resgataveis.length > 0 && (
                              <button onClick={() => setModalResgate({ clienteId: c.id, clienteNome: c.nome, pontos })} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Resgatar recompensa"><Gift size={15}/></button>
                            )}
                            <button onClick={() => setClienteExpandido(clienteExpandido === c.id ? null : c.id)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                              {clienteExpandido === c.id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                            </button>
                          </div>
                        </div>
                      </div>
                      {clienteExpandido === c.id && (
                        <div className="bg-gray-50 px-4 pb-4 border-t border-gray-100">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-3 mb-2">Histórico de Pontos</p>
                          {historico.length === 0 ? (
                            <p className="text-xs text-gray-400">Nenhuma movimentação registrada.</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {historico.slice(0, 20).map((h: any) => (
                                <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                                  <div>
                                    <span className="text-gray-600">{h.descricao}</span>
                                    <span className="text-gray-400 ml-2">{new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                  </div>
                                  <span className={`font-bold ml-4 ${h.pontos > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {h.pontos > 0 ? '+' : ''}{h.pontos} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regras do Programa */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-indigo-500"/>
              <h4 className="font-bold text-gray-800">Regras do Programa</h4>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800">Programa Ativo</p>
                <p className="text-xs text-gray-500">Habilitar/desabilitar o acúmulo de pontos</p>
              </div>
              <button onClick={() => setConfig(p => ({ ...p, ativo: !p.ativo }))} className={`w-12 h-6 rounded-full transition-colors ${config.ativo ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config.ativo ? 'left-6' : 'left-0.5'}`}/>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Pontos ganhos a cada R$ 1,00 gasto</label>
                <input type="number" min="0.1" step="0.1" value={config.pontosPorReal} onChange={e => setConfig(p => ({ ...p, pontosPorReal: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Ex: 1 = 1 ponto por real; 2 = 2 pontos por real</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Mínimo de pontos para resgatar</label>
                <input type="number" min="1" value={config.pontos_minimo_resgate} onChange={e => setConfig(p => ({ ...p, pontos_minimo_resgate: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
              </div>
            </div>
            <button onClick={salvarConfig} disabled={salvandoConfig} className="w-full py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50">
              {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>

          {/* Recompensas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Gift size={18} className="text-purple-500"/>
              <h4 className="font-bold text-gray-800">Recompensas</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recompensasArray.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma recompensa cadastrada.</p>
              ) : recompensasArray.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{r.nome}</p>
                    <p className="text-xs text-gray-500">{r.pontosNecessarios} pontos necessários{r.descricao ? ` · ${r.descricao}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{r.ativo ? 'Ativo' : 'Inativo'}</span>
                    <button onClick={() => { const updated = { ...config, recompensas: { ...config.recompensas, [r.id!]: { ...r, ativo: !r.ativo } } }; setConfig(updated); set(ref(db, 'fidelidade_config'), updated); }} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"><Settings size={13}/></button>
                    <button onClick={() => removerRecompensa(r.id!)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase">Nova Recompensa</p>
              <input type="text" placeholder="Nome da recompensa" value={novaRecompensa.nome} onChange={e => setNovaRecompensa(p => ({ ...p, nome: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <input type="number" placeholder="Pontos necessários" value={novaRecompensa.pontosNecessarios || ''} onChange={e => setNovaRecompensa(p => ({ ...p, pontosNecessarios: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <input type="text" placeholder="Descrição (opcional)" value={novaRecompensa.descricao} onChange={e => setNovaRecompensa(p => ({ ...p, descricao: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <button onClick={adicionarRecompensa} className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <Plus size={16}/> Adicionar Recompensa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resgate */}
      {modalResgate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-xl text-yellow-600"><Gift size={20}/></div>
                <div>
                  <h3 className="font-black text-gray-800">Resgatar Recompensa</h3>
                  <p className="text-xs text-gray-500">{modalResgate.clienteNome} · {modalResgate.pontos} pontos disponíveis</p>
                </div>
              </div>
              <button onClick={() => setModalResgate(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-3">
              {recompensasArray.filter(r => r.ativo && r.pontosNecessarios <= modalResgate.pontos).map(r => (
                <button key={r.id} onClick={() => realizarResgate(modalResgate.clienteId, r.id!)} className="w-full flex items-center justify-between p-4 border-2 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 rounded-xl transition-colors group">
                  <div className="text-left">
                    <p className="font-bold text-gray-800">{r.nome}</p>
                    {r.descricao && <p className="text-xs text-gray-500">{r.descricao}</p>}
                  </div>
                  <span className="font-black text-yellow-600 text-lg">{r.pontosNecessarios} pts</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuste Manual */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-800">Ajuste de Pontos</h3>
                <p className="text-xs text-gray-500">{modalAjuste.clienteNome} · {modalAjuste.pontos} pontos atuais</p>
              </div>
              <button onClick={() => setModalAjuste(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Ajuste de Pontos (use negativo para remover)</label>
                <input type="number" value={ajusteValor} onChange={e => setAjusteValor(e.target.value)} placeholder="Ex: 50 ou -30" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-lg font-mono text-center" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Motivo do ajuste</label>
                <input type="text" value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)} placeholder="Ex: Correção de compra, promoção..." className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
              </div>
              <button onClick={realizarAjuste} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">Confirmar Ajuste</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle className="mr-2" size={20} />{toast.message}
        </div>
      )}
    </div>
  );
}
