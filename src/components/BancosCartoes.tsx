import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { Landmark, CreditCard, Trash2, Pencil, CheckCircle, AlertTriangle } from 'lucide-react';

export default function BancosCartoes() {
  const [bancos, setBancos] = useState<any[]>([]);
  const [taxas, setTaxas] = useState<any[]>([]);
  
  const [nomeBanco, setNomeBanco] = useState('');
  const [editBancoId, setEditBancoId] = useState<string | null>(null);

  const [nomeTaxa, setNomeTaxa] = useState('');
  const [percentual, setPercentual] = useState('');
  const [prazoDias, setPrazoDias] = useState('1');
  const [bancoVinculado, setBancoVinculado] = useState('');
  const [editTaxaId, setEditTaxaId] = useState<string | null>(null);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const bancosRef = ref(db, 'bancos');
    const unsubB = onValue(bancosRef, snap => {
      const data = snap.val();
      if (data) setBancos(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setBancos([]);
    });

    const taxasRef = ref(db, 'taxas_cartoes');
    const unsubT = onValue(taxasRef, snap => {
      const data = snap.val();
      if (data) setTaxas(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      else setTaxas([]);
    });

    return () => { unsubB(); unsubT(); };
  }, []);

  const salvarBanco = async () => {
    if (!nomeBanco.trim()) return showToast('Preencha o nome do banco', 'error');
    if (editBancoId) {
      await update(ref(db, `bancos/${editBancoId}`), { nome: nomeBanco });
      setEditBancoId(null);
      showToast('Banco atualizado!');
    } else {
      await set(push(ref(db, 'bancos')), { nome: nomeBanco });
      showToast('Banco cadastrado!');
    }
    setNomeBanco('');
  };

  const salvarTaxa = async () => {
    if (!nomeTaxa.trim() || !percentual || !bancoVinculado) {
      return showToast('Preencha nome, % e vincule a um banco', 'error');
    }
    const data = {
      nome: nomeTaxa,
      percentual: Number(percentual),
      prazoDias: Number(prazoDias),
      bancoId: bancoVinculado
    };
    
    if (editTaxaId) {
      await update(ref(db, `taxas_cartoes/${editTaxaId}`), data);
      setEditTaxaId(null);
      showToast('Taxa/Cartão atualizado!');
    } else {
      await set(push(ref(db, 'taxas_cartoes')), data);
      showToast('Taxa/Cartão cadastrado!');
    }
    setNomeTaxa('');
    setPercentual('');
    setPrazoDias('1');
    setBancoVinculado('');
  };

  const excluir = async (path: string) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      await remove(ref(db, path));
      showToast('Excluído com sucesso!');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Bancos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center"><Landmark size={20} className="mr-2 text-indigo-500" /> {editBancoId ? 'Editar Banco' : 'Cadastrar Banco'}</h3>
          <input type="text" placeholder="Nome do Banco (Ex: Nubank)" value={nomeBanco} onChange={e=>setNomeBanco(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2">
            <button onClick={salvarBanco} className="flex-1 bg-indigo-600 text-white p-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Salvar Banco</button>
            {editBancoId && <button onClick={() => {setEditBancoId(null); setNomeBanco('');}} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-auto max-h-[400px]">
          <table className="w-full text-left min-w-[400px]">
            <thead className="sticky top-0 z-10 shadow-sm bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
              <tr><th className="p-4">Banco</th><th className="p-4 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {bancos.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{b.nome}</td>
                  <td className="p-4 text-right flex justify-end space-x-2">
                    <button onClick={()=>{setEditBancoId(b.id); setNomeBanco(b.nome);}} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                    <button onClick={()=>excluir(`bancos/${b.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {bancos.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-gray-400">Nenhum banco cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Taxas / Cartões */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center"><CreditCard size={20} className="mr-2 text-orange-500" /> {editTaxaId ? 'Editar Cartão/Taxa' : 'Cadastrar Cartão/Taxa'}</h3>
          <input type="text" placeholder="Forma Pagto (Ex: Crédito Master)" value={nomeTaxa} onChange={e=>setNomeTaxa(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" placeholder="Taxa (%)" value={percentual} onChange={e=>setPercentual(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
            <input type="number" placeholder="Prazo (Dias)" value={prazoDias} onChange={e=>setPrazoDias(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" title="Dias para recebimento" />
          </div>
          <select value={bancoVinculado} onChange={e=>setBancoVinculado(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">Selecione a Conta Destino...</option>
            {bancos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={salvarTaxa} className="flex-1 bg-orange-600 text-white p-2 rounded-lg font-bold hover:bg-orange-700 transition-colors">Salvar Forma de Pagto</button>
            {editTaxaId && <button onClick={() => {setEditTaxaId(null); setNomeTaxa(''); setPercentual(''); setPrazoDias('1'); setBancoVinculado('');}} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-auto max-h-[400px]">
          <table className="w-full text-left min-w-[500px]">
            <thead className="sticky top-0 z-10 shadow-sm bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
              <tr><th className="p-4">Forma de Pagto</th><th className="p-4">Taxa / Prazo</th><th className="p-4">Conta Destino</th><th className="p-4 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {taxas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{t.nome}</td>
                  <td className="p-4 text-gray-600">
                    <span className="font-bold text-red-500">{t.percentual}%</span>
                    <span className="text-xs text-gray-400 ml-2">({t.prazoDias} dias)</span>
                  </td>
                  <td className="p-4 text-gray-600">{bancos.find(b => b.id === t.bancoId)?.nome || 'Desconhecido'}</td>
                  <td className="p-4 text-right flex justify-end space-x-2">
                    <button onClick={()=>{setEditTaxaId(t.id); setNomeTaxa(t.nome); setPercentual(t.percentual); setPrazoDias(t.prazoDias); setBancoVinculado(t.bancoId);}} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                    <button onClick={()=>excluir(`taxas_cartoes/${t.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {taxas.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Nenhuma forma de pagamento/taxa cadastrada.</td></tr>}
            </tbody>
          </table>
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