import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Megaphone, Ticket, Plus, Trash2, Save, X, CheckCircle, AlertTriangle, Send, Users } from 'lucide-react';

export default function MarketingManager({ currentUser, temPermissao }: { currentUser?: any, temPermissao?: any }) {
  const [cupons, setCupons] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  
  const [mensagemMassa, setMensagemMassa] = useState('');
  const [enviandoMassa, setEnviandoMassa] = useState(false);
  const [showMassaModal, setShowMassaModal] = useState(false);
  const [categoriaMassa, setCategoriaMassa] = useState('Todos');

  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<'valor' | 'porcentagem'>('porcentagem');
  const [valor, setValor] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const canEdit = temPermissao ? temPermissao('marketing', 'aba_marketing', 'editar') : true;
  const canDelete = temPermissao ? temPermissao('marketing', 'aba_marketing', 'apagar') : true;

  const getHojeMesDia = () => {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${mes}-${dia}`;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const cuponsRef = ref(db, 'cupons');
    const unsub = onValue(cuponsRef, (snap) => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setCupons(list);
      } else {
        setCupons([]);
      }
    });

    const clientesRef = ref(db, 'clientes');
    const unsubClientes = onValue(clientesRef, (snap) => {
      if (snap.val()) {
        setClientes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      } else {
        setClientes([]);
      }
    });
    return () => { unsub(); unsubClientes(); };
  }, []);

  // Lógica de Criação de Cupons
  const handleSubmit = async () => {
    if (!codigo.trim() || !valor) {
      showToast('Preencha o código e o valor do cupom.', 'error');
      return;
    }
    
    const codigoLimpo = codigo.trim().toUpperCase().replace(/\s+/g, '');

    if (cupons.some(c => c.codigo === codigoLimpo && c.id !== editId)) {
      showToast('Já existe um cupom com este código.', 'error');
      return;
    }

    const payload = {
      codigo: codigoLimpo,
      tipo,
      valor: Number(valor),
      ativo,
      timestamp: Date.now()
    };

    if (editId) {
      await update(ref(db, `cupons/${editId}`), payload);
      showToast('Cupom atualizado com sucesso!', 'success');
    } else {
      await set(push(ref(db, 'cupons')), payload);
      showToast('Cupom criado com sucesso!', 'success');
    }
    
    setCodigo(''); setValor(''); setTipo('porcentagem'); setAtivo(true);
    setEditId(null); setShowForm(false);
  };

  const handleEdit = (cupom: any) => {
    setEditId(cupom.id);
    setCodigo(cupom.codigo);
    setTipo(cupom.tipo);
    setValor(String(cupom.valor));
    setAtivo(cupom.ativo !== false);
    setShowForm(true);
  };

  const handleExcluir = async (id: string) => {
    if (confirm('Deseja excluir este cupom promocional permanentemente?')) {
      await remove(ref(db, `cupons/${id}`));
      showToast('Cupom excluído.', 'success');
    }
  };

  // Lógica de Disparo em Massa
  const handleDisparoMassa = async () => {
    if (!mensagemMassa.trim()) {
      showToast('Digite uma mensagem para enviar.', 'error');
      return;
    }
    const clientesAlvo = categoriaMassa === 'Todos' 
      ? clientes.filter(c => c.telefone)
      : categoriaMassa === 'AniversariantesHoje'
      ? clientes.filter(c => c.telefone && c.dataNascimento && c.dataNascimento.substring(5, 10) === getHojeMesDia())
      : clientes.filter(c => c.telefone && c.categorias?.includes(categoriaMassa));
      
    if (clientesAlvo.length === 0) {
      showToast('Nenhum cliente válido encontrado nesta categoria.', 'error');
      return;
    }
    if (!confirm(`Deseja enviar esta mensagem para ${clientesAlvo.length} clientes?`)) return;
  
    setEnviandoMassa(true);
    let enviados = 0;
    for (const c of clientesAlvo) {
      let telLimpo = c.telefone.replace(/\D/g, '');
      if (!telLimpo.startsWith('55') && telLimpo.length >= 10) telLimpo = '55' + telLimpo;
      if (telLimpo.length >= 12) {
        await set(push(ref(db, 'fila_mensagens')), {
          telefone: telLimpo,
          mensagem: mensagemMassa,
          status: 'pendente',
          timestamp: Date.now()
        });
        enviados++;
      }
    }
    setEnviandoMassa(false);
    setMensagemMassa('');
    setCategoriaMassa('Todos');
    setShowMassaModal(false);
    showToast(`Mensagem enfileirada para ${enviados} clientes! O robô fará o envio gradativo.`, 'success');
  };

  const todasCategorias = Array.from(new Set(clientes.flatMap(c => c.categorias || []))).sort();
  const clientesAlvoCount = categoriaMassa === 'Todos' 
    ? clientes.filter(c => c.telefone).length 
    : categoriaMassa === 'AniversariantesHoje'
    ? clientes.filter(c => c.telefone && c.dataNascimento && c.dataNascimento.substring(5, 10) === getHojeMesDia()).length
    : clientes.filter(c => c.telefone && c.categorias?.includes(categoriaMassa)).length;

  const handleCategoriaChange = (e: any) => {
    const val = e.target.value;
    setCategoriaMassa(val);
    if (val === 'AniversariantesHoje' && (!mensagemMassa.trim() || mensagemMassa.includes('promoção especial para você hoje'))) {
      setMensagemMassa('Parabéns pelo seu dia! 🎉\nNós da ArttBurger lhe desejamos um feliz aniversário!\nPara comemorar, temos um presente especial para você: ...');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center">
          <div className="bg-purple-100 p-3 rounded-xl mr-4 text-purple-600">
            <Megaphone size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Marketing e Cupons</h2>
            <p className="text-sm text-gray-500">Crie cupons de desconto e dispare mensagens pelo WhatsApp.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canEdit && (
            <button onClick={() => setShowMassaModal(true)} className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center">
              <Send size={20} className="mr-2"/> Disparo WhatsApp
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setEditId(null); setCodigo(''); setValor(''); setShowForm(!showForm); }} className="bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm flex items-center justify-center">
              {showForm ? <><X size={20} className="mr-2"/> Cancelar</> : <><Plus size={20} className="mr-2"/> Novo Cupom</>}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 animate-in slide-in-from-top-4">
          <h4 className="font-bold text-gray-800 flex items-center"><Ticket className="mr-2 text-purple-500" size={20}/> {editId ? 'Editar Cupom' : 'Criar Novo Cupom'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Código Promocional</label>
              <input type="text" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: PROMO10" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-bold uppercase tracking-wider" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Desconto</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as any)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium">
                <option value="porcentagem">Porcentagem (%)</option>
                <option value="valor">Valor Fixo (R$)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Valor do Desconto</label>
              <input type="number" min="0" step="any" value={valor} onChange={e => setValor(e.target.value)} placeholder={tipo === 'porcentagem' ? 'Ex: 15' : 'Ex: 10.00'} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-bold" />
            </div>
            <div className="space-y-1 flex flex-col justify-end pb-1.5">
              <label className="flex items-center space-x-2 cursor-pointer p-2 border border-gray-200 rounded-lg bg-gray-50">
                <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer" />
                <span className="text-sm font-bold text-gray-700">Cupom Ativo</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSubmit} className="w-full sm:w-auto bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-sm flex items-center justify-center"><Save size={18} className="mr-2"/> Salvar Cupom</button>
          </div>
        </div>
      )}

      {showMassaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-800 flex items-center"><Send className="mr-2 text-green-500"/> Disparo em Massa (WhatsApp)</h3>
              <button onClick={() => setShowMassaModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <div className="bg-green-50 border border-green-100 p-3 rounded-lg flex items-start text-green-800 text-sm">
              <Users className="mr-2 mt-0.5 shrink-0" size={18}/>
              <p>A mensagem será enviada pelo Robô para <strong>{clientesAlvoCount} clientes</strong> da sua base de dados que possuem telefone válido cadastrado.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Filtrar por Categoria (Tag)</label>
              <select value={categoriaMassa} onChange={handleCategoriaChange} className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-gray-50">
                <option value="Todos">Todos os Clientes</option>
                <option value="AniversariantesHoje">🎂 Aniversariantes de Hoje</option>
                {todasCategorias.map(cat => (
                  <option key={cat as string} value={cat as string}>{cat as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Sua Mensagem</label>
              <textarea
                value={mensagemMassa}
                onChange={e => setMensagemMassa(e.target.value)}
                placeholder="Olá! Temos uma promoção especial para você hoje..."
                className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 min-h-[150px] resize-y"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowMassaModal(false)} className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleDisparoMassa} disabled={enviandoMassa || !mensagemMassa.trim()} className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex justify-center items-center disabled:opacity-50">
                {enviandoMassa ? 'Enfileirando...' : 'Iniciar Disparo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cupons.map(c => (<div key={c.id} className={`bg-white p-5 rounded-xl border-l-4 shadow-sm flex flex-col justify-between transition-colors ${c.ativo !== false ? 'border-l-purple-500' : 'border-l-gray-300 opacity-60'}`}><div className="flex justify-between items-start mb-2"><h4 className="font-black text-xl text-gray-900 tracking-tight">{c.codigo}</h4><div className="flex space-x-1">{canEdit && <button onClick={() => handleEdit(c)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Ticket size={16}/></button>}{canDelete && <button onClick={() => handleExcluir(c.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>}</div></div><div className="mt-2"><span className="text-2xl font-black text-purple-600">{c.tipo === 'porcentagem' ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2).replace('.', ',')}`}</span><p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{c.ativo !== false ? 'Disponível no PDV' : 'Inativo'}</p></div></div>))}
        {cupons.length === 0 && <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-100 border-dashed"><Ticket size={48} className="mx-auto mb-3 opacity-20" /><p className="font-medium">Nenhum cupom promocional criado.</p></div>}
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}