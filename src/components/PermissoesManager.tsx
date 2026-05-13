import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { db } from '../firebase';
import { Shield, Save, CheckCircle, AlertTriangle, Trash2, Copy } from 'lucide-react';

export default function PermissoesManager({ currentUser }: { currentUser?: any }) {
  const [permissoes, setPermissoes] = useState<Record<string, any>>({});
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);
  const [novoCargo, setNovoCargo] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('Gerente');
  const [cargoToCopy, setCargoToCopy] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const isDonoOrTI = currentUser && (Array.isArray(currentUser.cargo) ? currentUser.cargo.some((c: string) => ['Dono', 'TI'].includes(c)) : ['Dono', 'TI'].includes(currentUser.cargo as string));

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };


  const categorias = [
    {
      id: 'aba_dashboard', nome: 'Dashboard',
      modulos: [
        { id: 'dashboard_geral', nome: 'Dashboard (Tela Inicial)', admin: false }
      ]
    },
    {
      id: 'aba_pdv', nome: 'Caixa / PDV',
      modulos: [
        { id: 'vendas', nome: 'Frente de Caixa (Balcão/Mesa/Delivery)', admin: false },
        { id: 'pdv_comandas', nome: 'Comandas do Dia', admin: false },
        { id: 'pdv_conferencia', nome: 'Conferência de Fechamento', admin: true }
      ]
    },
    {
      id: 'aba_logistica', nome: 'Entregas e Logística',
      modulos: [
        { id: 'clientes', nome: 'Base de Clientes', admin: false },
        { id: 'despacho', nome: 'Despacho e Rotas', admin: false },
        { id: 'minhas_entregas', nome: 'Minhas Entregas (App Motoboy)', admin: false }
      ]
    },
    {
      id: 'aba_cadastros', nome: 'Cadastros',
      modulos: [
        { id: 'insumos', nome: 'Insumos (Estoque Base)', admin: false },
        { id: 'fornecedores', nome: 'Fornecedores e Contatos', admin: true }
      ]
    },
    {
      id: 'aba_cardapio', nome: 'Cardápio',
      modulos: [
        { id: 'produtos', nome: 'Produtos e Fichas Técnicas', admin: false },
        { id: 'promocoes', nome: 'Promoções e Combos', admin: false }
      ]
    },
    {
      id: 'aba_movimentacoes', nome: 'Movimentações',
      modulos: [
        { id: 'compras', nome: 'Entrada de Mercadorias', admin: true },
        { id: 'transferencias', nome: 'Transferências (Praças)', admin: false },
        { id: 'visibilidade_estoque', nome: 'Visibilidade de Estoque', admin: true },
        { id: 'descartes', nome: 'Descartes (Baixas / Perdas)', admin: true },
        { id: 'balanco', nome: 'Balanço e Ajuste de Estoque', admin: true }
      ]
    },
    {
      id: 'aba_tarefas', nome: 'Tarefas',
      modulos: [
        { id: 'tarefas', nome: 'Gerenciamento de Tarefas', admin: false },
        { id: 'bloco_notas', nome: 'Bloco de Notas Pessoal', admin: false }
      ]
    },
    {
      id: 'aba_producao', nome: 'Produção (KDS)',
      modulos: [
        { id: 'producao', nome: 'Painel da Cozinha (KDS)', admin: false }
      ]
    },
    {
      id: 'aba_financeiro', nome: 'Financeiro e Relatórios',
      modulos: [
        { id: 'calendario_contas', nome: 'Calendário de Contas Mensais', admin: true },
        { id: 'fechamento_caixa', nome: 'Fechamento do Dia', admin: true },
        { id: 'dashboard_financeiro', nome: 'Dashboard de Receitas', admin: true },
        { id: 'relatorios', nome: 'Relatórios de Movimentações', admin: true }
      ]
    },
    {
      id: 'aba_marketing', nome: 'Marketing',
      modulos: [
        { id: 'marketing', nome: 'Marketing e Cupons de Desconto', admin: true }
      ]
    },
    {
      id: 'aba_funcionarios', nome: 'Gestão de Equipe',
      modulos: [
        { id: 'funcionarios', nome: 'Perfis de Funcionários', admin: true },
        { id: 'gestao_equipe', nome: 'Atribuições, Folgas e Ponto', admin: true },
        { id: 'gestor_ia', nome: 'Gestor de Soluções IA', admin: true },
        { id: 'permissoes_acesso', nome: 'Cargos e Permissões', admin: true }
      ]
    },
    {
      id: 'aba_configuracoes', nome: 'Configurações',
      modulos: [
        { id: 'configuracoes', nome: 'Configurações Gerais', admin: true },
        { id: 'bancos_taxas', nome: 'Bancos e Taxas Fiscais', admin: true },
        { id: 'atualizacoes_sistema', nome: 'Histórico de Atualizações', admin: false }
      ]
    }
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
        if (!list.some(c => c.nome === 'TI')) {
          push(ref(db, 'cargos'), { nome: 'TI' });
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
    if (nome === 'Administrador' || nome === 'Gerente' || nome === 'Dono' || nome === 'TI') {
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
    if (selectedCargo === 'Dono' || selectedCargo === 'TI') return;

    const currentVal = permissoes[selectedCargo]?.[moduloId]?.[acao] || false;
    const newVal = !currentVal;

    const modulo = categorias.flatMap(c => c.modulos).find(m => m.id === moduloId) || categorias.find(c => c.id === moduloId);
    
    if (modulo && 'admin' in modulo && modulo.admin && !isDonoOrTI) {
      showToast('Acesso negado: Apenas Dono e TI podem alterar permissões administrativas.', 'error');
      return;
    }

    if (newVal && modulo && 'admin' in modulo && modulo.admin) {
      if (!window.confirm(`ATENÇÃO:\nA permissão para "${modulo.nome}" é considerada uma função administrativa sensível.\n\nDeseja realmente ativar este acesso para o cargo de ${selectedCargo}?`)) {
        return;
      }
    }

    setPermissoes(prev => {
      const newState = JSON.parse(JSON.stringify(prev));
      
      if (!newState[selectedCargo]) newState[selectedCargo] = {};
      if (!newState[selectedCargo][moduloId]) {
        newState[selectedCargo][moduloId] = { visualizar: false, editar: false, apagar: false };
      }
      
      newState[selectedCargo][moduloId][acao] = newVal;

      if (!currentVal && (acao === 'editar' || acao === 'apagar')) {
        newState[selectedCargo][moduloId].visualizar = true;
      }
      if (currentVal && acao === 'visualizar') {
        newState[selectedCargo][moduloId].editar = false;
        newState[selectedCargo][moduloId].apagar = false;
      }

      return newState;
    });
  };

  const handleCopyPermissions = () => {
    if (!cargoToCopy) return;
    if (['Dono', 'TI'].includes(cargoToCopy) && !isDonoOrTI) {
      showToast('Acesso negado: Apenas Dono e TI podem copiar permissões de acesso total.', 'error');
      return;
    }
    if (window.confirm(`Deseja substituir as permissões de ${selectedCargo} pelas permissões do cargo ${cargoToCopy}?`)) {
      setPermissoes(prev => {
        const newState = JSON.parse(JSON.stringify(prev));
        if (['Dono', 'TI'].includes(cargoToCopy)) {
           newState[selectedCargo] = {};
           categorias.forEach(cat => {
             newState[selectedCargo][cat.id] = { visualizar: true, editar: true, apagar: true };
             cat.modulos.forEach(m => {
               newState[selectedCargo][m.id] = { visualizar: true, editar: true, apagar: true };
             });
           });
        } else {
           const copied = newState[cargoToCopy] ? JSON.parse(JSON.stringify(newState[cargoToCopy])) : {};
           if (!isDonoOrTI) {
               categorias.forEach(cat => {
                   cat.modulos.forEach(m => {
                       if (m.admin && copied[m.id]) {
                           if (newState[selectedCargo]?.[m.id]) {
                               copied[m.id] = newState[selectedCargo][m.id];
                           } else {
                               delete copied[m.id];
                           }
                       }
                   });
               });
           }
           newState[selectedCargo] = copied;
        }
        return newState;
      });
      showToast(`Permissões copiadas com sucesso! Lembre-se de salvar.`, 'success');
      setCargoToCopy('');
    }
  };

  const salvarPermissoes = async () => {
    try {
      await set(ref(db, 'permissoes'), permissoes);
      showToast('Permissões salvas com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao salvar permissões.', 'error');
    }
  };

  const getPerm = (id: string, acao: 'visualizar' | 'editar' | 'apagar', parentId?: string) => {
    if (selectedCargo === 'Dono' || selectedCargo === 'TI') return true;
    
    if (!parentId && acao === 'visualizar') {
      const val = permissoes[selectedCargo]?.[id]?.visualizar;
      if (val === undefined) return true;
      return val;
    }
    if (parentId && permissoes[selectedCargo]?.[parentId] && permissoes[selectedCargo]?.[parentId].visualizar === false) return false;
    return permissoes[selectedCargo]?.[id]?.[acao] || false;
  };

  const categoriasVisiveis = categorias.map(cat => ({
    ...cat,
    modulos: isDonoOrTI ? cat.modulos : cat.modulos.filter(m => !m.admin)
  })).filter(cat => cat.modulos.length > 0);

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
              {c.nome !== 'Administrador' && c.nome !== 'Gerente' && c.nome !== 'Dono' && c.nome !== 'TI' && (
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
          <div className="mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <div>
              <h4 className="text-xl font-bold text-gray-800">Acessos para: <span className="text-indigo-600">{selectedCargo}</span></h4>
              {(selectedCargo === 'Dono' || selectedCargo === 'TI') && (
                <p className="text-sm text-orange-600 font-bold mt-2 bg-orange-50 p-3 rounded-lg border border-orange-100 max-w-2xl">
                  Este cargo base possui acesso total (Leitura, Edição e Exclusão) a todos os módulos por padrão. Não é possível restringi-lo.
                </p>
              )}
            </div>

            {selectedCargo !== 'Dono' && selectedCargo !== 'TI' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 shrink-0">
                <span className="text-sm font-bold text-gray-600">Copiar de:</span>
                <select 
                  value={cargoToCopy} 
                  onChange={(e) => setCargoToCopy(e.target.value)}
                  className="p-2 border border-gray-200 rounded-md outline-none text-sm bg-white min-w-[150px] focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um cargo...</option>
                  {cargos.filter(c => c.nome !== selectedCargo).map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
                <button 
                  onClick={handleCopyPermissions} 
                  disabled={!cargoToCopy}
                  className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-md font-bold text-sm hover:bg-gray-100 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Copy size={16} className="mr-2" /> Copiar
                </button>
              </div>
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
                {categoriasVisiveis.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-indigo-50/50">
                      <td className="py-3 px-6 font-bold text-indigo-900 flex items-center">{cat.nome} (Aba Completa)</td>
                      <td className="py-3 px-6 text-center"><input type="checkbox" checked={getPerm(cat.id, 'visualizar')} disabled={selectedCargo === 'Dono' || selectedCargo === 'TI'} onChange={() => handleToggle(cat.id, 'visualizar')} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" title="Ativar/Desativar Aba Inteira" /></td>
                      <td className="py-3 px-6 text-center"></td>
                      <td className="py-3 px-6 text-center"></td>
                    </tr>
                    {cat.modulos.map(m => {
                      const isDisabled = (selectedCargo === 'Dono' || selectedCargo === 'TI') ? false : (permissoes[selectedCargo]?.[cat.id]?.visualizar === false);
                      return (
                      <tr key={m.id} className={`transition-colors ${isDisabled ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-6 pl-10 text-gray-700 flex items-center">
                          <div className="w-2 h-2 bg-gray-300 rounded-full mr-3"></div>
                          <span className={isDisabled ? 'line-through' : 'font-medium'}>{m.nome}</span>
                          {m.admin && <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest font-black shrink-0">Admin</span>}
                        </td>
                        <td className="py-3 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'visualizar', cat.id)} disabled={isDisabled || selectedCargo === 'Dono' || selectedCargo === 'TI' || (m.admin && !isDonoOrTI)} onChange={() => handleToggle(m.id, 'visualizar')} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                        <td className="py-3 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'editar', cat.id)} disabled={isDisabled || selectedCargo === 'Dono' || selectedCargo === 'TI' || (m.admin && !isDonoOrTI)} onChange={() => handleToggle(m.id, 'editar')} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                        <td className="py-3 px-6 text-center"><input type="checkbox" checked={getPerm(m.id, 'apagar', cat.id)} disabled={isDisabled || selectedCargo === 'Dono' || selectedCargo === 'TI' || (m.admin && !isDonoOrTI)} onChange={() => handleToggle(m.id, 'apagar')} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50" /></td>
                      </tr>
                    )})}
                  </React.Fragment>
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