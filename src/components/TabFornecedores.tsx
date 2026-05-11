import { useState } from 'react';
import { ref, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Pencil, Trash2, Loader2 } from 'lucide-react';

export default function TabFornecedores({ fornecedores, loading, showToast, excluir }: any) {
  const [editId, setEditId] = useState<string | null>(null);
  const [nomeForn, setNomeForn] = useState('');
  const [telForn, setTelefoneForn] = useState('');
  const [documentoForn, setDocumentoForn] = useState('');
  const [nomeFantasiaForn, setNomeFantasiaForn] = useState('');
  const [observacaoForn, setObservacaoForn] = useState('');
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const formatDocumento = (val: string) => {
    let v = val.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return v.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2').substring(0, 18);
    }
  };

  const handleDocumentoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatDocumento(e.target.value);
    setDocumentoForn(val);
    const clean = val.replace(/\D/g, '');
    
    if (clean.length === 14) {
      setIsFetchingCnpj(true);
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
        if (res.ok) {
          const data = await res.json();
          if (data.razao_social) setNomeForn(data.razao_social);
          if (data.nome_fantasia) setNomeFantasiaForn(data.nome_fantasia);
          if (data.ddd_telefone_1) setTelefoneForn(data.ddd_telefone_1);
          showToast('Dados do CNPJ preenchidos automaticamente.', 'success');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsFetchingCnpj(false);
      }
    }
  };

  const salvarFornecedor = async () => {
    if (!nomeForn) return showToast('Nome é obrigatório', 'error');
    if (editId) await update(ref(db, `fornecedores/${editId}`), { nome: nomeForn, nomeFantasia: nomeFantasiaForn, telefone: telForn, documento: documentoForn, observacao: observacaoForn });
    else await set(push(ref(db, 'fornecedores')), { nome: nomeForn, nomeFantasia: nomeFantasiaForn, telefone: telForn, documento: documentoForn, observacao: observacaoForn });
    showToast(editId ? 'Fornecedor atualizado!' : 'Fornecedor salvo com sucesso!');
    setEditId(null); setNomeForn(''); setNomeFantasiaForn(''); setTelefoneForn(''); setDocumentoForn(''); setObservacaoForn('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{editId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
        <div className="relative">
          <input type="text" placeholder="CNPJ ou CPF (Opcional)" value={documentoForn} onChange={handleDocumentoChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm" />
          {isFetchingCnpj && <Loader2 size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-500 animate-spin" />}
        </div>
        <input type="text" placeholder="Razão Social / Nome" value={nomeForn} onChange={e=>setNomeForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="text" placeholder="Nome Fantasia (Opcional)" value={nomeFantasiaForn} onChange={e=>setNomeFantasiaForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="text" placeholder="Telefone / Contato" value={telForn} onChange={e=>setTelefoneForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
        <textarea placeholder="Observação (Opcional)" value={observacaoForn} onChange={e=>setObservacaoForn(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none" rows={3}></textarea>
        <div className="flex gap-2">
          <button onClick={salvarFornecedor} className="flex-1 bg-purple-600 text-white p-2 rounded-lg font-bold hover:bg-purple-700 transition-colors">Salvar</button>
          {editId && <button onClick={() => { setEditId(null); setNomeForn(''); setNomeFantasiaForn(''); setTelefoneForn(''); setDocumentoForn(''); setObservacaoForn(''); }} className="p-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">Cancelar</button>}
        </div>
      </div>
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
         <table className="w-full text-left min-w-[400px]">
           <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase"><tr><th className="p-4">Nome / Razão Social</th><th className="p-4">Nome Fantasia</th><th className="p-4">CNPJ / CPF</th><th className="p-4">Contato</th><th className="p-4 text-right">Ações</th></tr></thead>
           {loading ? (
             <tbody>{[...Array(5)].map((_, i) => (<tr key={i} className="animate-pulse border-b border-gray-50"><td className="p-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="p-4 flex justify-end"><div className="h-6 bg-gray-200 rounded w-12"></div></td></tr>))}</tbody>
           ) : (
           <tbody className="divide-y divide-gray-50 text-sm">
             {fornecedores.map((f: any) => (
               <tr key={f.id} className="hover:bg-gray-50">
                 <td className="p-4">
                   <p className="font-bold text-gray-800">{f.nome}</p>
                   {f.observacao && <p className="text-xs text-gray-400 mt-1 line-clamp-2" title={f.observacao}>{f.observacao}</p>}
                 </td>
                 <td className="p-4 text-gray-700">{f.nomeFantasia || '-'}</td>
                 <td className="p-4 text-gray-600 font-mono text-xs">{f.documento || '-'}</td>
                 <td className="p-4 text-gray-600">{f.telefone || '-'}</td>
                 <td className="p-4 text-right flex justify-end space-x-2"><button onClick={()=>{setEditId(f.id || null); setNomeForn(f.nome); setNomeFantasiaForn(f.nomeFantasia || ''); setTelefoneForn(f.telefone); setDocumentoForn(f.documento || ''); setObservacaoForn(f.observacao || '');}} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Pencil size={16}/></button><button onClick={()=>excluir(`fornecedores/${f.id}`)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button></td>
               </tr>
             ))}
             {fornecedores.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">Nenhum fornecedor registrado.</td></tr>}
           </tbody>
           )}
         </table>
      </div>
    </div>
  );
}
