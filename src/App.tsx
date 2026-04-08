import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InsumosManager from './components/InsumosManager';
import ProdutosManager from './components/ProdutosManager';
import ComprasManager from './components/ComprasManager';
import ProducaoManager from './components/ProducaoManager';
import RelatoriosManager from './components/RelatoriosManager';
import FechamentoManager from './components/FechamentoManager';
import { LayoutDashboard, Package, ChefHat, Utensils, Menu, X, ShoppingCart, CheckCircle, BarChart3, Scale, Wallet } from 'lucide-react';
import BalancoManager from './components/BalancoManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'insumos' | 'produtos' | 'compras' | 'producao' | 'relatorios' | 'balanco' | 'fechamento'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'ArttBurguer';

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as 'dashboard' | 'insumos' | 'produtos' | 'compras' | 'producao' | 'relatorios' | 'balanco' | 'fechamento';
      if (['dashboard', 'insumos', 'produtos', 'compras', 'producao', 'relatorios', 'balanco', 'fechamento'].includes(hash)) {
        setActiveTab(hash);
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

  const handleTabChange = (tab: 'dashboard' | 'insumos' | 'produtos' | 'compras' | 'producao' | 'relatorios' | 'balanco' | 'fechamento') => {
    window.location.hash = tab;
    setIsMobileMenuOpen(false); // Fecha o menu no mobile após o clique
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center z-20 sticky top-0">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-500 p-2 rounded-lg">
            <Utensils size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tighter italic">ARTT BURGUER</h1>
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
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:min-h-screen`}>
        <div className="flex p-6 items-center justify-between border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-500 p-2 rounded-lg">
              <Utensils size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic">ARTT BURGUER</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'dashboard' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => handleTabChange('insumos')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'insumos' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Package size={20} />
            <span>Cadastro de Itens</span>
          </button>
          
          <button
            onClick={() => handleTabChange('produtos')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'produtos' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <ChefHat size={20} />
            <span>Cadastro de Produtos</span>
          </button>

          <button
            onClick={() => handleTabChange('balanco')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'balanco' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Scale size={20} />
            <span>Balanço / Ajuste</span>
          </button>

          <button
            onClick={() => handleTabChange('compras')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'compras' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <ShoppingCart size={20} />
            <span>Compras</span>
          </button>

          <button
            onClick={() => handleTabChange('producao')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'producao' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <CheckCircle size={20} />
            <span>Produção</span>
          </button>

          <button
            onClick={() => handleTabChange('fechamento')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'fechamento' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Wallet size={20} />
            <span>Fechamento Caixa</span>
          </button>

          <button
            onClick={() => handleTabChange('relatorios')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'relatorios' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <BarChart3 size={20} />
            <span>Relatórios</span>
          </button>
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
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-orange-500 uppercase tracking-widest">Sistema de Gestão</h2>
            <p className="text-gray-400 text-xs">Controle de estoque e custos de produção</p>
          </div>
          <div className="flex items-center space-x-4 self-end sm:self-auto">
             <div className="text-right">
               <p className="text-sm font-bold text-gray-800">Admin</p>
               <p className="text-xs text-gray-500">Gerente de Produção</p>
             </div>
             <div className="w-10 h-10 bg-gray-200 rounded-full border-2 border-white shadow-sm overflow-hidden">
                <img src="https://picsum.photos/seed/chef/100/100" alt="Avatar" referrerPolicy="no-referrer" />
             </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'insumos' && <InsumosManager />}
          {activeTab === 'produtos' && <ProdutosManager />}
          {activeTab === 'compras' && <ComprasManager />}
          {activeTab === 'producao' && <ProducaoManager />}
          {activeTab === 'relatorios' && <RelatoriosManager />}
          {activeTab === 'balanco' && <BalancoManager />}
          {activeTab === 'fechamento' && <FechamentoManager />}
        </div>
      </main>
    </div>
  );
}
