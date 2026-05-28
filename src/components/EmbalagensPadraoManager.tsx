import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto } from '../types';
import { Truck, Store, Plus, Trash2, Save, Search, CheckCircle, AlertTriangle, Package, X, Pencil, Tag } from 'lucide-react';

interface EmbalagemItem {
  insumoId: string;
  quantidade: number;
}

export interface GrupoData {
  nome: string;
  categorias: string[];
  delivery: EmbalagemItem[];
  salao: EmbalagemItem[];
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

// ─── Seletor de categoria reutilizável ────────────────────────────────────────
function CategoriaSelector({
  categorias,
  excludeNomes,
  onAdd,
}: {
  categorias: string[];
  excludeNomes: string[];
  onAdd: (categoria: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = categorias.filter(
    c => c.toLowerCase().includes(search.toLowerCase()) && !excludeNomes.includes(c)
  );

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-orange-400">
        <Tag size={13} className="ml-2 text-gray-400 shrink-0" />
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full p-1.5 outline-none text-sm bg-transparent"
          placeholder="Adicionar categoria..."
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
          {filtered.map(c => (
            <div key={c} onMouseDown={() => { onAdd(c); setSearch(''); setOpen(false); }}
              className="p-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0">
              <span className="font-medium">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de grupo com Delivery / Mesa separados ───────────────────────────────
function GrupoCard({
  grupo, insumos, categorias, onChange, onDelete,
}: {
  grupo: GrupoData;
  insumos: Insumo[];
  categorias: string[];
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

  const addCategoria = (nome: string) => onChange({ ...grupo, categorias: [...(grupo.categorias || []), nome] });
  const removeCategoria = (nome: string) => onChange({ ...grupo, categorias: (grupo.categorias || []).filter(c => c !== nome) });

  const addD = (id: string, qtd: number) => onChange({ ...grupo, delivery: [...grupo.delivery, { insumoId: id, quantidade: qtd }] });
  const removeD = (id: string) => onChange({ ...grupo, delivery: grupo.delivery.filter(i => i.insumoId !== id) });
  const changeQtdD = (id: string, qtd: number) => onChange({ ...grupo, delivery: grupo.delivery.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i) });

  const addS = (id: string, qtd: number) => onChange({ ...grupo, salao: [...grupo.salao, { insumoId: id, quantidade: qtd }] });
  const removeS = (id: string) => onChange({ ...grupo, salao: grupo.salao.filter(i => i.insumoId !== id) });
  const changeQtdS = (id: string, qtd: number) => onChange({ ...grupo, salao: grupo.salao.map(i => i.insumoId === id ? { ...i, quantidade: qtd } : i) });

  const renderInsumos = (
    items: EmbalagemItem[],
    onRemove: (id: string) => void,
    onChangeQtd: (id: string, qtd: number) => void,
    bgClass: string
  ) =>
    items.length === 0 ? (
      <p className="text-xs text-gray-400 text-center py-2">Nenhum insumo configurado</p>
    ) : (
      <ul className="space-y-1">
        {items.map(item => {
          const ins = insumos.find(i => i.id === item.insumoId);
          return (
            <li key={item.insumoId} className={`flex items-center gap-2 ${bgClass} px-2.5 py-1.5 rounded-lg`}>
              <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                {ins?.nome || <span className="text-red-400 italic">Insumo removido</span>}
              </span>
              <input type="number" min={0.01} step={0.01} value={item.quantidade}
                onChange={e => onChangeQtd(item.insumoId, Number(e.target.value))}
                className="w-14 p-1 border border-gray-200 rounded text-xs text-center bg-white" />
              <span className="text-xs text-gray-400 w-8 shrink-0">{ins?.unidade || ''}</span>
              <button onClick={() => onRemove(item.insumoId)} className="text-red-400 hover:text-red-600 shrink-0">
                <Trash2 size={13} />
              </button>
            </li>
          );
        })}
      </ul>
    );

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

      {/* Categorias */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Categorias deste grupo</p>
        <CategoriaSelector categorias={categorias} excludeNomes={grupo.categorias || []} onAdd={addCategoria} />
        {(grupo.categorias || []).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Nenhuma categoria vinculada</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(grupo.categorias || []).map(cat => (
              <span key={cat} className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-medium px-2.5 py-1 rounded-full">
                {cat}
                <button onClick={() => removeCategoria(cat)} className="text-orange-400 hover:text-red-500 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Insumos split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
        <div className="space-y-2">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
            <Truck size={12} /> Delivery
          </p>
          <InsumoSelector insumos={insumos} excludeIds={grupo.delivery.map(i => i.insumoId)} onAdd={addD} />
          {renderInsumos(grupo.delivery, removeD, changeQtdD, 'bg-blue-50')}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wide flex items-center gap-1">
            <Store size={12} /> Mesa / Salão
          </p>
          <InsumoSelector insumos={insumos} excludeIds={grupo.salao.map(i => i.insumoId)} onAdd={addS} />
          {renderInsumos(grupo.salao, removeS, changeQtdS, 'bg-green-50')}
        </div>
      </div>
    </div>
  );
}

// ─── Manager principal ─────────────────────────────────────────────────────────
export default function EmbalagensPadraoManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<Record<string, GrupoData>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [addingGrupo, setAddingGrupo] = useState(false);

  const categoriasDisponiveis = Array.from(
    new Set(produtos.map(p => (p as any).categoria).filter(Boolean))
  ).sort() as string[];

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
      onValue(ref(db, 'configuracoes/embalagens_padrao/grupos'), snap => {
        const data = snap.val();
        if (data && typeof data === 'object') {
          const parsed: Record<string, GrupoData> = {};
          for (const [id, g] of Object.entries(data) as [string, any][]) {
            parsed[id] = {
              nome: g.nome || 'Grupo',
              categorias: Array.isArray(g.categorias) ? g.categorias : g.categorias ? Object.values(g.categorias) : [],
              delivery: toArr(g.delivery),
              salao: toArr(g.salao),
            };
          }
          setGrupos(parsed);
        } else {
          setGrupos({});
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await set(ref(db, 'configuracoes/embalagens_padrao/grupos'), grupos);
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
    setGrupos(prev => ({ ...prev, [id]: { nome, categorias: [], delivery: [], salao: [] } }));
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
            Agrupe categorias e defina quais insumos de embalagem são descontados — separados por Delivery e Mesa/Salão.
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

      {/* Grupos */}
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
              placeholder="Nome do grupo (ex: Hamburguer, Fritas, Bebidas...)"
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
            <p className="text-xs text-gray-400 mt-1">Crie um grupo, adicione as categorias e configure as embalagens para Delivery e Mesa</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grupos).map(([id, grupo]) => (
              <GrupoCard
                key={id}
                grupo={grupo}
                insumos={insumos}
                categorias={categoriasDisponiveis}
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
          Ao enviar um pedido para a cozinha, o sistema identifica a categoria de cada produto, encontra o grupo correspondente e desconta automaticamente os insumos de embalagem do estoque rotativo — usando a coluna <strong>Delivery</strong> para pedidos de entrega e <strong>Mesa/Salão</strong> para os demais.
        </p>
      </div>
    </div>
  );
}
