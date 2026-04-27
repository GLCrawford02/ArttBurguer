import { useState, useEffect, FormEvent } from 'react';
import { ref, push, set, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario, TransferenciaLog } from '../types';
import { Plus, Trash2, Save, Pencil, X, History, Users, CheckCircle, AlertTriangle, UserX, UserCheck } from 'lucide-react';

export default function FuncionariosManager() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaLog[]>([]);
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [historicoFuncionarioId, setHistoricoFuncionarioId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{nome: string, pin: string, cargo: string[], ativo: boolean, telefone: string}>({ nome: '', pin: '', cargo: ['Atendente'], ativo: true, telefone: '' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let isFirstLoad = true;
    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snapshot) => {
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

    const transRef = ref(db, 'historico_transferencias');
    const unsubTrans = onValue(transRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setTransferencias(list);
      } else {
        setTransferencias([]);
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
        const defaultCargos = [
          { id: 'dono', nome: 'Dono' },
          { id: 'admin', nome: 'Administrador' },
          { id: 'gerente', nome: 'Gerente' },
          { id: 'cozinheiro', nome: 'Cozinheiro' },
          { id: 'atendente', nome: 'Atendente' }
        ];
        defaultCargos.sort((a, b) => a.nome.localeCompare(b.nome));
        setCargos(defaultCargos);
      }
    });

    return () => {
      unsubFunc();
      unsubTrans();
      unsubCargos();
    };
  }, []);

  const formatPhone = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2').substring(0, 15);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.pin.length !== 4 || !/^\d+$/.test(formData.pin)) {
      showToast('O PIN deve conter exatamente 4 números.', 'error');
      return;
    }
    if (formData.cargo.length === 0) {
      showToast('Selecione pelo menos um cargo.', 'error');
      return;
    }

    if (editId) {
      await set(ref(db, `funcionarios/${editId}`), formData);
      setEditId(null);
      showToast('Funcionário atualizado!', 'success');
    } else {
      await set(push(ref(db, 'funcionarios')), formData);
      showToast('Funcionário cadastrado!', 'success');
    }
    setFormData({ nome: '', pin: '', cargo: ['Atendente'], ativo: true, telefone: '' });
  };

  const handleEdit = (f: Funcionario) => {
    setEditId(f.id);
    const cargosArr = Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente'];
    setFormData({ nome: f.nome, pin: f.pin, cargo: cargosArr, ativo: (f as any).ativo !== false, telefone: (f as any).telefone || '' });
  };

  const toggleAtivo = async (f: Funcionario) => {
    if (confirm(`Deseja ${(f as any).ativo === false ? 'ativar' : 'inativar'} o funcionário ${f.nome}?`)) {
      await set(ref(db, `funcionarios/${f.id}/ativo`), (f as any).ativo === false);
      showToast((f as any).ativo === false ? 'Funcionário ativado!' : 'Funcionário inativado!', 'success');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este funcionário? Recomenda-se apenas inativar.')) {
      await remove(ref(db, `funcionarios/${id}`));
      showToast('Funcionário excluído!', 'success');
    }
  };

  const getCargoColor = (cargo: string) => {
    const c = cargo.toLowerCase();
    if (c === 'dono') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (c === 'administrador') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (c === 'gerente') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (c.includes('entregador') || c.includes('motoboy')) return 'bg-green-100 text-green-700 border-green-200';
    if (c.includes('cozinheiro') || c.includes('chapa')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  };

  const funcHistorico = transferencias.filter(t => t.funcionarioId === historicoFuncionarioId);
  const selectedFunc = funcionarios.find(f => f.id === historicoFuncionarioId);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
          <Users size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Gerenciar Equipe</h3>
          <p className="text-sm text-gray-500">Cadastre os funcionários e defina um PIN de 4 dígitos para cada um.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h4 className="font-bold text-gray-800 mb-4">{editId ? 'Editar Funcionário' : 'Novo Funcionário'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
                <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Cargos</label>
                <div className="flex flex-wrap gap-2 border border-gray-200 p-3 rounded-lg bg-white max-h-48 overflow-y-auto">
                  {cargos.map(c => {
                    const isSelected = formData.cargo.includes(c.nome);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (!isSelected) setFormData({...formData, cargo: [...formData.cargo, c.nome]});
                          else setFormData({...formData, cargo: formData.cargo.filter(cargo => cargo !== c.nome)});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors flex items-center ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                      >
                        <span className="mr-1 text-lg leading-none font-black">{isSelected ? '-' : '+'}</span> {c.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Telefone / WhatsApp {formData.cargo.some(c => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy')) ? '(Obrigatório para Rota)' : '(Opcional)'}</label>
                <input type="text" value={formData.telefone} onChange={e => setFormData({...formData, telefone: formatPhone(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">PIN (4 dígitos)</label>
                <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} required value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg font-mono" placeholder="****" />
              </div>
              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                  <span className="text-sm font-bold text-gray-700">Funcionário Ativo no Sistema</span>
                </label>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center">
                  <Save size={18} className="mr-2" /> Salvar
                </button>
                {editId && (
                  <button type="button" onClick={() => {setEditId(null); setFormData({nome:'', pin:'', cargo: ['Atendente'], ativo: true, telefone: ''});}} className="bg-gray-200 text-gray-700 p-2 rounded-lg font-bold hover:bg-gray-300">
                    <X size={20} />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h4 className="font-bold text-gray-800">Equipe</h4>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {funcionarios.map(f => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className={`font-bold ${(f as any).ativo === false ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{f.nome}</p>
                      {(f as any).ativo === false && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-100 text-red-600">Inativo</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente']).map(c => (
                        <span key={c} className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border shadow-sm ${getCargoColor(c)}`}>{c}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 font-mono">PIN: ****</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => setHistoricoFuncionarioId(f.id)} className={`p-1.5 rounded-lg ${historicoFuncionarioId === f.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Ver Histórico">
                      <History size={18} />
                    </button>
                    <button onClick={() => toggleAtivo(f)} className={`p-1.5 rounded-lg ${(f as any).ativo === false ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`} title={(f as any).ativo === false ? 'Ativar Funcionário' : 'Inativar Funcionário'}>
                      {(f as any).ativo === false ? <UserCheck size={18} /> : <UserX size={18} />}
                    </button>
                    <button onClick={() => handleEdit(f)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil size={18} /></button>
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {funcionarios.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Nenhum funcionário cadastrado.</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h4 className="font-bold text-gray-800">{selectedFunc ? `Histórico de Transferências: ${selectedFunc.nome}` : 'Selecione um funcionário para ver o histórico'}</h4>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {!selectedFunc ? (<div className="h-full flex items-center justify-center text-gray-400 flex-col"><History size={48} className="mb-4 opacity-20" /><p>Clique no ícone de histórico ao lado de um funcionário.</p></div>) : funcHistorico.length === 0 ? (<div className="h-full flex items-center justify-center text-gray-400"><p>Nenhuma transferência registrada para este funcionário.</p></div>) : (<div className="space-y-4">{funcHistorico.map(t => (<div key={t.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50"><div><p className="font-bold text-gray-800">{t.quantidade}x {t.nomeInsumo}</p><p className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleString('pt-BR')}</p></div><span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Transferência</span></div>))}</div>)}
            </div>
          </div>
        </div>
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span className="whitespace-pre-line">{toast.message}</span></div>)}
    </div>
  );
}