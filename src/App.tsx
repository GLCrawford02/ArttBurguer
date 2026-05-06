import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InsumosManager from './components/InsumosManager';
import ProdutosManager from './components/ProdutosManager';
import PromocoesManager from './components/PromocoesManager';
import ComprasManager from './components/ComprasManager';
import ProducaoManager from './components/ProducaoManager';
import RelatoriosManager from './components/RelatoriosManager';
import FechamentoManager from './components/FechamentoManager';
import { LayoutDashboard, Package, Utensils, Menu, X, CheckCircle, Scale, Wallet, ArrowRightLeft, Users, LogOut, Lock, Truck, ShoppingCart, Settings, CheckSquare } from 'lucide-react';
import BalancoManager from './components/BalancoManager';
import TarefasManager from './components/TarefasManager';
import PermissoesManager from './components/PermissoesManager';
import TransferenciaManager from './components/TransferenciaManager';
import GestaoFinanceira from './components/GestaoFinanceira';
import FuncionariosManager from './components/FuncionariosManager';
import GestaoEquipeManager from './components/GestaoEquipeManager';
import LancamentoVendas from './components/LancamentoVendas';
import BancosCartoes from './components/BancosCartoes';
import ConfiguracoesGerais from './components/ConfiguracoesGerais';
import AtualizacoesSistema from './components/AtualizacoesSistema';
import ClientesManager from './components/ClientesManager';
import DespachoManager from './components/DespachoManager';
import { ref, onValue, set, push } from 'firebase/database';
import { db } from './firebase';
import { Funcionario } from './types';
import logoImg from './assets/logo.png';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pdv' | 'cadastros' | 'cardapio' | 'movimentacoes' | 'producao' | 'financeiro' | 'balanco' | 'funcionarios' | 'logistica' | 'configuracoes' | 'tarefas'>('dashboard');
  const [subTabCadastros, setSubTabCadastros] = useState<'insumos' | 'fornecedores'>('insumos');
  const [subTabCardapio, setSubTabCardapio] = useState<'produtos' | 'promocoes'>('produtos');
  const [subTabMovimentacoes, setSubTabMovimentacoes] = useState<'compras' | 'transferencia'>('compras');
  const [subTabFinanceiro, setSubTabFinanceiro] = useState<'calendario' | 'relatorios_gerais'>('calendario');
  const [subSubTabRelatorios, setSubSubTabRelatorios] = useState<'fechamento' | 'dashboard_fin' | 'movimentacoes'>('fechamento');
  const [subSubTabConfiguracoes, setSubSubTabConfiguracoes] = useState<'bancos_cartoes' | 'gerais' | 'atualizacoes'>('gerais');
  const [subTabFuncionarios, setSubTabFuncionarios] = useState<'equipe' | 'gestao' | 'permissoes'>('equipe');
  const [subTabLogistica, setSubTabLogistica] = useState<'clientes' | 'despacho'>('clientes');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [currentUser, setCurrentUser] = useState<Funcionario | null>(() => {
    const saved = sessionStorage.getItem('arttburger_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [permissoes, setPermissoes] = useState<Record<string, any>>({});

  // Salva a sessão para não deslogar quando a página atualiza ou o código é salvo no localhost
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('arttburger_session', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('arttburger_session');
    }
  }, [currentUser]);

  useEffect(() => {
    document.title = 'ArttBurger';

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
      if (['dashboard', 'pdv', 'cadastros', 'movimentacoes', 'producao', 'financeiro', 'balanco', 'funcionarios', 'logistica', 'configuracoes', 'tarefas'].includes(hash)) {
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

  const handleTabChange = (tab: 'dashboard' | 'pdv' | 'cadastros' | 'cardapio' | 'movimentacoes' | 'producao' | 'financeiro' | 'balanco' | 'funcionarios' | 'logistica' | 'configuracoes' | 'tarefas') => {
    window.location.hash = tab;
    setIsMobileMenuOpen(false); // Fecha o menu no mobile após o clique
  };

  const temPermissao = (modulo: string) => {
    if (!currentUser) return false;
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    if (cargos.includes('Administrador') || cargos.includes('Dono')) return true;
    return cargos.some(c => permissoes[c]?.[modulo]?.visualizar);
  };

  const getAllowedTabs = () => {
    if (!currentUser) return [];
    const cargos = Array.isArray(currentUser.cargo) ? currentUser.cargo : [currentUser.cargo || 'Atendente'];
    if (cargos.includes('Administrador') || cargos.includes('Dono')) return ['dashboard', 'pdv', 'cadastros', 'cardapio', 'movimentacoes', 'producao', 'financeiro', 'balanco', 'funcionarios', 'logistica', 'configuracoes', 'tarefas'];

    const allowed = ['dashboard']; // Dashboard é liberado por padrão para todos
    
    const hasPerm = (mod: string, acao: 'visualizar' | 'editar' | 'apagar' = 'visualizar') => {
      return cargos.some(c => permissoes[c]?.[mod]?.[acao]);
    };

    if (hasPerm('vendas')) allowed.push('pdv');
    if (hasPerm('insumos') || hasPerm('produtos')) allowed.push('cadastros');
    if (hasPerm('produtos') || hasPerm('promocoes')) allowed.push('cardapio');
    if (hasPerm('compras') || hasPerm('transferencias')) allowed.push('movimentacoes');
    if (hasPerm('clientes') || hasPerm('despacho')) allowed.push('logistica');
    if (hasPerm('producao')) allowed.push('producao');
    if (hasPerm('balanco')) allowed.push('balanco');
    if (hasPerm('relatorios')) allowed.push('financeiro');
    if (hasPerm('funcionarios')) allowed.push('funcionarios');
    if (hasPerm('configuracoes')) allowed.push('configuracoes');
    if (hasPerm('tarefas')) allowed.push('tarefas');
    return allowed;
  };

  useEffect(() => {
    if (currentUser) {
      const allowed = getAllowedTabs();
      if (!allowed.includes(activeTab) && allowed.length > 0) {
        handleTabChange(allowed[0] as any);
      }
      
      const checkIsDono = Array.isArray(currentUser.cargo) ? currentUser.cargo.includes('Dono') : currentUser.cargo === 'Dono';

      // Redireciona a sub-aba automaticamente se ele perder o acesso
      const allowedCadastrosSubTabs: ('insumos' | 'fornecedores')[] = [];
      if (temPermissao('insumos')) allowedCadastrosSubTabs.push('insumos');
      if (temPermissao('configuracoes')) allowedCadastrosSubTabs.push('fornecedores');
      if (activeTab === 'cadastros' && !allowedCadastrosSubTabs.includes(subTabCadastros) && allowedCadastrosSubTabs.length > 0) {
          setSubTabCadastros(allowedCadastrosSubTabs[0]);
      }

      const allowedCardapioSubTabs: ('produtos' | 'promocoes')[] = [];
      if (temPermissao('produtos')) allowedCardapioSubTabs.push('produtos');
      if (temPermissao('promocoes')) allowedCardapioSubTabs.push('promocoes');
      if (activeTab === 'cardapio' && !allowedCardapioSubTabs.includes(subTabCardapio) && allowedCardapioSubTabs.length > 0) {
          setSubTabCardapio(allowedCardapioSubTabs[0]);
      }


      setSubTabMovimentacoes(prev => (!temPermissao('compras') && prev === 'compras') ? 'transferencia' : prev);
      setSubTabLogistica(prev => (!temPermissao('clientes') && prev === 'clientes') ? 'despacho' : prev);
      setSubTabFinanceiro(prev => (!checkIsDono && prev === 'calendario') ? 'relatorios_gerais' : prev);
      setSubSubTabRelatorios(prev => (!checkIsDono && prev === 'dashboard_fin') ? 'fechamento' : prev);
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
      return cargosArr.some(c => ['Administrador', 'Gerente', 'Dono'].includes(c));
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
    const user = funcionarios.find(f => f.pin === pinInput);
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

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" translate="no">
        <style>{`@media (min-width: 768px) and (max-width: 1180px) { html { font-size: 18px; } }`}</style>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <img src={logoImg} alt="ArttBurger Logo" className="h-32 w-auto object-contain" />
          </div>
          <p className="text-center text-gray-500 mb-8 text-sm">Digite seu PIN para entrar no sistema</p>
          
          <form onSubmit={handleLogin}>
            <input type="tel" autoComplete="off" maxLength={4} autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-4xl tracking-[0.5em] font-mono p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 transition-all mb-4" placeholder="****" style={{ WebkitTextSecurity: 'disc' } as any} />
            {loginError && <p className="text-red-500 text-sm text-center mb-4 font-bold">{loginError}</p>}
            <button type="submit" disabled={pinInput.length !== 4} className="w-full bg-orange-500 text-white p-4 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors text-lg">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  const allowedTabs = getAllowedTabs();
  const isDono = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.includes('Dono') : currentUser.cargo === 'Dono');

  return (
    <div className="h-screen bg-gray-50 flex flex-col md:flex-row overflow-hidden" translate="no">
      <style>{`@media (min-width: 768px) and (max-width: 1180px) { html { font-size: 18px; } }`}</style>
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center z-20 shrink-0 print:hidden">
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

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:h-screen print:hidden`}>
        <div className="flex p-6 items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ArttBurger" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-black tracking-tighter italic leading-tight">ARTT</h1>
              <h1 className="text-lg font-black tracking-tighter italic leading-tight">BURGER</h1>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
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
            <span>Produção</span>
          </button>
          )}

          {allowedTabs.includes('balanco') && (
          <button
            onClick={() => handleTabChange('balanco')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'balanco' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Scale size={20} />
            <span>Balanço / Ajuste</span>
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

          {allowedTabs.includes('logistica') && (
          <button
            onClick={() => handleTabChange('logistica')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'logistica' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Truck size={20} />
            <span>Logística</span>
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
            <span>Equipe</span>
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw]">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
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

        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} />}
          
          {activeTab === 'tarefas' && <TarefasManager />}
          
          {activeTab === 'cadastros' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
            {temPermissao('configuracoes') && <button onClick={() => setSubTabCadastros('fornecedores')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCadastros === 'fornecedores' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fornecedores</button>}
                {temPermissao('insumos') && <button onClick={() => setSubTabCadastros('insumos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCadastros === 'insumos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Insumos</button>} 
              </div>
          {subTabCadastros === 'fornecedores' && <GestaoFinanceira activeTab="fornecedores" currentUser={currentUser} />}
              {subTabCadastros === 'insumos' && <InsumosManager />}
            </div>
          )}

          {activeTab === 'cardapio' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('produtos') && (
                  <button onClick={() => setSubTabCardapio('produtos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCardapio === 'produtos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Produtos</button>
                )}
                {temPermissao('promocoes') && (
                  <button onClick={() => setSubTabCardapio('promocoes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabCardapio === 'promocoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Promoções</button>
                )}
              </div>
              {subTabCardapio === 'produtos' && <ProdutosManager />}
              {subTabCardapio === 'promocoes' && <PromocoesManager />}
            </div>
          )}

      {activeTab === 'pdv' && <LancamentoVendas currentUser={currentUser} />}

          {activeTab === 'movimentacoes' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('compras') && <button onClick={() => setSubTabMovimentacoes('compras')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'compras' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Compras</button>}
                {temPermissao('transferencias') && <button onClick={() => setSubTabMovimentacoes('transferencia')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabMovimentacoes === 'transferencia' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Transferências</button>}
              </div>
              {subTabMovimentacoes === 'compras' && <ComprasManager />}
              {subTabMovimentacoes === 'transferencia' && <TransferenciaManager />}
            </div>
          )}

          {activeTab === 'logistica' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                {temPermissao('clientes') && <button onClick={() => setSubTabLogistica('clientes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabLogistica === 'clientes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Clientes</button>}
                {temPermissao('despacho') && <button onClick={() => setSubTabLogistica('despacho')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabLogistica === 'despacho' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Despachos e Rotas</button>}
              </div>
              {subTabLogistica === 'clientes' && <ClientesManager />}
              {subTabLogistica === 'despacho' && <DespachoManager />}
            </div>
          )}

          {activeTab === 'funcionarios' && (
            <div className="space-y-6">
              <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
                <button onClick={() => setSubTabFuncionarios('equipe')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'equipe' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Equipe</button>
                {(Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono') : (currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono')) && (
                  <>
                    <button onClick={() => setSubTabFuncionarios('gestao')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'gestao' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gestão de Equipe</button>
                    <button onClick={() => setSubTabFuncionarios('permissoes')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFuncionarios === 'permissoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Cargos e Permissões</button>
                  </>
                )}
              </div>
              {subTabFuncionarios === 'equipe' && <FuncionariosManager currentUser={currentUser} />}
              {subTabFuncionarios === 'gestao' && (Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono') : (currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono')) && <GestaoEquipeManager />}
              {subTabFuncionarios === 'permissoes' && (Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono') : (currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono')) && <PermissoesManager />}
            </div>
          )}
          {activeTab === 'producao' && <ProducaoManager />}
          {activeTab === 'balanco' && <BalancoManager />}

          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
                {temPermissao('relatorios') && (
                  <>
                    {isDono && <button onClick={() => setSubTabFinanceiro('calendario')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFinanceiro === 'calendario' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Calendário e Contas</button>}
                    <button onClick={() => setSubTabFinanceiro('relatorios_gerais')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subTabFinanceiro === 'relatorios_gerais' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Relatórios</button>
                  </>
                )}
              </div>
              {subTabFinanceiro === 'calendario' && isDono && (
                <GestaoFinanceira activeTab="calendario" currentUser={currentUser} />
              )}
              
              {subTabFinanceiro === 'relatorios_gerais' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
                    <button onClick={() => setSubSubTabRelatorios('fechamento')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'fechamento' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fechamento do Dia</button>
                    {isDono && <button onClick={() => setSubSubTabRelatorios('dashboard_fin')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'dashboard_fin' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Dashboard A Pagar/Receber</button>}
                    <button onClick={() => setSubSubTabRelatorios('movimentacoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabRelatorios === 'movimentacoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Movimentações de Estoque</button>
                  </div>
                  {subSubTabRelatorios === 'fechamento' && <FechamentoManager />}
                  {subSubTabRelatorios === 'dashboard_fin' && isDono && <GestaoFinanceira activeTab="dashboard_fin" currentUser={currentUser} />}
                  {subSubTabRelatorios === 'movimentacoes' && <RelatoriosManager />}
                </div>
              )}
            </div>
          )}

      {activeTab === 'configuracoes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap bg-gray-200 p-1 rounded-xl w-full sm:w-fit gap-1">
            <button onClick={() => setSubSubTabConfiguracoes('gerais')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'gerais' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Configurações Gerais</button>
            <button onClick={() => setSubSubTabConfiguracoes('bancos_cartoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'bancos_cartoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Bancos e Taxas</button>
            <button onClick={() => setSubSubTabConfiguracoes('atualizacoes')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${subSubTabConfiguracoes === 'atualizacoes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Atualizações</button>
          </div>
          {subSubTabConfiguracoes === 'gerais' && <ConfiguracoesGerais />}
          {subSubTabConfiguracoes === 'bancos_cartoes' && <BancosCartoes />}
          {subSubTabConfiguracoes === 'atualizacoes' && <AtualizacoesSistema />}
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
