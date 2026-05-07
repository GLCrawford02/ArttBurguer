import { useState } from 'react';
import { ref, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Pencil, Trash2 } from 'lucide-react';

export default function TabFornecedores({ fornecedores, loading, showToast, excluir }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [telForn, setTelefoneForn] = useState('');

  const salvarFornecedor = async () => {
    if (!nomeForn) return showToast('Nome é obrigatório', 'error');
    if (editId) await update(ref(db, `fornecedores/${editId}`), { nome: nomeForn, telefone: telForn });
    else await set(push(ref(db, 'fornecedores')), { nome: nomeForn, telefone: telForn });
    showToast(editId ? 'Fornecedor atualizado!' : 'Fornecedor salvo com sucesso!');
    setEditId(null); setNomeForn(''); setTelefoneForn('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
        <input type="text" placeholder="Nome do Fornecedor" value={nomeForn} onChange={e=>setNomeForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="text" placeholder="Telefone / Contato" value={telForn} onChange={e=>setTelefoneForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <div className="flex gap-2">
          <button onClick={salvarFornecedor} className="flex-1 bg-purple-600 text-white p-2 rounded-lg font-bold hover:bg-purple-700 transition-colors">Salvar</button>
          {editId && <button onClick={() => { setEditId(null); setNomeForn(''); setTelefoneForn(''); }} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
        </div>
      </div>
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
         <table className="w-full text-left min-w-[400px]">
           <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase"><tr><th className="p-4">Nome</th><th className="p-4">Contato</th><th className="p-4 text-right">Ações</th></tr></thead>
           {loading ? (
             <tbody>{[...Array(5)].map((_, i) => (<tr key={i} className="animate-pulse border-b border-gray-50"><td className="p-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4 flex justify-end"><div className="h-6 bg-gray-200 rounded w-12"></div></td></tr>))}</tbody>
           ) : (
           <tbody className="divide-y divide-gray-50 text-sm">
             {fornecedores.map((f: any) => (
               <tr key={f.id} className="hover:bg-gray-50">
                 <td className="p-4 font-bold text-gray-800">{f.nome}</td>
                 <td className="p-4 text-gray-600">{f.telefone || '-'}</td>
                 <td className="p-4 text-right flex justify-end space-x-2"><button onClick={()=>{setEditId(f.id || null); setNomeForn(f.nome); setTelefoneForn(f.telefone);}} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={()=>excluir(`fornecedores/${f.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></td>
               </tr>
             ))}
             {fornecedores.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhum fornecedor registrado.</td></tr>}
           </tbody>
           )}
         </table>
      </div>
    </div>
  );
}
