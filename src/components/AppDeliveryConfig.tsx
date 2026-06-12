import { useState, useEffect } from 'react';
import { ref, onValue, update, push, remove, set } from 'firebase/database';
import { db } from '../firebase';
import { Filter, ChevronUp as ChevronUpIcon, ChevronDown as ChevronDownIcon, Eye, EyeOff, Image as ImageIcon, Plus, Trash2, Smartphone, FileText, CheckCircle } from 'lucide-react';

export default function AppDeliveryConfig() {
  const [activeTab, setActiveTab] = useState<'organizacao' | 'carrossel' | 'legal'>('organizacao');
  const [categoriasDb, setCategoriasDb] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [carrossel, setCarrossel] = useState<any[]>([]);
  const [novaUrl, setNovaUrl] = useState('');
  const [termosCondicoes, setTermosCondicoes] = useState('');
  const [politicaPrivacidade, setPoliticaPrivacidade] = useState('');
  const [horarioAbertura, setHorarioAbertura] = useState('18:30');
  const [salvandoLegal, setSalvandoLegal] = useState(false);
  const [toastLegal, setToastLegal] = useState(false);

  useEffect(() => {
    const categoriasRef = ref(db, 'categorias_produtos');
    const unsubCat = onValue(categoriasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCategoriasDb(list);
      } else {
        setCategoriasDb([]);
      }
    });

    const produtosRef = ref(db, 'produtos');
    const unsubProd = onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutos(list);
      } else {
        setProdutos([]);
      }
    });

    const carrosselRef = ref(db, 'configuracoes/app_delivery/carrossel');
    const unsubCar = onValue(carrosselRef, snap => {
      const data = snap.val();
      if (data) {
        setCarrossel(Object.entries(data).map(([id, val]: any) => ({ id, ...val })));
      } else {
        setCarrossel([]);
      }
    });

    const legalRef = ref(db, 'configuracoes/app_delivery');
    const unsubLegal = onValue(legalRef, snap => {
      const data = snap.val();
      setTermosCondicoes(data?.termosCondicoes || '');
      setPoliticaPrivacidade(data?.politicaPrivacidade || '');
      setHorarioAbertura(data?.horarioAbertura || '18:30');
    });

    return () => { unsubCat(); unsubProd(); unsubCar(); unsubLegal(); };
  }, []);

  const handleSalvarLegal = async () => {
    setSalvandoLegal(true);
    try {
      await update(ref(db, 'configuracoes/app_delivery'), {
        termosCondicoes: termosCondicoes.trim(),
        politicaPrivacidade: politicaPrivacidade.trim(),
        horarioAbertura: horarioAbertura.trim() || '18:30',
      });
      setToastLegal(true);
      setTimeout(() => setToastLegal(false), 2500);
    } finally {
      setSalvandoLegal(false);
    }
  };

  const handleMoveCategoria = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...categoriasDb].sort((a, b) => ((a as any).ordem || 0) - ((b as any).ordem || 0) || a.nome.localeCompare(b.nome));
    if (direction === 'up' && index > 0) [sorted[index], sorted[index - 1]] = [sorted[index - 1], sorted[index]];
    else if (direction === 'down' && index < sorted.length - 1) [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
    else return;
    const updates: any = {};
    sorted.forEach((cat, i) => { updates[`categorias_produtos/${cat.id}/ordem`] = i; });
    await update(ref(db), updates);
  };

  const handleMoveProduto = async (prodIndex: number, direction: 'up' | 'down', catNome: string) => {
    const catProds = produtos.filter(p => ((p as any).categoria || 'Outros') === catNome).sort((a, b) => ((a as any).ordem || 0) - ((b as any).ordem || 0) || a.nome.localeCompare(b.nome));
    if (direction === 'up' && prodIndex > 0) [catProds[prodIndex], catProds[prodIndex - 1]] = [catProds[prodIndex - 1], catProds[prodIndex]];
    else if (direction === 'down' && prodIndex < catProds.length - 1) [catProds[prodIndex], catProds[prodIndex + 1]] = [catProds[prodIndex + 1], catProds[prodIndex]];
    else return;
    const updates: any = {};
    catProds.forEach((prod, i) => { updates[`produtos/${prod.id}/ordem`] = i; });
    await update(ref(db), updates);
  };

  const handleAddImage = async () => {
    if (!novaUrl.trim()) return;
    await set(push(ref(db, 'configuracoes/app_delivery/carrossel')), { url: novaUrl.trim() });
    setNovaUrl('');
  };

  const handleDeleteImage = async (id: string) => {
    await remove(ref(db, `configuracoes/app_delivery/carrossel/${id}`));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-orange-100 p-3 rounded-xl mr-4 text-orange-600">
          <Smartphone size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">APP Delivery</h3>
          <p className="text-sm text-gray-500">Controle o visual, cardápio e carrossel do aplicativo dos clientes.</p>
        </div>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('organizacao')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'organizacao' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Organização e Visibilidade</button>
        <button onClick={() => setActiveTab('carrossel')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'carrossel' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Carrossel de Imagens</button>
        <button onClick={() => setActiveTab('legal')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === 'legal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Termos e Privacidade</button>
      </div>

      {activeTab === 'organizacao' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 animate-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center"><Filter className="mr-2 text-blue-500" /> Organização do Cardápio</h3>
          <p className="text-sm text-gray-500">Arraste ou use as setas para reordenar. Oculte itens que não devem aparecer no PDV/Delivery.</p>
          
          <div className="space-y-4">
            {categoriasDb.sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map((cat: any, catIdx) => (
               <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                 <div className="bg-gray-50 p-4 flex items-center justify-between border-b border-gray-200">
                   <div className="flex items-center gap-4">
                     <div className="flex flex-col gap-1">
                       <button onClick={() => handleMoveCategoria(catIdx, 'up')} disabled={catIdx===0} className="text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronUpIcon size={18}/></button>
                       <button onClick={() => handleMoveCategoria(catIdx, 'down')} disabled={catIdx===categoriasDb.length-1} className="text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronDownIcon size={18}/></button>
                     </div>
                     <span className={`font-black text-lg ${cat.oculto ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{cat.nome}</span>
                   </div>
                   <button onClick={() => update(ref(db, `categorias_produtos/${cat.id}`), { oculto: !cat.oculto })} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors ${cat.oculto ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`} title={cat.oculto ? 'Mostrar' : 'Ocultar'}>
                     {cat.oculto ? <><EyeOff size={16} className="mr-1"/> Oculto</> : <><Eye size={16} className="mr-1"/> Visível</>}
                   </button>
                 </div>
                 <div className="p-4 bg-white space-y-2">
                   {produtos.filter(p => ((p as any).categoria || 'Outros') === cat.nome).sort((a, b) => ((a as any).ordem || 0) - ((b as any).ordem || 0) || a.nome.localeCompare(b.nome)).map((prod, prodIdx, arr) => (
                     <div key={prod.id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors ${prod.oculto ? 'border-red-100 bg-red-50/30' : 'border-gray-100'}`}>
                       <div className="flex items-center gap-3">
                         <div className="flex flex-col gap-1 bg-gray-100 p-1 rounded">
                           <button onClick={() => handleMoveProduto(prodIdx, 'up', cat.nome)} disabled={prodIdx===0} className="text-gray-500 hover:text-blue-600 disabled:opacity-30"><ChevronUpIcon size={14}/></button>
                           <button onClick={() => handleMoveProduto(prodIdx, 'down', cat.nome)} disabled={prodIdx===arr.length-1} className="text-gray-500 hover:text-blue-600 disabled:opacity-30"><ChevronDownIcon size={14}/></button>
                         </div>
                         <span className={`font-medium ${prod.oculto ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{prod.nome}</span>
                       </div>
                       <button onClick={() => update(ref(db, `produtos/${prod.id}`), { oculto: !prod.oculto })} className={`p-2 rounded-md transition-colors ${prod.oculto ? 'text-red-500 hover:bg-red-100' : 'text-green-600 hover:bg-green-100'}`} title={prod.oculto ? 'Mostrar' : 'Ocultar'}>
                         {prod.oculto ? <EyeOff size={18} /> : <Eye size={18} />}
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'carrossel' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 animate-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center"><ImageIcon className="mr-2 text-orange-500" /> Banners do Carrossel</h3>
          <p className="text-sm text-gray-500">Essas imagens ficarão rolando automaticamente na tela inicial do App. Elas se embaralham e desaparecem quando o cliente clica em uma categoria.</p>
          <div className="flex space-x-2">
            <input type="text" value={novaUrl} onChange={e => setNovaUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddImage()} placeholder="URL da imagem..." className="flex-1 p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <button onClick={handleAddImage} className="bg-orange-500 text-white px-5 py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center"><Plus size={18} className="mr-2"/> Adicionar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
            {carrossel.map(c => (
              <div key={c.id} className="relative group rounded-xl overflow-hidden shadow-sm border border-gray-200 aspect-video">
                <img src={c.url} className="w-full h-full object-cover" />
                <button onClick={() => handleDeleteImage(c.id)} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'legal' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 animate-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center"><FileText className="mr-2 text-orange-500" /> Termos e Condições / Política de Privacidade</h3>
          <p className="text-sm text-gray-500">Esse texto será exibido para o cliente no app de delivery, em um link clicável durante o cadastro. O cliente precisa aceitar os dois para criar a conta.</p>

          <div className="space-y-2 max-w-xs">
            <label className="font-bold text-gray-700 text-sm">Horário de Abertura da Loja</label>
            <input type="time" value={horarioAbertura} onChange={e => setHorarioAbertura(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <p className="text-xs text-gray-400">Antes desse horário, o app exibirá um aviso informando que a loja ainda não abriu (o cliente pode fazer o pedido normalmente).</p>
          </div>

          <div className="space-y-2">
            <label className="font-bold text-gray-700 text-sm">Termos e Condições</label>
            <textarea value={termosCondicoes} onChange={e => setTermosCondicoes(e.target.value)} rows={10} placeholder="Cole ou escreva aqui o texto dos Termos e Condições de uso..." className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono" />
          </div>

          <div className="space-y-2">
            <label className="font-bold text-gray-700 text-sm">Política de Privacidade</label>
            <textarea value={politicaPrivacidade} onChange={e => setPoliticaPrivacidade(e.target.value)} rows={10} placeholder="Cole ou escreva aqui o texto da Política de Privacidade..." className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono" />
          </div>

          <button onClick={handleSalvarLegal} disabled={salvandoLegal} className="bg-orange-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {salvandoLegal ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      )}

      {toastLegal && (
        <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 bg-green-600">
          <CheckCircle className="mr-2" size={20} /><span>Textos salvos com sucesso!</span>
        </div>
      )}
    </div>
  );
}