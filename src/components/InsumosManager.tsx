import { useState, useEffect, FormEvent } from 'react';
import { ref, push, set, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Plus, Trash2, Save, Pencil, X, Search } from 'lucide-react';

export default function InsumosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Insumo, 'id'>>({
    nome: '',
    precoPacote: 0,
    qtdPacote: 0,
    estoqueAtual: 0,
    alertaMinimo: 0,
    unidade: 'g'
  });

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    return onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
        }));
        list.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena Insumos de A a Z
        setInsumos(list);
      } else {
        setInsumos([]);
      }
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (editId) {
      // Se estiver editando, atualiza o item existente
      await set(ref(db, `insumos/${editId}`), formData);
      setEditId(null);
    } else {
      // Se não, cria um novo
      const insumosRef = ref(db, 'insumos');
      const newInsumoRef = push(insumosRef);
      await set(newInsumoRef, formData);
    }

    setFormData({
      nome: '',
      precoPacote: 0,
      qtdPacote: 0,
      estoqueAtual: 0,
      alertaMinimo: 0,
      unidade: 'g'
    });
  };

  const handleEdit = (insumo: Insumo) => {
    setEditId(insumo.id);
    setFormData({
      nome: insumo.nome,
      precoPacote: insumo.precoPacote,
      qtdPacote: insumo.qtdPacote,
      estoqueAtual: insumo.estoqueAtual,
      alertaMinimo: insumo.alertaMinimo,
      unidade: insumo.unidade
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setFormData({ nome: '', precoPacote: 0, qtdPacote: 0, estoqueAtual: 0, alertaMinimo: 0, unidade: 'g' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir este insumo?')) {
      await remove(ref(db, `insumos/${id}`));
    }
  };

  const filteredInsumos = insumos.filter(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className={`bg-white p-6 rounded-xl shadow-sm border ${editId ? 'border-blue-300 ring-2 ring-blue-50' : 'border-gray-100'}`}>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          {editId ? <Pencil className="mr-2 text-blue-600" size={20} /> : <Plus className="mr-2 text-blue-600" size={20} />}
          {editId ? 'Editar Insumo' : 'Novo Insumo'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Pão Brioche"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Preço do Pacote (R$)</label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.precoPacote}
              onChange={e => setFormData({ ...formData, precoPacote: Number(e.target.value) })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Qtd por Pacote</label>
            <div className="flex space-x-2">
              <input
                type="number"
                required
                value={formData.qtdPacote}
                onChange={e => setFormData({ ...formData, qtdPacote: Number(e.target.value) })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <select
                value={formData.unidade}
                onChange={e => setFormData({ ...formData, unidade: e.target.value })}
                className="p-2 border border-gray-200 rounded-lg outline-none"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="un">un</option>
                <option value="ml">ml</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Estoque Inicial</label>
            <input
              type="number"
              required
              value={formData.estoqueAtual}
              onChange={e => setFormData({ ...formData, estoqueAtual: Number(e.target.value) })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Alerta Mínimo</label>
            <input
              type="number"
              required
              value={formData.alertaMinimo}
              onChange={e => setFormData({ ...formData, alertaMinimo: Number(e.target.value) })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white p-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <Save className="mr-2" size={18} />
              {editId ? 'Atualizar' : 'Salvar'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-200 text-gray-700 p-2 rounded-lg font-bold hover:bg-gray-300 transition-colors flex items-center justify-center"
                title="Cancelar edição"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-gray-800">Insumos Cadastrados</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
              <th className="px-6 py-3">Insumo</th>
              <th className="px-6 py-3">Preço Pacote</th>
              <th className="px-6 py-3">Qtd Pacote</th>
              <th className="px-6 py-3">Estoque</th>
              <th className="px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInsumos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{i.nome}</td>
                <td className="px-6 py-4 text-gray-600">R$ {i.precoPacote.toFixed(2)}</td>
                <td className="px-6 py-4 text-gray-600">{i.qtdPacote} {i.unidade}</td>
                <td className="px-6 py-4">
                  <span className={`font-bold ${i.estoqueAtual <= i.alertaMinimo ? 'text-red-600' : 'text-gray-600'}`}>
                    {i.estoqueAtual} {i.unidade}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleEdit(i)}
                      className="text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(i.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
