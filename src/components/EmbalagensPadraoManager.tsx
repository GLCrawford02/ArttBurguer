import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto } from '../types';
import { Truck, Store, Plus, Trash2, Save, Search, CheckCircle, AlertTriangle, Package, X, Pencil } from 'lucide-react';

interface EmbalagemItem {
  insumoId: string;
  quantidade: number;
}

interface GrupoData {
  nome: string;
  produtos: string[];
  insumos: EmbalagemItem[];
}

// ─── Seletor de insumo reutilizável ───────────────────────────────────────────
function InsumoSelector({
  insumos,
  excludeIds,
  onAdd,
}: {
  insumos: Insumo[];
  excludeIds: string[];
  onAdd: (insumoId: string, qtd: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qtd, setQtd] = useState(1);
  const [open, setOpen] = useState(false);

  const filtered = insumos.filter(
    i => (i.nome || '').toLowerCase().includes(search.toLowerCase()) && !excludeIds.includes(i.id)
  );

  const handle = () => {
    if (!selectedId || qtd <= 0) return;
    onAdd(selectedId, qtd);
    setSelectedId(''); setSearch(''); setQtd(1);
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-blue-400">
          <Search size={13} className="ml-2 text-gray-400 shrink-0" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setSelectedId(''); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className="w-full p-1.5 outline-none text-sm bg-transparent"
            placeholder="Buscar insumo..."
          />
        </div>
        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
            {filtered.slice(0, 20).map(i => (
              <div key={i.id} onMouseDown={() => { setSelectedId(i.id); setSearch(i.nome); setOpen(false); }}
                className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                {i.nome}
              </div>
            ))}
          </div>
        )}
      </div>
      <input type="number" min={0.01} step={0.01} value={qtd} onChange={e => setQtd(Number(e.target.value))}
        className="w-16 p-1.5 border border-gray-200 rounded-lg text-sm text-center" />
      <button onClick={handle} disabled={!selectedId}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
        <Plus size={15} />
      </button>
    </div>
  );
}

