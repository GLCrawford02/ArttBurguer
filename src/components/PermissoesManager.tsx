import { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { db } from '../firebase';
import { Shield, Save, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';

export default function PermissoesManager() {
  const [permissoes, setPermissoes] = useState<Record<string, any>>({});
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);
  const [novoCargo, setNovoCargo] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('Gerente');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Lista de todos os módulos do sistema
  const modulos = [
    { id: 'insumos', nome: 'Insumos' },
    { id: 'produtos', nome: 'Produtos e Combos' },
    { id: 'producao', nome: 'Produção e Saídas' },
    { id: 'compras', nome: 'Compras (Entrada)' },
    { id: 'transferencias', nome: 'Transferências' },
    { id: 'balanco', nome: 'Balanço e Auditoria' },
    { id: 'vendas', nome: 'PDV / Lançamento de Vendas' },
    { id: 'relatorios', nome: 'Relatórios Financeiros' },
    { id: 'funcionarios', nome: 'Equipe e Funcionários' },
    { id: 'configuracoes', nome: 'Configurações Gerais' },
    { id: 'clientes', nome: 'Cadastro de Clientes' },
    { id: 'despacho', nome: 'Despacho e Rotas (Logística)' },
  ];
  

  useEffect(() => {
    const permRef = ref(db, 'permissoes');
    const unsubPerm = onValue(permRef, (snap) => {
      if (snap.val()) {
        setPermissoes(snap.val());
      } else {
        setPermissoes({});
      }
    });

    const cargosRef = ref(db, 'cargos');
    const unsubCargos = onValue(cargosRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, nome: val.nome }));
        if (!list.some(c => c.nome === 'Dono')) {
          push(ref(db, 'cargos'), { nome: 'Dono' });
        }
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCargos(list);
      } else {
        const defaultCargos = ['Dono', 'Administrador', 'Gerente', 'Cozinheiro', 'Atendente'];
        defaultCargos.sort((a, b) => a.localeCompare(b));
        defaultCargos.forEach(c => push(ref(db, 'cargos'), { nome: c }));
      }
    });

    return () => { unsubPerm(); unsubCargos(); };
  }, []);

  const handleAddCargo = async () => {
    if (!novoCargo.trim()) return;
    if (cargos.some(c => c.nome.toLowerCase() === novoCargo.trim().toLowerCase())) {
      showToast('Este cargo já existe!', 'error');
      return;
    }
    await set(push(ref(db, 'cargos')), { nome: novoCargo.trim() });
    setNovoCargo('');
    showToast('Cargo adicionado com sucesso!', 'success');
  };

  const handleDeleteCargo = async (id: string, nome: string) => {
    if (nome === 'Administrador' || nome === 'Gerente' || nome === 'Dono') {
      showToast('Cargos base não podem ser excluídos.', 'error');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o cargo "${nome}"?`)) {
      await remove(ref(db, `cargos/${id}`));
      if (selectedCargo === nome) setSelectedCargo('Administrador');
      showToast('Cargo excluído!', 'success');
    }
  };

  const handleToggle = (moduloId: string, acao: 'visualizar' | 'editar' | 'apagar') => {
    if (selectedCargo === 'Administrador' || selectedCargo === 'Dono') return; // Bases não têm restrições

    setPermissoes(prev => {
      const newState = JSON.parse(JSON.stringify(prev)); // Copia profunda para não mutar estado
      
      if (!newState[selectedCargo]) newState[selectedCargo] = {};
      if (!newState[selectedCargo][moduloId]) {
        newState[selectedCargo][moduloId] = { visualizar: false, editar: false, apagar: false };
      }
      
      const currentVal = newState[selectedCargo][moduloId][acao];
      newState[selectedCargo][moduloId][acao] = !currentVal;

      // Regras de negócio automáticas:
      // 1. Se permitir editar ou apagar, deve obrigatoriamente permitir visualizar
      if (!currentVal && (acao === 'editar' || acao === 'apagar')) {
        newState[selectedCargo][moduloId].visualizar = true;
      }
      // 2. Se remover visualizar, deve obrigatoriamente remover editar e apagar
      if (currentVal && acao === 'visualizar') {
        newState[selectedCargo][moduloId].editar = false;
        newState[selectedCargo][moduloId].apagar = false;
      }

      return newState;
    });
  };

  const salvarPermissoes = async () => {
    try {
      await set(ref(db, 'permissoes'), permissoes);
      showToast('Permissões salvas com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao salvar permissões.', 'error');
    }
  };

  const getPerm = (moduloId: string, acao: 'visualizar' | 'editar' | 'apagar') => {
    if (selectedCargo === 'Administrador' || selectedCargo === 'Dono') return true;
    return permissoes[selectedCargo]?.[moduloId]?.[acao] || false;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-indigo-100 p-3 rounded-xl mr-4 text-indigo-600">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Permissões de Acesso</h3>
            <p className="text-sm text-gray-500">Defina o que cada cargo pode visualizar, editar ou apagar no sistema.</p>
          </div>
        </div>
        <button onClick={salvarPermissoes} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-sm">
          <Save size={18} className="mr-2" /> Salvar Configurações
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        {/* Menu Lateral de Cargos */}
        <div className="w-full md:w-72 bg-gray-50 border-r border-gray-100 p-4 flex flex-col max-h-[600px]">
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 px-2 tracking-wider">Cargos da Equipe</h4>
          
          <div className="flex space-x-2 mb-4 px-2">
            <input 
              type="text" 
              value={novoCargo} 
              onChange={e => setNovoCargo(e.target.value)} 
              placeholder="Novo cargo..." 
              className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-0" 
            />
            <button onClick={handleAddCargo} className="bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors text-sm shadow-sm">+</button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {cargos.map(c => (
            <div key={c.id} className={`flex items-center justify-between rounded-lg transition-all ${selectedCargo === c.nome ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
              <button
                onClick={() => setSelectedCargo(c.nome)}
                className="flex-1 text-left px-4 py-3 font-bold text-sm truncate"
              >
                {c.nome}
              </button>
              {c.nome !== 'Administrador' && c.nome !== 'Gerente' && c.nome !== 'Dono' && (
                <button 
                  onClick={() => handleDeleteCargo(c.id, c.nome)}
                  className={`p-2 mr-2 rounded-lg transition-colors flex-shrink-0 ${selectedCargo === c.nome ? 'text-white hover:bg-indigo-700' : 'text-red-500 hover:bg-red-50'}`}
                  title="Excluir Cargo"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          </div>
        </div>

        {/* Painel de Matriz de Permissões */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h4 className="text-xl font-bold text-gray-800">Acessos para: <span className="text-indigo-600">{selectedCargo}</span></h4>
            {(selectedCargo === 'Administrador' || selectedCargo === 'Dono') && (
              <p className="text-sm text-orange-600 font-bold mt-2 bg-orange-50 p-3 rounded-lg border border-orange-100">
                Este cargo base possui acesso total (Leitura, Edição e Exclusão) a todos os módulos por padrão. Não é possível restringi-lo.
              </p>
            )}
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6 font-bold">Módulo do Sistema</th>
                  <th className="py-4 px-6 font-bold text-center">Visualizar</th>
                  <th className="py-4 px-6 font-bold text-center">Editar / Criar</th>
                  <th className="py-4 px-6 font-bold text-center">Apagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {modulos.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-gray-800">{m.nome}</td>
                    <td className="py-4 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'visualizar')} disabled={selectedCargo === 'Administrador' || selectedCargo === 'Dono'} onChange={() => handleToggle(m.id, 'visualizar')} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                    <td className="py-4 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'editar')} disabled={selectedCargo === 'Administrador' || selectedCargo === 'Dono'} onChange={() => handleToggle(m.id, 'editar')} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                    <td className="py-4 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'apagar')} disabled={selectedCargo === 'Administrador' || selectedCargo === 'Dono'} onChange={() => handleToggle(m.id, 'apagar')} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}