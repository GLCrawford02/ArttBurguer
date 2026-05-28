import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, runTransaction, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo, Produto, IngredienteReceita } from '../types';
import { Plus, Trash2, Save, Calculator, ShoppingCart, Search, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Pencil, Download, Upload, Sparkles, Bot, Loader2, X, Settings, ChevronUp as ChevronUpIcon, ChevronDown as ChevronDownIcon, Copy, Filter, Eye, EyeOff } from 'lucide-react';
import React from 'react';
import ModalProduto from './ModalProduto';
import ExcelJS from 'exceljs';

export default function ProdutosManager({ currentUser, temPermissao }: { currentUser?: any, temPermissao?: any }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  
  const [categoriasDb, setCategoriasDb] = useState<{id: string, nome: string}[]>([]);
  const [novaCategoriaImagemForm, setNovaCategoriaImagemForm] = useState('');
  const [embalagensPadrao, setEmbalagensPadrao] = useState<{ delivery: {insumoId: string, quantidade: number}[], salao: {insumoId: string, quantidade: number}[] }>({ delivery: [], salao: [] });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editProduto, setEditProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [activeManagerTab, setActiveManagerTab] = useState<'lista' | 'organizacao'>('lista');

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const canEdit = temPermissao ? temPermissao('produtos', 'aba_cardapio', 'editar') : true;
  const canDelete = temPermissao ? temPermissao('produtos', 'aba_cardapio', 'apagar') : true;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [expandedProdutoId, setExpandedProdutoId] = useState<string | null>(null);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const produtosRef = ref(db, 'produtos');
    const categoriasRef = ref(db, 'categorias_produtos');

    const unsubInsumos = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInsumos(list);
      }
    });

    const unsubProdutos = onValue(produtosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
          list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutos(list);
      } else {
        setProdutos([]);
      }
      setLoading(false);
    });

    const unsubCategorias = onValue(categoriasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCategoriasDb(list);
      } else {
        setCategoriasDb([]);
      }
    });

    const toArr = (val: any) => {
      if (!val) return [];
      const arr = Array.isArray(val) ? val : Object.values(val);
      return (arr as any[]).filter(Boolean);
    };
    const unsubEmbalagens = onValue(ref(db, 'configuracoes/embalagens_padrao'), snap => {
      const data = snap.val();
      if (data) setEmbalagensPadrao({ delivery: toArr(data.delivery), salao: toArr(data.salao) });
    });

    return () => {
      unsubInsumos();
      unsubProdutos();
      unsubCategorias();
      unsubEmbalagens();
    };
  }, []);

  const handleEdit = (produto: Produto) => {
    setEditProduto(produto);
    setShowForm(true);
  };

  const handleDuplicate = (produto: Produto) => {
    const copia = { ...produto, nome: `${produto.nome} (Cópia)` };
    delete (copia as any).id;
    setEditProduto(copia);
    setShowForm(true);
  };

  const excluirProduto = async (id: string) => {
    if (confirm('Deseja excluir este produto?')) {
      await remove(ref(db, `produtos/${id}`));
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

  const filteredProdutos = produtos.filter(p => {
    const matchName = (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategoria ? ((p as any).categoria || 'Outros') === selectedCategoria : true;
    return matchName && matchCat;
  });

  const sortedProdutos = [...filteredProdutos].sort((a, b) => {
    if (!sortConfig) return a.nome.localeCompare(b.nome);
    const { key, direction } = sortConfig;
    let valA: any = ''; let valB: any = '';

    if (key === 'nome') { valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase(); }
    else if (key === 'categoria') { valA = ((a as any).categoria || '').toLowerCase(); valB = ((b as any).categoria || '').toLowerCase(); }
    else if (key === 'custo') { valA = Number(a.custoTotal || 0); valB = Number(b.custoTotal || 0); }
    else if (key === 'venda') { valA = Number((a as any).precoVenda || 0); valB = Number((b as any).precoVenda || 0); }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const embalagensNecessarias = [
    'Palito Golf', 'Papel acoplado', 'Papel laminado', 'CH3', 'Lacre',
    'Adesivo nominal', 'Sacola', 'Sache Ketchup', 'Sache Maionese', 'Guardanapo'
  ];
  const insumosFaltantes = embalagensNecessarias.filter(nome => !insumos.some(i => (i.nome || '').trim().toLowerCase() === nome.trim().toLowerCase()));

  const exportarProdutos = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Produtos');

    const LARANJA = 'FFFF6B00';
    const CINZA_HEADER = 'FF374151';
    const BRANCO = 'FFFFFFFF';
    const CINZA_CLARO = 'FFF9FAFB';
    const CINZA_LINHA = 'FFE5E7EB';

    ws.mergeCells('A1:E1');
    const titulo = ws.getCell('A1');
    titulo.value = '🍔 ArttBurger — Relatório de Produtos';
    titulo.font = { bold: true, size: 14, color: { argb: BRANCO } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.mergeCells('A2:E2');
    const subtitulo = ws.getCell('A2');
    subtitulo.value = `Gerado em ${new Date().toLocaleString('pt-BR')} · ${produtos.length} produtos`;
    subtitulo.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
    subtitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    subtitulo.alignment = { horizontal: 'center' };
    ws.getRow(2).height = 18;

    ws.addRow([]);

    const colunas = [
      { header: 'Nome', key: 'nome', width: 35 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Preço Venda (R$)', key: 'venda', width: 20 },
      { header: 'Custo Total (R$)', key: 'custo', width: 20 },
      { header: 'Ingredientes (Nome:Qtd)', key: 'ingredientes', width: 50 },
    ];
    ws.columns = colunas;

    const headerRow = ws.getRow(4);
    colunas.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: BRANCO }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: LARANJA } } };
    });
    headerRow.height = 28;

    produtos.forEach((p, idx) => {
      const ingStr = (p.ingredientes || []).map(ing => {
        const insumo = insumos.find(i => i.id === ing.insumoId);
        return `${insumo?.nome || 'Desconhecido'}: ${ing.quantidade}`;
      }).join(' | ');

      const row = ws.addRow([
        p.nome,
        (p as any).categoria || 'Outros',
        (p as any).precoVenda || 0,
        p.custoTotal || 0,
        ingStr
      ]);

      const bgColor = idx % 2 === 0 ? BRANCO : CINZA_CLARO;
      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = { bottom: { style: 'thin', color: { argb: CINZA_LINHA } } };
        cell.alignment = { vertical: 'middle' };
        if (c === 3 || c === 4) {
          cell.numFmt = '"R$ "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (c === 3) cell.font = { bold: true, color: { argb: 'FF059669' } };
          if (c === 4) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
        }
      }
    });

    ws.autoFilter = { from: 'A4', to: 'E4' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `produtos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return showToast('Arquivo CSV vazio ou sem dados.', 'error');

        let adicionados = 0;
        let atualizados = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(';');
          if (row.length < 3) continue;

          const nome = row[0]?.trim();
          if (!nome) continue;

          const categoria = row[1]?.trim() || 'Outros'; // Default to 'Outros' if CSV doesn't provide a category
          const precoVenda = Number(row[2]?.trim().replace(',', '.')) || 0;
          const ingredientesStr = row[4]?.trim() || '';

          const ingredientesParaSalvar: IngredienteReceita[] = [];
          if (ingredientesStr) {
            const ingList = ingredientesStr.split('|');
            for (const item of ingList) {
              const parts = item.split(':');
              if (parts.length >= 2) {
                const ingNome = parts[0].trim();
                const ingQtd = Number(parts[1].trim().replace(',', '.'));
                const insumoEncontrado = insumos.find(ins => (ins.nome || '').toLowerCase().trim() === ingNome.toLowerCase());
                if (insumoEncontrado && !isNaN(ingQtd)) {
                  ingredientesParaSalvar.push({ insumoId: insumoEncontrado.id, quantidade: ingQtd });
                }
              }
            }
          }

          const custoTotal = ingredientesParaSalvar.reduce((acc, ing) => {
            const insumo = insumos.find(ins => ins.id === ing.insumoId);
            if (!insumo) return acc;
            return acc + ((insumo.precoPacote / (insumo.qtdPacote || 1)) * ing.quantidade);
          }, 0);

          const produtoData = { nome, categoria, precoVenda, custoTotal, ingredientes: ingredientesParaSalvar };
          const produtoExistente = produtos.find(p => (p.nome || '').toLowerCase().trim() === nome.toLowerCase());

          if (produtoExistente) {
            await update(ref(db, `produtos/${produtoExistente.id}`), produtoData);
            atualizados++;
          } else {
            await set(push(ref(db, 'produtos')), produtoData);
            adicionados++;
          }
        }
        showToast(`Sucesso! ${adicionados} adicionados e ${atualizados} atualizados.`, 'success');
      } catch (error: any) {
        showToast('Erro ao importar: ' + error.message, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Base de Produtos</h2>
        {canEdit && (
          <button onClick={() => { setEditProduto(null); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center">
            <Plus size={20} className="mr-2" /> Novo Produto
          </button>
        )}
      </div>

      <ModalProduto 
        isOpen={showForm} 
        onClose={() => { setShowForm(false); setEditProduto(null); }} 
        produtoEdit={editProduto} 
        insumos={insumos} 
        produtos={produtos} 
        categoriasDb={categoriasDb} 
        showToast={showToast}
        embalagensPadrao={embalagensPadrao}
      />

      <div className="flex bg-gray-200 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveManagerTab('lista')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeManagerTab === 'lista' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Lista de Produtos</button>
        <button onClick={() => setActiveManagerTab('organizacao')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeManagerTab === 'organizacao' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Organização e Visibilidade</button>
      </div>

      {activeManagerTab === 'lista' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <ShoppingCart className="mr-2 text-blue-600" size={20} />
              Produtos Cadastrados
            </h3>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button onClick={exportarProdutos} className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
              <Download size={14} className="mr-1" /> Exportar CSV
            </button>
            {canEdit && (
              <>
                <label htmlFor="import-csv-produtos" className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center cursor-pointer mb-2 sm:mb-0">
                  <Upload size={14} className="mr-1" /> Importar CSV
                </label>
                <input type="file" accept=".csv" id="import-csv-produtos" className="hidden" onChange={handleFileUpload} />
              </>
            )}
            <div className="relative w-full sm:w-auto flex items-center space-x-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-48 bg-white appearance-none"
                >
                  <option value="">Todas as Categorias</option>
                  {categoriasDb.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  <option value="Outros">Outros</option>
                </select>
                <ChevronDownIcon size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
                />
              </div>
            </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 z-10 shadow-sm bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase font-bold tracking-wider select-none">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('nome')}>
                    <div className="flex items-center">Produto {sortConfig?.key === 'nome' ? (sortConfig.direction === 'asc' ? <ChevronUpIcon size={14} className="ml-1"/> : <ChevronDownIcon size={14} className="ml-1"/>) : ''}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('categoria')}>
                    <div className="flex items-center">Categoria {sortConfig?.key === 'categoria' ? (sortConfig.direction === 'asc' ? <ChevronUpIcon size={14} className="ml-1"/> : <ChevronDownIcon size={14} className="ml-1"/>) : ''}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('custo')}>
                    <div className="flex items-center">Custo {sortConfig?.key === 'custo' ? (sortConfig.direction === 'asc' ? <ChevronUpIcon size={14} className="ml-1"/> : <ChevronDownIcon size={14} className="ml-1"/>) : ''}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('venda')}>
                    <div className="flex items-center">Preço Venda {sortConfig?.key === 'venda' ? (sortConfig.direction === 'asc' ? <ChevronUpIcon size={14} className="ml-1"/> : <ChevronDownIcon size={14} className="ml-1"/>) : ''}</div>
                  </th>
                  <th className="px-6 py-4 text-center">Ficha Técnica</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              {loading ? (
                <tbody>{[...Array(5)].map((_, i) => (<tr key={i} className="animate-pulse"><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td></tr>))}</tbody>
              ) : (
              <tbody className="divide-y divide-gray-100 text-sm">
                {sortedProdutos.map(p => (
                  <React.Fragment key={p.id}>
                  <tr className={`transition-colors ${p.oculto ? 'bg-red-50/20' : 'hover:bg-gray-50'}`}>
                    <td className={`px-6 py-4 font-bold ${p.oculto ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{p.nome}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full uppercase">{((p as any).categoria) || 'Outros'}</span>
                    </td>
                    <td className="px-6 py-4 text-red-500 font-bold">R$ {(p.custoTotal || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-green-600 font-bold">R$ {((p as any).precoVenda || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setExpandedProdutoId(expandedProdutoId === p.id ? null : p.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center transition-colors mx-auto"
                      >
                        {(p.ingredientes || []).length} Insumos {expandedProdutoId === p.id ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 flex justify-end space-x-2">
                      {canEdit && <button onClick={() => update(ref(db, `produtos/${p.id}`), { oculto: !p.oculto })} className={`p-2 rounded-lg transition-colors ${p.oculto ? 'text-green-500 hover:bg-green-100' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`} title={p.oculto ? 'Mostrar Produto' : 'Ocultar Produto no PDV'}>{p.oculto ? <Eye size={18}/> : <EyeOff size={18}/>}</button>}
                      {canEdit && <button onClick={() => handleDuplicate(p)} className="p-2 text-purple-500 hover:bg-purple-100 rounded-lg transition-colors" title="Duplicar Produto"><Copy size={18} /></button>}
                      {canEdit && <button onClick={() => handleEdit(p)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors" title="Editar Produto"><Pencil size={18} /></button>}
                      {canDelete && <button onClick={() => excluirProduto(p.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Excluir Produto"><Trash2 size={18} /></button>}
                    </td>
                  </tr>
                  {expandedProdutoId === p.id && (
                    <tr className="bg-gray-50">
                  <td colSpan={6} className="px-6 py-4 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Composição da Ficha Técnica:</p>
                        <ul className="space-y-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(p.ingredientes || []).map((ing, idx) => {
                            const insumo = insumos.find(i => i.id === ing.insumoId);
                            return (<li key={idx} className="text-sm flex justify-between bg-white p-2 rounded border border-gray-100"><span className="text-gray-700">{insumo?.nome || 'Insumo não encontrado'}</span><span className="text-gray-500 font-bold">{ing.quantidade} {insumo?.unidade || ''}</span></li>);
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {sortedProdutos.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">Nenhum produto encontrado.</td></tr>}
              </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {activeManagerTab === 'organizacao' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Filter className="mr-2 text-blue-500" /> Organização do Cardápio
          </h3>
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
                   {produtos.filter(p => ((p as any).categoria || 'Outros') === cat.nome).length === 0 && (
                     <p className="text-sm text-gray-400 italic text-center py-2">Nenhum produto nesta categoria.</p>
                   )}
                 </div>
               </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
