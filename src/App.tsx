import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import InsumosManager from './components/InsumosManager';
import ProdutosManager from './components/ProdutosManager';
import { LayoutDashboard, Package, ChefHat, Utensils } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'insumos' | 'produtos'>('dashboard');

  useEffect(() => {
    document.title = 'ArttBurguer';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-800">
          <div className="bg-orange-500 p-2 rounded-lg">
            <Utensils size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter italic">ARTT BURGUER</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'dashboard' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveTab('insumos')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'insumos' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Package size={20} />
            <span>Insumos</span>
          </button>
          
          <button
            onClick={() => setActiveTab('produtos')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === 'produtos' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <ChefHat size={20} />
            <span>Ficha Técnica</span>
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
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-orange-500 uppercase tracking-widest">Sistema de Gestão</h2>
            <p className="text-gray-400 text-xs">Controle de estoque e custos de produção</p>
          </div>
          <div className="flex items-center space-x-4">
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
        </div>
      </main>
    </div>
  );
}
