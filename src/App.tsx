import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InsumosManager from './components/InsumosManager';
import ProdutosManager from './components/ProdutosManager';
import PromocoesManager from './components/PromocoesManager';
import ComprasManager from './components/ComprasManager';
import ProducaoManager from './components/ProducaoManager';
import RelatoriosManager from './components/RelatoriosManager';
import FechamentoManager from './components/FechamentoManager';
import { LayoutDashboard, Package, Utensils, Menu, X, CheckCircle, Scale, Wallet, ArrowRightLeft, Users, LogOut, Lock, Truck, ShoppingCart, Settings, CheckSquare, Megaphone } from 'lucide-react';
import BalancoManager from './components/BalancoManager';
import TarefasManager from './components/TarefasManager';
import PermissoesManager from './components/PermissoesManager';
import TransferenciaManager from './components/TransferenciaManager';
import VisibilidadeManager from './components/VisibilidadeManager';
import DescarteManager from './components/DescarteManager';
import GestaoFinanceira from './components/GestaoFinanceira';
import FuncionariosManager from './components/FuncionariosManager';
import GestaoEquipeManager from './components/GestaoEquipeManager';
import LancamentoVendas from './components/LancamentoVendas';
import BancosCartoes from './components/BancosCartoes';
import ConfiguracoesGerais from './components/ConfiguracoesGerais';
import AtualizacoesSistema from './components/AtualizacoesSistema';
import ClientesManager from './components/ClientesManager';
import DespachoManager from './components/DespachoManager';
import MarketingManager from './components/MarketingManager';
import BlocoNotasManager from './components/BlocoNotasManager';
import MinhasEntregas from './components/MinhasEntregas';
import { ref, onValue, set, push, update } from 'firebase/database';
import { db } from './firebase';
import { Funcionario } from './types';
import logoImg from './assets/logo.png';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pdv' | 'cadastros' | 'cardapio' | 'movimentacoes' | 'producao' | 'financeiro' | 'funcionarios' | 'logistica' | 'configuracoes' | 'tarefas' | 'marketing'>('dashboard');
  const [subTabCadastros, setSubTabCadastros] = useState<'insumos' | 'fornecedores'>('insumos');
  const [subTabCardapio, setSubTabCardapio] = useState<'produtos' | 'promocoes'>('produtos');
  const [subTabMovimentacoes, setSubTabMovimentacoes] = useState<'compras' | 'transferencia' | 'visibilidade' | 'descartes' | 'balanco'>('compras');
  const [subTabFinanceiro, setSubTabFinanceiro] = useState<'calendario' | 'relatorios_gerais'>('calendario');
  const [subSubTabRelatorios, setSubSubTabRelatorios] = useState<'fechamento' | 'dashboard_fin' | 'movimentacoes'>('fechamento');
  const [subSubTabConfiguracoes, setSubSubTabConfiguracoes] = useState<'bancos_cartoes' | 'gerais' | 'atualizacoes'>('gerais');
  const [subTabFuncionarios, setSubTabFuncionarios] = useState<'equipe' | 'gestao' | 'ia' | 'permissoes'>('equipe');
  const [subTabLogistica, setSubTabLogistica] = useState<'clientes' | 'despacho' | 'minhas_entregas'>('clientes');
  const [subTabTarefas, setSubTabTarefas] = useState<'gerenciamento' | 'notas'>('gerenciamento');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [currentUser, setCurrentUser] = useState<Funcionario | null>(() => {
    const saved = sessionStorage.getItem('arttburger_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [permissoes, setPermissoes] = useState<Record<string, any>>({});
  const [missingCpfInput, setMissingCpfInput] = useState('');

  // Salva a sessão para não deslogar quando a página atualiza ou o código é salvo no localhost
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('arttburger_session', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('arttburger_session');
    }
  }, [currentUser]);

  // Mantém a sessão do usuário atualizada em tempo real caso os cargos sejam alterados
  useEffect(() => {
    if (currentUser && funcionarios.length > 0) {
      const updatedUser = funcionarios.find(f => f.id === currentUser.id);
      if (updatedUser) {
        const currentCargoStr = Array.isArray(currentUser.cargo) ? [...currentUser.cargo].sort().join(',') : currentUser.cargo;
        const updatedCargoStr = Array.isArray(updatedUser.cargo) ? [...updatedUser.cargo].sort().join(',') : updatedUser.cargo;
        if (currentCargoStr !== updatedCargoStr || (updatedUser as any).ativo !== (currentUser as any).ativo || (updatedUser as any).cpf !== (currentUser as any).cpf) {
          setCurrentUser(updatedUser);
        }
      }
    }
  }, [funcionarios]);

  useEffect(() => {
    document.title = 'ArttBurger';

    // Força a tag de Viewport para corrigir a escala em celulares e tablets
    let metaViewport = document.querySelector("meta[name=viewport]") as HTMLMetaElement;
    if (!metaViewport) { 
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    metaViewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0";

    // Adiciona a logo na aba do navegador (Favicon)
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) { 
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoImg;

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as any; 
      console.log('🔗 URL mudou para a aba:', hash);
      
      if (['dashboard', 'pdv', 'cadastros', 'cardapio', 'movimentacoes', 'producao', 'financeiro', 'funcionarios', 'logistica', 'configuracoes', 'tarefas', 'marketing'].includes(hash)) {
        setActiveTab(hash as any);
      }
      setIsMobileMenuOpen(false);
    };

    window.addEventListener('hashchange', handleHashChange);
    
    if (!window.location.hash) {
      window.location.hash = 'dashboard';
    } else {
      handleHashChange();
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const funcRef = ref(db, 'funcionarios');
    let isFirstLoad = true;
    return onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFuncionarios(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setFuncionarios([]);
        if (isFirstLoad) {
          set(push(ref(db, 'funcionarios')), { nome: 'Admin', pin: '0000', cargo: 'Administrador' });
        }
      }
      isFirstLoad = false;
    });
  }, []);

  useEffect(() => {
    const permRef = ref(db, 'permissoes');
    return onValue(permRef, (snap) => {
      if (snap.val()) setPermissoes(snap.val());
      else setPermissoes({});
    });
  }, []);

  const handleTabChange = (tab: 'dashboard' | 'pdv' | 'cadastros' | 'cardapio' | 'movimentacoes' | 'producao' | 'financeiro' | 'funcionarios' | 'logistica' | 'configuracoes' | 'tarefas' | 'marketing') => {
    window.location.hash = tab;
    setIsMobileMenuOpen(false); // Fecha o menu no mobile após o clique
  };

  const temPermissao = (modulo: string, abaId?: string, acao: 'visualizar' | 'editar' | 'apagar' = 'visualizar') => {
    if (!currentUser) return false;
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    if (cargos.includes('Dono') || cargos.includes('TI')) return true;
    return cargos.some(c => {
      const p = permissoes[c];
      if (!p) return false;
      if (abaId && p[abaId] && p[abaId].visualizar === false) return false;
      return p[modulo]?.[acao];
    });
  };

  const getAllowedTabs = () => {
    if (!currentUser) return [];
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    
    const isKdsOnly = cargos.length > 0 && cargos.every((c: string) => c.toUpperCase().includes('KDS'));
    if (isKdsOnly) return ['producao'];

    const isEntregadorOnly = cargos.length > 0 && cargos.every((c: string) => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy'));
    if (isEntregadorOnly) return ['logistica'];

    if (cargos.includes('Dono') || cargos.includes('TI')) return ['dashboard', 'pdv', 'logistica', 'cadastros', 'cardapio', 'movimentacoes', 'producao', 'financeiro', 'funcionarios', 'configuracoes', 'tarefas', 'marketing'];

    const allowed: string[] = [];
    
    const hasPerm = (mod: string, abaId?: string, acao: 'visualizar' | 'editar' | 'apagar' = 'visualizar') => {
      return cargos.some((c: string) => {
        const p = permissoes[c];
        if (!p) return false;
        if (abaId && p[abaId] && p[abaId].visualizar === false) return false;
        return p[mod]?.[acao];
      });
    };

    if (hasPerm('dashboard_geral', 'aba_dashboard')) allowed.push('dashboard');
    if (hasPerm('vendas', 'aba_pdv') || hasPerm('pdv_comandas', 'aba_pdv') || hasPerm('pdv_conferencia', 'aba_pdv')) allowed.push('pdv');
    if (hasPerm('clientes', 'aba_logistica') || hasPerm('despacho', 'aba_logistica') || hasPerm('minhas_entregas', 'aba_logistica') || hasPerm('gerenciar_tags', 'aba_logistica') || cargos.some((c: string) => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy'))) allowed.push('logistica');
    if (hasPerm('insumos', 'aba_cadastros') || hasPerm('fornecedores', 'aba_cadastros')) allowed.push('cadastros');
    if (hasPerm('produtos', 'aba_cardapio') || hasPerm('promocoes', 'aba_cardapio')) allowed.push('cardapio');
    if (hasPerm('compras', 'aba_movimentacoes') || hasPerm('transferencias', 'aba_movimentacoes') || hasPerm('descartes', 'aba_movimentacoes') || hasPerm('visibilidade_estoque', 'aba_movimentacoes') || hasPerm('balanco', 'aba_movimentacoes')) allowed.push('movimentacoes');
    if (hasPerm('producao', 'aba_producao') || cargos.some((c: string) => c.toUpperCase().includes('KDS'))) allowed.push('producao');
    if (hasPerm('relatorios', 'aba_financeiro') || hasPerm('fechamento_caixa', 'aba_financeiro') || hasPerm('calendario_contas', 'aba_financeiro') || hasPerm('dashboard_financeiro', 'aba_financeiro')) allowed.push('financeiro');
    if (hasPerm('funcionarios', 'aba_funcionarios') || hasPerm('gestao_equipe', 'aba_funcionarios') || hasPerm('gestor_ia', 'aba_funcionarios') || hasPerm('permissoes_acesso', 'aba_funcionarios')) allowed.push('funcionarios');
    if (hasPerm('configuracoes', 'aba_configuracoes') || hasPerm('bancos_taxas', 'aba_configuracoes') || hasPerm('atualizacoes_sistema', 'aba_configuracoes')) allowed.push('configuracoes');
    if (hasPerm('tarefas', 'aba_tarefas') || hasPerm('bloco_notas', 'aba_tarefas')) allowed.push('tarefas');
    if (hasPerm('marketing', 'aba_marketing')) allowed.push('marketing');
    
    if (allowed.length === 0) allowed.push('pdv');
    return allowed;
  };

  useEffect(() => {
    if (currentUser) {
      const allowed = getAllowedTabs();
      if (!allowed.includes(activeTab) && allowed.length > 0) {
        handleTabChange(allowed[0] as any);
      }
      
      // Redireciona a sub-aba automaticamente se ele perder o acesso
      const allowedCadastrosSubTabs: ('insumos' | 'fornecedores')[] = [];
      if (temPermissao('insumos', 'aba_cadastros')) allowedCadastrosSubTabs.push('insumos');
      if (temPermissao('fornecedores', 'aba_cadastros')) allowedCadastrosSubTabs.push('fornecedores');
      if (activeTab === 'cadastros' && !allowedCadastrosSubTabs.includes(subTabCadastros) && allowedCadastrosSubTabs.length > 0) {
          setSubTabCadastros(allowedCadastrosSubTabs[0]);
      }

      const allowedCardapioSubTabs: ('produtos' | 'promocoes')[] = [];
      if (temPermissao('produtos', 'aba_cardapio')) allowedCardapioSubTabs.push('produtos');
      if (temPermissao('promocoes', 'aba_cardapio')) allowedCardapioSubTabs.push('promocoes');
      if (activeTab === 'cardapio' && !allowedCardapioSubTabs.includes(subTabCardapio) && allowedCardapioSubTabs.length > 0) {
          setSubTabCardapio(allowedCardapioSubTabs[0]);
      }


      const allowedTarefasSubTabs: ('gerenciamento' | 'notas')[] = [];
      if (temPermissao('tarefas', 'aba_tarefas')) allowedTarefasSubTabs.push('gerenciamento');
      if (temPermissao('bloco_notas', 'aba_tarefas')) allowedTarefasSubTabs.push('notas');
      if (activeTab === 'tarefas' && !allowedTarefasSubTabs.includes(subTabTarefas) && allowedTarefasSubTabs.length > 0) {
          setSubTabTarefas(allowedTarefasSubTabs[0]);
      }

      const allowedLogisticaSubTabs: ('clientes' | 'despacho' | 'minhas_entregas')[] = [];
      if (temPermissao('clientes', 'aba_logistica')) allowedLogisticaSubTabs.push('clientes');
      if (temPermissao('despacho', 'aba_logistica')) allowedLogisticaSubTabs.push('despacho');
      const cargosArr = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
      if (cargosArr.some((c: string) => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy') || c === 'Dono' || c === 'TI') || temPermissao('minhas_entregas', 'aba_logistica')) allowedLogisticaSubTabs.push('minhas_entregas');
      if (activeTab === 'logistica' && !allowedLogisticaSubTabs.includes(subTabLogistica) && allowedLogisticaSubTabs.length > 0) {
          setSubTabLogistica(allowedLogisticaSubTabs[0]);
      }

      const allowedMovimentacoesSubTabs: ('compras' | 'transferencia' | 'visibilidade' | 'descartes' | 'balanco')[] = [];
      if (temPermissao('compras', 'aba_movimentacoes')) allowedMovimentacoesSubTabs.push('compras');
      if (temPermissao('transferencias', 'aba_movimentacoes')) allowedMovimentacoesSubTabs.push('transferencia');
      if (temPermissao('visibilidade_estoque', 'aba_movimentacoes')) allowedMovimentacoesSubTabs.push('visibilidade');
      if (temPermissao('descartes', 'aba_movimentacoes')) allowedMovimentacoesSubTabs.push('descartes');
      if (temPermissao('balanco', 'aba_movimentacoes')) allowedMovimentacoesSubTabs.push('balanco');
      if (activeTab === 'movimentacoes' && !allowedMovimentacoesSubTabs.includes(subTabMovimentacoes) && allowedMovimentacoesSubTabs.length > 0) {
          setSubTabMovimentacoes(allowedMovimentacoesSubTabs[0]);
      }
      setSubTabFinanceiro(prev => (!temPermissao('calendario_contas', 'aba_financeiro') && prev === 'calendario') ? 'relatorios_gerais' : prev);
      setSubSubTabRelatorios(prev => (!temPermissao('dashboard_financeiro', 'aba_financeiro') && prev === 'dashboard_fin') ? 'fechamento' : prev);
    }
  }, [currentUser, activeTab, permissoes]);

  // Temporizador de Logout Automático para funcionários comuns 
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const timeMs = 3 * 60 * 1000; // 3 minutos fixos cravados no código
      timeoutId = setTimeout(() => {
        setCurrentUser(null);
      }, timeMs);
    };

    const isExempt = currentUser && (() => {
      const cargosArr = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
      return cargosArr.some((c: string) => ['Administrador', 'Gerente', 'Dono', 'TI'].includes(c) || c.toUpperCase().includes('KDS'));
    })();

    if (currentUser && !isExempt) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('touchstart', resetTimer);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = funcionarios.find(f => String(f.pin) === pinInput);
    if (user) {
      if ((user as any).ativo === false) {
        setLoginError('Usuário inativo. Acesso negado.');
      } else {
        setCurrentUser(user);
        setPinInput('');
        setLoginError('');
      }
    } else {
      setLoginError('PIN incorreto ou usuário não encontrado.');
    }
  };

  const formatCpf = (v: string) => {
    if (!v) return '';
    let val = v.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    val = val.replace(/(\d{3})(\d)/, '$1.$2');
    val = val.replace(/(\d{3})(\d)/, '$1.$2');
    val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return val;
  };

  const handleSaveMissingCpf = async () => {
    const limpo = missingCpfInput.replace(/\D/g, '');
    if (limpo.length !== 11 || !currentUser) return;
    
    if (!validarCPF(limpo)) {
      alert('CPF inválido! Por favor, digite um CPF válido.');
      return;
    }

    const cpfDuplicado = funcionarios.find(f => (f as any).cpf === limpo && f.id !== currentUser.id);
    if (cpfDuplicado) {
      alert('Este CPF já está sendo usado por outro funcionário no sistema. Procure a gerência.');
      return;
    }

    try {
      await update(ref(db, `funcionarios/${currentUser.id}`), { cpf: limpo });
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 md:p-8" translate="no">
        <style>{`html { font-size: clamp(10px, 1vw + 8px, 16px); } @media (min-width: 1280px) { html { font-size: 12px; } }`}</style>
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-12 w-full max-w-sm md:max-w-md lg:max-w-lg transition-all duration-300">
          <div className="flex justify-center mb-6 md:mb-10">
            <img src={logoImg} alt="ArttBurger Logo" className="h-28 md:h-40 w-auto object-contain transition-all duration-300" />
          </div>
          <p className="text-center text-gray-500 mb-6 md:mb-10 text-sm md:text-lg font-medium">Digite seu PIN para entrar no sistema</p>
          
          <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
            <input type="tel" autoComplete="off" maxLength={4} autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-4xl md:text-6xl tracking-[0.5em] font-mono p-4 md:p-6 lg:p-8 border-2 border-gray-200 rounded-xl md:rounded-2xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 transition-all text-gray-800" placeholder="****" style={{ WebkitTextSecurity: 'disc' } as any} />
            {loginError && <p className="text-red-500 text-sm md:text-base text-center font-bold">{loginError}</p>}
            <button type="submit" disabled={pinInput.length !== 4} className="w-full bg-orange-500 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors text-lg md:text-2xl shadow-lg hover:shadow-xl">
              Entrar no Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  const allowedTabs = getAllowedTabs();
  const isDono = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.includes('Dono') || currentUser.cargo.includes('TI') : currentUser.cargo === 'Dono' || currentUser.cargo === 'TI');

  const isKdsOnly = currentUser && (() => {
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    return cargos.length > 0 && cargos.every((c: string) => c.toUpperCase().includes('KDS'));
  })();

  const isEntregadorOnly = currentUser && (() => {
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    return cargos.length > 0 && cargos.every((c: string) => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy'));
  })();

  const hideSidebar = isKdsOnly || isEntregadorOnly;

  return (
    <div className="h-screen bg-gray-50 flex flex-col xl:flex-row overflow-hidden" translate="no">
      <style>{`html { font-size: clamp(10px, 1vw + 8px, 16px); } @media (min-width: 1280px) { html { font-size: 12px; } }`}</style>
      {/* Mobile Header */}
      {!hideSidebar && (
      <div className="xl:hidden bg-gray-900 text-white p-4 flex justify-between items-center z-20 shrink-0 print:hidden">
        <div className="flex items-center space-x-2">
          <img src={logoImg} alt="ArttBurger" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="text-sm font-black tracking-tighter italic leading-tight">ARTT</h1>
            <h1 className="text-sm font-black tracking-tighter italic leading-tight">BURGER</h1>
          </div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 focus:outline-none hover:bg-gray-800 rounded-lg transition-colors">
          <Menu size={24} />
        </button>
      </div>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && !hideSidebar && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/50 z-30" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!hideSidebar && (
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} xl:relative xl:translate-x-0 xl:h-screen print:hidden`}>
        <div className="flex p-6 items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ArttBurger" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-black tracking-tighter italic leading-tight">ARTT</h1>
              <h1 className="text-lg font-black tracking-tighter italic leading-tight">BURGER</h1>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="xl:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {allowedTabs.includes('dashboard') && (
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'dashboard' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          )}
          
          {allowedTabs.includes('pdv') && (
          <button
            onClick={() => handleTabChange('pdv')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'pdv' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <ShoppingCart size={20} />
            <span>Caixa / PDV</span>
          </button>
          )}

          {allowedTabs.includes('logistica') && (
          <button
            onClick={() => handleTabChange('logistica')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'logistica' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Truck size={20} />
            <span>Clientes e Entregas</span>
          </button>
          )}

          {allowedTabs.includes('cadastros') && (
          <button
            onClick={() => handleTabChange('cadastros')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'cadastros' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Package size={20} />
            <span>Cadastros</span>
          </button>
          )}
          
          {allowedTabs.includes('cardapio') && (
          <button
            onClick={() => handleTabChange('cardapio')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'cardapio' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Utensils size={20} />
            <span>Cardápio</span>
          </button>
          )}



          {allowedTabs.includes('movimentacoes') && (
          <button
            onClick={() => handleTabChange('movimentacoes')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'movimentacoes' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <ArrowRightLeft size={20} />
            <span>Movimentações</span>
          </button>
          )}

          {allowedTabs.includes('tarefas') && (
          <button
            onClick={() => handleTabChange('tarefas')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'tarefas' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <CheckSquare size={20} />
            <span>Tarefas</span>
          </button>
          )}

          {allowedTabs.includes('producao') && (
          <button
            onClick={() => handleTabChange('producao')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'producao' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <CheckCircle size={20} />
            <span>KDS</span>
          </button>
          )}

          {allowedTabs.includes('financeiro') && (
          <button
            onClick={() => handleTabChange('financeiro')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'financeiro' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Wallet size={20} />
            <span className="text-sm">Financeiro & Relatórios</span>
          </button>
          )}

          {allowedTabs.includes('marketing') && (
          <button
            onClick={() => handleTabChange('marketing')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'marketing' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Megaphone size={20} />
            <span>Marketing</span>
          </button>
          )}

          {allowedTabs.includes('funcionarios') && (
          <button
            onClick={() => handleTabChange('funcionarios')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'funcionarios' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Users size={20} />
            <span>Gestão de Equipe</span>
          </button>
          )}
        {allowedTabs.includes('configuracoes') && (
        <button
          onClick={() => handleTabChange('configuracoes')}
          className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
            activeTab === 'configuracoes' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings size={20} />
          <span>Configurações</span>
        </button>
        )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="bg-gray-800 p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Status do Sistema</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Conectado ao Firebase</span>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto w-full max-w-[100vw] ${hideSidebar ? 'p-2 sm:p-4' : 'p-4 md:p-8'}`}>
        <header className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden ${hideSidebar ? 'mb-4' : 'mb-8'}`}>
          <div>
            <h2 className="text-sm font-bold text-orange-500 uppercase tracking-widest">Sistema de Gestão</h2>
            <p className="text-gray-400 text-xs">Controle de estoque e custos de produção</p>
          </div>
          <div className="flex items-center space-x-4 self-end sm:self-auto">
             <div className="text-right">
               <p className="text-sm font-bold text-gray-800">{currentUser.nome}</p>
               <p className="text-xs text-gray-500">{Array.isArray(currentUser.cargo) ? currentUser.cargo.join(', ') : (currentUser.cargo || 'Atendente')}</p>
             </div>
             <button onClick={() => setCurrentUser(null)} className="w-10 h-10 bg-gray-200 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors" title="Sair do Sistema">
                <LogOut size={18} />
             </button>
          </div>
        </header>

        <div className="w-full mx-auto">
          {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
          
          {activeTab === 'tarefas' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('tarefas', 'aba_tarefas') && <button onClick={() => setSubTabTarefas('gerenciamento')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabTarefas === 'gerenciamento' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gerenciamento de Tarefas</button>}
                {temPermissao('bloco_notas', 'aba_tarefas') && <button onClick={() => setSubTabTarefas('notas')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabTarefas === 'notas' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Bloco de Notas</button>}
              </div>
              {subTabTarefas === 'gerenciamento' && <TarefasManager currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabTarefas === 'notas' && <BlocoNotasManager currentUser={currentUser} />}
            </div>
          )}
          
          {activeTab === 'cadastros' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('insumos', 'aba_cadastros') && <button onClick={() => setSubTabCadastros('insumos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCadastros === 'insumos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Insumos</button>} 
                {temPermissao('fornecedores', 'aba_cadastros') && <button onClick={() => setSubTabCadastros('fornecedores')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCadastros === 'fornecedores' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fornecedores</button>}
              </div>
          {subTabCadastros === 'fornecedores' && <GestaoFinanceira activeTab="fornecedores" currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabCadastros === 'insumos' && <InsumosManager currentUser={currentUser} temPermissao={temPermissao} />}
            </div>
          )}

          {activeTab === 'cardapio' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('produtos', 'aba_cardapio') && (
                  <button onClick={() => setSubTabCardapio('produtos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCardapio === 'produtos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Produtos</button>
                )}
                {temPermissao('promocoes', 'aba_cardapio') && (
                  <button onClick={() => setSubTabCardapio('promocoes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCardapio === 'promocoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Promoções</button>
                )}
              </div>
              {subTabCardapio === 'produtos' && <ProdutosManager currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabCardapio === 'promocoes' && <PromocoesManager />}
            </div>
          )}

      {activeTab === 'pdv' && <LancamentoVendas currentUser={currentUser} permissoes={permissoes} />}

          {activeTab === 'movimentacoes' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-1 bg-gray-200 p-1 rounded-xl w-full sm:w-fit">
                {temPermissao('compras', 'aba_movimentacoes') && <button onClick={() => setSubTabMovimentacoes('compras')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'compras' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Entrada de Mercadoria</button>}
                {temPermissao('transferencias', 'aba_movimentacoes') && <button onClick={() => setSubTabMovimentacoes('transferencia')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'transferencia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Transferências</button>}
                {temPermissao('visibilidade_estoque', 'aba_movimentacoes') && (
                  <button onClick={() => setSubTabMovimentacoes('visibilidade')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'visibilidade' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Visibilidade de Estoque</button>
                )}
                {temPermissao('descartes', 'aba_movimentacoes') && <button onClick={() => setSubTabMovimentacoes('descartes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'descartes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Descartes / Perdas</button>}
                {temPermissao('balanco', 'aba_movimentacoes') && <button onClick={() => setSubTabMovimentacoes('balanco')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'balanco' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Balanço / Ajuste</button>}
              </div>
              {subTabMovimentacoes === 'compras' && <ComprasManager currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabMovimentacoes === 'transferencia' && <TransferenciaManager currentUser={currentUser} />}
              {subTabMovimentacoes === 'visibilidade' && <VisibilidadeManager />}
              {subTabMovimentacoes === 'descartes' && <DescarteManager currentUser={currentUser} />}
              {subTabMovimentacoes === 'balanco' && <BalancoManager currentUser={currentUser} />}
            </div>
          )}

          {activeTab === 'logistica' && (
            <div className={!isEntregadorOnly ? "space-y-6" : ""}>
              {!isEntregadorOnly && (
                <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('clientes', 'aba_logistica') && <button onClick={() => setSubTabLogistica('clientes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabLogistica === 'clientes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Clientes</button>}
                {temPermissao('despacho', 'aba_logistica') && <button onClick={() => setSubTabLogistica('despacho')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabLogistica === 'despacho' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Despachos e Rotas</button>}
                {(() => {
                  const cargosArr = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
                  const isEntregador = cargosArr.some((c: string) => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy')) || cargosArr.includes('Dono') || cargosArr.includes('TI') || temPermissao('minhas_entregas', 'aba_logistica');
                  if (isEntregador) {
                    return <button onClick={() => setSubTabLogistica('minhas_entregas')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabLogistica === 'minhas_entregas' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Minhas Entregas</button>;
                  }
                  return null;
                })()}
              </div>
              )}
              {subTabLogistica === 'clientes' && <ClientesManager currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabLogistica === 'despacho' && <DespachoManager currentUser={currentUser} temPermissao={temPermissao} />}
              {subTabLogistica === 'minhas_entregas' && <MinhasEntregas currentUser={currentUser} />}
            </div>
          )}

          {activeTab === 'marketing' && <MarketingManager currentUser={currentUser} temPermissao={temPermissao} />}

          {activeTab === 'funcionarios' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('funcionarios', 'aba_funcionarios') && <button onClick={() => setSubTabFuncionarios('equipe')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'equipe' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Equipe</button>}
                {temPermissao('gestao_equipe', 'aba_funcionarios') && <button onClick={() => setSubTabFuncionarios('gestao')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'gestao' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Atribuições</button>}
                {temPermissao('gestor_ia', 'aba_funcionarios') && <button onClick={() => setSubTabFuncionarios('ia')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'ia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gestor IA</button>}
                {temPermissao('permissoes_acesso', 'aba_funcionarios') && <button onClick={() => setSubTabFuncionarios('permissoes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'permissoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cargos e Permissões</button>}
              </div>
              {subTabFuncionarios === 'equipe' && <FuncionariosManager currentUser={currentUser} />}
              {subTabFuncionarios === 'gestao' && temPermissao('gestao_equipe', 'aba_funcionarios') && <GestaoEquipeManager activeView="gestao" />}
              {subTabFuncionarios === 'ia' && temPermissao('gestor_ia', 'aba_funcionarios') && <GestaoEquipeManager activeView="ia" />}
              {subTabFuncionarios === 'permissoes' && temPermissao('permissoes_acesso', 'aba_funcionarios') && <PermissoesManager currentUser={currentUser} />}
            </div>
          )}
          {activeTab === 'producao' && <ProducaoManager currentUser={currentUser} />}

          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
                {temPermissao('calendario_contas', 'aba_financeiro') && <button onClick={() => setSubTabFinanceiro('calendario')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFinanceiro === 'calendario' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Calendário e Contas</button>}
                {(temPermissao('relatorios', 'aba_financeiro') || temPermissao('fechamento_caixa', 'aba_financeiro') || temPermissao('dashboard_financeiro', 'aba_financeiro')) && (
                  <button onClick={() => setSubTabFinanceiro('relatorios_gerais')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFinanceiro === 'relatorios_gerais' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Relatórios e Fechamento</button>
                )}
              </div>
              {subTabFinanceiro === 'calendario' && temPermissao('calendario_contas', 'aba_financeiro') && (
                <GestaoFinanceira activeTab="calendario" currentUser={currentUser} temPermissao={temPermissao} />
              )}
              
              {subTabFinanceiro === 'relatorios_gerais' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
                    {temPermissao('fechamento_caixa', 'aba_financeiro') && <button onClick={() => setSubSubTabRelatorios('fechamento')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'fechamento' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fechamento do Dia</button>}
                    {temPermissao('dashboard_financeiro', 'aba_financeiro') && <button onClick={() => setSubSubTabRelatorios('dashboard_fin')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'dashboard_fin' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Dashboard Financeiro</button>}
                    {temPermissao('relatorios', 'aba_financeiro') && <button onClick={() => setSubSubTabRelatorios('movimentacoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'movimentacoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Movimentações de Estoque</button>}
                  </div>
                  {subSubTabRelatorios === 'fechamento' && temPermissao('fechamento_caixa', 'aba_financeiro') && <FechamentoManager />}
                  {subSubTabRelatorios === 'dashboard_fin' && temPermissao('dashboard_financeiro', 'aba_financeiro') && <GestaoFinanceira activeTab="dashboard_fin" currentUser={currentUser} temPermissao={temPermissao} />}
                  {subSubTabRelatorios === 'movimentacoes' && temPermissao('relatorios', 'aba_financeiro') && <RelatoriosManager />}
                </div>
              )}
            </div>
          )}

      {activeTab === 'configuracoes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
            {temPermissao('configuracoes', 'aba_configuracoes') && <button onClick={() => setSubSubTabConfiguracoes('gerais')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'gerais' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configurações Gerais</button>}
            {temPermissao('bancos_taxas', 'aba_configuracoes') && <button onClick={() => setSubSubTabConfiguracoes('bancos_cartoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'bancos_cartoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Bancos e Taxas</button>}
            {temPermissao('atualizacoes_sistema', 'aba_configuracoes') && <button onClick={() => setSubSubTabConfiguracoes('atualizacoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'atualizacoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Atualizações</button>}
          </div>
          {subSubTabConfiguracoes === 'gerais' && temPermissao('configuracoes', 'aba_configuracoes') && <ConfiguracoesGerais />}
          {subSubTabConfiguracoes === 'bancos_cartoes' && temPermissao('bancos_taxas', 'aba_configuracoes') && <BancosCartoes />}
          {subSubTabConfiguracoes === 'atualizacoes' && temPermissao('atualizacoes_sistema', 'aba_configuracoes') && <AtualizacoesSistema />}
        </div>
      )}
        </div>
      </main>

      {/* Modal de CPF Obrigatório */}
      {currentUser && !(currentUser as any).cpf && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Lock size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Atualização Obrigatória</h3>
            <p className="text-sm text-gray-500 mb-6">
              Precisamos do seu CPF para garantir a segurança da sua conta e do seu histórico no sistema.
            </p>
            <input 
              type="text" 
              value={missingCpfInput} 
              onChange={e => setMissingCpfInput(formatCpf(e.target.value))} 
              className="w-full text-center text-xl font-mono p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all mb-4" 
              placeholder="000.000.000-00" 
            />
            <button 
              onClick={handleSaveMissingCpf} 
              disabled={missingCpfInput.replace(/\D/g, '').length !== 11}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors text-lg"
            >
              Salvar Meu CPF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
