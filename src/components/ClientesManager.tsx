import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { Users, MapPin, Phone, Search, Save, Trash2, Pencil, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ShoppingBag, Heart, Plus, X } from 'lucide-react';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
  observacaoCliente?: string;
  observacaoEntregador?: string;
  ultimosPedidos?: any[];
  favoritos?: any[];
}

export default function ClientesManager() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);


  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [observacaoCliente, setObservacaoCliente] = useState('');
  const [observacaoEntregador, setObservacaoEntregador] = useState('');

  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const unsub = onValue(clientesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setClientes(list);
      } else {
        setClientes([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);


  const formatCPF = (val: string) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
  const formatPhone = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2').substring(0, 15);
  const formatCEP = (val: string) => val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatCEP(e.target.value);
    setCep(val);
    const justNumbers = val.replace(/\D/g, '');
    
    if (justNumbers.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${justNumbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setUf(data.uf || '');

          document.getElementById('numero_end')?.focus();
        } else {
          showToast('CEP não encontrado.', 'error');
        }
      } catch (error) {
        showToast('Erro ao consultar o CEP.', 'error');
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const resetForm = () => {
    setEditId(null); setNome(''); setTelefone(''); setCpf(''); setCep('');
    setLogradouro(''); setNumero(''); setBairro(''); setComplemento('');
    setCidade(''); setUf(''); setObservacaoCliente(''); setObservacaoEntregador('');
  };

  const handleSalvar = async () => {
    if (!nome || !telefone) {
      showToast('Nome e Telefone são obrigatórios!', 'error');
      return;
    }

    const clienteData = {
      nome: nome || '',
      telefone: telefone || '',
      cpf: cpf || '',
      cep: cep || '',
      logradouro: logradouro || '',
      numero: numero || '',
      bairro: bairro || '',
      complemento: complemento || '',
      cidade: cidade || '',
      uf: uf || '',
      observacaoCliente: observacaoCliente || '',
      observacaoEntregador: observacaoEntregador || '',
    };

    try {
      if (editId) {
        await update(ref(db, `clientes/${editId}`), clienteData);
        showToast('Cliente atualizado com sucesso!', 'success');
        setEditId(null);
      } else {
        await set(push(ref(db, 'clientes')), {
          ...clienteData,
          dataCadastro: Date.now()
        });
        showToast('Cliente cadastrado com sucesso!', 'success');
      }
      
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      showToast('Erro ao salvar cliente: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditId(cliente.id);
    setNome(cliente.nome || '');
    setTelefone(cliente.telefone || '');
    setCpf(cliente.cpf || '');
    setCep(cliente.cep || '');
    setLogradouro(cliente.logradouro || '');
    setNumero(cliente.numero || '');
    setBairro(cliente.bairro || '');
    setComplemento(cliente.complemento || '');
    setCidade(cliente.cidade || '');
    setUf(cliente.uf || '');
    setObservacaoCliente(cliente.observacaoCliente || '');
    setObservacaoEntregador(cliente.observacaoEntregador || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      await remove(ref(db, `clientes/${id}`));
      showToast('Cliente excluído.', 'success');
    }
  };

  const filteredClientes = clientes.filter(c => 
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.telefone || '').includes(searchTerm) ||
    (c.cpf || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Base de Clientes</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center">
          <Plus size={20} className="mr-2" /> Novo Cliente
        </button>
      </div>

      {showForm && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6 animate-in slide-in-from-top-4 duration-300">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Users className="mr-2 text-indigo-600" size={20} />
            {editId ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button onClick={() => { resetForm(); setShowForm(false); }} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"><X size={20} /></button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Dados Pessoais</h4>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Nome Completo *</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Ex: João da Silva" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Telefone / WhatsApp *</label>
                <input type="text" value={telefone} onChange={e => setTelefone(formatPhone(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">CPF (Opcional)</label>
                <input type="text" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="000.000.000-00" />
              </div>
            </div>
          </div>


          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2 flex items-center">
              <MapPin size={16} className="mr-1 text-indigo-500"/> Endereço de Entrega
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">CEP</label>
                <div className="relative">
                  <input type="text" value={cep} onChange={handleCepChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="00000-000" />
                  {isFetchingCep && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Logradouro (Rua/Av)</label>
                <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Nome da rua" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                <input type="text" id="numero_end" value={numero} onChange={e => setNumero(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="S/N" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Complemento / Ref.</label>
                <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Apto, Bloco..." />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Bairro</label>
                <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">UF</label>
                <input type="text" value={uf} onChange={e => setUf(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase" maxLength={2} />
              </div>
            </div>
          </div>


          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4 lg:col-span-2">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Observações (Cadastro / Entrega)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações do Cliente</label>
                <textarea value={observacaoCliente} onChange={e => setObservacaoCliente(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" placeholder="Ex: Alergia a algum ingrediente, cliente exigente..." rows={2}></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações para o Entregador</label>
                <textarea value={observacaoEntregador} onChange={e => setObservacaoEntregador(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" placeholder="Ex: Deixar na portaria, campainha não funciona, cachorro solto..." rows={2}></textarea>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => { resetForm(); setShowForm(false); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm">Cancelar</button>
          <button onClick={handleSalvar} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center">
            <Save size={18} className="mr-2" /> {editId ? 'Atualizar Cliente' : 'Salvar Cliente'}
          </button>
        </div>
      </div>
      )}

      {/* Lista de Clientes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
          {filteredClientes.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="p-4 flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-bold text-gray-900 truncate">{c.nome}</h4>
                  <p className="text-sm text-gray-500 font-medium flex items-center mt-1"><Phone size={14} className="mr-1 text-indigo-400"/> {c.telefone}</p>
                  {c.logradouro && <p className="text-xs text-gray-400 mt-1 truncate"><MapPin size={12} className="inline mr-1 text-gray-400"/>{c.logradouro}, {c.numero} - {c.bairro}</p>}
                </div>
                <div className="flex space-x-1 shrink-0">
                  <button onClick={() => handleEdit(c)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={16} /></button>
                  <button onClick={() => handleExcluir(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
              

              <div className="bg-gray-50 border-t border-gray-100">
                <button onClick={() => setExpandedClienteId(expandedClienteId === c.id ? null : c.id)} className="w-full p-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex justify-center items-center">
                  Perfil do Cliente {expandedClienteId === c.id ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}
                </button>
                
                {expandedClienteId === c.id && (
                  <div className="p-4 space-y-4 border-t border-indigo-100">
                    {(c.observacaoCliente || c.observacaoEntregador) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {c.observacaoCliente && (
                          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <p className="text-[10px] font-bold text-yellow-800 uppercase mb-1">Obs. do Cliente</p>
                            <p className="text-xs text-yellow-900 whitespace-pre-wrap">{c.observacaoCliente}</p>
                          </div>
                        )}
                        {c.observacaoEntregador && (
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-800 uppercase mb-1">Obs. para Entregador</p>
                            <p className="text-xs text-blue-900 whitespace-pre-wrap">{c.observacaoEntregador}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <h5 className="text-xs font-bold text-gray-700 flex items-center mb-2"><ShoppingBag size={14} className="mr-1 text-orange-500"/> Últimos Pedidos</h5>
                      {c.ultimosPedidos && c.ultimosPedidos.length > 0 ? (
                        <ul className="space-y-2">
                          {c.ultimosPedidos.map((ped: any, idx: number) => (
                            <li key={idx} className="text-xs bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                              <div className="flex justify-between items-center border-b border-gray-50 pb-1 mb-1"><span className="font-bold text-gray-700">{new Date(ped.data).toLocaleDateString('pt-BR')} às {new Date(ped.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span><span className="font-bold text-green-600">R$ {ped.total.toFixed(2)}</span></div>
                              <span className="text-gray-500">{ped.itens.join(', ')}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (<p className="text-xs text-gray-400 italic">Nenhum pedido registrado ainda.</p>)}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-gray-700 flex items-center mb-2"><Heart size={14} className="mr-1 text-red-500"/> Pedidos Favoritos</h5>
                      {c.favoritos && c.favoritos.length > 0 ? (<ul className="space-y-1"></ul>) : (<p className="text-xs text-gray-400 italic">Nenhum favorito.</p>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}