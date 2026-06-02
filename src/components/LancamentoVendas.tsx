import { useState, useEffect, useRef, useMemo } from 'react';
import { ref, onValue, push, set, remove, update, runTransaction, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebase';
import { Calculator, CheckCircle, Trash2, AlertTriangle, ArrowRightLeft, Plus, Minus, X, Search, ShoppingCart, Store, User, CreditCard, Receipt, ArrowLeft, Save, Truck, Flame, Pencil, Sparkles, Ticket, Map, Printer, Lock, Bell, Eye, ChevronUp, ChevronDown, BarChart2, Filter } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';
import { ensureFaceModelsLoaded, faceapi, getCameraStream, getCameraErrorMsg } from '../faceApiUtils';
import DescontoModal from './modals/DescontoModal';
import QuickClientModal from './modals/QuickClientModal';
import GarcomIaModal from './modals/GarcomIaModal';
import AuthEditModal from './modals/AuthEditModal';
import ComandaModal from './modals/ComandaModal';
import SimuladorRecebimentoModal from './modals/SimuladorRecebimentoModal';
import PainelEntregasModal from './modals/PainelEntregasModal';
import PdvItemModal from './modals/PdvItemModal';
import AlertPedidoConcluidoModal from './modals/AlertPedidoConcluidoModal';
import MapaView from './views/MapaView';
import ConferenciaView from './views/ConferenciaView';
import ComandasView from './views/ComandasView';

const CARGOS_EDIT_AUTORIZADO = ['Dono', 'TI', 'Admin', 'Administrador', 'Gerente', 'Caixa'];
const AUTH_SESSION_MS = 30 * 1000;

const isPointInPolygon = (point: [number, number], vs: number[][]) => {
  let x = Number(point[0]), y = Number(point[1]);
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = Number(vs[i][0]), yi = Number(vs[i][1]);
    let xj = Number(vs[j][0]), yj = Number(vs[j][1]);
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export default function LancamentoVendas({ currentUser, permissoes = {} }: { currentUser?: any, permissoes?: any }) {
  const [activeView, setActiveView] = useState<'pdv' | 'comandas' | 'conferencia' | 'x9'>('pdv');
  
  const [taxas, setTaxas] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [vendasPdv, setVendasPdv] = useState<any[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [cupons, setCupons] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [pontosPorCliente, setPontosPorCliente] = useState<Record<string, number>>({});

  const [pdvItemModal, setPdvItemModal] = useState<any>(null);
  const [pdvItemOptions, setPdvItemOptions] = useState<any>({
    montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, tamanho: ''
  });

  const [pdvDescontoAplicado, setPdvDescontoAplicado] = useState<{valor: number, cupom?: string, autorizadoPorId: string, autorizadoPorNome: string} | null>(null);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [descontoInput, setDescontoInput] = useState('');
  const [descontoPin, setDescontoPin] = useState('');

  const [authEditModal, setAuthEditModal] = useState<{ itemId: string; delta: 1 | -1 } | null>(null);
  const [authEditMethod, setAuthEditMethod] = useState<'face' | 'pin'>('face');
  const [authEditPin, setAuthEditPin] = useState('');
  const [editAuthSession, setEditAuthSession] = useState<number | null>(null);
  const [faceAuthStatus, setFaceAuthStatus] = useState('');
  const faceAuthVideoRef = useRef<HTMLVideoElement>(null);
  const faceAuthStreamRef = useRef<MediaStream | null>(null);
  const faceAuthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const [pdvView, setPdvView] = useState<'mapa' | 'caixa'>('mapa');
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null);
  const [mesasAbertas, setMesasAbertas] = useState<Record<string, any>>({});
  const [entregasAbertas, setEntregasAbertas] = useState<Record<string, any>>({});
  const [zonasRestritas, setZonasRestritas] = useState<any[]>([]);
  const [zonasValor, setZonasValor] = useState<any[]>([]);
  const [taxasEntregaConfig, setTaxasEntregaConfig] = useState<any>({ taxas: {}, lojaLat: null, lojaLng: null });
  const [pdvTaxaEntregaFixa, setPdvTaxaEntregaFixa] = useState<number | null>(null);
  const [entregaSelecionada, setEntregaSelecionada] = useState<string | null>(null);
  const [qtdMesas, setQtdMesas] = useState(30);

  const [pdvCarrinho, setPdvCarrinho] = useState<Record<string, { produtoId?: string, nome: string, preco: number, qtd: number, enviadoCozinha?: number, concluidoCozinha?: number, opcoes?: any, adicionadoPor?: string, adicionadoEm?: number }>>({});
  const [pdvPagamentos, setPdvPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [pdvDescricao, setPdvDescricao] = useState('');
  const [pdvSearchProd, setPdvSearchProd] = useState('');
  const [pdvSearchCliente, setPdvSearchCliente] = useState('');
  const [pdvCliente, setPdvCliente] = useState<any | null>(null);
  const [pdvTipoPedido, setPdvTipoPedido] = useState<'Balcão' | 'Entrega' | 'Mesa'>('Balcão');
  const [pdvIsRetirada, setPdvIsRetirada] = useState(false);
  const [showPainelEntregas, setShowPainelEntregas] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [pdvCategoria, setPdvCategoria] = useState<string>('Todos');
  const [categoriasCardapioDb, setCategoriasCardapioDb] = useState<any[]>([]);

  const entregasVisiveisPdv = useMemo(() => {
    const filtered: Record<string, any> = {};
    Object.entries(entregasAbertas).forEach(([id, entrega]) => {
      if (entrega.statusEntrega !== 'Em Rota') {
        filtered[id] = entrega;
      }
    });
    return filtered;
  }, [entregasAbertas]);

  const [pdvSessaoId, setPdvSessaoId] = useState<string>(`sessao_${Date.now()}`);

  const [showConfModal, setShowConfModal] = useState(false);
  const [editConfId, setEditConfId] = useState<string | null>(null);
  const [confCarrinho, setConfCarrinho] = useState<Record<string, { nome: string, preco: number, qtd: number }>>({});
  const [confPagamentos, setConfPagamentos] = useState<{ taxaId: string; valor: number | '' }[]>([{ taxaId: '', valor: 0 }]);
  const [confDescricao, setConfDescricao] = useState('');
  const [confSearchProd, setConfSearchProd] = useState('');
  const [viewComanda, setViewComanda] = useState<any>(null);
  
  const [showIaModal, setShowIaModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [configImpressoras, setConfigImpressoras] = useState<Record<string, string>>({});
  const [impressorasIPs, setImpressorasIPs] = useState<{ cozinha: string; balcao: string }>({ cozinha: '', balcao: '' });
  const [configFidelidade, setConfigFidelidade] = useState<{ ativo: boolean; valorPorCarimbo: number; carimbosParaPremio: number } | null>(null);
  const [embalagensGrupos, setEmbalagensGrupos] = useState<Record<string, { categorias: string[]; delivery: { insumoId: string; quantidade: number }[]; salao: { insumoId: string; quantidade: number }[] }>>({});

  const [alertPedidoConcluido, setAlertPedidoConcluido] = useState<any | null>(null);
  const pedidosConcluidosRef = useRef<Set<string>>(new Set());
  const pedidoStatusRef = useRef<Record<string, string>>({});
  const dedupPedidosCozinhaRef = useRef<Record<string, number>>({});
  const dedupImpressaoRef = useRef<Record<string, number>>({});
  const primeiraLeituraPedidosRef = useRef(true);
  const funcionariosRef = useRef<any[]>([]);
  const confirmacoesX9Ref = useRef<Set<string>>(new Set());
  const [logsX9List, setLogsX9List] = useState<any[]>([]);

  const [expandedSessao, setExpandedSessao] = useState<string | null>(null);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getCurrentIdentificador = () => {
    if (pdvTipoPedido === 'Mesa') return getMesaIdentificador(mesaSelecionada, pdvCliente?.nome);
    if (pdvTipoPedido === 'Entrega') return `Delivery: ${pdvCliente?.nome || ''}`;
    return `Balcão: ${pdvCliente?.nome || ''}`;
  };

  const registrarLogX9 = async (sessaoId: string, identificador: string, tipoEvento: string, descricao: string, atorNome: string, autorizadorNome?: string | null, detalhes?: any) => {
    try {
      await set(push(ref(db, 'logs_x9')), {
        sessaoId,
        identificador,
        tipoEvento,
        descricao,
        atorNome,
        autorizadorNome: autorizadorNome || null,
        timestamp: Date.now(),
        detalhes: detalhes || null
      });
    } catch (e) { console.error('Erro ao registrar log X9', e); }
  };

  const getStableHash = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(36);
  };

  const isRecentDuplicate = (store: Record<string, number>, key: string, windowMs = 15000) => {
    const now = Date.now();
    const prev = store[key];
    if (prev && now - prev < windowMs) return true;
    store[key] = now;
    return false;
  };

  const buildOrderDedupKey = (identificador: string, tipo: string, referenciaId: string | undefined, itens: any[]) => {
    const normalized = JSON.stringify({
      identificador,
      tipo,
      referenciaId: referenciaId || '',
      itens: itens.map((item: any) => ({
        cartItemId: item.cartItemId,
        produtoId: item.produtoId,
        nome: item.nome,
        qtd: item.qtd,
        opcoes: item.opcoes || null
      }))
    });
    return `pedido_${getStableHash(normalized)}`;
  };

  const buildPrintJobDedupKey = (job: any) => {
    const normalized = JSON.stringify({
      type: job.type,
      printerIp: job.printerIp,
      identificador: job.identificador,
      destLabel: job.destLabel || null,
      clienteNome: job.clienteNome || null,
      total: job.total || null,
      itens: (job.itens || []).map((item: any) => ({
        cartItemId: item.cartItemId || item.id,
        produtoId: item.produtoId,
        nome: item.nome,
        qtd: item.qtd,
        opcoes: item.opcoes || null
      }))
    });
    return `print_${getStableHash(normalized)}`;
  };

  const formatPhone = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2').substring(0, 15);

  const getMesaIdentificador = (numero?: number | null, clienteNome?: string | null) => {
    const mesa = `Mesa ${numero || ''}`.trim();
    const nome = (clienteNome || '').trim();
    return nome ? `${mesa} - ${nome}` : mesa;
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

    return `🍔 *ArttBurger Fidelidade*\n\nOlá, *${primeiroNome}*! Você ganhou *${carimbosGanhos} carimbo(s)* na sua compra.\n\nSua nova pontuação é: *${totalCarimbos} carimbo(s)*.\nCartão atual: *${carimbosNoCartao}/${meta}*.${statusCartao}\n\nObrigado pela preferência!`;
  };

  const enfileirarMensagemFidelidade = async (cliente: any, carimbosGanhos: number, totalCarimbos: number, meta: number) => {
    const telefone = normalizarTelefoneMensagem(cliente?.telefone);
    if (!telefone) return;

    await set(push(ref(db, 'fila_mensagens')), {
      telefone,
      mensagem: montarMensagemFidelidade(cliente.nome, carimbosGanhos, totalCarimbos, meta),
      status: 'pendente',
      origem: 'fidelidade',
      timestamp: Date.now(),
    });
  };

  const handleCriarClienteVinculado = async () => {
    const nomeForm = quickClientName.trim();
    const telForm = quickClientPhone.trim();
    const cleanPhone = telForm.replace(/\D/g, '');
    
    if (!nomeForm || !telForm) return showToast('Nome e Telefone são obrigatórios.', 'error');
    
    const normalizePhoneForComparison = (p: string) => {
      const digits = p.replace(/\D/g, '');
      if (digits.length === 11) return digits.substring(0, 2) + digits.substring(3);
      return digits;
    };

    const targetPhone = normalizePhoneForComparison(cleanPhone);
    const existe = clientes.find((c: any) => normalizePhoneForComparison(c.telefone || '') === targetPhone);
    if (existe) {
      showToast(`Telefone já cadastrado para o cliente: ${existe.nome}`, 'error');
      return;
    }
    
    const newRef = push(ref(db, 'clientes'));
    const pinAleatorio = Math.floor(100000 + Math.random() * 900000).toString();
    const novoCliente = { id: newRef.key, nome: nomeForm, telefone: telForm, pin: pinAleatorio, timestamp: Date.now() };
    await set(newRef, novoCliente);
    
    // Enviar mensagem de boas vindas / fidelidade se tiver telefone
    if (telForm) {
      const cleanPhone2 = telForm.replace(/\D/g, '');
      if (cleanPhone2.length >= 10) {
        const msgFidelidade = `*🍔 Bem-vindo ao ArttBurger! 🍔*\n\nSeu cadastro foi realizado com sucesso e você já está participando do nosso *Programa de Fidelidade*!\n\n*Sua senha de acesso ao aplicativo:* ${pinAleatorio}\n\n*Como funciona?*\n✨ Cada ponto é adquirido com o consumo de R$ 50,00 (independente do produto).\n✨ Os pontos não são acumulativos nem transferíveis.\n✨ Nosso sistema irá avisar sempre que você receber uma pontuação.\n\n*Recompensa:*\nA cada 10 pontos, você pode trocar por qualquer um dos nossos *Artesanais Clássicos*:\n🍔 Artt Burger\n🍔 Artt Burger Pepper Jelly\n🍔 Artt Burger Barbecue\n🍔 Artt Burger Cheddar\n🍔 Artt Burger Bacon\n\nAgradecemos a preferência e bom apetite!`;
        await set(push(ref(db, 'fila_mensagens')), {
          telefone: cleanPhone2,
          mensagem: msgFidelidade,
          status: 'pendente',
          timestamp: Date.now()
        });
      }
    }
    
    setPdvCliente(novoCliente);
    setShowQuickClientModal(false);
    setQuickClientName('');
    setQuickClientPhone('');
    setPdvSearchCliente('');
    showToast('Cliente cadastrado e vinculado!', 'success');
  };

  const temPermissao = (modulo: string, abaId?: string) => {
    if (!currentUser) return false;
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    if (cargos.includes('Dono') || cargos.includes('TI')) return true;
    return cargos.some((c: string) => {
      const p = permissoes[c];
      if (!p) return false;
      if (abaId && p[abaId] && p[abaId].visualizar === false) return false;
      return p[modulo]?.visualizar;
    });
  };

  const isAdminOrGerente = temPermissao('pdv_conferencia', 'aba_pdv');

  const normalizeStatus = (v: any) => String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const statusConcluidoNorm = normalizeStatus('Concluído');
  const canViewComandas = temPermissao('pdv_comandas', 'aba_pdv');
  const isCaixaOrAdmin = temPermissao('vendas', 'aba_pdv');
  const canDelivery = temPermissao('pdv_delivery', 'aba_pdv');
  const canViewX9 = isAdminOrGerente || isCaixaOrAdmin || canViewComandas;
  const canCancelTable = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => CARGOS_EDIT_AUTORIZADO.includes(c)) : CARGOS_EDIT_AUTORIZADO.includes(currentUser.cargo as string));
  const normalizeCargoText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const getCargoTokens = () => {
    const rawCargos = Array.isArray(currentUser?.cargo) ? currentUser.cargo : [currentUser?.cargo || ''];
    return rawCargos.map((cargo: string) => normalizeCargoText(String(cargo || ''))).filter(Boolean);
  };

  useEffect(() => {
    if (!isAdminOrGerente && activeView === 'conferencia') setActiveView('pdv');
    if (!canViewComandas && activeView === 'comandas') setActiveView('pdv');
    if (!canViewX9 && activeView === 'x9') setActiveView('pdv');
  }, [isAdminOrGerente, canViewComandas, canViewX9, activeView]);

  useEffect(() => {
    const taxasRef = ref(db, 'taxas_cartoes');
    onValue(taxasRef, snap => {
      if (snap.val()) setTaxas(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setTaxas([]);
    });

    const lancamentosRef = ref(db, 'lancamentos_vendas');
    onValue(lancamentosRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setLancamentos(list);
      } else setLancamentos([]);
    });

    const vendasPdvRef = ref(db, 'vendas_pdv');
    onValue(vendasPdvRef, snap => {
      if (snap.val()) setVendasPdv(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setVendasPdv([]);
    });

    const pedidosCozRef = ref(db, 'pedidos_cozinha');
    onValue(pedidosCozRef, snap => {
      const pedidos: any[] = snap.val() ? Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })) : [];
      // Na primeira resposta do Firebase, marca todos os pedidos já concluídos como "já vistos"
      // para que o popup só dispare para pedidos novos a partir deste momento.
      if (primeiraLeituraPedidosRef.current) {
        pedidos.forEach(p => {
          pedidoStatusRef.current[p.id] = p.status || '';
          if (p.status === 'Concluído') pedidosConcluidosRef.current.add(p.id);
        });
        primeiraLeituraPedidosRef.current = false;
      }
      setPedidosCozinha(pedidos);
    });

    const prodRef = ref(db, 'produtos');
    onValue(prodRef, snap => {
      if (snap.val()) setProdutos(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setProdutos([]);
    });

    const promoRef = ref(db, 'promocoes');
    onValue(promoRef, snap => {
      if (snap.val()) setPromocoes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setPromocoes([]);
    });

    const clientesRef = ref(db, 'clientes');
    onValue(clientesRef, snap => {
      if (snap.val()) setClientes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setClientes([]);
    });

    const insumosRef = ref(db, 'insumos');
    onValue(insumosRef, snap => {
      if (snap.val()) setInsumos(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setInsumos([]);
    });

    const cuponsRef = ref(db, 'cupons');
    onValue(cuponsRef, snap => {
      if (snap.val()) setCupons(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setCupons([]);
    });

    const funcRef = ref(db, 'funcionarios');
    onValue(funcRef, snap => {
      if (snap.val()) setFuncionarios(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }))); else setFuncionarios([]);
    });

    const mesasRef = ref(db, 'mesas_abertas');
    onValue(mesasRef, snap => setMesasAbertas(snap.val() || {}));

    const entregasAbertasRef = ref(db, 'entregas_abertas');
    onValue(entregasAbertasRef, snap => setEntregasAbertas(snap.val() || {}));

    const configMesasRef = ref(db, 'configuracoes/pdv/qtdMesas');
    onValue(configMesasRef, snap => {
      if (snap.val()) setQtdMesas(Number(snap.val()));
    });

    const configTaxasRef = ref(db, 'configuracoes/taxas_entrega');
    onValue(configTaxasRef, snap => {
      if (snap.val()) {
        const data = snap.val();
        setZonasRestritas(data.zonasRestritas ? (Array.isArray(data.zonasRestritas) ? data.zonasRestritas : Object.values(data.zonasRestritas)) : []);
        setZonasValor(data.zonasValor ? (Array.isArray(data.zonasValor) ? data.zonasValor : Object.values(data.zonasValor)) : []);
        setTaxasEntregaConfig({ taxas: data.taxas || {}, lojaLat: data.loja_lat || null, lojaLng: data.loja_lng || null });
      }
    });

    const configImpressorasRef = ref(db, 'configuracoes/impressoras');
    onValue(configImpressorasRef, snap => {
      setConfigImpressoras(snap.val() || {});
    });

    const nomesRef = ref(db, 'configuracoes/impressoras_nomes');
    onValue(nomesRef, snap => {
      setImpressorasIPs(snap.val() || { cozinha: '', balcao: '' });
    });

    const fidelidadeRef = ref(db, 'fidelidade_config');
    onValue(fidelidadeRef, snap => {
      const data = snap.val();
      if (data) setConfigFidelidade({ ativo: data.ativo ?? true, valorPorCarimbo: data.valorPorCarimbo ?? 50, carimbosParaPremio: data.carimbosParaPremio ?? 10 });
    });

    const fidelidadePontosRef = ref(db, 'fidelidade_pontos');
    onValue(fidelidadePontosRef, snap => {
      const data = snap.val();
      if (data) {
        const mapa: Record<string, number> = {};
        Object.entries(data).forEach(([cId, v]: any) => { mapa[cId] = v.pontos || 0; });
        setPontosPorCliente(mapa);
      } else setPontosPorCliente({});
    });

    const confX9DbRef = ref(db, 'confirmacoes_x9');
    onValue(confX9DbRef, snap => {
      if (snap.val()) {
        confirmacoesX9Ref.current = new Set(Object.keys(snap.val()));
      } else {
        confirmacoesX9Ref.current = new Set();
      }
    });

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const logsX9Ref = query(ref(db, 'logs_x9'), orderByChild('timestamp'), startAt(sevenDaysAgo));
    onValue(logsX9Ref, snap => {
      if (snap.val()) {
        const logs = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        logs.sort((a, b) => b.timestamp - a.timestamp);
        setLogsX9List(logs);
      } else {
        setLogsX9List([]);
      }
    });

    const embalagensRef = ref(db, 'configuracoes/embalagens_padrao/grupos');
    onValue(embalagensRef, snap => {
      const data = snap.val();
      if (data && typeof data === 'object') {
        const toArr = (v: any) => v ? (Array.isArray(v) ? v : Object.values(v)).filter(Boolean) : [];
        const parsed: typeof embalagensGrupos = {};
        for (const [id, g] of Object.entries(data) as [string, any][]) {
          parsed[id] = {
            categorias: Array.isArray(g.categorias) ? g.categorias : g.categorias ? Object.values(g.categorias) : [],
            delivery: toArr(g.delivery),
            salao: toArr(g.salao),
          };
        }
        setEmbalagensGrupos(parsed);
      } else {
        setEmbalagensGrupos({});
      }
    });
  }, []);

  useEffect(() => {
    if (pdvTipoPedido !== 'Entrega') setPdvIsRetirada(false);
  }, [pdvTipoPedido]);

  useEffect(() => { funcionariosRef.current = funcionarios; }, [funcionarios]);

  // Face auth for cart lock
  useEffect(() => {
    if (!authEditModal) {
      if (faceAuthIntervalRef.current) { clearInterval(faceAuthIntervalRef.current); faceAuthIntervalRef.current = null; }
      if (faceAuthStreamRef.current) { faceAuthStreamRef.current.getTracks().forEach(t => t.stop()); faceAuthStreamRef.current = null; }
      setFaceAuthStatus('');
      setAuthEditPin('');
      setAuthEditMethod('face');
      return;
    }
    if (authEditMethod !== 'face') {
      if (faceAuthIntervalRef.current) { clearInterval(faceAuthIntervalRef.current); faceAuthIntervalRef.current = null; }
      if (faceAuthStreamRef.current) { faceAuthStreamRef.current.getTracks().forEach(t => t.stop()); faceAuthStreamRef.current = null; }
      setFaceAuthStatus('');
      return;
    }
    let aborted = false;
    const run = async () => {
      setFaceAuthStatus('Iniciando câmera...');
      let stream: MediaStream;
      try {
        stream = await getCameraStream();
        if (aborted) { stream.getTracks().forEach(t => t.stop()); return; }
        faceAuthStreamRef.current = stream;
        if (faceAuthVideoRef.current) { faceAuthVideoRef.current.srcObject = stream; await faceAuthVideoRef.current.play(); }
      } catch (e) {
        if (!aborted) setFaceAuthStatus(getCameraErrorMsg(e));
        return;
      }
      if (!aborted) setFaceAuthStatus('Carregando modelos de IA...');
      try { await ensureFaceModelsLoaded(); } catch { if (!aborted) setFaceAuthStatus('Falha ao carregar modelos.'); return; }
      if (aborted) return;
      setFaceAuthStatus('Posicione seu rosto na câmera...');
      const { itemId, delta } = authEditModal;
      faceAuthIntervalRef.current = setInterval(async () => {
        if (!faceAuthVideoRef.current || aborted) return;
        const toDesc = (raw: any): Float32Array | null => {
          if (!raw) return null;
          const vals: number[] = Array.isArray(raw) ? raw : Object.values(raw);
          if (vals.length !== 128) return null;
          return new Float32Array(vals);
        };
        const autorizados = funcionariosRef.current
          .filter(f => { const c: string[] = Array.isArray(f.cargo) ? f.cargo : [f.cargo || '']; return c.some(x => CARGOS_EDIT_AUTORIZADO.includes(x)); })
          .map(f => ({ f, desc: toDesc((f as any).faceDescriptor) }))
          .filter((x): x is { f: any; desc: Float32Array } => x.desc !== null);
        if (autorizados.length === 0) { setFaceAuthStatus('Nenhum rosto autorizado cadastrado. Use PIN via gerência.'); return; }
        try {
          const det = await faceapi.detectSingleFace(faceAuthVideoRef.current!, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
          if (!det) { setFaceAuthStatus('Posicione seu rosto na câmera...'); return; }
          setFaceAuthStatus('Reconhecendo...');
          const labeled = autorizados.map(({ f, desc }) => new faceapi.LabeledFaceDescriptors(f.id, [desc]));
          const matcher = new faceapi.FaceMatcher(labeled, 0.6);
          const match = matcher.findBestMatch(det.descriptor);
          if (match.label !== 'unknown' && !aborted) {
            const user = funcionariosRef.current.find(f => f.id === match.label);
            if (user) {
              aborted = true;
              if (faceAuthIntervalRef.current) clearInterval(faceAuthIntervalRef.current);
              if (faceAuthStreamRef.current) faceAuthStreamRef.current.getTracks().forEach(t => t.stop());
              aplicarEdicaoAutorizada(itemId, delta, user.nome);
            }
          }
        } catch { /* frame error, ignore */ }
      }, 1500);
    };
    run();
    return () => { aborted = true; };
  }, [authEditModal, authEditMethod]);

  // Kitchen completion alert
  useEffect(() => {
    if (primeiraLeituraPedidosRef.current) return; // Firebase ainda não respondeu
    if (alertPedidoConcluido) return; // Fila: aguarda o fechamento do modal atual

    const concluidos = pedidosCozinha.filter(p => normalizeStatus(p.status) === statusConcluidoNorm);
      const novos = concluidos.filter(pedido => {
      const statusAnterior = pedidoStatusRef.current[pedido.id];
      const transicaoParaConcluido = normalizeStatus(statusAnterior) !== statusConcluidoNorm;
      const aindaNaoVisto = !pedidosConcluidosRef.current.has(pedido.id);
      return transicaoParaConcluido && aindaNaoVisto;
    });

    if (novos.length > 0) {
      const isAdmin = getCargoTokens().some((c: string) => ['administrador', 'gerente', 'dono', 'ti'].includes(c));
      const isEntregador = getCargoTokens().some((c: string) => c.includes('entregador') || c.includes('motoboy'));
      
      let pedidoParaAlertar = null;

      for (const pedido of novos) {
        pedidosConcluidosRef.current.add(pedido.id);
        pedidoStatusRef.current[pedido.id] = pedido.status || '';

        const temLevar = (pedido.itens || []).some((item: any) => {
          const m = item.opcoes?.montagem;
          if (!m) return false;
          const vals = Array.isArray(m) ? m : Object.values(m);
          return (vals as any[]).some((v: any) => typeof v === 'string' && v.toLowerCase().includes('levar com pedido'));
        });
        
        if (temLevar && impressorasIPs.balcao) {
          const bebidasItens: any[] = [];
          (pedido.itens || []).forEach((item: any) => {
            const b = item.opcoes?.bebidas;
            if (!b) return;
            const arr = Array.isArray(b) ? b : Object.values(b);
            (arr as any[]).forEach((bv: any) => { if (bv?.nome) bebidasItens.push({ nome: bv.nome, qtd: bv.qtd || 1, preco: 0 }); });
          });
          if (bebidasItens.length > 0) {
            imprimirTicketInterno(bebidasItens, 'BEBIDAS', pedido.identificador, impressorasIPs.balcao);
          }
        }

        if (!pedidoParaAlertar) {
          let relevante = false;
          if (isAdmin) relevante = true;
          else if (isEntregador) relevante = pedido.tipo === 'Entrega';
          else relevante = pedido.tipo !== 'Entrega'; // Salão (Atendentes e Caixa)

          if (relevante) {
            pedidoParaAlertar = pedido;
            break; // Pausa o loop e exibe este. O resto fica para o próximo ciclo do useEffect.
          }
        }
      }

      if (pedidoParaAlertar) {
        setAlertPedidoConcluido(pedidoParaAlertar);
        tocarSomConclusao();
      }
    }
  }, [pedidosCozinha, currentUser?.cargo, currentUser?.id, currentUser?.nome, impressorasIPs.balcao, alertPedidoConcluido]);

  const tocarSomConclusao = () => {
    try {
      const ctx = new AudioContext();
      [[880, 0, 0.15], [1100, 0.18, 0.15], [1320, 0.36, 0.25]].forEach(([freq, start, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq as number;
        gain.gain.setValueAtTime(0.4, ctx.currentTime + (start as number));
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (start as number) + (dur as number));
        osc.start(ctx.currentTime + (start as number));
        osc.stop(ctx.currentTime + (start as number) + (dur as number));
      });
    } catch { /* AudioContext unavailable */ }
  };

  const registrarConfirmacaoX9 = async (pedido: any) => {
    if (!pedido?.id) {
      showToast('Pedido inválido para confirmar.', 'error');
      return;
    }

    const pedidoId = pedido.id;
    confirmacoesX9Ref.current.add(pedidoId);

    try {
      await set(ref(db, `confirmacoes_x9/${pedidoId}`), {
        atendenteId: currentUser?.id || null,
        atendenteNome: currentUser?.nome || 'Desconhecido',
        identificador: pedido.identificador,
        timestamp: Date.now()
      });
      registrarLogX9(pedido.sessaoId || pedido.id, pedido.identificador, 'cozinha_conclusao', `Confirmou retirada do pedido da cozinha`, currentUser?.nome || 'Sistema');
      showToast(`Registro X9 salvo para ${pedido.identificador}.`, 'success');
      setAlertPedidoConcluido(null);
    } catch (err) {
      confirmacoesX9Ref.current.delete(pedidoId);
      console.error('Erro ao registrar X9:', err);
      showToast('Erro ao registrar confirmação X9.', 'error');
    }
  };

  const taxasComPadroes = [
    { id: 'pix', nome: 'Pix', percentual: 0 },
    { id: 'dinheiro', nome: 'Dinheiro', percentual: 0 },
    ...taxas
  ];

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateDeliveryFee = (clienteLat?: number, clienteLng?: number) => {
    if (!clienteLat || !clienteLng || !taxasEntregaConfig.lojaLat || !taxasEntregaConfig.lojaLng) return null;
    const dist = getDistanceFromLatLonInKm(taxasEntregaConfig.lojaLat, taxasEntregaConfig.lojaLng, clienteLat, clienteLng);
    const km = Math.ceil(dist);
    if (km > 20 || !taxasEntregaConfig.taxas[km]) return null;
    return Number(taxasEntregaConfig.taxas[km]);
  };

  let taxaEntregaPdv = 0;
  let taxaEntregaText = '';

  if (pdvTipoPedido === 'Entrega' && !pdvIsRetirada) {
    if (pdvTaxaEntregaFixa !== null) {
      taxaEntregaPdv = pdvTaxaEntregaFixa;
      taxaEntregaText = `R$ ${taxaEntregaPdv.toFixed(2).replace('.', ',')}`;
    } else if (pdvCliente && pdvCliente.lat && pdvCliente.lng) {
      const calculated = calculateDeliveryFee(pdvCliente.lat, pdvCliente.lng);
      if (calculated !== null) {
        taxaEntregaPdv = calculated;
        taxaEntregaText = `R$ ${taxaEntregaPdv.toFixed(2).replace('.', ',')}`;
      } else {
        taxaEntregaText = 'A Calcular / Fora de Área';
      }
    } else if (pdvCliente) {
      taxaEntregaText = 'Sem Coordenadas GPS';
    }
  }

  const rawSubtotalPdvBase = Object.values(pdvCarrinho).reduce((acc: any, item: any) => acc + (item.preco * item.qtd), 0);
  const rawTotalPdvBase = rawSubtotalPdvBase + taxaEntregaPdv;
  let descontoCalculado = 0;
  if (pdvDescontoAplicado) {
     descontoCalculado = pdvDescontoAplicado.valor;
     if (descontoCalculado > rawTotalPdvBase) descontoCalculado = rawTotalPdvBase;
  }
  const rawTotalPdv = rawTotalPdvBase - Math.max(0, descontoCalculado);
  const totalPdv = Number(rawTotalPdv.toFixed(2));
  
  const rawPagoPdv = pdvPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const pagoPdv = Number(rawPagoPdv.toFixed(2));
  const restantePdv = Number((totalPdv - pagoPdv).toFixed(2));

  useEffect(() => {
    if (pdvPagamentos.length === 1 && totalPdv > 0) setPdvPagamentos([{ ...pdvPagamentos[0], valor: totalPdv }]);
    else if (totalPdv === 0) setPdvPagamentos([{ taxaId: pdvPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalPdv]);


  const rawTotalConf = Object.values(confCarrinho).reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const totalConf = Number(rawTotalConf.toFixed(2));
  const rawPagoConf = confPagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const pagoConf = Number(rawPagoConf.toFixed(2));
  const restanteConf = Number((totalConf - pagoConf).toFixed(2));

  useEffect(() => {
    if (confPagamentos.length === 1 && totalConf > 0) setConfPagamentos([{ ...confPagamentos[0], valor: totalConf }]);
    else if (totalConf === 0) setConfPagamentos([{ taxaId: confPagamentos[0]?.taxaId || '', valor: 0 }]);
  }, [totalConf]);

  const getNumeroDiario = (tipo: 'Entrega' | 'Balcão/Mesa', idExistente: string | null) => {
    const inicioHoje = getInicioDiaComercial();
    if (tipo === 'Entrega') {
       if (idExistente && entregasAbertas[idExistente]?.numeroDiario) return entregasAbertas[idExistente].numeroDiario;
       const maxEntrega = Math.max(0, ...Object.values(entregasAbertas).filter((e: any) => e.timestamp >= inicioHoje).map((e: any) => e.numeroDiario || 0), ...vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.timestamp >= inicioHoje).map((v: any) => v.numeroDiario || 0));
       return maxEntrega + 1;
    } else {
       const maxPdv = Math.max(0, ...vendasPdv.filter((v: any) => v.tipoPedido !== 'Entrega' && v.timestamp >= inicioHoje).map((v: any) => v.numeroDiario || 0));
       return maxPdv + 1;
    }
  };

  const isEditAuthValid = () =>
    editAuthSession !== null && Date.now() - editAuthSession < AUTH_SESSION_MS;

  const aplicarEdicaoAutorizada = (itemId: string, delta: 1 | -1, autorizadoPor: string) => {
    setEditAuthSession(Date.now());
    updateCartItemQtd(itemId, delta);
    setAuthEditModal(null);
    setAuthEditPin('');
    registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'edicao_autorizada', `${delta > 0 ? 'Adicionou' : 'Removeu'} 1x ${pdvCarrinho[itemId]?.nome || 'Item'}`, currentUser?.nome || 'Sistema', autorizadoPor);
    showToast(`Autorizado por ${autorizadoPor}`, 'success');
  };

  const handleAutorizarEdicaoPorPin = () => {
    if (!authEditModal) return;
    const func = funcionarios.find(f => String(f.pin) === authEditPin);
    if (!func) return showToast('PIN inválido.', 'error');
    const cargos = Array.isArray(func.cargo) ? func.cargo : [func.cargo || ''];
    const isAuthorized = cargos.some((cargo: string) => CARGOS_EDIT_AUTORIZADO.includes(cargo));
    if (!isAuthorized) return showToast('Autorização negada! Requer Caixa, Gerente ou superior.', 'error');
    aplicarEdicaoAutorizada(authEditModal.itemId, authEditModal.delta, func.nome);
  };

  const handleMinusClick = (id: string, item: { nome: string, qtd: number; enviadoCozinha?: number }) => {
    const enviado = item.enviadoCozinha || 0;
    if (enviado > 0 && item.qtd <= enviado && !isEditAuthValid()) {
      setAuthEditModal({ itemId: id, delta: -1 });
      return;
    }
    updateCartItemQtd(id, -1);
    registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'remocao_item', `Removeu 1x ${item.nome}`, currentUser?.nome || 'Sistema');
  };

  const handlePlusClick = (id: string, item: { nome: string, enviadoCozinha?: number }) => {
    const enviado = item.enviadoCozinha || 0;
    if (enviado > 0 && !isEditAuthValid()) {
      setAuthEditModal({ itemId: id, delta: 1 });
      return;
    }
    updateCartItemQtd(id, 1);
    registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'adicao_item', `Adicionou 1x ${item.nome}`, currentUser?.nome || 'Sistema');
  };

  const updateCartItemQtd = (cartItemId: string, delta: number) => {
    setPdvCarrinho((prev: any) => {
      const current = prev[cartItemId];
      if (!current) return prev;
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) { const { [cartItemId]: _, ...rest } = prev; return rest; }
      let newEnviado = current.enviadoCozinha || 0;
      if (newQtd < newEnviado) newEnviado = newQtd;
      let newConcluido = current.concluidoCozinha || 0;
      if (newQtd < newConcluido) newConcluido = newQtd;
      return { ...prev, [cartItemId]: { ...current, qtd: newQtd, enviadoCozinha: newEnviado, concluidoCozinha: newConcluido } };
    });
  };

  const updateCart = (setter: any, id: string, nome: string, preco: number, delta: number) => {
    setter((prev: any) => {
      const current = prev[id] || { nome, preco, qtd: 0, enviadoCozinha: 0 };
      const newQtd = current.qtd + delta;
      if (newQtd <= 0) { const { [id]: _, ...rest } = prev; return rest; }
      let newEnviado = current.enviadoCozinha || 0;
      if (newQtd < newEnviado) newEnviado = newQtd;
      return { ...prev, [id]: { ...current, qtd: newQtd, enviadoCozinha: newEnviado } };
    });
  };

  const queueImpressao = async (job: any) => {
    const dedupKey = buildPrintJobDedupKey(job);
    if (isRecentDuplicate(dedupImpressaoRef.current, dedupKey, 15000)) {
      console.log('Impressão duplicada detectada localmente, ignorando:', dedupKey);
      return false;
    }

    try {
      const jobRef = ref(db, `impressoras/jobs/${dedupKey}`);
      await set(jobRef, {
        ...job,
        status: 'pendente',
        attempts: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast('Impressão agendada e será processada assim que possível.', 'success');
      return true;
    } catch (e: any) {
      console.error('Erro ao agendar impressão:', e);
      showToast('Falha ao agendar impressão. Verifique a conexão.', 'error');
      return false;
    }
  };

  const imprimirTicketInterno = async (itens: any[], destLabel: string, identificador: string, printerIp?: string, lancadoPor?: string) => {
    if (itens.length === 0) return;

    const electron = (window as any).electronAPI;
    const isIp = printerIp ? /^[0-9\.]+$/.test(printerIp) : false;

    if (electron && printerIp && isIp) {
      try {
        await electron.imprimirTicketIP(printerIp, itens, destLabel, identificador, lancadoPor);
        return;
      } catch (e: any) {
        console.error('Erro ao imprimir via IP:', e);
        showToast('Erro na impressão direta. Impressão será agendada.', 'error');
      }
    }

    if (printerIp && isIp) {
      await queueImpressao({
        type: 'ticket',
        printerIp,
        itens,
        destLabel,
        identificador,
        lancadoPor: lancadoPor || null,
        origin: 'web',
      });
      return;
    }

    // Fallback HTML para ambientes não-Electron (web/APK)
    const dt = new Date();
    const dataStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let itensHtml = '';
    itens.forEach((item: any) => {
      itensHtml += `<tr><td class="col-qty">${item.qtd}x</td><td class="col-desc">${item.nome}</td></tr>`;
      if (item.opcoes) {
        const { montagem, pontoCarne, adicionais, restricoes, observacao } = item.opcoes;
        if (montagem && Object.values(montagem).length > 0)
          itensHtml += `<tr><td></td><td class="item-sub">Montagem: ${Object.values(montagem).join(', ')}</td></tr>`;
        if (pontoCarne)
          itensHtml += `<tr><td></td><td class="item-sub">Ponto: ${pontoCarne}</td></tr>`;
        if (adicionais && Object.values(adicionais).length > 0)
          Object.values(adicionais).forEach((a: any) => {
            itensHtml += `<tr><td></td><td class="item-sub">+ ${a.qtd}x ${a.nome}</td></tr>`;
          });
        if (restricoes && Object.values(restricoes).length > 0)
          itensHtml += `<tr><td></td><td class="item-sub item-sem">SEM: ${Object.values(restricoes).join(', ')}</td></tr>`;
        if (observacao)
          itensHtml += `<tr><td></td><td class="item-sub">Obs: ${observacao}</td></tr>`;
      }
      itensHtml += `<tr><td colspan="2"><div class="item-sep"></div></td></tr>`;
    });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 13px; width: 74mm; margin: 0 auto; line-height: 1.5; }
  .dest { font-size: 22px; font-weight: bold; letter-spacing: 3px; text-align: center; padding: 4px 0; }
  .sep { border: none; border-top: 1px solid #000; margin: 5px 0; }
  .ident { font-size: 14px; font-weight: bold; margin: 2px 0; }
  .lancado { font-size: 11px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 3px 0; }
  .col-qty { width: 28px; font-weight: bold; vertical-align: top; white-space: nowrap; }
  .col-desc { font-weight: bold; vertical-align: top; word-break: break-word; }
  .col-header { font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .item-sub { font-size: 11px; padding-left: 4px; color: #222; }
  .item-sem { font-weight: bold; text-decoration: underline; }
  .item-sep { border-top: 1px dashed #999; margin: 4px 0; }
  .footer { font-size: 11px; margin-top: 4px; }
</style></head><body>
<div class="dest">*** ${destLabel} ***</div>
<div class="sep"></div>
<div class="ident">${identificador}</div>
${lancadoPor ? `<div class="lancado">LANÇADO POR: ${lancadoPor}</div>` : ''}
<div class="sep"></div>
<table>
  <thead><tr><th class="col-qty col-header">Qtd</th><th class="col-desc col-header" style="text-align:left">Descrição</th></tr></thead>
  <tbody>${itensHtml}</tbody>
</table>
<div class="sep"></div>
<div class="footer">Data ${dataStr}  Hora: ${horaStr}</div>
</body></html>`;

    if (electron && electron.imprimir && printerIp && !isIp) {
      try {
        await electron.imprimir(printerIp, html);
        return;
      } catch (e: any) {
        console.error('Erro ao imprimir via USB:', e);
        showToast('Erro na impressão USB. Verifique a impressora.', 'error');
      }
    }

    if (!electron) {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.onafterprint = () => win.close(); win.print(); }, 300);
    }
  };

  const dispararImpressaoSeparada = async (identificador: string, carrinhoSnapshot: Record<string, any>, lancadoPor?: string) => {
    if (Object.keys(configImpressoras).length === 0) return;

    const itensNovos = Object.entries(carrinhoSnapshot).filter(
      ([id, item]: any) => item.qtd > (item.enviadoCozinha || 0)
    ).map(([id, item]: any) => ({
      ...item,
      cartItemId: id,
      qtd: item.qtd - (item.enviadoCozinha || 0)
    }));

    if (itensNovos.length === 0) return;

    const itensCozinha: any[] = [];
    const itensBalcao: any[] = [];

    itensNovos.forEach((item: any) => {
      const prod = [...produtos, ...promocoes].find(p => p.id === item.produtoId);
      const categoria = prod?.tipoItem === 'Promoção' ? 'Promoções' : (prod?.categoria || '');
      const destino = configImpressoras[categoria] || 'cozinha';
      if (destino === 'cozinha' || destino === 'ambos') itensCozinha.push(item);
      if (destino === 'balcao' || destino === 'ambos') itensBalcao.push(item);
    });

    // Aguarda cada impressão terminar antes de iniciar a próxima (evita conflito no Electron)
    if (itensCozinha.length > 0) {
      if (!impressorasIPs.cozinha) showToast('Impressora da cozinha não configurada!', 'error');
      else await imprimirTicketInterno(itensCozinha, 'COZINHA', identificador, impressorasIPs.cozinha, lancadoPor);
    }
    if (itensBalcao.length > 0) {
      if (!impressorasIPs.balcao) showToast('Impressora do balcão não configurada!', 'error');
      else await imprimirTicketInterno(itensBalcao, 'BALCÃO', identificador, impressorasIPs.balcao, lancadoPor);
    }
  };

  const dispararParaCozinha = async (identificador: string, tipo: string, referenciaId?: string, meta?: Record<string, any>) => {
    const itensParaEnviar = Object.entries(pdvCarrinho)
      .filter(([id, item]) => item.qtd > (item.enviadoCozinha || 0))
      .map(([id, item]) => {
        const prod = [...produtos, ...promocoes].find(p => p.id === (item.produtoId || id) || p.nome === item.nome);
        return {
          cartItemId: id,
          produtoId: item.produtoId || id,
          nome: item.nome,
          categoria: prod?.tipoItem === 'Promoção' ? 'Promoção / Combo' : (prod?.categoria || 'Outros'),
          qtd: item.qtd - (item.enviadoCozinha || 0),
          opcoes: item.opcoes || null
        };
      });

    const novoCarrinho: any = {};
    Object.keys(pdvCarrinho).forEach(id => {
      novoCarrinho[id] = { ...pdvCarrinho[id], enviadoCozinha: pdvCarrinho[id].qtd };
    });

    if (itensParaEnviar.length > 0) {
      const dedupKey = buildOrderDedupKey(identificador, tipo, referenciaId, itensParaEnviar);
      if (isRecentDuplicate(dedupPedidosCozinhaRef.current, dedupKey, 15000)) {
        console.log('KDS duplicado detectado localmente, ignorando:', dedupKey);
        return novoCarrinho;
      }

      const pedidoRef = ref(db, `pedidos_cozinha/${dedupKey}`);
      const pedidoPayload = {
        identificador, tipo,
        isRetirada: pdvTipoPedido === 'Entrega' ? pdvIsRetirada : false,
        referenciaId: referenciaId || null,
        itens: itensParaEnviar,
        status: 'Pendente',
        sessaoId: pdvSessaoId,
        timestamp: Date.now(),
        dedupKey,
        ...(meta || {})
      };

      const transactionResult = await runTransaction(pedidoRef, (current) => {
        if (current) return current;
        return pedidoPayload;
      });

      const pedidoCriado = transactionResult.committed && transactionResult.snapshot.exists();
      if (!pedidoCriado) {
        console.log('Pedido duplicado detectado no KDS, ignorando novo envio:', dedupKey);
      } else {
        // Abate do estoque rotativo no momento em que o pedido cai no KDS
        for (const item of itensParaEnviar) {
        const prod = [...produtos, ...promocoes].find(p => p.id === item.produtoId);
        if (!prod) continue;

        const multiplicador = item.qtd;
        const restricoes: string[] = item.opcoes?.restricoes
          ? Object.values(item.opcoes.restricoes) as string[]
          : [];

        for (const ing of (prod.ingredientes || [])) {
          const insumo = insumos.find((i: any) => i.id === ing.insumoId);
          if (!insumo || insumo.isVariavel) continue;
          if (restricoes.includes(insumo.nome)) continue;

          const qtdAbater = Number((Number(ing.quantidade) * multiplicador).toFixed(4));
          await runTransaction(ref(db, `insumos/${ing.insumoId}`), (data) => {
            if (data) {
              data.estoqueRotativo = Number(Math.max(0, (data.estoqueRotativo ?? 0) - qtdAbater).toFixed(4));
            }
            return data;
          });
        }

        if (item.opcoes?.adicionais) {
          for (const add of Object.values(item.opcoes.adicionais) as any[]) {
            let insumoId = add.insumoId;
            if (!insumoId) {
              const found = insumos.find((i: any) => i.nome.toLowerCase().trim() === (add.nome || '').toLowerCase().trim());
              insumoId = found?.id;
            }
            if (!insumoId) continue;

            const insumo = insumos.find((i: any) => i.id === insumoId);
            if (!insumo || insumo.isVariavel) continue;

            const baseQtd = add.quantidadeInsumo ? Number(add.quantidadeInsumo) : 1;
            const qtdAbater = Number((Number(add.qtd) * baseQtd * multiplicador).toFixed(4));
            await runTransaction(ref(db, `insumos/${insumoId}`), (data) => {
              if (data) {
                data.estoqueRotativo = Number(Math.max(0, (data.estoqueRotativo ?? 0) - qtdAbater).toFixed(4));
              }
              return data;
            });
          }
        }
      }

      // Dedução de embalagens por grupo (Delivery vs Mesa/Salão)
      for (const item of itensParaEnviar) {
        const prod = [...produtos, ...promocoes].find(p => p.id === item.produtoId);
        const categoria = prod?.categoria;
        if (!categoria) continue;
        const grupo = Object.values(embalagensGrupos).find(g => g.categorias?.includes(categoria));
        if (!grupo) continue;
        const embItens = tipo === 'Entrega' ? grupo.delivery : grupo.salao;
        for (const emb of embItens) {
          const qtdAbater = Number((emb.quantidade * item.qtd).toFixed(4));
          await runTransaction(ref(db, `insumos/${emb.insumoId}`), (data) => {
            if (data) {
              data.estoqueRotativo = Number(Math.max(0, (data.estoqueRotativo ?? 0) - qtdAbater).toFixed(4));
            }
            return data;
          });
        }
      }
    }
  }

    return novoCarrinho;
  };

  const handlePagamentoChange = (setter: any, stateList: any[], index: number, field: string, value: any) => {
    const novos = [...stateList];
    novos[index] = { ...novos[index], [field]: value };
    setter(novos);
  };

  const handleAbrirMesa = (numero: number) => {
    setMesaSelecionada(numero);
    setEntregaSelecionada(null);
    setPdvTipoPedido('Mesa');
    setPdvDescontoAplicado(null);
    setPdvTaxaEntregaFixa(null);
    const mesaData = mesasAbertas[`mesa_${numero}`] || mesasAbertas[numero];
    if (mesaData) {
      setPdvSessaoId(mesaData.sessaoId || `mesa_${numero}_${mesaData.timestamp}`);
      setPdvCarrinho(mesaData.carrinho || {});
      const c = clientes.find((client: any) => client.id === mesaData.clienteId);
      if (c) setPdvCliente(c);
      else if (mesaData.nomeCliente) setPdvCliente({ id: mesaData.clienteId || `temp_${Date.now()}`, nome: mesaData.nomeCliente, telefone: mesaData.clienteTelefone || '' });
      else setPdvCliente(null);
    } else {
      setPdvSessaoId(`mesa_${numero}_${Date.now()}`);
      setPdvCarrinho({});
      setPdvCliente(null);
    }
    setPdvView('caixa');
  };

  const cancelarKdsMesa = async (numeroMesa: number) => {
    const ref_id = `mesa_${numeroMesa}`;
    const pendentes = pedidosCozinha.filter(
      p => p.referenciaId === ref_id && p.status !== 'Concluído' && p.status !== 'Cancelado'
    );
    await Promise.all(pendentes.map(p => update(ref(db, `pedidos_cozinha/${p.id}`), { status: 'Cancelado' })));
  };

  const handleCancelarPedidoAtual = async () => {
    if (!canCancelTable) {
      showToast('Autorização negada! Requer Caixa ou Gerente.', 'error');
      return;
    }
    if (pdvTipoPedido === 'Mesa' && mesaSelecionada) {
      if (confirm(`Deseja cancelar a Mesa ${mesaSelecionada} e desvincular o cliente? Itens não finalizados serão cancelados na cozinha.`)) {
        await cancelarKdsMesa(mesaSelecionada);
        await remove(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`));
        await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
        showToast(`Mesa ${mesaSelecionada} cancelada e liberada!`, 'success');
        registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'cancelamento', `Mesa cancelada e liberada`, currentUser?.nome || 'Sistema');
        
        setPdvCarrinho({}); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvCliente(null); setPdvTipoPedido('Balcão');
        setPdvDescontoAplicado(null);
        setMesaSelecionada(null);
        setPdvIsRetirada(false);
        setPdvIsRetirada(false);
        setEntregaSelecionada(null);
        setPdvItemModal(null);
        setPdvSearchProd('');
        setPdvSearchCliente('');
        setIsCartExpanded(false);
        setPdvView('mapa');
        setPdvSessaoId(`sessao_${Date.now()}`);
      }
    } else if (pdvTipoPedido === 'Entrega' && entregaSelecionada) {
      if (confirm('Deseja cancelar este Delivery e desvincular o cliente? Itens não finalizados serão cancelados na cozinha.')) {
        const pendentes = pedidosCozinha.filter(
          p => p.referenciaId === entregaSelecionada && p.status !== 'Concluído' && p.status !== 'Cancelado'
        );
        await Promise.all(pendentes.map(p => update(ref(db, `pedidos_cozinha/${p.id}`), { status: 'Cancelado' })));
        
        await remove(ref(db, `entregas_abertas/${entregaSelecionada}`));
        showToast('Delivery cancelado com sucesso!', 'success');
        registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'cancelamento', `Delivery cancelado e removido`, currentUser?.nome || 'Sistema');

        setPdvCarrinho({}); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvCliente(null); setPdvTipoPedido('Balcão');
        setPdvDescontoAplicado(null);
        setMesaSelecionada(null);
        setEntregaSelecionada(null);
        setPdvTaxaEntregaFixa(null);
        setPdvItemModal(null);
        setPdvSearchProd('');
        setPdvTaxaEntregaFixa(null);
        setPdvSearchCliente('');
        setIsCartExpanded(false);
        setPdvView('mapa');
        setPdvSessaoId(`sessao_${Date.now()}`);
      }
    }
  };

  const handleSalvarMesa = async () => {
    if (!pdvCliente) return showToast('É obrigatório vincular um cliente à mesa.', 'error');
    
    // Se o carrinho tá vazio mas tem cliente vinculado, a gente salva a mesa aberta (reserva)
    if (Object.keys(pdvCarrinho).length === 0) {
      if (mesaSelecionada) {
        await set(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`), {
          carrinho: {},
          clienteId: pdvCliente.id,
          nomeCliente: pdvCliente.nome,
          clienteTelefone: pdvCliente.telefone || null,
          timestamp: Date.now(),
          sessaoId: pdvSessaoId
        });
        await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
        showToast(`Mesa ${mesaSelecionada} vinculada a ${pdvCliente.nome}!`, 'success');
        registrarLogX9(pdvSessaoId, getMesaIdentificador(mesaSelecionada, pdvCliente.nome), 'abertura', `Mesa reservada/vinculada ao cliente`, currentUser?.nome || 'Sistema');
      }
    } else {
        const mesaIdentificador = getMesaIdentificador(mesaSelecionada, pdvCliente?.nome);
        dispararImpressaoSeparada(mesaIdentificador, pdvCarrinho, currentUser?.nome);
        const novoCarrinho = await dispararParaCozinha(mesaIdentificador, 'Mesa', `mesa_${mesaSelecionada}`, {
          atendenteId: currentUser?.id || null,
          atendenteNome: currentUser?.nome || null
        });
      await set(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`), {
        carrinho: novoCarrinho,
        clienteId: pdvCliente?.id || null,
        nomeCliente: pdvCliente?.nome || null,
        clienteTelefone: pdvCliente?.telefone || null,
        timestamp: Date.now(),
        sessaoId: pdvSessaoId
      });
      await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
      showToast(`Pedido salvo na Mesa ${mesaSelecionada}!`, 'success');
      setPdvDescontoAplicado(null);
      registrarLogX9(pdvSessaoId, getMesaIdentificador(mesaSelecionada, pdvCliente?.nome), 'abertura', `Mesa com pedidos atualizada/salva na produção`, currentUser?.nome || 'Sistema');
    }
    setPdvItemModal(null);
    setPdvSearchProd('');
    setPdvSearchCliente('');
    setIsCartExpanded(false);
    setPdvView('mapa');
  };

  const handleAbrirEntrega = (id: string) => {
    setEntregaSelecionada(id);
    setMesaSelecionada(null);
    setPdvTipoPedido('Entrega');
    setPdvDescontoAplicado(null);
    setPdvItemModal(null);
    setPdvTaxaEntregaFixa(null);
    setPdvSearchProd('');
    setPdvSearchCliente('');
    setIsCartExpanded(false);
    setPdvDescricao('');
    setPdvPagamentos([{ taxaId: '', valor: 0 }]);
    const entregaData = entregasAbertas[id];
    if (entregaData) {
      setPdvSessaoId(entregaData.sessaoId || `delivery_${id}_${entregaData.timestamp}`);
      setPdvCarrinho(entregaData.carrinho || {});
      setPdvIsRetirada(entregaData.isRetirada || false);
      setPdvTaxaEntregaFixa(entregaData.taxaEntrega !== undefined ? entregaData.taxaEntrega : null);
      const c = clientes.find((client: any) => client.id === entregaData.clienteId);
      if (c) setPdvCliente(c);
      else setPdvCliente({ id: entregaData.clienteId, nome: entregaData.clienteNome, telefone: entregaData.clienteTelefone });
    }
    setPdvView('caixa');
  };

  const handleSalvarEntrega = async () => {
    if (!pdvCliente) return showToast('Selecione um cliente para o Delivery.', 'error');
    if (Object.keys(pdvCarrinho).length === 0) {
      if (entregaSelecionada) await remove(ref(db, `entregas_abertas/${entregaSelecionada}`));
      showToast('Delivery cancelado/removido!', 'success');
    } else {
      const id = entregaSelecionada || `delivery_${Date.now()}`;
      const numDiario = getNumeroDiario('Entrega', entregaSelecionada);
        dispararImpressaoSeparada(`Delivery: ${pdvCliente.nome}`, pdvCarrinho, currentUser?.nome);
        const novoCarrinho = await dispararParaCozinha(`Delivery: ${pdvCliente.nome}`, 'Entrega', id);
      await set(ref(db, `entregas_abertas/${id}`), {
        clienteId: pdvCliente.id,
        clienteNome: pdvCliente.nome,
        clienteTelefone: pdvCliente.telefone,
        carrinho: novoCarrinho,
        numeroDiario: numDiario,
        isRetirada: pdvIsRetirada,
        timestamp: Date.now(),
        taxaEntrega: taxaEntregaPdv,
        sessaoId: pdvSessaoId
      });
      showToast('Pedido de Delivery salvo!', 'success');
      setPdvDescontoAplicado(null);
      registrarLogX9(pdvSessaoId, `Delivery: ${pdvCliente.nome}`, 'abertura', `Delivery salvo/enviado para produção`, currentUser?.nome || 'Sistema');
    }
    setPdvItemModal(null);
    setPdvSearchProd('');
    setPdvSearchCliente('');
    setPdvIsRetirada(false);
    setPdvTaxaEntregaFixa(null);
    setIsCartExpanded(false);
    setPdvView('mapa');
  };

  const handleReimprimirEntrega = (e: React.MouseEvent, id: string, entrega: any) => {
    e.stopPropagation();
    if (!entrega) return;
    const subtotal = (Object.values(entrega.carrinho || {}) as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0) as number;
    const taxa = Number(entrega.taxaEntrega || 0);
    setViewComanda({
      timestamp: entrega.timestamp || Date.now(),
      descricao: `Delivery: ${entrega.clienteNome}`,
      tipoPedido: 'Entrega',
      clienteNome: entrega.clienteNome || '',
      itens: Object.values(entrega.carrinho || {}),
      valor: subtotal + taxa,
      taxaEntrega: taxa,
      desconto: 0,
      pagamentos: []
    });
  };

  const handleReimprimirMesa = (e: React.MouseEvent, num: number, isAberta: any) => {
    e.stopPropagation();
    if (!isAberta) return;
    const total = Object.values(isAberta.carrinho || {}).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);
    setViewComanda({
      timestamp: isAberta.timestamp || Date.now(),
      descricao: getMesaIdentificador(num, isAberta.nomeCliente),
      tipoPedido: 'Mesa',
      mesa: num,
      clienteNome: isAberta.nomeCliente || '',
      itens: Object.values(isAberta.carrinho || {}),
      valor: total,
      desconto: 0,
      pagamentos: []
    });
  };

  const handleReabrirEntrega = async (venda: any) => {
    if (window.confirm('Deseja reabrir este pedido? O pagamento e o registro de venda serão desfeitos até que você finalize no caixa novamente.')) {
      await remove(ref(db, `vendas_pdv/${venda.id}`));
      const carrinhoRestaurado: Record<string, any> = {};
      if (venda.itens) {
        venda.itens.forEach((item: any) => { carrinhoRestaurado[item.id] = { ...item }; });
      }
      const c = clientes.find((client: any) => client.id === venda.clienteId);
      await set(ref(db, `entregas_abertas/${venda.id}`), { clienteId: venda.clienteId, clienteNome: venda.clienteNome, clienteTelefone: c ? c.telefone : (venda.clienteTelefone || ''), carrinho: carrinhoRestaurado, timestamp: venda.timestamp });
      setShowPainelEntregas(false);
      handleAbrirEntrega(venda.id);
    }
  };

  const handleImprimirCupom = async () => {
    if (!viewComanda) return;

    const subtotalBruto = viewComanda.itens
      ? (viewComanda.itens as any[]).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0)
      : 0;
    const taxaEntregaCupom = Number(viewComanda.taxaEntrega || 0);
    const desconto = Number(viewComanda.desconto || 0);
    const total = Number(viewComanda.valor || (subtotalBruto + taxaEntregaCupom - desconto));

    const tipoPedido = viewComanda.tipoPedido || '';
    let identificador = 'Balcão';
    if (tipoPedido === 'Mesa') identificador = getMesaIdentificador(viewComanda.mesa, viewComanda.clienteNome);
    else if (tipoPedido === 'Entrega') identificador = 'Delivery';

    const clienteNome = viewComanda.clienteNome || '';

    let itensHtml = '';
    if (viewComanda.itens) {
      (viewComanda.itens as any[]).forEach((item: any) => {
        const itemTotal = (item.preco * item.qtd).toFixed(2);
        itensHtml += `<tr>
          <td class="col-qty">${item.qtd}x</td>
          <td class="col-nome">${item.nome}</td>
          <td class="col-total">R$&nbsp;${itemTotal}</td>
        </tr>`;
        if (item.opcoes) {
          const { montagem, pontoCarne, adicionais, restricoes, observacao } = item.opcoes;
          if (montagem && Object.values(montagem).length > 0)
            itensHtml += `<tr><td></td><td colspan="2" class="item-sub">Montagem: ${Object.values(montagem).join(', ')}</td></tr>`;
          if (pontoCarne)
            itensHtml += `<tr><td></td><td colspan="2" class="item-sub">Ponto: ${pontoCarne}</td></tr>`;
          if (adicionais && Object.values(adicionais).length > 0)
            Object.values(adicionais).forEach((a: any) => {
              itensHtml += `<tr><td></td><td colspan="2" class="item-sub">+ ${a.qtd}x ${a.nome}</td></tr>`;
            });
          if (restricoes && Object.values(restricoes).length > 0)
            itensHtml += `<tr><td></td><td colspan="2" class="item-sub item-sem">SEM: ${Object.values(restricoes).join(', ')}</td></tr>`;
          if (observacao)
            itensHtml += `<tr><td></td><td colspan="2" class="item-sub">Obs: ${observacao}</td></tr>`;
        }
      });
    }

    // Electron + IP configurado: imprime ESC/POS direto na impressora do balcão
    const electron = (window as any).electronAPI;
    const isIp = impressorasIPs.balcao ? /^[0-9\.]+$/.test(impressorasIPs.balcao) : false;

    if (electron && impressorasIPs.balcao && isIp) {
      try {
        await electron.imprimirReciboIP(impressorasIPs.balcao, {
          itens: viewComanda.itens || [],
          identificador,
          clienteNome,
          subtotal: subtotalBruto,
          desconto,
          total,
          cupom: viewComanda.cupom || null,
          timestamp: viewComanda.timestamp,
        });
        return;
      } catch (e: any) {
        console.error('Erro ao imprimir recibo via IP:', e);
        showToast('Erro na impressão direta. Impressão será agendada.', 'error');
      }
    }

    if (impressorasIPs.balcao && isIp) {
      await queueImpressao({
        type: 'recibo',
        printerIp: impressorasIPs.balcao,
        itens: viewComanda.itens || [],
        identificador,
        clienteNome,
        subtotal: subtotalBruto,
        desconto,
        total,
        cupom: viewComanda.cupom || null,
        timestamp: viewComanda.timestamp,
        origin: 'web',
      });
      return;
    }

    // Fallback HTML para ambientes não-Electron (web/APK)
    const win = window.open('', '_blank');
    if (!win) return;

    const dt = new Date(viewComanda.timestamp);
    const dataStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 80mm auto; margin: 4mm 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 74mm; margin: 0 auto; line-height: 1.5; }
    .center { text-align: center; }
    .store-name { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
    .cnpj { font-size: 11px; margin-bottom: 2px; }
    .sep { border: none; border-top: 1px solid #000; margin: 5px 0; }
    .title { font-size: 13px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; }
    .ident { font-size: 13px; font-weight: bold; margin: 2px 0; }
    .cliente { font-size: 12px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { border-bottom: 1px solid #000; }
    .col-qty { width: 24px; font-weight: bold; vertical-align: top; white-space: nowrap; padding-bottom: 2px; }
    .col-nome { font-weight: bold; vertical-align: top; word-break: break-word; padding: 0 3px; }
    .col-total { text-align: right; white-space: nowrap; vertical-align: top; }
    .col-header { font-size: 10px; font-weight: bold; text-transform: uppercase; padding-bottom: 3px; }
    .item-sub { font-size: 10px; color: #333; padding-left: 3px; line-height: 1.3; }
    .item-sem { font-weight: bold; text-decoration: underline; }
    .row-subtotal { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .row-desconto { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .row-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 3px 0; }
    .no-fiscal { text-align: center; font-size: 11px; font-weight: bold; margin: 2px 0; }
    .data-hora { text-align: center; font-size: 11px; margin: 2px 0; }
    .footer-msg { text-align: center; font-size: 11px; margin: 1px 0; }
    @media print { @page { size: 80mm auto; margin: 4mm 3mm; } body { width: 74mm; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="store-name">Artt Burger Curvelo LTDA</div>
    <div class="cnpj">CNPJ: 46.827.745/0001-20</div>
  </div>
  <div class="sep"></div>
  <div class="center title">RESUMO DA CONTA</div>
  <div class="sep"></div>
  <div class="center ident">${identificador}</div>
  ${clienteNome ? `<div class="center cliente">Cliente: ${clienteNome}</div>` : ''}
  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th class="col-qty col-header" style="text-align:left">Qtd</th>
        <th class="col-nome col-header" style="text-align:left">Produto</th>
        <th class="col-total col-header">Total</th>
      </tr>
    </thead>
    <tbody>${itensHtml}</tbody>
  </table>
  <div class="sep"></div>
  <div class="row-subtotal"><span>Subtotal:</span><span>R$ ${subtotalBruto.toFixed(2)}</span></div>
  ${taxaEntregaCupom > 0 ? `<div class="row-desconto"><span>Taxa de Entrega:</span><span>+ R$ ${taxaEntregaCupom.toFixed(2)}</span></div>` : ''}
  ${desconto > 0 ? `<div class="row-desconto"><span>Desconto${viewComanda.cupom ? ` (${viewComanda.cupom})` : ''}:</span><span>- R$ ${desconto.toFixed(2)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="row-total"><span>Total</span><span>R$ ${total.toFixed(2)}</span></div>
  <div class="sep"></div>
  <div class="no-fiscal">DOCUMENTO SEM VALOR FISCAL</div>
  <div class="sep"></div>
  <div class="data-hora">Data: ${dataStr}  Hora: ${horaStr}</div>
  <div class="footer-msg">OBRIGADO PELA PREFERENCIA.</div>
  <div class="footer-msg">VOLTE SEMPRE!</div>
</body>
</html>`;

    if (electron && electron.imprimir && impressorasIPs.balcao && !isIp) {
      try {
        await electron.imprimir(impressorasIPs.balcao, html);
        return;
      } catch (e: any) {
        console.error('Erro ao imprimir recibo via USB:', e);
        showToast('Erro na impressão USB. Verifique a impressora.', 'error');
      }
    }

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.onafterprint = () => win.close(); win.print(); }, 400);
  };

  const handleOpenPdvItemModal = (item: any) => {
    const firstSize = item.opcoes?.tamanhos?.[0]?.nome || '';
    setPdvItemModal(item);
    setPdvItemOptions({
      montagem: [],
      pontoCarne: '',
      adicionais: {},
      restricoes: [],
      observacao: '',
      bebidas: {},
      quantidade: 1,
      tamanho: firstSize
    });
  };

  const handleAddPdvItem = () => {
    const selectedTamanho = (pdvItemModal.opcoes?.tamanhos || []).find((t: any) => t.nome === pdvItemOptions.tamanho);
    let basePrice = selectedTamanho ? Number(selectedTamanho.preco) : Number(pdvItemModal.precoVenda || 0);
    let adicionaisPrice = 0;
    const adicionaisDoProduto = pdvItemModal.opcoes?.adicionais || [];
    
    Object.entries(pdvItemOptions.adicionais).forEach(([addId, qtd]: [string, any]) => {
       const add = adicionaisDoProduto.find((a: any) => a.id === addId);
       if (add) adicionaisPrice += Number(add.preco || 0) * qtd;
    });
    
    let bebidasPrice = 0;
    const bebidasSelecionadas = Object.entries(pdvItemOptions.bebidas || {}).filter(([, qtd]: [string, any]) => qtd > 0);
    bebidasSelecionadas.forEach(([prodId, qtd]: [string, any]) => {
      const prod = produtos.find((p: any) => p.id === prodId);
      if (prod) bebidasPrice += Number(prod.precoVenda || 0) * qtd;
    });
    
    const unitPrice = basePrice + adicionaisPrice + bebidasPrice;
    const cartItemId = `${pdvItemModal.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const hasOptions = pdvItemOptions.tamanho || pdvItemOptions.montagem.length > 0 || pdvItemOptions.pontoCarne || Object.keys(pdvItemOptions.adicionais).length > 0 || pdvItemOptions.restricoes.length > 0 || pdvItemOptions.observacao || bebidasSelecionadas.length > 0;
    
    const nomeFinal = selectedTamanho ? `${pdvItemModal.nome} (${selectedTamanho.nome})` : pdvItemModal.nome;

    const opcoesObj = hasOptions ? {
      tamanho: pdvItemOptions.tamanho,
      montagem: pdvItemOptions.montagem,
      pontoCarne: pdvItemOptions.pontoCarne,
      adicionais: Object.entries(pdvItemOptions.adicionais).map(([addId, qtd]: [string, any]) => {
        const add = adicionaisDoProduto.find((a: any) => a.id === addId);
        return { id: add?.id, nome: add?.nome, qtd, preco: Number(add?.preco || 0), insumoId: add?.insumoId, quantidadeInsumo: add?.quantidade || 1 };
      }),
      restricoes: pdvItemOptions.restricoes,
      observacao: pdvItemOptions.observacao,
      bebidas: bebidasSelecionadas.map(([prodId, qtd]: [string, any]) => {
        const prod = produtos.find((p: any) => p.id === prodId);
        return { id: prodId, nome: prod?.nome || prodId, qtd, preco: Number(prod?.precoVenda || 0) };
      })
    } : null;
  
    setPdvCarrinho(prev => ({
      ...prev,
      [cartItemId]: {
        produtoId: pdvItemModal.id,
        nome: nomeFinal,
        preco: unitPrice,
        qtd: pdvItemOptions.quantidade,
        opcoes: opcoesObj,
        enviadoCozinha: 0,
        adicionadoPor: currentUser?.nome || 'Sistema',
        adicionadoEm: Date.now()
      }
    }));
    registrarLogX9(pdvSessaoId, getCurrentIdentificador(), 'adicao_item', `Adicionou ${pdvItemOptions.quantidade}x ${pdvItemModal.nome}`, currentUser?.nome || 'Sistema');
    
    setPdvItemModal(null);
  };

  const handleAplicarDesconto = () => {
     // Verificação de segurança e autorização
     const func = funcionarios.find(f => String(f.pin) === descontoPin);
     if (!func) return showToast('PIN inválido', 'error');
     const roles = Array.isArray(func.cargo) ? func.cargo : [func.cargo];
     const isAuthorized = roles.some((c: string) => ['Dono', 'TI'].includes(c) || permissoes[c]?.['vendas']?.visualizar || permissoes[c]?.['pdv_conferencia']?.visualizar);
     if (!isAuthorized) {
        return showToast('Autorização negada! Requer permissão de acesso ao Caixa ou Conferência.', 'error');
     }

     let valorDesconto = 0;
     let cupomUsado = '';
     const cupom = cupons.find(c => c.codigo.toLowerCase() === descontoInput.trim().toLowerCase() && c.ativo !== false);
     
     if (cupom) {
        if (cupom.tipo === 'valor') valorDesconto = Number(cupom.valor);
        else if (cupom.tipo === 'porcentagem') valorDesconto = rawTotalPdvBase * (Number(cupom.valor) / 100);
        cupomUsado = cupom.codigo;
     } else {
        const rawNum = Number(descontoInput.replace(',', '.'));
        if (!isNaN(rawNum) && rawNum > 0) {
           valorDesconto = rawNum;
        } else {
           return showToast('Cupom não encontrado ou valor inválido.', 'error');
        }
     }

     setPdvDescontoAplicado({ valor: valorDesconto, cupom: cupomUsado, autorizadoPorId: func.id, autorizadoPorNome: func.nome });
     setShowDescontoModal(false);
     setDescontoInput('');
     setDescontoPin('');
     showToast('Desconto autorizado e aplicado!', 'success');
  };

  const handlePdvSalvar = async () => {
    // Validação inicial do Caixa
    if (totalPdv < 0) return showToast('O total não pode ser negativo.', 'error');
    if (totalPdv === 0 && Object.keys(pdvCarrinho).length === 0) return showToast('Adicione produtos à venda.', 'error');
    const pagamentosValidos = pdvPagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (totalPdv > 0 && pagamentosValidos.length === 0) return showToast('Informe uma forma de pagamento.', 'error');
    if (Math.abs(restantePdv) > 0.05) return showToast(`O valor pago deve ser exatamente R$ ${totalPdv.toFixed(2)} para liberar a mesa/venda.`, 'error');
    if (pdvTipoPedido === 'Entrega' && !pdvCliente) return showToast('Para entregas, é obrigatório selecionar o cliente.', 'error');

    if (pdvTipoPedido === 'Entrega' && !pdvIsRetirada && pdvTaxaEntregaFixa === null) {
      const calcFee = calculateDeliveryFee(pdvCliente?.lat, pdvCliente?.lng);
      if (calcFee === null) {
        return showToast('O endereço do cliente está fora da área de entrega. Edite o cliente ou altere o tipo para retirada.', 'error');
      }
    }

    try {
      let valorLiquidoTotal = 0;
      const pagamentosProcessados = pagamentosValidos.map(p => {
        const taxa = taxasComPadroes.find(t => t.id === p.taxaId);
        const perc = taxa ? Number(taxa.percentual || 0) : 0;
        const rawLiq = Number(p.valor) - (Number(p.valor) * (perc / 100));
        const liq = Number(rawLiq.toFixed(2));
        valorLiquidoTotal += liq;
        return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
      });
  
      let custoPedido = 0;
      Object.entries(pdvCarrinho).forEach(([id, item]) => {
        const prod = produtos.find(p => p.id === item.produtoId) || promocoes.find(p => p.id === item.produtoId);
        if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
      });
      valorLiquidoTotal = Number((valorLiquidoTotal - custoPedido).toFixed(2));
  
      let ident = 'Balcão';
      if (pdvTipoPedido === 'Entrega') ident = `Delivery: ${pdvCliente?.nome || ''}`;
      else if (pdvTipoPedido === 'Mesa') ident = getMesaIdentificador(mesaSelecionada, pdvCliente?.nome);
      else if (pdvCliente) ident = `Balcão: ${pdvCliente.nome}`;
      dispararImpressaoSeparada(ident, pdvCarrinho, currentUser?.nome);
      await dispararParaCozinha(ident, pdvTipoPedido);
      const detalhesPag = pagamentosProcessados.map(p => `${p.nomeTaxa}: R$ ${p.valor.toFixed(2)}`).join(', ');
      registrarLogX9(pdvSessaoId, ident, 'fechamento', `Venda finalizada. Pago: ${detalhesPag}`, currentUser?.nome || 'Sistema', pdvDescontoAplicado?.autorizadoPorNome, { total: totalPdv, pagamentos: pagamentosProcessados });
  
      const statusEntregaAtual = pdvTipoPedido === 'Entrega' && entregaSelecionada && entregasAbertas[entregaSelecionada]?.statusEntrega
        ? entregasAbertas[entregaSelecionada].statusEntrega
        : 'Pendente';

      const numDiario = pdvTipoPedido === 'Entrega' ? getNumeroDiario('Entrega', entregaSelecionada) : getNumeroDiario('Balcão/Mesa', null);

      const novaVendaId = (pdvTipoPedido === 'Entrega' && entregaSelecionada) ? entregaSelecionada : push(ref(db, 'vendas_pdv')).key;

      await set(ref(db, `vendas_pdv/${novaVendaId}`), {
        valor: totalPdv,
        valorLiquido: valorLiquidoTotal,
        pagamentos: pagamentosProcessados,
        taxaId: pagamentosProcessados.length > 0 ? pagamentosProcessados[0].taxaId : 'cortesia',
        nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : (pagamentosProcessados.length === 1 ? pagamentosProcessados[0].nomeTaxa : 'Cortesia / 100% Desconto'),
        descricao: pdvDescricao || 'Venda Balcão',
        clienteId: pdvCliente?.id || null,
        clienteNome: pdvCliente?.nome || 'Cliente Balcão',
        desconto: pdvDescontoAplicado ? pdvDescontoAplicado.valor : 0,
        cupom: pdvDescontoAplicado?.cupom || null,
        descontoAutorizadoPor: pdvDescontoAplicado?.autorizadoPorNome || null,
        itens: Object.entries(pdvCarrinho).map(([id, item]) => ({ id, ...item })),
        tipoPedido: pdvTipoPedido,
        isRetirada: pdvTipoPedido === 'Entrega' ? pdvIsRetirada : false,
        mesa: pdvTipoPedido === 'Mesa' ? mesaSelecionada : null,
        statusEntrega: pdvTipoPedido === 'Entrega' ? statusEntregaAtual : null,
        taxaEntrega: taxaEntregaPdv,
        numeroDiario: numDiario,
        timestamp: Date.now()
      });
  
      if (pdvCliente) {
        const ultimos = pdvCliente.ultimosPedidos || [];
        const novoPedido = { data: Date.now(), total: totalPdv, itens: Object.values(pdvCarrinho).map((i: any) => `${i.qtd}x ${i.nome}`) };
        const atualizados = [novoPedido, ...ultimos].slice(0, 5);
        await update(ref(db, `clientes/${pdvCliente.id}`), { ultimosPedidos: atualizados });

        if (configFidelidade?.ativo && totalPdv > 0 && pdvTipoPedido !== 'Entrega') {
          const valorPorCarimbo = configFidelidade.valorPorCarimbo || 50;
          const carimbosGanhos = Math.floor(totalPdv / valorPorCarimbo);
          if (carimbosGanhos > 0) {
            const pontosRef = ref(db, `fidelidade_pontos/${pdvCliente.id}`);
            const resultadoPontos = await runTransaction(pontosRef, (dados) => {
              const atual = dados || { clienteId: pdvCliente.id, clienteNome: pdvCliente.nome, pontos: 0, totalGasto: 0 };
              atual.pontos = (atual.pontos || 0) + carimbosGanhos;
              atual.totalGasto = (atual.totalGasto || 0) + totalPdv;
              atual.clienteId = pdvCliente.id;
              atual.clienteNome = pdvCliente.nome;
              return atual;
            });
            await set(push(ref(db, `fidelidade_pontos/${pdvCliente.id}/historico`)), {
              tipo: 'ganho',
              pontos: carimbosGanhos,
              descricao: `Compra R$ ${totalPdv.toFixed(2)} — ${carimbosGanhos} carimbo(s)`,
              timestamp: Date.now(),
              operadorId: currentUser?.id || '',
              operadorNome: currentUser?.nome || 'PDV',
            });
            const totalCarimbosAtualizado = Number(resultadoPontos.snapshot.val()?.pontos || carimbosGanhos);
            await enfileirarMensagemFidelidade(
              pdvCliente,
              carimbosGanhos,
              totalCarimbosAtualizado,
              configFidelidade.carimbosParaPremio || 10
            );
          }
        }
      }
  
      if (pdvTipoPedido === 'Mesa' && mesaSelecionada) {
        await cancelarKdsMesa(mesaSelecionada);
        await remove(ref(db, `mesas_abertas/mesa_${mesaSelecionada}`));
        await remove(ref(db, `mesas_abertas/${mesaSelecionada}`));
      }
      
      if (pdvTipoPedido === 'Entrega' && entregaSelecionada) {
        await remove(ref(db, `entregas_abertas/${entregaSelecionada}`));
      }
  
      setPdvCarrinho({}); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvCliente(null); setPdvTipoPedido('Balcão');
      setPdvDescontoAplicado(null);
      setMesaSelecionada(null);
      setPdvIsRetirada(false);
      setEntregaSelecionada(null);
      setPdvTaxaEntregaFixa(null);
      setPdvItemModal(null);
      setPdvSearchProd('');
      setPdvSearchCliente('');
      setIsCartExpanded(false);
      setPdvView('mapa');
      setPdvSessaoId(`sessao_${Date.now()}`);
      showToast('Venda finalizada com sucesso!', 'success');
    } catch (error: any) {
      showToast('Erro ao finalizar venda: ' + error.message, 'error');
      console.error(error);
    }
  };

  const handleConfSalvar = async () => {
    if (totalConf <= 0) return showToast('Adicione produtos ao lançamento.', 'error');
    const pagamentosValidos = confPagamentos.filter(p => p.taxaId && Number(p.valor) > 0);
    if (pagamentosValidos.length === 0) return showToast('Selecione a forma de pagamento.', 'error');
    if (Math.abs(restanteConf) > 0.05) return showToast(`O valor pago deve ser exatamente igual ao total.`, 'error');

    let valorLiquidoTotal = 0;
    const pagamentosProcessados = pagamentosValidos.map(p => {
      const taxa = taxasComPadroes.find(t => t.id === p.taxaId);
      const perc = taxa ? Number(taxa.percentual || 0) : 0;
      const rawLiq = Number(p.valor) - (Number(p.valor) * (perc / 100));
      const liq = Number(rawLiq.toFixed(2));
      valorLiquidoTotal += liq;
      return { taxaId: p.taxaId, nomeTaxa: taxa?.nome || 'Desconhecida', valor: Number(p.valor), valorLiquido: liq };
    });

    let custoPedido = 0;
    Object.entries(confCarrinho).forEach(([id, item]) => {
      const prod = produtos.find(p => p.id === id) || promocoes.find(p => p.id === id);
      if (prod) custoPedido += Number(prod.custoTotal || 0) * item.qtd;
    });
    valorLiquidoTotal = Number((valorLiquidoTotal - custoPedido).toFixed(2));

    const lancamentoData = {
      valor: totalConf,
      valorLiquido: valorLiquidoTotal,
      pagamentos: pagamentosProcessados,
      taxaId: pagamentosProcessados[0].taxaId,
      nomeTaxa: pagamentosProcessados.length > 1 ? 'Múltiplos' : pagamentosProcessados[0].nomeTaxa,
      descricao: confDescricao || 'Simulação Avulsa',
      itens: Object.entries(confCarrinho).map(([id, item]) => ({ id, ...item })),
      timestamp: editConfId ? (lancamentos.find(l => l.id === editConfId)?.timestamp || Date.now()) : Date.now()
    };

    if (editConfId) {
      await update(ref(db, `lancamentos_vendas/${editConfId}`), lancamentoData);
      showToast('Conferência atualizada com sucesso!', 'success');
    } else {
      await set(push(ref(db, 'lancamentos_vendas')), lancamentoData);
      showToast('Conferência registrada com sucesso!', 'success');
    }

    setConfCarrinho({}); setConfDescricao(''); setConfPagamentos([{ taxaId: '', valor: 0 }]); setShowConfModal(false); setEditConfId(null);
  };

  const handleEditConf = (l: any) => {
    setEditConfId(l.id);
    setConfDescricao(l.descricao || '');
    
    const restoredCarrinho: Record<string, any> = {};
    if (l.itens && Array.isArray(l.itens)) {
      l.itens.forEach((i: any) => restoredCarrinho[i.id] = { nome: i.nome, preco: i.preco || 0, qtd: i.qtd || 1 });
    }
    setConfCarrinho(restoredCarrinho);
    
    if (l.pagamentos && Array.isArray(l.pagamentos)) {
      setConfPagamentos(l.pagamentos.map((p: any) => ({ taxaId: p.taxaId, valor: p.valor })));
    } else {
      setConfPagamentos([{ taxaId: l.taxaId || '', valor: l.valor || 0 }]);
    }
    
    setShowConfModal(true);
  };

  const getInicioDiaComercial = () => {
    const agora = new Date();
    const limiteStr = new Date(agora);
    limiteStr.setHours(6, 59, 59, 999); // Limite de virada do dia (06:59:59 da manhã)
    if (agora.getTime() <= limiteStr.getTime()) {
      const ontem = new Date(agora);
      ontem.setDate(ontem.getDate() - 1);
      ontem.setHours(7, 0, 0, 0); // Considera como "Hoje Comercial" a partir de Ontem às 07:00
      return ontem.getTime();
    } else {
      const hoje = new Date(agora);
      hoje.setHours(7, 0, 0, 0); // Considera como "Hoje Comercial" a partir de Hoje às 07:00
      return hoje.getTime();
    }
  };

  const calcularConferencia = () => {
    const inicioHoje = getInicioDiaComercial();

    const lancamentosHoje = lancamentos.filter(l => l.timestamp >= inicioHoje).sort((a, b) => b.timestamp - a.timestamp);

    const vendasHoje = vendasPdv.filter(v => v.timestamp >= inicioHoje);

    const rawTotalLancado = lancamentosHoje.reduce((acc, l) => acc + l.valor, 0);
    const totalLancado = Number(rawTotalLancado.toFixed(2));
    const rawTotalLiquido = lancamentosHoje.reduce((acc, l) => acc + l.valorLiquido, 0);
    const totalLiquido = Number(rawTotalLiquido.toFixed(2));
    const rawTotalSistema = vendasHoje.reduce((acc, v) => acc + v.valor, 0);
    const totalSistema = Number(rawTotalSistema.toFixed(2));
    const diferenca = Number((totalLancado - totalSistema).toFixed(2));

    return { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje, vendasHoje };
  };
  const { totalLancado, totalLiquido, totalSistema, diferenca, lancamentosHoje, vendasHoje } = calcularConferencia();

  const todosItens = [...produtos.map(p => ({ ...p, tipoItem: 'Produto' })), ...promocoes.map(p => ({ ...p, tipoItem: 'Promoção' }))];
  
  const pdvFilteredItems = todosItens.filter(i => {
    if (i.oculto) return false;
    const nome = i.nome || '';
    if (!normalizeString(nome).includes(normalizeString(pdvSearchProd))) return false;
    const nomeTrimmed = nome.trimStart();
    if (pdvTipoPedido === 'Entrega' && nomeTrimmed.startsWith('%')) return false;
    if (pdvTipoPedido !== 'Entrega' && nomeTrimmed.startsWith('/')) return false;

    if (pdvCategoria !== 'Todos') {
      if (pdvCategoria === 'Promoções') {
        if (i.tipoItem !== 'Promoção') return false;
      } else {
        if (i.tipoItem === 'Promoção' || i.categoria !== pdvCategoria) return false;
      }
    }
    
    return true;
  }).sort((a, b) => ((a as any).ordem || 0) - ((b as any).ordem || 0) || (a.nome || '').localeCompare(b.nome || ''));

  const categoriasCardapioDbOrdenadas = [...categoriasCardapioDb].filter(c => !c.oculto).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  const categoriasCardapio = ['Todos', 'Promoções', ...categoriasCardapioDbOrdenadas.map(c => c.nome)];
  
  const groupedLogs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    logsX9List.forEach(log => {
      const fallbackKey = log.identificador ? `${log.identificador}_${new Date(log.timestamp).toLocaleDateString('pt-BR')}` : `avulso_${log.id}`;
      const key = log.sessaoId || fallbackKey;
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => a.timestamp - b.timestamp));
    return Object.entries(groups).map(([sessaoId, logs]) => {
      const lastLog = logs[logs.length - 1];
      const firstLog = logs[0];
      return {
        sessaoId, identificador: lastLog.identificador || 'Sessão', logs,
        inicio: firstLog.timestamp, fim: (lastLog.tipoEvento === 'fechamento' || lastLog.tipoEvento === 'cancelamento') ? lastLog.timestamp : null,
        lastActivity: lastLog.timestamp
      };
    }).sort((a, b) => b.lastActivity - a.lastActivity);
  }, [logsX9List]);

  const x9Stats = useMemo(() => {
    const counts: Record<string, number> = {
      abertura: 0,
      adicao_item: 0,
      remocao_item: 0,
      edicao_autorizada: 0,
      cancelamento: 0,
      fechamento: 0,
      cozinha_conclusao: 0
    };
    logsX9List.forEach(l => {
      if (counts[l.tipoEvento] !== undefined) counts[l.tipoEvento]++;
      else counts[l.tipoEvento] = 1;
    });
    return counts;
  }, [logsX9List]);
  const maxX9Stat = Math.max(...Object.values(x9Stats), 1);

  const getEventTitle = (tipo: string) => {
    switch(tipo) {
      case 'abertura': return '🟢 Abertura'; case 'adicao_item': return '➕ Adição de Item'; case 'remocao_item': return '➖ Remoção de Item';
      case 'edicao_autorizada': return '🔐 Edição Autorizada'; case 'fechamento': return '💰 Fechamento/Pagamento'; case 'cancelamento': return '🚫 Cancelamento';
      case 'cozinha_conclusao': return '🍳 Retirada (KDS)'; default: return '📝 Registro';
    }
  };

  const getEventStyle = (tipo: string) => {
    switch(tipo) {
      case 'abertura': return { dotOuter: 'border-emerald-400', dotInner: 'bg-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
      case 'adicao_item': return { dotOuter: 'border-green-400', dotInner: 'bg-green-600', bg: 'bg-green-50', border: 'border-green-200' };
      case 'remocao_item': return { dotOuter: 'border-red-400', dotInner: 'bg-red-600', bg: 'bg-red-50', border: 'border-red-200' };
      case 'cancelamento': return { dotOuter: 'border-red-500', dotInner: 'bg-red-700', bg: 'bg-red-100', border: 'border-red-300' };
      case 'edicao_autorizada': return { dotOuter: 'border-orange-400', dotInner: 'bg-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' };
      case 'fechamento': return { dotOuter: 'border-blue-400', dotInner: 'bg-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
      case 'cozinha_conclusao': return { dotOuter: 'border-yellow-400', dotInner: 'bg-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
      default: return { dotOuter: 'border-indigo-400', dotInner: 'bg-indigo-600', bg: 'bg-white', border: 'border-gray-200' };
    }
  };

  const confFilteredItems = todosItens.filter(i => normalizeString(i.nome).includes(normalizeString(confSearchProd)));
  const pdvFilteredClientes = clientes.filter(c => normalizeString(c.nome).includes(normalizeString(pdvSearchCliente)) || (c.telefone || '').includes(pdvSearchCliente));

  const handlePedidoIA = async () => {
    if (!aiPrompt.trim()) return showToast('Descreva o pedido do cliente.', 'error');
    setIsGenerating(true);
    try {
      const availableItems = todosItens.map(i => `${i.nome} (ID: ${i.id}, Preço: ${i.precoVenda})`).join('\n');

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
        body: JSON.stringify({
          model: 'grok-3-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Você é um garçom anotando o pedido. Extraia os itens solicitados do texto e cruze com os itens do cardápio disponíveis. Responda APENAS com um array JSON com a estrutura solicitada.
Cardápio Disponível:
${availableItems}

Formato esperado:
[{
  "produtoId": "ID exato do produto correspondente do cardápio",
  "nome": "Nome do Produto",
  "preco": preco (número),
  "qtd": quantidade (número),
  "observacao": "Alguma observação, restrição ou adicional solicitado para este item específico"
}]`
            },
            { role: 'user', content: aiPrompt }
          ]
        })
      });
      const data = await response.json();
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('Não foi possível compreender o pedido.');
      const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const itensPedido = JSON.parse(cleanJson);
      
      const novosItens: any = { ...pdvCarrinho };
      let addCount = 0;
      for (const item of itensPedido) {
        const prod = todosItens.find(i => i.id === item.produtoId);
        if (prod) {
          const cartItemId = `${prod.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          novosItens[cartItemId] = {
            produtoId: prod.id,
            nome: prod.nome,
            preco: Number(item.preco) || Number(prod.precoVenda) || 0,
            qtd: Number(item.qtd) || 1,
            enviadoCozinha: 0,
            opcoes: item.observacao ? { observacao: item.observacao } : null,
            adicionadoPor: `${currentUser?.nome || 'Sistema'} (IA)`,
            adicionadoEm: Date.now()
          };
          addCount++;
        }
      }
      setPdvCarrinho(novosItens);
      showToast(`Garçom IA adicionou ${addCount} itens ao carrinho!`, 'success');
      setAiPrompt('');
      setShowIaModal(false);
    } catch (e: any) { showToast('Erro IA: ' + e.message, 'error'); } 
    finally { setIsGenerating(false); }
  };

  const DescontoArea = (
    <div className="mb-3 px-1">
       {!pdvDescontoAplicado ? (
         <button onClick={() => setShowDescontoModal(true)} className="w-full py-2.5 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors flex justify-center items-center">
            <Ticket size={16} className="mr-2" /> Adicionar Desconto / Cupom
         </button>
       ) : (
         <div className="flex justify-between items-center bg-red-50 p-2.5 rounded-lg border border-red-200 shadow-sm">
           <div className="flex flex-col">
              <span className="text-xs font-bold text-red-700 flex items-center"><Ticket size={14} className="mr-1"/> Desconto {pdvDescontoAplicado.cupom ? `(${pdvDescontoAplicado.cupom})` : ''}</span>
              <span className="text-[10px] text-red-500 font-medium">Autorizado por: {pdvDescontoAplicado.autorizadoPorNome}</span>
           </div>
           <div className="flex items-center space-x-3">
             <span className="text-sm font-black text-red-600">- R$ {pdvDescontoAplicado.valor.toFixed(2)}</span>
             <button onClick={() => setPdvDescontoAplicado(null)} className="text-red-400 hover:text-red-600 p-1 bg-white rounded-md"><X size={16}/></button>
           </div>
         </div>
       )}
    </div>
  );

  const PaymentSection = (
    <div className="flex flex-col gap-3">
      {pdvTipoPedido === 'Mesa' || pdvTipoPedido === 'Entrega' ? (
        <>
          <button onClick={pdvTipoPedido === 'Mesa' ? handleSalvarMesa : handleSalvarEntrega} className="w-full bg-orange-500 text-white p-3 rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors shadow-md flex justify-center items-center">
            <Save className="mr-2" size={16}/> Salvar / Enviar para Cozinha
          </button>
          
          <div className="border-t border-gray-200 pt-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-center bg-gray-100 py-1.5 rounded-lg"><CreditCard size={14} className="mr-2"/> Pagamento (Encerrar {pdvTipoPedido})</h4>
            
            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200 mb-2">
              <span className="font-bold text-gray-800 uppercase text-xs">Total a Pagar</span>
              <div className="text-right">
                {pdvTipoPedido === 'Entrega' && !pdvIsRetirada && (
                  <div className="text-[10px] text-gray-500 mb-1 font-bold">+ {taxaEntregaText} (Entrega)</div>
                )}
                {pdvDescontoAplicado && <span className="text-xs text-red-500 line-through mr-2">R$ {rawTotalPdvBase.toFixed(2)}</span>}
                <span className="font-black text-lg text-green-600">R$ {totalPdv.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="space-y-2 mb-2 max-h-[120px] overflow-y-auto">
              {pdvPagamentos.map((p, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium">
                    <option value="">Forma de Pagto...</option>
                    {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs font-medium">R$</span>
                    <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-bold text-right" placeholder="0,00" />
                  </div>
                  {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                </div>
              ))}
              {restantePdv > 0.05 && (
                <div className="flex justify-between items-center text-xs px-1">
                  <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                  <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={12} className="mr-1" /> Dividir</button>
                </div>
              )}
            </div>
            
            <button onClick={handlePdvSalvar} disabled={totalPdv < 0 || (totalPdv > 0 && pdvPagamentos.some(p => !p.taxaId)) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center mt-2">
              <CheckCircle className="mr-2" size={16}/> Finalizar e Liberar {pdvTipoPedido}
            </button>
          </div>
        </>
      ) : (
        <>
          {DescontoArea}
          <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100 shadow-inner">
            <span className="font-bold text-green-800 uppercase text-xs">Total a Pagar</span>
            <div className="text-right">
              {pdvDescontoAplicado && <span className="text-xs text-red-500 line-through mr-2">R$ {rawTotalPdvBase.toFixed(2)}</span>}
              <span className="font-black text-xl text-green-600">R$ {totalPdv.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="space-y-2 mt-2 max-h-[120px] overflow-y-auto">
            {pdvPagamentos.map((p, index) => (
              <div key={index} className="flex items-center space-x-2">
                <select value={p.taxaId} onChange={e => handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'taxaId', e.target.value)} className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium">
                  <option value="">Forma de Pagto...</option>
                  {taxasComPadroes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs font-medium">R$</span>
                  <input type="text" value={p.valor === '' ? '' : Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); handlePagamentoChange(setPdvPagamentos, pdvPagamentos, index, 'valor', digits ? parseInt(digits, 10) / 100 : ''); }} className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-xs font-bold text-right" placeholder="0,00" />
                </div>
                {pdvPagamentos.length > 1 && <button onClick={() => setPdvPagamentos(pdvPagamentos.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
              </div>
            ))}
            {restantePdv > 0.05 && (
              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-red-500 font-bold">Falta: R$ {restantePdv.toFixed(2)}</span>
                <button onClick={() => setPdvPagamentos([...pdvPagamentos, { taxaId: '', valor: restantePdv > 0 ? Number(restantePdv.toFixed(2)) : '' }])} className="text-blue-600 font-bold flex items-center hover:text-blue-800"><Plus size={12} className="mr-1" /> Dividir</button>
              </div>
            )}
          </div>
          
          <button onClick={handlePdvSalvar} disabled={totalPdv < 0 || (totalPdv > 0 && pdvPagamentos.some(p => !p.taxaId)) || Math.abs(restantePdv) > 0.05} className="w-full bg-green-600 text-white p-3 rounded-lg font-bold text-base hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 mt-2 flex justify-center items-center">
            <CheckCircle className="mr-2" size={18}/> Finalizar Venda
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-emerald-100 p-3 rounded-xl mr-4 text-emerald-600">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Caixa e Vendas</h3>
            <p className="text-sm text-gray-500">Ponto de Venda Oficial e Módulo de Conferência Financeira.</p>
          </div>
        </div>
        
        {(canViewComandas || isAdminOrGerente || canViewX9) && (
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveView('pdv')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${activeView === 'pdv' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Frente de Caixa (PDV)</button>
            {canViewComandas && (
              <button onClick={() => setActiveView('comandas')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'comandas' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Receipt size={16} className="mr-1"/> Comandas</button>
            )}
            {isAdminOrGerente && (
              <>
                <button onClick={() => setActiveView('conferencia')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'conferencia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Calculator size={16} className="mr-1"/> Conferência (Admin)</button>
              </>
            )}
            {canViewX9 && (
              <button onClick={() => setActiveView('x9')} className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center ${activeView === 'x9' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Eye size={16} className="mr-1"/> Registros X9</button>
            )}
          </div>
        )}
      </div>

      {activeView === 'pdv' && pdvView === 'mapa' && (
        <>
          <style>{`
            /* Destaca entregas concluídas no PDV (Aguardando Pagamento) */
            button:has(span.bg-gray-200.text-gray-700), button:has(span.bg-gray-100.text-gray-700) {
              background-color: #fef9c3 !important; 
              border-color: #eab308 !important; 
              animation: pdv-alert-pulse 1.5s infinite !important;
            }
            button:has(span.bg-gray-200.text-gray-700) span.text-orange-600,
            button:has(span.bg-gray-100.text-gray-700) span.text-orange-600,
            button:has(span.bg-gray-200.text-gray-700) span.text-orange-700,
            button:has(span.bg-gray-100.text-gray-700) span.text-orange-700 {
              color: #a16207 !important; 
            }
            @keyframes pdv-alert-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.02); background-color: #fef08a !important; }
            }
          `}</style>
          <MapaView
            isCaixaOrAdmin={isCaixaOrAdmin}
            canDelivery={canDelivery}
            entregasAbertas={entregasVisiveisPdv}
            mesasAbertas={mesasAbertas}
            qtdMesas={qtdMesas}
          onAbrirEntrega={handleAbrirEntrega}
          onAbrirMesa={handleAbrirMesa}
          getMesaIdentificador={getMesaIdentificador}
          onReimprimirEntrega={handleReimprimirEntrega}
          onReimprimirMesa={handleReimprimirMesa}
          onAbrirPainelEntregas={() => setShowPainelEntregas(true)}
          onAddMesa={() => set(ref(db, 'configuracoes/pdv/qtdMesas'), qtdMesas + 1)}
          onAbrirDelivery={() => { setMesaSelecionada(null); setEntregaSelecionada(null); setPdvTipoPedido('Entrega'); setPdvCarrinho({}); setPdvCliente(null); setPdvItemModal(null); setPdvSearchProd(''); setPdvSearchCliente(''); setIsCartExpanded(false); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvView('caixa'); }}
          onAbrirBalcao={() => { setPdvSessaoId(`balcao_${Date.now()}`); setMesaSelecionada(null); setEntregaSelecionada(null); setPdvTipoPedido('Balcão'); setPdvCarrinho({}); setPdvCliente(null); setPdvItemModal(null); setPdvSearchProd(''); setPdvSearchCliente(''); setIsCartExpanded(false); setPdvDescricao(''); setPdvPagamentos([{ taxaId: '', valor: 0 }]); setPdvView('caixa'); }}
        />
        </>
      )}

      {activeView === 'pdv' && pdvView === 'caixa' && (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 animate-in slide-in-from-left-4 duration-300 pb-52 lg:pb-0 lg:h-[calc(100vh-140px)]">
          
          <div className="flex flex-col w-full lg:w-[400px] xl:w-[450px] gap-4 h-full shrink-0">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-[300px] max-h-[50vh] lg:max-h-none z-10 overflow-hidden">
              <h3 className="font-bold text-gray-800 flex items-center mb-4 text-lg"><ShoppingCart className="mr-2 text-green-600"/> Caixa Aberto</h3>
            
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg items-center">
              <button onClick={() => setPdvView('mapa')} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md transition-colors" title="Voltar para Mapa">
                <ArrowLeft size={18}/>
              </button>
              {pdvTipoPedido === 'Mesa' ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="font-bold text-gray-700 truncate">{getMesaIdentificador(mesaSelecionada, pdvCliente?.nome)}</span>
                  {canCancelTable && (
                    <button onClick={handleCancelarPedidoAtual} className="text-red-500 hover:bg-red-100 p-1.5 rounded-md text-xs font-bold transition-colors ml-auto flex items-center shrink-0" title="Cancelar pedido e desvincular cliente">
                      <Trash2 size={14} className="mr-1"/> Cancelar Mesa
                    </button>
                  )}
                </div>
              ) : entregaSelecionada ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="flex-1 font-bold text-green-700 text-center">Edição de Delivery</span>
                  {canCancelTable && (
                    <button onClick={handleCancelarPedidoAtual} className="text-red-500 hover:bg-red-100 p-1.5 rounded-md text-xs font-bold transition-colors ml-auto flex items-center shrink-0" title="Cancelar delivery e desvincular cliente">
                      <Trash2 size={14} className="mr-1"/> Cancelar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 gap-1">
                {isCaixaOrAdmin && <button onClick={() => { setPdvSessaoId(`balcao_${Date.now()}`); setPdvTipoPedido('Balcão'); }} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Balcão' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Balcão</button>}
                {canDelivery && <button onClick={() => setPdvTipoPedido('Entrega')} className={`flex-1 py-1.5 rounded-md font-bold text-sm transition-colors ${pdvTipoPedido === 'Entrega' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Delivery</button>}
                {!isCaixaOrAdmin && !canDelivery && <div className="flex-1 text-center font-bold text-gray-500 py-1.5">Selecione uma mesa no mapa</div>}
                </div>
              )}
              {pdvTipoPedido === 'Entrega' && !entregaSelecionada && (
                <label className="flex items-center space-x-2 mt-2 w-full cursor-pointer bg-orange-50 p-2 rounded-lg border border-orange-100">
                  <input type="checkbox" checked={pdvIsRetirada} onChange={e => setPdvIsRetirada(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500 accent-orange-600 w-4 h-4" />
                  <span className="text-sm font-bold text-orange-800">Retirada na Loja (Cliente vem buscar)</span>
                </label>
              )}
            </div>
            
            <div className="mb-4 relative">
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Cliente {(pdvTipoPedido === 'Entrega' || pdvTipoPedido === 'Mesa') ? '(Obrigatório)' : '(Opcional)'}</label>
              {pdvCliente ? (
                <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <User size={16} className="text-indigo-600 shrink-0"/>
                    <span className="font-bold text-indigo-800 text-sm truncate">{pdvCliente.nome}</span>
                    {configFidelidade?.ativo && (
                      <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-0.5 rounded-full shrink-0">
                        ★ {pontosPorCliente[pdvCliente.id] || 0}/{configFidelidade.carimbosParaPremio || 10}
                      </span>
                    )}
                    {configFidelidade?.ativo && totalPdv > 0 && Math.floor(totalPdv / (configFidelidade.valorPorCarimbo || 50)) > 0 && (
                      <span className="text-xs text-green-600 font-bold shrink-0">
                        +{Math.floor(totalPdv / (configFidelidade.valorPorCarimbo || 50))} carimbo(s)
                      </span>
                    )}
                    {configFidelidade?.ativo && (pontosPorCliente[pdvCliente.id] || 0) >= (configFidelidade.carimbosParaPremio || 10) && (
                      <span className="text-xs bg-green-100 text-green-700 font-black px-2 py-0.5 rounded-full animate-pulse shrink-0">🎁 PRÊMIO!</span>
                    )}
                  </div>
                  <button onClick={() => setPdvCliente(null)} className="text-indigo-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-100 shrink-0"><X size={18}/></button>
                </div>
              ) : (
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Vincular a um cliente..." value={pdvSearchCliente} onChange={e => setPdvSearchCliente(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    {pdvSearchCliente && pdvFilteredClientes.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {pdvFilteredClientes.map(c => (
                          <button key={c.id} onClick={() => { setPdvCliente(c); setPdvSearchCliente(''); setPdvTaxaEntregaFixa(null); }} className="w-full text-left p-3 hover:bg-indigo-50 border-b border-gray-50 text-sm flex justify-between items-center transition-colors">
                            <div>
                              <p className="font-bold text-gray-800">{c.nome}</p>
                              <p className="text-xs text-gray-500">{c.telefone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {configFidelidade?.ativo && pontosPorCliente[c.id] > 0 && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pontosPorCliente[c.id] >= (configFidelidade.carimbosParaPremio || 10) ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {pontosPorCliente[c.id] >= (configFidelidade.carimbosParaPremio || 10) ? '🎁' : '★'} {pontosPorCliente[c.id]}/{configFidelidade.carimbosParaPremio || 10}
                                </span>
                              )}
                              <Plus size={16} className="text-indigo-500"/>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setShowQuickClientModal(true); setQuickClientPhone(pdvSearchCliente.replace(/\D/g, '').length >= 10 ? formatPhone(pdvSearchCliente) : ''); }} className="bg-indigo-100 text-indigo-700 p-2.5 rounded-lg font-bold hover:bg-indigo-200 transition-colors shrink-0" title="Cadastro Rápido"><Plus size={20}/></button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border-t border-b border-gray-100 py-3 space-y-3 pr-1">
              {(() => {
                const cartItemsList = Object.entries(pdvCarrinho);
                const displayedItems = isCartExpanded ? cartItemsList : cartItemsList.slice(0, 3);
                return (
                  <>
                    {displayedItems.map(([id, item]) => (
                      <div key={id} className="flex justify-between items-start text-base group border-b border-gray-100 pb-4 mb-2 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center">
                            <div className="flex items-center space-x-2 mr-3 bg-gray-100 rounded p-1 shrink-0">
                              {(() => {
                                const enviado = item.enviadoCozinha || 0;
                                const bloqueado = enviado > 0 && item.qtd <= enviado && !isEditAuthValid();
                                return (
                                  <button
                                    onClick={() => handleMinusClick(id, item as any)}
                                    title={bloqueado ? 'Requer autorização do Caixa/Gerente' : ''}
                                    className={`rounded px-2 py-1 transition-colors ${bloqueado ? 'text-orange-500 hover:text-orange-700 hover:bg-white' : 'text-gray-500 hover:text-red-500 hover:bg-white'}`}
                                  >
                                    {bloqueado ? <Lock size={16}/> : <Minus size={18}/>}
                                  </button>
                                );
                              })()}
                              <span className="font-black w-6 text-center text-base">{item.qtd}</span>
                              {(() => {
                                const enviado = item.enviadoCozinha || 0;
                                const bloqueado = enviado > 0 && !isEditAuthValid();
                                return (
                                  <button
                                    onClick={() => handlePlusClick(id, item as any)}
                                    title={bloqueado ? 'Requer autorização do Caixa/Gerente. Para adicionar sem autorização, busque o produto novamente.' : ''}
                                    className={`rounded px-2 py-1 transition-colors ${bloqueado ? 'text-orange-500 hover:text-orange-700 hover:bg-white' : 'text-gray-500 hover:text-green-500 hover:bg-white'}`}
                                  >
                                    {bloqueado ? <Lock size={16}/> : <Plus size={18}/>}
                                  </button>
                                );
                              })()}
                            </div>
                            <p className="font-bold text-gray-800 break-words text-lg">{item.nome}</p>
                            {item.enviadoCozinha && item.enviadoCozinha > 0 ? (
                              (item.concluidoCozinha || 0) >= item.enviadoCozinha ? (
                                 <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2 font-bold whitespace-nowrap flex items-center shrink-0"><CheckCircle size={12} className="mr-1"/> Pronto ({item.enviadoCozinha})</span>
                              ) : (item.concluidoCozinha || 0) > 0 ? (
                                 <div className="flex gap-1 ml-2">
                                   <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center shrink-0"><CheckCircle size={12} className="mr-1"/> Pronto ({item.concluidoCozinha})</span>
                                   <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold whitespace-nowrap flex items-center shrink-0"><Flame size={12} className="mr-1"/> Cozinha ({(item.enviadoCozinha || 0) - (item.concluidoCozinha || 0)})</span>
                                 </div>
                              ) : (
                                 <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full ml-2 font-bold whitespace-nowrap flex items-center shrink-0"><Flame size={12} className="mr-1"/> Na Cozinha ({item.enviadoCozinha})</span>
                              )
                            ) : null}
                          </div>
                          {item.opcoes && (
                            <div className="text-sm text-gray-500 mt-2 pl-16 space-y-1">
                              {item.opcoes.montagem && Object.values(item.opcoes.montagem).length > 0 && <p><span className="font-bold text-gray-600">Montagem:</span> {Object.values(item.opcoes.montagem).join(', ')}</p>}
                              {item.opcoes.pontoCarne && <p><span className="font-bold text-gray-600">Ponto:</span> {item.opcoes.pontoCarne}</p>}
                              {item.opcoes.adicionais && Object.values(item.opcoes.adicionais).map((a:any, i:number) => <p key={i}>+ {a.qtd}x AD/ {a.nome}</p>)}
                              {item.opcoes.restricoes && Object.values(item.opcoes.restricoes).length > 0 && <p className="text-red-500 font-medium">- {Object.values(item.opcoes.restricoes).join(', ')}</p>}
                              {item.opcoes.observacao && <p><span className="font-bold text-gray-600">Obs:</span> {item.opcoes.observacao}</p>}
                            </div>
                          )}
                          {item.adicionadoPor && (
                            <p className="text-xs text-gray-400 mt-2 pl-16 flex items-center font-medium">
                              <User size={12} className="mr-1"/> Add por {item.adicionadoPor} às {new Date(item.adicionadoEm || Date.now()).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                            </p>
                          )}
                        </div>
                        <span className="font-black text-gray-800 shrink-0 mt-1 text-lg">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                      </div>
                    ))}
                    {cartItemsList.length > 3 && (
                      <button onClick={() => setIsCartExpanded(!isCartExpanded)} className="w-full text-center text-sm font-bold text-gray-500 hover:text-gray-800 py-3 mt-2 bg-gray-100 rounded-lg transition-colors flex items-center justify-center">
                        {isCartExpanded ? 'Recolher Itens' : `Ver mais ${cartItemsList.length - 3} itens...`}
                      </button>
                    )}
                  </>
                );
              })()}
              {Object.keys(pdvCarrinho).length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-80 py-4">
                  <Receipt size={48} className="mb-3" />
                  <p className="text-sm font-medium">Caixa Livre</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex bg-white p-4 rounded-xl shadow-sm border border-gray-100 shrink-0 flex-col">
            {PaymentSection}
          </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 h-[60vh] lg:h-full min-h-[400px]">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative shrink-0 hidden sm:block">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select
                  value={pdvCategoria}
                  onChange={(e) => setPdvCategoria(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors text-sm font-bold text-gray-700 appearance-none cursor-pointer"
                >
                  {categoriasCardapio.map((cat: any) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar hambúrguer, bebida ou combo..." value={pdvSearchProd} onChange={(e) => setPdvSearchProd(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors text-lg" />
              </div>
              <button onClick={() => setShowIaModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-sm shrink-0" title="Garçom IA">
                <Sparkles size={24} />
              </button>
            </div>
            
            <div className="flex overflow-x-auto gap-3 mb-4 pb-2 border-b border-gray-100 shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoriasCardapio.map((cat: any) => {
                const config = categoriasCardapioDb.find(c => c.nome === cat);
                return (
                <button
                  key={cat}
                  onClick={() => setPdvCategoria(cat)}
                  className={`flex flex-col items-center min-w-[80px] w-[80px] gap-1 transition-all ${pdvCategoria === cat ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100'}`}
                >
                  <div className={`w-16 h-16 rounded-xl shadow-sm border flex items-center justify-center overflow-hidden shrink-0 ${pdvCategoria === cat ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 bg-white'}`}>
                    {config?.imageUrl ? (
                      <img src={config.imageUrl} alt={cat} className="w-full h-full object-cover" />
                    ) : (
                      <Store size={20} className={pdvCategoria === cat ? 'text-green-500' : 'text-gray-400'} />
                    )}
                  </div>
                  <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 w-full ${pdvCategoria === cat ? 'text-green-700' : 'text-gray-600'}`}>{cat}</span>
                </button>
              )})}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-y-auto pr-2 pb-4">
              {pdvFilteredItems.map(item => (
                <div key={item.id} onClick={() => handleOpenPdvItemModal(item)} className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm hover:border-green-500 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between h-auto min-h-[140px] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
                  {item.imageUrl ? (
                    <div className="w-full h-24 mb-2 rounded-lg overflow-hidden shrink-0">
                      <img src={item.imageUrl} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                  ) : null}
                  <p className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">{item.nome}</p>
                  <div className="mt-auto pt-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.tipoItem}</p>
                    <p className="font-black text-green-600 text-lg">R$ {(item.precoVenda || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.1)] z-50 rounded-t-2xl max-h-[50vh] overflow-y-auto">
             {PaymentSection}
          </div>

        </div>
      )}

      {activeView === 'conferencia' && (
        <ConferenciaView
          totalSistema={totalSistema}
          totalLancado={totalLancado}
          totalLiquido={totalLiquido}
          diferenca={diferenca}
          lancamentosHoje={lancamentosHoje}
          onAbrirSimulador={() => { setEditConfId(null); setConfCarrinho({}); setConfPagamentos([{ taxaId: '', valor: 0 }]); setConfDescricao(''); setShowConfModal(true); }}
          onEditConf={handleEditConf}
          onZerarConferencia={() => { if(confirm('Excluir todos os lançamentos simulados?')) remove(ref(db, 'lancamentos_vendas')); }}
          onDeletarLancamento={(id) => { if(confirm('Excluir?')) remove(ref(db, `lancamentos_vendas/${id}`)); }}
        />
      )}

      {activeView === 'comandas' && (
        <ComandasView
          vendasHoje={vendasHoje}
          onVerComanda={setViewComanda}
        />
      )}

      {activeView === 'x9' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full animate-in fade-in duration-300 min-h-[500px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center"><Eye className="mr-2 text-indigo-600"/> Registro X9 (Auditoria e Movimentos)</h3>
              <p className="text-sm text-gray-500">Histórico completo de movimentação de mesas, adições, remoções e pagamentos (Últimos 7 dias).</p>
            </div>
            <button onClick={() => { if(confirm('Limpar todos os registros de auditoria?')) remove(ref(db, 'logs_x9')); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center text-sm">
              <Trash2 size={16} className="mr-2"/> Limpar Registros
            </button>
          </div>

          <div className="p-6 border-b border-gray-100 bg-white shrink-0">
            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center"><BarChart2 size={18} className="mr-2 text-indigo-500"/> Frequência de Eventos (Últimos 7 dias)</h4>
            <div className="flex h-24 items-end gap-2 sm:gap-4">
              {Object.entries(x9Stats).map(([tipo, count]) => {
                const style = getEventStyle(tipo);
                const height = `${(count / maxX9Stat) * 100}%`;
                const titleNorm = getEventTitle(tipo).replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
                return (
                  <div key={tipo} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div className={`w-full ${style.bg} ${style.border} border rounded-t-md relative flex justify-center hover:opacity-80 transition-opacity`} style={{ height: count > 0 ? height : '4px', minHeight: count > 0 ? '4px' : '0' }}>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded transition-opacity whitespace-nowrap z-10">
                        {count} eventos
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 mt-2 truncate w-full text-center" title={titleNorm}>
                      {titleNorm}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {groupedLogs.map(group => (
              <div key={group.sessaoId} className="border border-gray-200 rounded-xl shadow-sm overflow-hidden bg-white">
                <button onClick={() => setExpandedSessao(expandedSessao === group.sessaoId ? null : group.sessaoId)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">{group.identificador}</h4>
                    <p className="text-xs text-gray-500 mt-1">Início: {new Date(group.inicio).toLocaleString('pt-BR')} {group.fim ? ` • Fim: ${new Date(group.fim).toLocaleString('pt-BR')}` : ' • Em andamento'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{group.logs.length} eventos</span>
                    {expandedSessao === group.sessaoId ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                  </div>
                </button>
                {expandedSessao === group.sessaoId && (
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <div className="relative border-l-2 border-indigo-200 ml-3 space-y-6">
                      {group.logs.map((log: any) => {
                        const style = getEventStyle(log.tipoEvento);
                        return (
                          <div key={log.id} className="relative pl-6">
                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center ${style.dotOuter}`}><div className={`w-1.5 h-1.5 rounded-full ${style.dotInner}`}></div></div>
                            <div className={`p-3 rounded-lg border shadow-sm ${style.bg} ${style.border}`}>
                              <div className="flex justify-between items-start mb-1"><span className="font-bold text-sm text-gray-800">{getEventTitle(log.tipoEvento)}</span><span className="text-[10px] text-gray-400 font-mono">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span></div>
                              <p className="text-sm text-gray-700">{log.descricao}</p>
                              <div className="mt-2 flex flex-wrap gap-2"><span className="text-[10px] bg-white text-gray-600 px-2 py-0.5 rounded font-medium flex items-center shadow-sm border border-gray-100"><User size={10} className="mr-1"/> Por: {log.atorNome}</span>{log.autorizadorNome && (<span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold flex items-center border border-orange-200"><Lock size={10} className="mr-1"/> Autorizado por: {log.autorizadorNome}</span>)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {groupedLogs.length === 0 && <div className="text-center py-12 text-gray-400"><Eye size={48} className="mx-auto mb-3 opacity-20" /><p>Nenhum registro de auditoria encontrado nos últimos 7 dias.</p></div>}
          </div>
        </div>
      )}

      <PdvItemModal
        produto={pdvItemModal}
        onClose={() => setPdvItemModal(null)}
        options={pdvItemOptions}
        setOptions={setPdvItemOptions}
        onAdicionar={handleAddPdvItem}
        produtos={produtos}
      />

      <GarcomIaModal
        show={showIaModal}
        onClose={() => setShowIaModal(false)}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        isGenerating={isGenerating}
        onSubmit={handlePedidoIA}
      />

      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto sm:max-w-md p-4 rounded-xl shadow-2xl text-white font-bold flex items-start z-[100] transition-all animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-3 shrink-0 mt-0.5" size={20} /> : <AlertTriangle className="mr-3 shrink-0 mt-0.5" size={20} />}
          <span className="whitespace-pre-line break-words text-sm flex-1">{toast.message}</span>
        </div>
      )}

      <AlertPedidoConcluidoModal
        pedido={alertPedidoConcluido}
        onClose={() => setAlertPedidoConcluido(null)}
        onConfirmarX9={registrarConfirmacaoX9}
      />

      <AuthEditModal
        authEditModal={authEditModal}
        onClose={() => setAuthEditModal(null)}
        authEditMethod={authEditMethod}
        setAuthEditMethod={setAuthEditMethod}
        authEditPin={authEditPin}
        setAuthEditPin={setAuthEditPin}
        faceAuthVideoRef={faceAuthVideoRef as any}
        faceAuthStatus={faceAuthStatus}
        onAutorizarPin={handleAutorizarEdicaoPorPin}
      />

      <ComandaModal
        venda={viewComanda}
        onClose={() => setViewComanda(null)}
        onImprimir={handleImprimirCupom}
      />

      <SimuladorRecebimentoModal
        show={showConfModal}
        editConfId={editConfId}
        onClose={() => { setShowConfModal(false); setEditConfId(null); }}
        confSearchProd={confSearchProd}
        setConfSearchProd={setConfSearchProd}
        confFilteredItems={confFilteredItems}
        onUpdateCart={(itemId, nome, preco, delta) => updateCart(setConfCarrinho, itemId, nome, preco, delta)}
        confCarrinho={confCarrinho}
        totalConf={totalConf}
        restanteConf={restanteConf}
        confPagamentos={confPagamentos}
        setConfPagamentos={setConfPagamentos}
        taxasComPadroes={taxasComPadroes}
        onPagamentoChange={(index, field, value) => handlePagamentoChange(setConfPagamentos, confPagamentos, index, field, value)}
        confDescricao={confDescricao}
        setConfDescricao={setConfDescricao}
        onSalvar={handleConfSalvar}
      />

      <PainelEntregasModal
        show={showPainelEntregas && canDelivery}
        onClose={() => setShowPainelEntregas(false)}
        entregasAbertas={entregasAbertas}
        vendasPdv={vendasPdv}
        pedidosCozinha={pedidosCozinha}
        onAbrirEntrega={handleAbrirEntrega}
        onReabrirEntrega={handleReabrirEntrega}
        onFinalizarEntrega={(vendaId, isAberta) => { 
          if(confirm('Marcar esta entrega como concluída?')) {
            if (isAberta) {
              update(ref(db, `entregas_abertas/${vendaId}`), { statusEntrega: 'Concluída' });
            } else {
              update(ref(db, `vendas_pdv/${vendaId}`), { statusEntrega: 'Concluída' }); 
            }
          }
        }}
        getInicioDiaComercial={getInicioDiaComercial}
        onVerVenda={(venda) => setViewComanda(venda)}
      />

      <DescontoModal
        show={showDescontoModal}
        onClose={() => { setShowDescontoModal(false); setDescontoInput(''); setDescontoPin(''); }}
        descontoInput={descontoInput}
        setDescontoInput={setDescontoInput}
        descontoPin={descontoPin}
        setDescontoPin={setDescontoPin}
        onSubmit={handleAplicarDesconto}
      />

      <QuickClientModal
        show={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        quickClientName={quickClientName}
        setQuickClientName={setQuickClientName}
        quickClientPhone={quickClientPhone}
        setQuickClientPhone={setQuickClientPhone}
        onSalvar={handleCriarClienteVinculado}
        formatPhone={formatPhone}
      />

    </div>
  );
}
