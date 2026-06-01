import { useState, useEffect } from 'react';
import { ref, onValue, update, set, push, remove } from 'firebase/database';
import { db } from '../firebase';
import { Gift, Star, Users, Settings, Search, X, CheckCircle, Trash2, Plus, ChevronDown, ChevronUp, Award, Stamp } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';

export interface ConfigFidelidade {
  ativo: boolean;
  valorPorCarimbo: number;
  carimbosParaPremio: number;
  recompensas: Record<string, Recompensa>;
}

interface Recompensa {
  id?: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

interface DadosCliente {
  clienteId: string;
  clienteNome: string;
  pontos: number;
  totalGasto: number;
  historico?: Record<string, HistoricoItem>;
}

interface HistoricoItem {
  tipo: 'ganho' | 'resgate';
  pontos: number;
  descricao: string;
  timestamp: number;
  operadorNome?: string;
}

const TOTAL_CARIMBOS = 10;

const CartaoCarimbo = ({ carimbos, meta = TOTAL_CARIMBOS, pequeno = false }: { carimbos: number; meta?: number; pequeno?: boolean }) => {
  const preenchidos = Math.min(carimbos % meta, meta);
  const completos = Math.floor(carimbos / meta);
  return (
    <div className={`${pequeno ? 'p-2' : 'p-4'} bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200`}>
      {!pequeno && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-orange-700 uppercase tracking-widest">Cartão Fidelidade</span>
          {completos > 0 && (
            <span className="bg-orange-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{completos}x Prêmio Resgatado</span>
          )}
        </div>
      )}
      <div className={`grid grid-cols-5 ${pequeno ? 'gap-1' : 'gap-2'}`}>
        {Array.from({ length: meta }).map((_, i) => (
          <div
            key={i}
            className={`${pequeno ? 'w-6 h-6 text-[10px]' : 'w-10 h-10 text-base'} rounded-full flex items-center justify-center font-black border-2 transition-all duration-300
              ${i < preenchidos
                ? 'bg-orange-500 border-orange-600 text-white shadow-md scale-105'
                : 'bg-white border-orange-200 text-orange-200'
              }`}
          >
            {i < preenchidos ? '★' : i + 1}
          </div>
        ))}
      </div>
      {!pequeno && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-orange-600 font-bold">{preenchidos}/{meta} carimbos</p>
          <div className="h-2 flex-1 mx-3 bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${(preenchidos / meta) * 100}%` }}
            />
          </div>
          {preenchidos >= meta ? (
            <span className="text-xs font-black text-green-600 animate-pulse">🎁 PRÊMIO!</span>
          ) : (
            <span className="text-xs text-orange-500 font-bold">faltam {meta - preenchidos}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default function FidelidadeManager({ currentUser, temPermissao }: { currentUser?: any; temPermissao?: any }) {
  const [config, setConfig] = useState<ConfigFidelidade>({
    ativo: true,
    valorPorCarimbo: 50,
    carimbosParaPremio: TOTAL_CARIMBOS,
    recompensas: {},
  });
  const [clientes, setClientes] = useState<any[]>([]);
  const [dadosClientes, setDadosClientes] = useState<Record<string, DadosCliente>>({});
  const [activeView, setActiveView] = useState<'clientes' | 'config'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalResgate, setModalResgate] = useState<{ clienteId: string; clienteNome: string; carimbos: number } | null>(null);
  const [modalAjuste, setModalAjuste] = useState<{ clienteId: string; clienteNome: string; carimbos: number } | null>(null);
  const [ajusteValor, setAjusteValor] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [novaRecompensa, setNovaRecompensa] = useState<Partial<Recompensa>>({ nome: '', descricao: '', ativo: true });
  const [salvando, setSalvando] = useState(false);
  const canEdit = temPermissao ? temPermissao('fidelidade', 'aba_logistica', 'editar') : true;
  const canDelete = temPermissao ? temPermissao('fidelidade', 'aba_logistica', 'apagar') : true;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsubConfig = onValue(ref(db, 'fidelidade_config'), snap => {
      const data = snap.val();
      if (data) setConfig(prev => ({ ...prev, ...data }));
    });
    const unsubClientes = onValue(ref(db, 'clientes'), snap => {
      const data = snap.val();
      setClientes(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubDados = onValue(ref(db, 'fidelidade_pontos'), snap => {
      setDadosClientes(snap.val() || {});
    });
    return () => { unsubConfig(); unsubClientes(); unsubDados(); };
  }, []);

  useEffect(() => {
    if (!canEdit && activeView === 'config') setActiveView('clientes');
  }, [canEdit, activeView]);

  const salvarConfig = async () => {
    if (!canEdit) { showToast('Você não tem permissão para editar a fidelidade.', 'error'); return; }
    setSalvando(true);
    try {
      await set(ref(db, 'fidelidade_config'), config);
      showToast('Configurações salvas!');
    } catch {
      showToast('Erro ao salvar.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarRecompensa = async () => {
    if (!canEdit) { showToast('Você não tem permissão para editar recompensas.', 'error'); return; }
    if (!novaRecompensa.nome?.trim()) { showToast('Informe o nome da recompensa.', 'error'); return; }
    const id = push(ref(db, 'fidelidade_config/recompensas')).key!;
    const updated = { ...config, recompensas: { ...(config.recompensas || {}), [id]: { nome: novaRecompensa.nome, descricao: novaRecompensa.descricao || '', ativo: true } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setNovaRecompensa({ nome: '', descricao: '', ativo: true });
    showToast('Recompensa adicionada!');
  };

  const removerRecompensa = async (id: string) => {
    if (!canDelete) { showToast('Você não tem permissão para apagar recompensas.', 'error'); return; }
    const updated = { ...config, recompensas: { ...config.recompensas } };
    delete updated.recompensas[id];
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    showToast('Recompensa removida.');
  };

  const normalizarTelefoneMensagem = (telefone?: string) => {
    let tel = (telefone || '').replace(/\D/g, '');
    if (tel.length < 10) return '';
    if (!tel.startsWith('55')) tel = `55${tel}`;
    return tel;
  };

  const montarMensagemFidelidade = (clienteNome: string, carimbosGanhos: number, totalCarimbos: number, meta: number) => {
    const primeiroNome = (clienteNome || 'cliente').split(' ')[0];
    const premiosDisponiveis = Math.floor(totalCarimbos / meta);
    const resto = totalCarimbos % meta;
    const carimbosNoCartao = premiosDisponiveis > 0 && resto === 0 ? meta : resto;
    const statusCartao = premiosDisponiveis > 0
      ? `\n\n🎁 Você já tem *${premiosDisponiveis} prêmio(s) disponível(is)* para resgatar!`
      : `\n\nFaltam *${meta - carimbosNoCartao} carimbo(s)* para o seu próximo prêmio.`;

    return `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Você ganhou *${carimbosGanhos} carimbo(s)* no seu cartão fidelidade.\n\nSua nova pontuação é: *${totalCarimbos} carimbo(s)*.\nCartão atual: *${carimbosNoCartao}/${meta}*.${statusCartao}\n\nObrigado pela preferência!`;
  };

  const enfileirarMensagemFidelidade = async (clienteId: string, clienteNome: string, carimbosGanhos: number, totalCarimbos: number, meta: number) => {
    const cliente = clientes.find(c => c.id === clienteId);
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem: montarMensagemFidelidade(clienteNome, carimbosGanhos, totalCarimbos, meta),
      status: 'pendente',
      origem: 'fidelidade',
      timestamp: Date.now(),
    });
  };

  const enfileirarMensagemResgate = async (clienteId: string, clienteNome: string, recompensaNome: string, saldoCarimbos: number, meta: number) => {
    const cliente = clientes.find(c => c.id === clienteId);
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    const primeiroNome = (clienteNome || 'cliente').split(' ')[0];
    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem: `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Sua recompensa *${recompensaNome}* foi resgatada com sucesso.\n\nEsperamos que goste! Foram descontados *${meta} carimbo(s)* do seu cartão, e seu saldo agora é de *${saldoCarimbos} carimbo(s)*.\n\nAguardamos você para continuar pontuando no seu cartão fidelidade.\n\nObrigado pela preferência!`,
      status: 'pendente',
      origem: 'fidelidade_resgate',
      timestamp: Date.now(),
    });
  };

  const realizarResgate = async (clienteId: string, recompensaId: string) => {
    if (!canEdit) { showToast('Você não tem permissão para resgatar recompensas.', 'error'); return; }
    const recomp = config.recompensas[recompensaId];
    const dados = dadosClientes[clienteId];
    const meta = config.carimbosParaPremio || TOTAL_CARIMBOS;
    const carimbosAtuais = dados?.pontos || 0;
    if (carimbosAtuais < meta) { showToast('Carimbos insuficientes.', 'error'); return; }
    const novosCarimbos = Math.max(0, carimbosAtuais - meta);
    await update(ref(db, `fidelidade_pontos/${clienteId}`), { pontos: novosCarimbos });
    await set(push(ref(db, `fidelidade_pontos/${clienteId}/historico`)), {
      tipo: 'resgate', pontos: -meta,
      descricao: `Prêmio resgatado: ${recomp.nome}`,
      timestamp: Date.now(),
      operadorNome: currentUser?.nome || 'Sistema',
    });
    await enfileirarMensagemResgate(clienteId, dados?.clienteNome || modalResgate?.clienteNome || 'Cliente', recomp.nome, novosCarimbos, meta);
    showToast(`Prêmio "${recomp.nome}" resgatado! -${meta} carimbos.`);
    setModalResgate(null);
  };

  const realizarAjuste = async () => {
    if (!canEdit) { showToast('Você não tem permissão para ajustar carimbos.', 'error'); return; }
    if (!modalAjuste || !ajusteValor || !ajusteMotivo.trim()) { showToast('Preencha valor e motivo.', 'error'); return; }
    const delta = Number(ajusteValor);
    if (isNaN(delta)) { showToast('Valor inválido.', 'error'); return; }
    const atual = dadosClientes[modalAjuste.clienteId]?.pontos || 0;
    const novo = Math.max(0, atual + delta);
    await update(ref(db, `fidelidade_pontos/${modalAjuste.clienteId}`), {
      pontos: novo, clienteId: modalAjuste.clienteId, clienteNome: modalAjuste.clienteNome,
    });
    await set(push(ref(db, `fidelidade_pontos/${modalAjuste.clienteId}/historico`)), {
      tipo: delta > 0 ? 'ganho' : 'resgate', pontos: delta,
      descricao: `Ajuste manual: ${ajusteMotivo}`,
      timestamp: Date.now(), operadorNome: currentUser?.nome || 'Sistema',
    });
    if (delta > 0) {
      await enfileirarMensagemFidelidade(
        modalAjuste.clienteId,
        modalAjuste.clienteNome,
        delta,
        novo,
        config.carimbosParaPremio || TOTAL_CARIMBOS
      );
    }
    showToast(`Ajuste de ${delta > 0 ? '+' : ''}${delta} carimbo(s) aplicado!`);
    setModalAjuste(null); setAjusteValor(''); setAjusteMotivo('');
  };

  const meta = config.carimbosParaPremio || TOTAL_CARIMBOS;
  const recompensasArray = Object.entries(config.recompensas || {}).map(([id, r]) => ({ id, ...r }));

  const clientesFiltrados = clientes
    .filter(c => !searchTerm || normalizeString(c.nome).includes(normalizeString(searchTerm)) || c.telefone?.includes(searchTerm))
    .map(c => ({ ...c, dados: dadosClientes[c.id] }))
    .sort((a, b) => (b.dados?.pontos || 0) - (a.dados?.pontos || 0));

  const totalCarimbosCirculacao = Object.values(dadosClientes).reduce((acc, d) => acc + (d.pontos || 0), 0);
  const clientesComCarimbo = Object.keys(dadosClientes).filter(id => (dadosClientes[id]?.pontos || 0) > 0).length;
  const clientesComPremio = Object.keys(dadosClientes).filter(id => (dadosClientes[id]?.pontos || 0) >= meta).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
            <Award size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Cartão Fidelidade</h3>
            <p className="text-sm text-gray-500">
              A cada R$ {config.valorPorCarimbo?.toFixed(0) || '50'} em uma compra = 1 carimbo · {meta} carimbos = 1 prêmio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${config.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {config.ativo ? 'Programa Ativo' : 'Programa Inativo'}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setActiveView('clientes')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'clientes' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Clientes</button>
            {canEdit && <button onClick={() => setActiveView('config')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'config' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configurações</button>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes com Cartão', valor: clientesComCarimbo, icon: <Users size={18} className="text-blue-500" />, cor: 'text-blue-600' },
          { label: 'Carimbos em Circulação', valor: totalCarimbosCirculacao, icon: <Star size={18} className="text-orange-500" />, cor: 'text-orange-600' },
          { label: 'Prêmios Disponíveis', valor: clientesComPremio, icon: <Gift size={18} className="text-green-500" />, cor: 'text-green-600' },
          { label: 'Recompensas Ativas', valor: recompensasArray.filter(r => r.ativo).length, icon: <Award size={18} className="text-purple-500" />, cor: 'text-purple-600' },
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
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-sm w-full" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {clientesFiltrados.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-30" />
                <p>Nenhum cliente encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clientesFiltrados.map(c => {
                  const carimbos = c.dados?.pontos || 0;
                  const temPremio = carimbos >= meta;
                  const historico = c.dados?.historico
                    ? Object.entries(c.dados.historico).map(([id, h]: any) => ({ id, ...h })).sort((a: any, b: any) => b.timestamp - a.timestamp)
                    : [];

                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${temPremio ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {c.nome?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800 text-sm truncate">{c.nome}</p>
                              {temPremio && <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse">🎁 PRÊMIO!</span>}
                            </div>
                            <p className="text-xs text-gray-500">{c.telefone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          {carimbos > 0 && (
                            <CartaoCarimbo carimbos={carimbos} meta={meta} pequeno />
                          )}
                          <div className="text-right">
                            <p className={`font-black text-lg ${carimbos > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{carimbos % meta}<span className="text-xs font-bold text-gray-400">/{meta}</span></p>
                            <p className="text-[10px] text-gray-400">carimbos</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && <button onClick={() => setModalAjuste({ clienteId: c.id, clienteNome: c.nome, carimbos })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ajustar carimbos">
                              <Settings size={15} />
                            </button>}
                            {canEdit && temPremio && (
                              <button onClick={() => setModalResgate({ clienteId: c.id, clienteNome: c.nome, carimbos })} className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors text-xs font-black flex items-center gap-1.5 shadow-sm" title="Resgatar recompensa">
                                <Gift size={14} /> Resgatar recompensa
                              </button>
                            )}
                            <button onClick={() => setExpandido(expandido === c.id ? null : c.id)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                              {expandido === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandido === c.id && (
                        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-3">
                          {carimbos > 0 && (
                            <div className="pt-3">
                              <CartaoCarimbo carimbos={carimbos} meta={meta} />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Histórico</p>
                            {historico.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhuma movimentação.</p>
                            ) : (
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {historico.slice(0, 20).map((h: any) => (
                                  <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                                    <div>
                                      <span className="text-gray-600">{h.descricao}</span>
                                      <span className="text-gray-400 ml-2">{new Date(h.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    <span className={`font-bold ml-4 ${h.pontos > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {h.pontos > 0 ? '+' : ''}{h.pontos} ★
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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
          {/* Regras */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-indigo-500" />
              <h4 className="font-bold text-gray-800">Regras do Cartão</h4>
            </div>

            {/* Preview do cartão */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-black text-lg tracking-tight">ArttBurger</p>
                  <p className="text-xs text-orange-100 font-medium">Cartão Fidelidade</p>
                </div>
                <Award size={28} className="text-orange-200" />
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {Array.from({ length: meta }).map((_, i) => (
                  <div key={i} className={`h-9 rounded-lg flex items-center justify-center font-black text-sm border-2 ${i < 3 ? 'bg-white text-orange-500 border-white shadow-md' : 'bg-orange-400 border-orange-300 text-orange-200'}`}>
                    {i < 3 ? '★' : i + 1}
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-100">A cada R$ {config.valorPorCarimbo?.toFixed(0)} em 1 compra = 1 carimbo · {meta} carimbos = prêmio</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800">Programa Ativo</p>
                <p className="text-xs text-gray-500">Carimbos são acumulados automaticamente no PDV</p>
              </div>
              <button onClick={() => setConfig(p => ({ ...p, ativo: !p.ativo }))} className={`w-12 h-6 rounded-full transition-colors relative ${config.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config.ativo ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Valor mínimo por compra para 1 carimbo (R$)</label>
                <input type="number" min="1" step="1" value={config.valorPorCarimbo} onChange={e => setConfig(p => ({ ...p, valorPorCarimbo: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-sm font-mono font-bold" />
                <p className="text-xs text-gray-400 mt-1">Compra de R$ {config.valorPorCarimbo * 2} = 2 carimbos · R$ {config.valorPorCarimbo - 1} = 0 carimbos</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Carimbos necessários para o prêmio</label>
                <input type="number" min="1" max="20" value={config.carimbosParaPremio} onChange={e => setConfig(p => ({ ...p, carimbosParaPremio: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-sm font-mono font-bold" />
              </div>
            </div>

            <button onClick={salvarConfig} disabled={salvando} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>

          {/* Recompensas */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Gift size={18} className="text-purple-500" />
              <h4 className="font-bold text-gray-800">Prêmios / Recompensas</h4>
            </div>
            <p className="text-xs text-gray-500">Configure o que o cliente ganha ao completar o cartão ({meta} carimbos).</p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recompensasArray.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum prêmio cadastrado.</p>
              ) : recompensasArray.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{r.nome}</p>
                    {r.descricao && <p className="text-xs text-gray-500">{r.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => { const u = { ...config, recompensas: { ...config.recompensas, [r.id!]: { nome: r.nome, descricao: r.descricao || '', ativo: !r.ativo } } }; setConfig(u); set(ref(db, 'fidelidade_config'), u); }} className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{r.ativo ? 'Ativo' : 'Inativo'}</button>
                    {canDelete && <button onClick={() => removerRecompensa(r.id!)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase">Novo Prêmio</p>
              <input type="text" placeholder="Nome do prêmio (ex: Hambúrguer Grátis)" value={novaRecompensa.nome} onChange={e => setNovaRecompensa(p => ({ ...p, nome: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <input type="text" placeholder="Descrição (opcional)" value={novaRecompensa.descricao} onChange={e => setNovaRecompensa(p => ({ ...p, descricao: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <button onClick={adicionarRecompensa} className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Adicionar Prêmio
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
                <div className="bg-green-100 p-2 rounded-xl text-green-600"><Gift size={20} /></div>
                <div>
                  <h3 className="font-black text-gray-800">Resgatar Prêmio</h3>
                  <p className="text-xs text-gray-500">{modalResgate.clienteNome} · {modalResgate.carimbos % meta}/{meta} carimbos</p>
                </div>
              </div>
              <button onClick={() => setModalResgate(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <CartaoCarimbo carimbos={modalResgate.carimbos} meta={meta} />
              <p className="text-sm text-center text-gray-500 mt-2">Escolha o prêmio para resgatar ({meta} carimbos serão descontados):</p>
              {recompensasArray.filter(r => r.ativo).map(r => (
                <button key={r.id} onClick={() => realizarResgate(modalResgate.clienteId, r.id!)} className="w-full flex items-center justify-between p-4 border-2 border-green-200 hover:border-green-400 hover:bg-green-50 rounded-xl transition-colors">
                  <div className="text-left">
                    <p className="font-bold text-gray-800">{r.nome}</p>
                    {r.descricao && <p className="text-xs text-gray-500">{r.descricao}</p>}
                  </div>
                  <span className="font-black text-orange-600">{meta} ★</span>
                </button>
              ))}
              {recompensasArray.filter(r => r.ativo).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum prêmio configurado ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuste */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-800">Ajuste de Carimbos</h3>
                <p className="text-xs text-gray-500">{modalAjuste.clienteNome} · {modalAjuste.carimbos} carimbos atuais</p>
              </div>
              <button onClick={() => setModalAjuste(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Ajuste (negativo para remover)</label>
                <input type="number" value={ajusteValor} onChange={e => setAjusteValor(e.target.value)} placeholder="Ex: 1 ou -2" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-lg font-mono text-center" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Motivo</label>
                <input type="text" value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)} placeholder="Ex: Correção, promoção..." className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
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