// ─── Seletor de produto reutilizável ──────────────────────────────────────────
function ProdutoSelector({
  produtos,
  excludeIds,
  onAdd,
}: {
  produtos: Produto[];
  excludeIds: string[];
  onAdd: (produtoId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = produtos.filter(
    p => (p.nome || '').toLowerCase().includes(search.toLowerCase()) && !excludeIds.includes(p.id)
  );

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-orange-400">
        <Search size={13} className="ml-2 text-gray-400 shrink-0" />
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full p-1.5 outline-none text-sm bg-transparent"
          placeholder="Adicionar produto..."
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
          {filtered.slice(0, 20).map(p => (
            <div key={p.id} onMouseDown={() => { onAdd(p.id); setSearch(''); setOpen(false); }}
              className="p-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0">
              <span className="font-medium">{p.nome}</span>
              {p.categoria && <span className="ml-2 text-xs text-gray-400">{p.categoria}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de seção fixa (Delivery / Salão) ────────────────────────────────────
function SectionCard({
  label, icon, items, insumos, onAdd, onRemove, onChangeQtd,
}: {
  label: string;
  icon: React.ReactNode;
  items: EmbalagemItem[];
  insumos: Insumo[];
  onAdd: (id: string, qtd: number) => void;
  onRemove: (id: string) => void;
  onChangeQtd: (id: string, qtd: number) => void;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
      <h4 className="text-sm font-bold text-gray-700 flex items-center border-b border-gray-100 pb-2">
        {icon}{label}
      </h4>
      <InsumoSelector insumos={insumos} excludeIds={items.map(i => i.insumoId)} onAdd={onAdd} />
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
                <input type="number" min={0.01} step={0.01} value={item.quantidade}
                  onChange={e => onChangeQtd(item.insumoId, Number(e.target.value))}
                  className="w-16 p-1 border border-gray-200 rounded text-xs text-center bg-white" />
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

// ─── Card de grupo customizado ─────────────────────────────────────────────────
function GrupoCard({
  grupo, insumos, produtos, onChange, onDelete,
}: {
  grupo: GrupoData;
  insumos: Insumo[];
  produtos: Produto[];
  onChange: (g: GrupoData) => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(grupo.nome);

  const commitName = () => {
    setEditingName(false);
    if (nameInput.trim()) onChange({ ...grupo, nome: nameInput.trim() });
    else setNameInput(grupo.nome);
  };

  const addInsumo = (insumoId: string, qtd: number) =>
    onChange({ ...grupo, insumos: [...grupo.insumos, { insumoId, quantidade: qtd }] });

  const removeInsumo = (id: string) =>
    onChange({ ...grupo, insumos: grupo.insumos.filter(i => i.insumoId !== id) });

  const changeQtdInsumo = (id: string, qtd: number) =>
    onChange({ ...grupo, insumos: grupo.insumos.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i) });

  const addProduto = (produtoId: string) =>
    onChange({ ...grupo, produtos: [...grupo.produtos, produtoId] });

  const removeProduto = (produtoId: string) =>
    onChange({ ...grupo, produtos: grupo.produtos.filter(id => id !== produtoId) });

  return (
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-orange-100 pb-3">
        <Package size={16} className="text-orange-500 shrink-0" />
        {editingName ? (
          <input
            autoFocus value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(grupo.nome); } }}
            className="flex-1 text-sm font-bold border-b-2 border-orange-400 outline-none bg-transparent py-0.5"
          />
        ) : (
          <span className="flex-1 text-sm font-bold text-gray-800">{grupo.nome}</span>
        )}
        <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-orange-500 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Produtos */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Produtos deste grupo</p>
          <ProdutoSelector produtos={produtos} excludeIds={grupo.produtos} onAdd={addProduto} />
          {grupo.produtos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Nenhum produto vinculado</p>
          ) : (
            <ul className="space-y-1">
              {grupo.produtos.map(pid => {
                const p = produtos.find(pr => pr.id === pid);
                return (
                  <li key={pid} className="flex items-center gap-2 bg-orange-50 px-2.5 py-1.5 rounded-lg">
                    <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                      {p?.nome || <span className="text-red-400 italic">Produto removido</span>}
                    </span>
                    {p?.categoria && <span className="text-xs text-gray-400">{p.categoria}</span>}
                    <button onClick={() => removeProduto(pid)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Insumos / Embalagens */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Insumos descontados no estoque</p>
          <InsumoSelector insumos={insumos} excludeIds={grupo.insumos.map(i => i.insumoId)} onAdd={addInsumo} />
          {grupo.insumos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Nenhum insumo configurado</p>
          ) : (
            <ul className="space-y-1">
              {grupo.insumos.map(item => {
                const insumo = insumos.find(i => i.id === item.insumoId);
                return (
                  <li key={item.insumoId} className="flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                    <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                      {insumo?.nome || <span className="text-red-400 italic">Insumo removido</span>}
                    </span>
                    <input type="number" min={0.01} step={0.01} value={item.quantidade}
                      onChange={e => changeQtdInsumo(item.insumoId, Number(e.target.value))}
                      className="w-14 p-1 border border-gray-200 rounded text-xs text-center bg-white" />
                    <span className="text-xs text-gray-400 w-8 shrink-0">{insumo?.unidade || ''}</span>
                    <button onClick={() => removeInsumo(item.insumoId)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manager principal ─────────────────────────────────────────────────────────
export default function EmbalagensPadraoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [delivery, setDelivery] = useState<EmbalagemItem[]>([]);
  const [salao, setSalao] = useState<EmbalagemItem[]>([]);
  const [grupos, setGrupos] = useState<Record<string, GrupoData>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [addingGrupo, setAddingGrupo] = useState(false);

  useEffect(() => {
    const toArr = (val: any): EmbalagemItem[] => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : Object.values(val);
      return (arr as any[]).filter(Boolean);
    };

    const unsubs = [
      onValue(ref(db, 'insumos'), snap => {
        const data = snap.val();
        if (data) {
          const list: Insumo[] = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          setInsumos(list);
        }
      }),
      onValue(ref(db, 'produtos'), snap => {
        const data = snap.val();
        if (data) {
          const list: Produto[] = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          setProdutos(list);
        }
      }),
      onValue(ref(db, 'configuracoes/embalagens_padrao'), snap => {
        const data = snap.val();
        if (data) {
          setDelivery(toArr(data.delivery));
          setSalao(toArr(data.salao));
          if (data.grupos && typeof data.grupos === 'object') {
            const parsed: Record<string, GrupoData> = {};
            for (const [id, g] of Object.entries(data.grupos) as [string, any][]) {
              parsed[id] = {
                nome: g.nome || 'Grupo',
                produtos: Array.isArray(g.produtos) ? g.produtos : g.produtos ? Object.values(g.produtos) : [],
                insumos: toArr(g.insumos),
              };
            }
            setGrupos(parsed);
          }
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await set(ref(db, 'configuracoes/embalagens_padrao'), { delivery, salao, grupos });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const criarGrupo = () => {
    const nome = novoGrupoNome.trim();
    if (!nome) return;
    const id = `grupo_${Date.now()}`;
    setGrupos(prev => ({ ...prev, [id]: { nome, produtos: [], insumos: [] } }));
    setNovoGrupoNome('');
    setAddingGrupo(false);
  };

  const updateGrupo = (id: string, g: GrupoData) => setGrupos(prev => ({ ...prev, [id]: g }));
  const deleteGrupo = (id: string) => setGrupos(prev => { const n = { ...prev }; delete n[id]; return n; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-800">Embalagens Padrão</h3>
          <p className="text-sm text-gray-500 mt-1">
            Insumos adicionados automaticamente por canal de venda e por grupo de produto.
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

      {/* Delivery / Salão */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Por canal de venda</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard label="Delivery (/)" icon={<Truck size={16} className="mr-2 text-blue-500" />}
            items={delivery} insumos={insumos}
            onAdd={(id, qtd) => setDelivery(prev => [...prev, { insumoId: id, quantidade: qtd }])}
            onRemove={id => setDelivery(prev => prev.filter(i => i.insumoId !== id))}
            onChangeQtd={(id, qtd) => setDelivery(prev => prev.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i))}
          />
          <SectionCard label="Salão (%)" icon={<Store size={16} className="mr-2 text-green-500" />}
            items={salao} insumos={insumos}
            onAdd={(id, qtd) => setSalao(prev => [...prev, { insumoId: id, quantidade: qtd }])}
            onRemove={id => setSalao(prev => prev.filter(i => i.insumoId !== id))}
            onChangeQtd={(id, qtd) => setSalao(prev => prev.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i))}
          />
        </div>
      </div>

      {/* Grupos de produto */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Grupos de produto</p>
          {!addingGrupo && (
            <button
              onClick={() => setAddingGrupo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
            >
              <Plus size={13} /> Novo Grupo
            </button>
          )}
        </div>

        {addingGrupo && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text"
              value={novoGrupoNome}
              onChange={e => setNovoGrupoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') criarGrupo(); if (e.key === 'Escape') { setAddingGrupo(false); setNovoGrupoNome(''); } }}
              placeholder="Nome do grupo (ex: Sanduíche, Porção, Bebidas...)"
              className="flex-1 border border-orange-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button onClick={criarGrupo} disabled={!novoGrupoNome.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors">
              Criar
            </button>
            <button onClick={() => { setAddingGrupo(false); setNovoGrupoNome(''); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              <X size={15} />
            </button>
          </div>
        )}

        {Object.keys(grupos).length === 0 && !addingGrupo ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <Package size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">Nenhum grupo cadastrado</p>
            <p className="text-xs text-gray-400 mt-1">Crie grupos para definir quais insumos são descontados por tipo de produto</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grupos).map(([id, grupo]) => (
              <GrupoCard
                key={id}
                grupo={grupo}
                insumos={insumos}
                produtos={produtos}
                onChange={g => updateGrupo(id, g)}
                onDelete={() => deleteGrupo(id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Os grupos de produto definem quais insumos são descontados do estoque ao vender produtos de cada categoria.
          Os canais Delivery e Salão adicionam insumos de embalagem automaticamente ao criar SKUs.
        </p>
      </div>
    </div>
  );
}
