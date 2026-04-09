import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Package, Search, Trash2, CheckCircle, AlertTriangle, Pencil } from 'lucide-react';

export default function InsumosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editId, setEditId] = useState<string | null>(null);
  // Form state
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [unidade, setUnidade] = useState('g');
  const [precoPacote, setPrecoPacote] = useState('');
  const [qtdPacote, setQtdPacote] = useState('');
  const [diasAvisoValidade, setDiasAvisoValidade] = useState('7');
  const [alertaMinimo, setAlertaMinimo] = useState('');
  const [estoqueMaximo, setEstoqueMaximo] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const generateSku = (name: string): string => {
    if (!name) return '';
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    const randomNumber = Math.floor(100 + Math.random() * 900);
    return `${prefix}${randomNumber}`;
  };

  useEffect(() => {
    if (!editId && nome) {
      setSku(generateSku(nome));
    } else if (!editId) {
      setSku('');
    }
  }, [nome, editId]);

  const handleSalvar = async () => {
    if (!nome || !unidade || !precoPacote || !qtdPacote || !alertaMinimo) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (editId) {
      await update(ref(db, `insumos/${editId}`), {
        nome,
        sku: sku || generateSku(nome),
        unidade,
        precoPacote: Number(precoPacote),
        qtdPacote: Number(qtdPacote),
        diasAvisoValidade: Number(diasAvisoValidade),
        alertaMinimo: Number(alertaMinimo),
        estoqueMaximo: estoqueMaximo ? Number(estoqueMaximo) : null,
      });
      showToast('Insumo atualizado com sucesso!', 'success');
      setEditId(null);
    } else {
      const newInsumoRef = push(ref(db, 'insumos'));
      await set(newInsumoRef, {
        nome,
        sku: sku || generateSku(nome),
        unidade,
        precoPacote: Number(precoPacote),
        qtdPacote: Number(qtdPacote),
        diasAvisoValidade: Number(diasAvisoValidade),
        alertaMinimo: Number(alertaMinimo),
        estoqueMaximo: estoqueMaximo ? Number(estoqueMaximo) : null,
        estoqueRotativo: 0,
        estoqueEstacionario: estoqueAtual ? Number(estoqueAtual) : 0,
      });
      showToast('Insumo salvo com sucesso!', 'success');
    }

    // Reset form
    setNome('');
    setSku('');
    setUnidade('g');
    setPrecoPacote('');
    setQtdPacote('');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
  };

  const handleEdit = (insumo: Insumo) => {
    setEditId(insumo.id);
    setNome(insumo.nome);
    setSku((insumo as any).sku || '');
    setUnidade(insumo.unidade);
    setPrecoPacote(String(insumo.precoPacote));
    setQtdPacote(String(insumo.qtdPacote));
    setDiasAvisoValidade(String(insumo.diasAvisoValidade || 7));
    setAlertaMinimo(String(insumo.alertaMinimo || ''));
    setEstoqueMaximo(insumo.estoqueMaximo ? String(insumo.estoqueMaximo) : '');
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNome('');
    setSku('');
    setUnidade('g');
    setPrecoPacote('');
    setQtdPacote('');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita.')) {
      await remove(ref(db, `insumos/${id}`));
      showToast('Insumo excluído com sucesso.', 'success');
    }
  };

  const filteredInsumos = insumos.filter(i => 
    i.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((i as any).sku && (i as any).sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Package className="mr-2 text-green-600" size={20} />
          {editId ? 'Editar Insumo' : 'Novo Insumo'}
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Nome do Insumo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: Pão Brioche" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">SKU (Automático)</label>
              <input type="text" value={sku} onChange={e => setSku(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 font-mono" placeholder="Ex: PAO123" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Unidade</label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white">
                <option value="g">Grama (g)</option>
                <option value="kg">Quilograma (kg)</option>
                <option value="ml">Mililitro (ml)</option>
                <option value="L">Litro (L)</option>
                <option value="un">Unidade (un)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Preço Pacote (R$)</label>
              <input type="number" value={precoPacote} onChange={e => setPrecoPacote(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="15.90" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Qtd. Pacote</label>
              <input type="number" value={qtdPacote} onChange={e => setQtdPacote(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Estoque Mínimo (Alerta)</label>
              <input type="number" value={alertaMinimo} onChange={e => setAlertaMinimo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: 5" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Estoque Máximo (Opcional)</label>
              <input type="number" value={estoqueMaximo} onChange={e => setEstoqueMaximo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: 20" />
            </div>
            {!editId && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Estoque Atual (Opcional)</label>
                <input type="number" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="Ex: 10" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Avisar Validade (dias antes)</label>
            <input type="number" value={diasAvisoValidade} onChange={e => setDiasAvisoValidade(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500" placeholder="7" />
          </div>

          <div className="pt-4 border-t flex gap-2">
            <button onClick={handleSalvar} className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors">
              {editId ? 'Atualizar Insumo' : 'Salvar Novo Insumo'}
            </button>
            {editId && (
              <button onClick={handleCancelEdit} className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-gray-800">Insumos Cadastrados</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm w-full sm:w-64" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {filteredInsumos.map(i => (
            <div key={i.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-bold text-gray-900">{i.nome}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{ (i as any).sku || 'N/A'}</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Custo: <span className="text-blue-600">R$ {(i.precoPacote / i.qtdPacote).toFixed(3)}</span> por {i.unidade}
                </p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(i)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Pencil size={18} />
                </button>
                <button onClick={() => handleExcluir(i.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredInsumos.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">Nenhum insumo encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}
    </div>
  );
}