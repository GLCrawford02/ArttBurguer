import { useState, useEffect } from 'react';
import { ref, onValue, update, set, push, remove, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Gift, Star, Users, Settings, Search, X, CheckCircle, XCircle, Trash2, Plus, ChevronDown, ChevronUp, Award, Target, Pencil, Check, ClipboardCheck } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';

export interface ConfigFidelidade {
  ativo: boolean;
  pontosPorReal: number;
  recompensas: Record<string, Recompensa>;
  missoes: Record<string, Missao>;
}

export interface Recompensa {
  id?: string;
  nome: string;
  descricao?: string;
  custoPontos: number;
  ativo: boolean;
  ordem?: number;
  tipo?: 'desconto' | 'produto' | 'frete';
  valorDesconto?: number;
  produtoId?: string | null;
  produtoNome?: string | null;
}

export interface Missao {
  id?: string;
  nome: string;
  descricao?: string;
  pontos: number;
  ativo: boolean;
  categoria?: string;
  ordem?: number;
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

interface MissaoPendente {
  id: string;
  clienteId: string;
  clienteNome: string;
  missaoId: string;
  missaoNome: string;
  pontos: number;
  categoria?: string;
  nickname?: string;
  amigoNome?: string;
  amigoTelefone?: string;
  status: string;
  timestamp: number;
}

const DEFAULT_PONTOS_POR_REAL = 100;

export default function FidelidadeManager({ currentUser, temPermissao }: { currentUser?: any; temPermissao?: any }) {
  const [config, setConfig] = useState<ConfigFidelidade>({
    ativo: true,
    pontosPorReal: DEFAULT_PONTOS_POR_REAL,
    recompensas: {},
    missoes: {},
  });
  const [clientes, setClientes] = useState<any[]>([]);
  const [dadosClientes, setDadosClientes] = useState<Record<string, DadosCliente>>({});
  const [missoesPendentes, setMissoesPendentes] = useState<MissaoPendente[]>([]);
  const [activeView, setActiveView] = useState<'clientes' | 'config' | 'pendencias'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalResgate, setModalResgate] = useState<{ clienteId: string; clienteNome: string; pontos: number } | null>(null);
  const [modalAjuste, setModalAjuste] = useState<{ clienteId: string; clienteNome: string; pontos: number } | null>(null);
  const [ajusteValor, setAjusteValor] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [novaRecompensa, setNovaRecompensa] = useState<Partial<Recompensa>>({ nome: '', descricao: '', custoPontos: 1000, ativo: true, tipo: 'desconto', valorDesconto: 0 });
  const [produtos, setProdutos] = useState<any[]>([]);
  const [novaMissao, setNovaMissao] = useState<Partial<Missao>>({ nome: '', descricao: '', pontos: 100, ativo: true, categoria: 'Outros' });
  const [editandoRecompensaId, setEditandoRecompensaId] = useState<string | null>(null);
  const [editRecompensa, setEditRecompensa] = useState<Partial<Recompensa>>({});
  const [editandoMissaoId, setEditandoMissaoId] = useState<string | null>(null);
  const [editMissao, setEditMissao] = useState<Partial<Missao>>({});
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
      if (data) setConfig(prev => ({ ...prev, ...data, pontosPorReal: data.pontosPorReal || DEFAULT_PONTOS_POR_REAL, recompensas: data.recompensas || {}, missoes: data.missoes || {} }));
    });
    const unsubClientes = onValue(ref(db, 'clientes'), snap => {
      const data = snap.val();
      setClientes(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubDados = onValue(ref(db, 'fidelidade_pontos'), snap => {
      setDadosClientes(snap.val() || {});
    });
    const unsubMissoesPendentes = onValue(ref(db, 'fidelidade_missoes_pendentes'), snap => {
      const data = snap.val();
      const list = data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) as MissaoPendente[] : [];
      list.sort((a, b) => b.timestamp - a.timestamp);
      setMissoesPendentes(list);
    });
    const unsubProdutos = onValue(ref(db, 'produtos'), snap => {
      const data = snap.val();
      setProdutos(data ? Object.entries(data).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { unsubConfig(); unsubClientes(); unsubDados(); unsubMissoesPendentes(); unsubProdutos(); };
  }, []);

  useEffect(() => {
    if (!canEdit && activeView !== 'clientes') setActiveView('clientes');
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

  // ── Recompensas ────────────────────────────────────────────────────────────
  const adicionarRecompensa = async () => {
    if (!canEdit) { showToast('Você não tem permissão para editar recompensas.', 'error'); return; }
    if (!novaRecompensa.nome?.trim()) { showToast('Informe o nome da recompensa.', 'error'); return; }
    if (!novaRecompensa.custoPontos || novaRecompensa.custoPontos <= 0) { showToast('Informe o custo em pontos.', 'error'); return; }
    if (novaRecompensa.tipo === 'produto' && !novaRecompensa.produtoId) { showToast('Selecione o produto que será concedido.', 'error'); return; }
    const id = push(ref(db, 'fidelidade_config/recompensas')).key!;
    const ordem = Object.keys(config.recompensas || {}).length;
    const tipo = novaRecompensa.tipo || 'desconto';
    const produtoEscolhido = produtos.find(p => p.id === novaRecompensa.produtoId);
    const updated = { ...config, recompensas: { ...(config.recompensas || {}), [id]: {
      nome: novaRecompensa.nome,
      descricao: novaRecompensa.descricao || '',
      custoPontos: Number(novaRecompensa.custoPontos),
      ativo: true,
      ordem,
      tipo,
      valorDesconto: tipo !== 'produto' ? Number(novaRecompensa.valorDesconto || 0) : 0,
      produtoId: tipo === 'produto' && novaRecompensa.produtoId ? novaRecompensa.produtoId : null,
      produtoNome: tipo === 'produto' && produtoEscolhido ? produtoEscolhido.nome : null,
    } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setNovaRecompensa({ nome: '', descricao: '', custoPontos: 1000, ativo: true, tipo: 'desconto', valorDesconto: 0 });
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

  const toggleRecompensaAtiva = async (r: Recompensa & { id: string }) => {
    if (!canEdit) return;
    const updated = { ...config, recompensas: { ...config.recompensas, [r.id]: { ...config.recompensas[r.id], ativo: !r.ativo } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
  };

  const moverRecompensa = async (id: string, direcao: 'up' | 'down') => {
    if (!canEdit) return;
    const ordenadas = recompensasArray;
    const idx = ordenadas.findIndex(r => r.id === id);
    const alvo = direcao === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || alvo < 0 || alvo >= ordenadas.length) return;
    const a = ordenadas[idx];
    const b = ordenadas[alvo];
    const updated = {
      ...config,
      recompensas: {
        ...config.recompensas,
        [a.id!]: { ...config.recompensas[a.id!], ordem: alvo },
        [b.id!]: { ...config.recompensas[b.id!], ordem: idx },
      },
    };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
  };

  const iniciarEdicaoRecompensa = (r: Recompensa & { id: string }) => {
    setEditandoRecompensaId(r.id);
    setEditRecompensa({ nome: r.nome, descricao: r.descricao || '', custoPontos: r.custoPontos, tipo: r.tipo || 'desconto', valorDesconto: r.valorDesconto || 0, produtoId: r.produtoId, produtoNome: r.produtoNome });
  };

  const salvarEdicaoRecompensa = async (id: string) => {
    if (!canEdit) return;
    if (!editRecompensa.nome?.trim()) { showToast('Informe o nome da recompensa.', 'error'); return; }
    if (!editRecompensa.custoPontos || editRecompensa.custoPontos <= 0) { showToast('Informe o custo em pontos.', 'error'); return; }
    const tipo = editRecompensa.tipo || 'desconto';
    if (tipo === 'produto' && !editRecompensa.produtoId) { showToast('Selecione o produto que será concedido.', 'error'); return; }
    const atual = config.recompensas[id];
    const produtoEscolhido = produtos.find(p => p.id === editRecompensa.produtoId);
    const updated = { ...config, recompensas: { ...config.recompensas, [id]: {
      ...atual,
      nome: editRecompensa.nome,
      descricao: editRecompensa.descricao || '',
      custoPontos: Number(editRecompensa.custoPontos),
      tipo,
      valorDesconto: tipo !== 'produto' ? Number(editRecompensa.valorDesconto || 0) : 0,
      produtoId: tipo === 'produto' && editRecompensa.produtoId ? editRecompensa.produtoId : null,
      produtoNome: tipo === 'produto' && (produtoEscolhido || editRecompensa.produtoNome) ? (produtoEscolhido?.nome || editRecompensa.produtoNome) : null,
    } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setEditandoRecompensaId(null);
    showToast('Recompensa atualizada!');
  };

  // ── Missões ───────────────────────────────────────────────────────────────
  const adicionarMissao = async () => {
    if (!canEdit) { showToast('Você não tem permissão para editar missões.', 'error'); return; }
    if (!novaMissao.nome?.trim()) { showToast('Informe o nome da missão.', 'error'); return; }
    if (!novaMissao.pontos || novaMissao.pontos <= 0) { showToast('Informe os pontos da missão.', 'error'); return; }
    const id = push(ref(db, 'fidelidade_config/missoes')).key!;
    const ordem = Object.keys(config.missoes || {}).length;
    const updated = { ...config, missoes: { ...(config.missoes || {}), [id]: { nome: novaMissao.nome, descricao: novaMissao.descricao || '', pontos: Number(novaMissao.pontos), ativo: true, ordem, categoria: novaMissao.categoria || 'Outros' } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setNovaMissao({ nome: '', descricao: '', pontos: 100, ativo: true, categoria: 'Outros' });
    showToast('Missão adicionada!');
  };

  const removerMissao = async (id: string) => {
    if (!canDelete) { showToast('Você não tem permissão para apagar missões.', 'error'); return; }
    const updated = { ...config, missoes: { ...config.missoes } };
    delete updated.missoes[id];
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    showToast('Missão removida.');
  };

  const toggleMissaoAtiva = async (m: Missao & { id: string }) => {
    if (!canEdit) return;
    const updated = { ...config, missoes: { ...config.missoes, [m.id]: { nome: m.nome, descricao: m.descricao || '', pontos: m.pontos, ativo: !m.ativo, ordem: m.ordem, categoria: m.categoria || 'Outros' } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
  };

  const moverMissao = async (id: string, direcao: 'up' | 'down') => {
    if (!canEdit) return;
    const ordenadas = missoesArray;
    const idx = ordenadas.findIndex(m => m.id === id);
    const alvo = direcao === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || alvo < 0 || alvo >= ordenadas.length) return;
    const a = ordenadas[idx];
    const b = ordenadas[alvo];
    const updated = {
      ...config,
      missoes: {
        ...config.missoes,
        [a.id!]: { ...config.missoes[a.id!], ordem: alvo },
        [b.id!]: { ...config.missoes[b.id!], ordem: idx },
      },
    };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
  };

  const iniciarEdicaoMissao = (m: Missao & { id: string }) => {
    setEditandoMissaoId(m.id);
    setEditMissao({ nome: m.nome, descricao: m.descricao || '', pontos: m.pontos, categoria: m.categoria || 'Outros' });
  };

  const salvarEdicaoMissao = async (id: string) => {
    if (!canEdit) return;
    if (!editMissao.nome?.trim()) { showToast('Informe o nome da missão.', 'error'); return; }
    if (!editMissao.pontos || editMissao.pontos <= 0) { showToast('Informe os pontos da missão.', 'error'); return; }
    const atual = config.missoes[id];
    const updated = { ...config, missoes: { ...config.missoes, [id]: { ...atual, nome: editMissao.nome, descricao: editMissao.descricao || '', pontos: Number(editMissao.pontos), categoria: editMissao.categoria || 'Outros' } } };
    setConfig(updated);
    await set(ref(db, 'fidelidade_config'), updated);
    setEditandoMissaoId(null);
    showToast('Missão atualizada!');
  };

  // ── Mensagens ─────────────────────────────────────────────────────────────
  const normalizarTelefoneMensagem = (telefone?: string) => {
    let tel = (telefone || '').replace(/\D/g, '');
    if (tel.length < 10) return '';
    if (!tel.startsWith('55')) tel = `55${tel}`;
    return tel;
  };

  const montarMensagemFidelidade = (clienteNome: string, pontosGanhos: number, totalPontos: number, pontosPorReal: number) => {
    const primeiroNome = (clienteNome || 'cliente').split(' ')[0];
    const valorReais = (totalPontos / pontosPorReal).toFixed(2);
    return `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Você ganhou *${pontosGanhos} pontos* no seu cartão fidelidade.\n\nSeu saldo agora é de *${totalPontos} pontos* (equivalente a R$ ${valorReais}).\n\nObrigado pela preferência!`;
  };

  const enfileirarMensagemFidelidade = async (clienteId: string, clienteNome: string, pontosGanhos: number, totalPontos: number, pontosPorReal: number) => {
    const cliente = clientes.find(c => c.id === clienteId);
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem: montarMensagemFidelidade(clienteNome, pontosGanhos, totalPontos, pontosPorReal),
      status: 'pendente',
      origem: 'fidelidade',
      timestamp: Date.now(),
    });
  };

  const enfileirarMensagemResgate = async (clienteId: string, clienteNome: string, recompensaNome: string, custoPontos: number, saldoPontos: number) => {
    const cliente = clientes.find(c => c.id === clienteId);
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    const primeiroNome = (clienteNome || 'cliente').split(' ')[0];
    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem: `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Sua recompensa *${recompensaNome}* foi resgatada com sucesso.\n\nForam descontados *${custoPontos} pontos* do seu saldo, e seu saldo agora é de *${saldoPontos} pontos*.\n\nAguardamos você para continuar pontuando!\n\nObrigado pela preferência!`,
      status: 'pendente',
      origem: 'fidelidade_resgate',
      timestamp: Date.now(),
    });
  };

  const enfileirarMensagemMissao = async (clienteId: string, clienteNome: string, missaoNome: string, aprovada: boolean) => {
    const cliente = clientes.find(c => c.id === clienteId);
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    const primeiroNome = (clienteNome || 'cliente').split(' ')[0];
    const mensagem = aprovada
      ? `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Sua missão *${missaoNome}* foi verificada e aprovada. Os pontos já foram creditados na sua conta!\n\nObrigado pela preferência!`
      : `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Não conseguimos confirmar a conclusão da missão *${missaoNome}*. Você pode tentar novamente quando quiser.\n\nQualquer dúvida, fale com a gente!`;

    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem,
      status: 'pendente',
      origem: 'fidelidade_missao',
      timestamp: Date.now(),
    });
  };

  const aprovarMissaoPendente = async (mp: MissaoPendente) => {
    if (!canEdit) { showToast('Você não tem permissão para aprovar missões.', 'error'); return; }
    const pontosRef = ref(db, `fidelidade_pontos/${mp.clienteId}`);
    const resultado = await runTransaction(pontosRef, (dados) => {
      const atual = dados || { clienteId: mp.clienteId, clienteNome: mp.clienteNome, pontos: 0, totalGasto: 0 };
      atual.pontos = (atual.pontos || 0) + mp.pontos;
      atual.clienteId = mp.clienteId;
      atual.clienteNome = mp.clienteNome;
      return atual;
    });
    await set(push(ref(db, `fidelidade_pontos/${mp.clienteId}/historico`)), {
      tipo: 'ganho',
      pontos: mp.pontos,
      descricao: `Missão concluída: ${mp.missaoNome}`,
      timestamp: Date.now(),
      operadorNome: currentUser?.nome || 'Sistema',
    });
    const totalPontosAtualizado = Number(resultado.snapshot.val()?.pontos || mp.pontos);
    await enfileirarMensagemFidelidade(mp.clienteId, mp.clienteNome, mp.pontos, totalPontosAtualizado, config.pontosPorReal || DEFAULT_PONTOS_POR_REAL);
    await remove(ref(db, `fidelidade_missoes_pendentes/${mp.id}`));
    showToast(`Missão "${mp.missaoNome}" aprovada! +${mp.pontos} pontos para ${mp.clienteNome}.`);
  };

  const rejeitarMissaoPendente = async (mp: MissaoPendente) => {
    if (!canEdit) { showToast('Você não tem permissão para rejeitar missões.', 'error'); return; }
    await enfileirarMensagemMissao(mp.clienteId, mp.clienteNome, mp.missaoNome, false);
    await remove(ref(db, `fidelidade_missoes_pendentes/${mp.id}`));
    showToast(`Missão "${mp.missaoNome}" rejeitada.`);
  };

  const realizarResgate = async (clienteId: string, recompensaId: string) => {
    if (!canEdit) { showToast('Você não tem permissão para resgatar recompensas.', 'error'); return; }
    const recomp = config.recompensas[recompensaId];
    const dados = dadosClientes[clienteId];
    const custoPontos = recomp.custoPontos || 0;
    const pontosAtuais = dados?.pontos || 0;
    if (pontosAtuais < custoPontos) { showToast('Pontos insuficientes.', 'error'); return; }
    const novosPontos = pontosAtuais - custoPontos;
    await update(ref(db, `fidelidade_pontos/${clienteId}`), { pontos: novosPontos });
    await set(push(ref(db, `fidelidade_pontos/${clienteId}/historico`)), {
      tipo: 'resgate', pontos: -custoPontos,
      descricao: `Recompensa resgatada: ${recomp.nome}`,
      timestamp: Date.now(),
      operadorNome: currentUser?.nome || 'Sistema',
    });
    await enfileirarMensagemResgate(clienteId, dados?.clienteNome || modalResgate?.clienteNome || 'Cliente', recomp.nome, custoPontos, novosPontos);
    showToast(`Recompensa "${recomp.nome}" resgatada! -${custoPontos} pontos.`);
    setModalResgate(null);
  };

  const realizarAjuste = async () => {
    if (!canEdit) { showToast('Você não tem permissão para ajustar pontos.', 'error'); return; }
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
        config.pontosPorReal || DEFAULT_PONTOS_POR_REAL
      );
    }
    showToast(`Ajuste de ${delta > 0 ? '+' : ''}${delta} ponto(s) aplicado!`);
    setModalAjuste(null); setAjusteValor(''); setAjusteMotivo('');
  };

  const pontosPorReal = config.pontosPorReal || DEFAULT_PONTOS_POR_REAL;
  const recompensasArray = Object.entries(config.recompensas || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const missoesArray = Object.entries(config.missoes || {}).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const recompensasAtivas = recompensasArray.filter(r => r.ativo);
  const categoriasRecompensaDef: { key: string; label: string; match: (r: Recompensa) => boolean }[] = [
    { key: 'desconto', label: '💸 Descontos no Pedido', match: r => (r.tipo || 'desconto') === 'desconto' },
    { key: 'frete', label: '🚚 Abatimento no Frete', match: r => r.tipo === 'frete' },
    { key: 'produto', label: '🎁 Produtos Grátis', match: r => r.tipo === 'produto' },
  ];
  const menorCustoAtivo = recompensasAtivas.length > 0 ? Math.min(...recompensasAtivas.map(r => r.custoPontos || 0)) : null;

  const clientesFiltrados = clientes
    .filter(c => !searchTerm || normalizeString(c.nome).includes(normalizeString(searchTerm)) || c.telefone?.includes(searchTerm))
    .map(c => ({ ...c, dados: dadosClientes[c.id] }))
    .sort((a, b) => (b.dados?.pontos || 0) - (a.dados?.pontos || 0));

  const totalPontosCirculacao = Object.values(dadosClientes).reduce((acc, d) => acc + (d.pontos || 0), 0);
  const clientesComPontos = Object.keys(dadosClientes).filter(id => (dadosClientes[id]?.pontos || 0) > 0).length;
  const clientesComResgateDisponivel = menorCustoAtivo !== null
    ? Object.keys(dadosClientes).filter(id => (dadosClientes[id]?.pontos || 0) >= (menorCustoAtivo as number)).length
    : 0;

  const categoriasMissoes = ['Indicação', 'Instagram', 'TikTok', 'Pedidos', 'Avaliação', 'Facebook', 'X (Twitter)', 'Outros'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
            <Award size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Programa de Pontos</h3>
            <p className="text-sm text-gray-500">
              A cada R$ 1,00 em uma compra (salão ou delivery) = {pontosPorReal} pontos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${config.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {config.ativo ? 'Programa Ativo' : 'Programa Inativo'}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setActiveView('clientes')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'clientes' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Clientes</button>
            {canEdit && (
              <button onClick={() => setActiveView('pendencias')} className={`relative px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'pendencias' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Missões Pendentes
                {missoesPendentes.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{missoesPendentes.length}</span>
                )}
              </button>
            )}
            {canEdit && <button onClick={() => setActiveView('config')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeView === 'config' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configurações</button>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clientes com Pontos', valor: clientesComPontos, icon: <Users size={18} className="text-blue-500" />, cor: 'text-blue-600' },
          { label: 'Pontos em Circulação', valor: totalPontosCirculacao.toLocaleString('pt-BR'), sub: `≈ R$ ${(totalPontosCirculacao / pontosPorReal).toFixed(2)}`, icon: <Star size={18} className="text-orange-500" />, cor: 'text-orange-600' },
          { label: 'Clientes c/ Resgate Disponível', valor: clientesComResgateDisponivel, icon: <Gift size={18} className="text-green-500" />, cor: 'text-green-600' },
          { label: 'Recompensas / Missões Ativas', valor: `${recompensasAtivas.length} / ${missoesArray.filter(m => m.ativo).length}`, icon: <Award size={18} className="text-purple-500" />, cor: 'text-purple-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
              {k.icon}
            </div>
            <p className={`text-2xl font-black ${k.cor}`}>{k.valor}</p>
            {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
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
                  const pontos = c.dados?.pontos || 0;
                  const podeResgatar = menorCustoAtivo !== null && pontos >= (menorCustoAtivo as number);
                  const historico = c.dados?.historico
                    ? Object.entries(c.dados.historico).map(([id, h]: any) => ({ id, ...h })).sort((a: any, b: any) => b.timestamp - a.timestamp)
                    : [];

                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${podeResgatar ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {c.nome?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800 text-sm truncate">{c.nome}</p>
                              {podeResgatar && <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse">🎁 RESGATE!</span>}
                            </div>
                            <p className="text-xs text-gray-500">{c.telefone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          <div className="text-right">
                            <p className={`font-black text-lg ${pontos > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{pontos.toLocaleString('pt-BR')}</p>
                            <p className="text-[10px] text-gray-400">pontos · R$ {(pontos / pontosPorReal).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && <button onClick={() => setModalAjuste({ clienteId: c.id, clienteNome: c.nome, pontos })} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ajustar pontos">
                              <Settings size={15} />
                            </button>}
                            {canEdit && recompensasAtivas.length > 0 && (
                              <button onClick={() => setModalResgate({ clienteId: c.id, clienteNome: c.nome, pontos })} className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-black flex items-center gap-1.5 shadow-sm ${podeResgatar ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title="Resgatar recompensa">
                                <Gift size={14} /> Resgatar
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
                          <div className="pt-3">
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
                                      {h.pontos > 0 ? '+' : ''}{h.pontos} pts
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

      {activeView === 'pendencias' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {missoesPendentes.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <ClipboardCheck size={40} className="mx-auto mb-2 opacity-30" />
              <p>Nenhuma missão aguardando verificação.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {missoesPendentes.map(mp => (
                <div key={mp.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shrink-0">
                      <Target size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-800 truncate">{mp.clienteNome}</p>
                      <p className="text-xs text-gray-500 truncate">{mp.missaoNome}</p>
                      {mp.amigoNome && (
                        <p className="text-xs font-bold text-purple-600 truncate mt-0.5">👥 Indicou: {mp.amigoNome} {mp.amigoTelefone ? `• ${mp.amigoTelefone}` : ''}</p>
                      )}
                      {mp.nickname && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">@{mp.nickname}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(mp.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg shrink-0">+{mp.pontos.toLocaleString('pt-BR')} pts</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => aprovarMissaoPendente(mp)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors" title="Aprovar"><CheckCircle size={18} /></button>
                    <button onClick={() => rejeitarMissaoPendente(mp)} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors" title="Rejeitar"><XCircle size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regras */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-indigo-500" />
              <h4 className="font-bold text-gray-800">Regras do Programa</h4>
            </div>

            {/* Preview */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-black text-lg tracking-tight">ArttBurger</p>
                  <p className="text-xs text-orange-100 font-medium">Programa de Pontos</p>
                </div>
                <Award size={28} className="text-orange-200" />
              </div>
              <p className="text-xs text-orange-100">A cada R$ 1,00 gasto (salão ou delivery) = {pontosPorReal} pontos. Ex: compra de R$ 60,00 = {(60 * pontosPorReal).toLocaleString('pt-BR')} pontos.</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="font-bold text-sm text-gray-800">Programa Ativo</p>
                <p className="text-xs text-gray-500">Pontos são acumulados automaticamente no PDV e no Delivery</p>
              </div>
              <button onClick={() => setConfig(p => ({ ...p, ativo: !p.ativo }))} className={`w-12 h-6 rounded-full transition-colors relative ${config.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${config.ativo ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Pontos ganhos por R$ 1,00 gasto</label>
                <input type="number" min="1" step="1" value={config.pontosPorReal} onChange={e => setConfig(p => ({ ...p, pontosPorReal: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-sm font-mono font-bold" />
                <p className="text-xs text-gray-400 mt-1">Padrão: 100 pontos = R$ 1,00 (1 ponto = R$ 0,01)</p>
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
              <h4 className="font-bold text-gray-800">Recompensas para Resgate</h4>
            </div>
            <p className="text-xs text-gray-500">Configure os prêmios (frete grátis, refrigerante, sanduíches...) e o custo em pontos de cada um.</p>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recompensasArray.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma recompensa cadastrada.</p>
              ) : categoriasRecompensaDef.map(cat => {
                const itensCategoria = recompensasArray.filter(cat.match);
                if (itensCategoria.length === 0) return null;
                return (
                  <div key={cat.key} className="space-y-2">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide">{cat.label}</p>
                    {itensCategoria.map(r => {
                      const idx = recompensasArray.findIndex(x => x.id === r.id);
                      return (
                <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                  {editandoRecompensaId === r.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editRecompensa.nome} onChange={e => setEditRecompensa(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
                      <input type="text" value={editRecompensa.descricao} onChange={e => setEditRecompensa(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição (opcional)" className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
                      <input type="number" min="1" value={editRecompensa.custoPontos} onChange={e => setEditRecompensa(p => ({ ...p, custoPontos: Number(e.target.value) }))} placeholder="Custo em pontos" className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm font-mono font-bold" />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditRecompensa(p => ({ ...p, tipo: 'desconto' }))} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${(editRecompensa.tipo || 'desconto') === 'desconto' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Desconto (R$)</button>
                        <button type="button" onClick={() => setEditRecompensa(p => ({ ...p, tipo: 'frete' }))} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${editRecompensa.tipo === 'frete' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Abatimento no Frete</button>
                        <button type="button" onClick={() => setEditRecompensa(p => ({ ...p, tipo: 'produto' }))} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${editRecompensa.tipo === 'produto' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Produto Grátis</button>
                      </div>
                      {(editRecompensa.tipo || 'desconto') !== 'produto' ? (
                        <input type="number" min="0" step="0.01" value={editRecompensa.valorDesconto ?? 0} onChange={e => setEditRecompensa(p => ({ ...p, valorDesconto: Number(e.target.value) }))} placeholder={editRecompensa.tipo === 'frete' ? 'Abatimento no frete até (R$)' : 'Valor do desconto (R$)'} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm font-mono" />
                      ) : (
                        <select value={editRecompensa.produtoId || ''} onChange={e => { const prod = produtos.find(pp => pp.id === e.target.value); setEditRecompensa(p => ({ ...p, produtoId: e.target.value, produtoNome: prod?.nome })); }} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm">
                          <option value="">Selecione o produto...</option>
                          {[...produtos].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => salvarEdicaoRecompensa(r.id)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Check size={15} /></button>
                        <button onClick={() => setEditandoRecompensaId(null)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"><X size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {canEdit && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moverRecompensa(r.id!, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                            <button onClick={() => moverRecompensa(r.id!, 'down')} disabled={idx === recompensasArray.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{r.nome}</p>
                          {r.descricao && <p className="text-xs text-gray-500">{r.descricao}</p>}
                          <p className="text-xs font-black text-orange-600 mt-0.5">{(r.custoPontos || 0).toLocaleString('pt-BR')} pts <span className="text-gray-400 font-normal">(R$ {((r.custoPontos || 0) / pontosPorReal).toFixed(2)})</span></p>
                          <p className="text-xs font-bold mt-0.5">
                            {r.tipo === 'produto'
                              ? <span className="text-green-600">🎁 Produto: {r.produtoNome || '(não definido)'}</span>
                              : r.tipo === 'frete'
                              ? <span className="text-amber-600">🚚 Abatimento no frete: até R$ {(r.valorDesconto || 0).toFixed(2)}</span>
                              : <span className="text-blue-600">💸 Desconto: R$ {(r.valorDesconto || 0).toFixed(2)}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button onClick={() => toggleRecompensaAtiva(r as any)} className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{r.ativo ? 'Ativo' : 'Inativo'}</button>
                        {canEdit && <button onClick={() => iniciarEdicaoRecompensa(r as any)} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"><Pencil size={13} /></button>}
                        {canDelete && <button onClick={() => removerRecompensa(r.id!)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>}
                      </div>
                    </div>
                  )}
                </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase">Nova Recompensa</p>
              <input type="text" placeholder="Nome (ex: Frete Grátis, Refrigerante, X-Salada)" value={novaRecompensa.nome} onChange={e => setNovaRecompensa(p => ({ ...p, nome: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <input type="text" placeholder="Descrição (opcional)" value={novaRecompensa.descricao} onChange={e => setNovaRecompensa(p => ({ ...p, descricao: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm" />
              <input type="number" min="1" placeholder="Custo em pontos" value={novaRecompensa.custoPontos} onChange={e => setNovaRecompensa(p => ({ ...p, custoPontos: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm font-mono font-bold" />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setNovaRecompensa(p => ({ ...p, tipo: 'desconto' }))} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${(novaRecompensa.tipo || 'desconto') === 'desconto' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Desconto (R$)</button>
                <button type="button" onClick={() => setNovaRecompensa(p => ({ ...p, tipo: 'frete' }))} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${novaRecompensa.tipo === 'frete' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Abatimento no Frete</button>
                <button type="button" onClick={() => setNovaRecompensa(p => ({ ...p, tipo: 'produto' }))} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${novaRecompensa.tipo === 'produto' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}`}>Produto Grátis</button>
              </div>
              {(novaRecompensa.tipo || 'desconto') !== 'produto' ? (
                <input type="number" min="0" step="0.01" placeholder={novaRecompensa.tipo === 'frete' ? 'Abatimento no frete até (R$)' : 'Valor do desconto (R$)'} value={novaRecompensa.valorDesconto ?? 0} onChange={e => setNovaRecompensa(p => ({ ...p, valorDesconto: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm font-mono" />
              ) : (
                <select value={novaRecompensa.produtoId || ''} onChange={e => { const prod = produtos.find(pp => pp.id === e.target.value); setNovaRecompensa(p => ({ ...p, produtoId: e.target.value, produtoNome: prod?.nome })); }} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 text-sm">
                  <option value="">Selecione o produto...</option>
                  {[...produtos].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              )}
              <button onClick={adicionarRecompensa} className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Adicionar Recompensa
              </button>
            </div>
          </div>

          {/* Missões */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4 lg:col-span-2">
            <div className="flex items-center gap-3">
              <Target size={18} className="text-blue-500" />
              <h4 className="font-bold text-gray-800">Missões</h4>
            </div>
            <p className="text-xs text-gray-500">Tarefas que o cliente pode realizar (postar nos stories, avaliar, indicar amigos...) para ganhar pontos extras.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {missoesArray.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 md:col-span-2">Nenhuma missão cadastrada.</p>
              ) : missoesArray.map((m, idx) => (
                <div key={m.id} className="p-3 bg-gray-50 rounded-xl">
                  {editandoMissaoId === m.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editMissao.nome} onChange={e => setEditMissao(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da missão" className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
                      <input type="text" value={editMissao.descricao} onChange={e => setEditMissao(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição (opcional)" className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
                      <div className="flex items-center gap-2">
                        <select value={editMissao.categoria || 'Outros'} onChange={e => setEditMissao(p => ({ ...p, categoria: e.target.value }))} className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-gray-50"><option value="" disabled>Categoria</option>{categoriasMissoes.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        <input type="number" min="1" value={editMissao.pontos} onChange={e => setEditMissao(p => ({ ...p, pontos: Number(e.target.value) }))} placeholder="Pontos" className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm font-mono font-bold" />
                        <button onClick={() => salvarEdicaoMissao(m.id)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Check size={15} /></button>
                        <button onClick={() => setEditandoMissaoId(null)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"><X size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {canEdit && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moverMissao(m.id!, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                            <button onClick={() => moverMissao(m.id!, 'down')} disabled={idx === missoesArray.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{m.nome}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase">{m.categoria || 'Outros'}</p>
                          {m.descricao && <p className="text-xs text-gray-500">{m.descricao}</p>}
                          <p className="text-xs font-black text-blue-600 mt-0.5">+{(m.pontos || 0).toLocaleString('pt-BR')} pts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button onClick={() => toggleMissaoAtiva(m as any)} className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{m.ativo ? 'Ativa' : 'Inativa'}</button>
                        {canEdit && <button onClick={() => iniciarEdicaoMissao(m as any)} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"><Pencil size={13} /></button>}
                        {canDelete && <button onClick={() => removerMissao(m.id!)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase">Nova Missão</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input type="text" placeholder="Nome da Missão" value={novaMissao.nome} onChange={e => setNovaMissao(p => ({ ...p, nome: e.target.value }))} className="md:col-span-1 w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
                <select value={novaMissao.categoria || 'Outros'} onChange={e => setNovaMissao(p => ({ ...p, categoria: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm bg-gray-50">{categoriasMissoes.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <input type="number" min="1" placeholder="Pontos" value={novaMissao.pontos} onChange={e => setNovaMissao(p => ({ ...p, pontos: Number(e.target.value) }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm font-mono font-bold" />
              </div>
              <input type="text" placeholder="Descrição / regras (opcional)" value={novaMissao.descricao} onChange={e => setNovaMissao(p => ({ ...p, descricao: e.target.value }))} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
              <button onClick={adicionarMissao} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Adicionar Missão
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
                  <h3 className="font-black text-gray-800">Resgatar Recompensa</h3>
                  <p className="text-xs text-gray-500">{modalResgate.clienteNome} · {modalResgate.pontos.toLocaleString('pt-BR')} pontos disponíveis</p>
                </div>
              </div>
              <button onClick={() => setModalResgate(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {recompensasAtivas.map(r => {
                const dispoivel = modalResgate.pontos >= (r.custoPontos || 0);
                return (
                  <button key={r.id} disabled={!dispoivel} onClick={() => realizarResgate(modalResgate.clienteId, r.id!)} className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-colors ${dispoivel ? 'border-green-200 hover:border-green-400 hover:bg-green-50' : 'border-gray-100 opacity-50 cursor-not-allowed'}`}>
                    <div className="text-left">
                      <p className="font-bold text-gray-800">{r.nome}</p>
                      {r.descricao && <p className="text-xs text-gray-500">{r.descricao}</p>}
                    </div>
                    <span className="font-black text-orange-600 shrink-0 ml-3">{(r.custoPontos || 0).toLocaleString('pt-BR')} pts</span>
                  </button>
                );
              })}
              {recompensasAtivas.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma recompensa configurada ainda.</p>
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
                <h3 className="font-black text-gray-800">Ajuste de Pontos</h3>
                <p className="text-xs text-gray-500">{modalAjuste.clienteNome} · {modalAjuste.pontos.toLocaleString('pt-BR')} pontos atuais</p>
              </div>
              <button onClick={() => setModalAjuste(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Ajuste em pontos (negativo para remover)</label>
                <input type="number" value={ajusteValor} onChange={e => setAjusteValor(e.target.value)} placeholder="Ex: 100 ou -200" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-lg font-mono text-center" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Motivo</label>
                <input type="text" value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)} placeholder="Ex: Missão concluída, correção..." className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
              </div>
              {missoesArray.filter(m => m.ativo).length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Atalho: missões cadastradas</label>
                  <div className="flex flex-wrap gap-1.5">
                    {missoesArray.filter(m => m.ativo).map(m => (
                      <button key={m.id} onClick={() => { setAjusteValor(String(m.pontos)); setAjusteMotivo(`Missão: ${m.nome}`); }} className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                        {m.nome} (+{m.pontos})
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
