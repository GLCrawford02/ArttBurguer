import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Truck, Store, Plus, Trash2, Save, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface EmbalagemItem {
  insumoId: string;
  quantidade: number;
}

interface SectionProps {
  label: string;
  icon: React.ReactNode;
  items: EmbalagemItem[];
  insumos: Insumo[];
  onAdd: (insumoId: string, qtd: number) => void;
  onRemove: (insumoId: string) => void;
  onChangeQtd: (insumoId: string, qtd: number) => void;
}

function SectionCard({ label, icon, items, insumos, onAdd, onRemove, onChangeQtd }: SectionProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qtd, setQtd] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = insumos.filter(i =>
    (i.nome || '').toLowerCase().includes(search.toLowerCase()) &&
    !items.find(it => it.insumoId === i.id)
  );

  const handleAdd = () => {
    if (!selectedId || qtd <= 0) return;
    onAdd(selectedId, qtd);
    setSelectedId('');
    setSearch('');
    setQtd(1);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
      <h4 className="text-sm font-bold text-gray-700 flex items-center border-b border-gray-100 pb-2">
        {icon}{label}
      </h4>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
            <Search size={14} className="ml-2 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedId(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full p-2 outline-none text-sm bg-transparent rounded-lg"
              placeholder="Buscar insumo..."
            />
          </div>
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {filtered.slice(0, 20).map(i => (
                <div
                  key={i.id}
                  onMouseDown={() => { setSelectedId(i.id); setSearch(i.nome); setShowDropdown(false); }}
                  className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                >
                  {i.nome}
                </div>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={qtd}
          onChange={e => setQtd(Number(e.target.value))}
          className="w-20 p-2 border border-gray-200 rounded-lg text-sm text-center"
          placeholder="Qtd"
        />
        <button
          onClick={handleAdd}
          disabled={!selectedId}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Nenhum insumo configurado</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(item => {
            const insumo = insumos.find(i => i.id === item.insumoId);
            return (
              <li key={item.insumoId} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                  {insumo?.nome || <span className="text-red-400 italic">Insumo removido</span>}
                </span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={item.quantidade}
                  onChange={e => onChangeQtd(item.insumoId, Number(e.target.value))}
                  className="w-16 p-1 border border-gray-200 rounded text-xs text-center bg-white"
                />
                <span className="text-xs text-gray-400 w-8 shrink-0">{insumo?.unidade || ''}</span>
                <button onClick={() => onRemove(item.insumoId)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function EmbalagensPadraoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [delivery, setDelivery] = useState<EmbalagemItem[]>([]);
  const [salao, setSalao] = useState<EmbalagemItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const toArr = (val: any): EmbalagemItem[] => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : Object.values(val);
      return (arr as any[]).filter(Boolean);
    };

    const unsubInsumos = onValue(ref(db, 'insumos'), snap => {
      const data = snap.val();
      if (data) {
        const list: Insumo[] = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInsumos(list);
      }
    });

    const unsubConfig = onValue(ref(db, 'configuracoes/embalagens_padrao'), snap => {
      const data = snap.val();
      if (data) {
        setDelivery(toArr(data.delivery));
        setSalao(toArr(data.salao));
      }
    });

    return () => { unsubInsumos(); unsubConfig(); };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await set(ref(db, 'configuracoes/embalagens_padrao'), { delivery, salao });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const addDelivery = (insumoId: string, qtd: number) =>
    setDelivery(prev => [...prev, { insumoId, quantidade: qtd }]);
  const addSalao = (insumoId: string, qtd: number) =>
    setSalao(prev => [...prev, { insumoId, quantidade: qtd }]);
  const removeDelivery = (id: string) =>
    setDelivery(prev => prev.filter(i => i.insumoId !== id));
  const removeSalao = (id: string) =>
    setSalao(prev => prev.filter(i => i.insumoId !== id));
  const changeQtdDelivery = (id: string, qtd: number) =>
    setDelivery(prev => prev.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i));
  const changeQtdSalao = (id: string, qtd: number) =>
    setSalao(prev => prev.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-800">Embalagens Padrão</h3>
          <p className="text-sm text-gray-500 mt-1">
            Insumos adicionados automaticamente ao criar SKUs de{' '}
            <span className="font-bold text-blue-600">Delivery (/)</span> e{' '}
            <span className="font-bold text-green-600">Salão (%)</span>
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm self-start"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          label="Delivery (/)"
          icon={<Truck size={16} className="mr-2 text-blue-500" />}
          items={delivery}
          insumos={insumos}
          onAdd={addDelivery}
          onRemove={removeDelivery}
          onChangeQtd={changeQtdDelivery}
        />
        <SectionCard
          label="Salão (%)"
          icon={<Store size={16} className="mr-2 text-green-500" />}
          items={salao}
          insumos={insumos}
          onAdd={addSalao}
          onRemove={removeSalao}
          onChangeQtd={changeQtdSalao}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Esses insumos são somados aos ingredientes base do produto ao criar os SKUs de Delivery e Salão.
          Certifique-se de que todos estão cadastrados no sistema antes de usar a função "Criar SKUs".
        </p>
      </div>
    </div>
  );
}
