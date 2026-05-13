import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Package, Search, Trash2, CheckCircle, AlertTriangle, Pencil, Sparkles, Bot, Loader2, X, Plus, RefreshCw, Link as LinkIcon, ChevronUp, ChevronDown } from 'lucide-react';

export default function InsumosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editId, setEditId] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [unidade, setUnidade] = useState('g');
  const [isVariavel, setIsVariavel] = useState(false);
  const [precoPacote, setPrecoPacote] = useState('0');
  const [qtdPacote, setQtdPacote] = useState('1');
  const [diasAvisoValidade, setDiasAvisoValidade] = useState('7');
  const [alertaMinimo, setAlertaMinimo] = useState('');
  const [estoqueMaximo, setEstoqueMaximo] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [tipoUso, setTipoUso] = useState('');
  const [searchTipoUso, setSearchTipoUso] = useState('');
  const [showTipoUsoDropdown, setShowTipoUsoDropdown] = useState(false);
  const [insumoVinculado, setInsumoVinculado] = useState('');
  const [searchInsumoVinculado, setSearchInsumoVinculado] = useState('');
  const [showInsumoVinculadoDropdown, setShowInsumoVinculadoDropdown] = useState(false);

  const [filtroTipoUso, setFiltroTipoUso] = useState('');

  const [tiposUsoDb, setTiposUsoDb] = useState<{id: string, nome: string}[]>([]);
  const [showTiposModal, setShowTiposModal] = useState(false);
  const [novoTipoForm, setNovoTipoForm] = useState('');

  const [cadastroMode, setCadastroMode] = useState<'manual' | 'ia'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsub = onValue(insumosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setInsumos(list);
      } else {
        setInsumos([]);
      }
      setLoading(false);
    });
    
    const tiposRef = ref(db, 'tipos_uso');
    const unsubTipos = onValue(tiposRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setTiposUsoDb(list);
      } else {
        setTiposUsoDb([]);
      }
    });

    return () => { unsub(); unsubTipos(); };
  }, []);

  const generateSku = (name: string): string => {
    if (!name) return '';
    
    // Pega o nome exato, converte para minúsculas e remove tudo que não for letra ou número
    const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return `#${baseName.substring(0, 19)}`; // Máximo 20 caracteres (incluindo a #)
  };

  useEffect(() => {
    if (nome && !editId) {
      setSku(generateSku(nome));
    } else if (!nome && !editId) {
      setSku('');
    }
  }, [nome, editId]);

  const handleAddTipo = async () => {
    if (!novoTipoForm.trim()) return;
    await set(push(ref(db, 'tipos_uso')), { nome: novoTipoForm.trim() });
    setNovoTipoForm('');
  };

  const handleDeleteTipo = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este tipo de uso?')) {
      await remove(ref(db, `tipos_uso/${id}`));
    }
  };

  const handlePadronizarSkus = async () => {
    if (!window.confirm('Deseja padronizar os SKUs de todos os insumos existentes?')) return;
    
    let atualizados = 0;
    setLoading(true);
    try {
      const promessas = insumos.map(async (insumo) => {
        const novoSku = generateSku(insumo.nome);
        if ((insumo as any).sku !== novoSku) {
          await update(ref(db, `insumos/${insumo.id}`), { sku: novoSku });
          atualizados++;
        }
      });
      await Promise.all(promessas);
      showToast(`${atualizados} SKUs foram padronizados com sucesso!`, 'success');
    } catch (error: any) {
      showToast('Erro ao padronizar SKUs: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSincronizarCustos = async () => {
    if (!window.confirm('Deseja sincronizar os custos de todos os insumos vinculados? Isso repassará o custo em cascata para todas as quebras (Caixa -> Pacote -> Unidade).')) return;
    
    setLoading(true);
    try {
      const insumosLocais = JSON.parse(JSON.stringify(insumos));
      const updatesToApply: Record<string, any> = {};
      let hasChanges = true;

      while (hasChanges) {
        hasChanges = false;
        for (const insumo of insumosLocais) {
          const linkedId = insumo.insumoVinculado;
          if (linkedId) {
            const linkedInsumo = insumosLocais.find((i: any) => i.id === linkedId);
            if (linkedInsumo) {
              const novoPreco = Number((insumo.precoPacote / (insumo.qtdPacote || 1)).toFixed(4));
              if (linkedInsumo.precoPacote !== novoPreco) {
                linkedInsumo.precoPacote = novoPreco;
                updatesToApply[linkedId] = novoPreco;
                hasChanges = true;
              }
            }
          }
        }
      }

      if (Object.keys(updatesToApply).length > 0) {
        const promessas = Object.entries(updatesToApply).map(async ([id, novoPreco]) => {
          await update(ref(db, `insumos/${id}`), { precoPacote: novoPreco });
        });
        await Promise.all(promessas);
      }

      showToast(`${Object.keys(updatesToApply).length} insumos tiveram seus custos sincronizados em cascata!`, 'success');
    } catch (error: any) {
      showToast('Erro ao sincronizar custos: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    const missingFields = [];
    if (!nome) missingFields.push('Nome do Insumo');
    if (!unidade) missingFields.push('Unidade de Medida');
    if (!qtdPacote) missingFields.push('Qtd. na Embalagem');
    if (!alertaMinimo) missingFields.push('Estoque Mínimo');

    if (missingFields.length > 0) {
      showToast(`Preencha os campos obrigatórios:\n- ${missingFields.join('\n- ')}`, 'error');
      return;
    }

    const duplicado = insumos.find(i => {
      if (i.id === editId) return false;
      const iNome = (i.nome || '').trim().toLowerCase();
      const iSku = ((i as any).sku || '').trim().toLowerCase();
      return iNome === nome.trim().toLowerCase() || (sku && iSku === sku.trim().toLowerCase());
    });

    if (duplicado) {
      showToast('Já existe um insumo cadastrado com este nome ou SKU.', 'error');
      return;
    }

    const finalSku = sku || generateSku(nome);

    if (editId) {
      const updateData: any = {
        nome,
        sku: finalSku,
        unidade,
        precoPacote: Number(precoPacote),
        qtdPacote: Number(qtdPacote),
        diasAvisoValidade: Number(diasAvisoValidade),
        alertaMinimo: Number(alertaMinimo),
        estoqueMaximo: estoqueMaximo ? Number(estoqueMaximo) : null,
        tipoUso: tipoUso,
        insumoVinculado: insumoVinculado || null,
        isVariavel,
      };

      await update(ref(db, `insumos/${editId}`), updateData);
      showToast('Insumo atualizado com sucesso!', 'success');
      setEditId(null);
    } else {
      const newInsumoRef = push(ref(db, 'insumos'));
      await set(newInsumoRef, {
        nome,
        sku: finalSku,
        unidade,
        precoPacote: Number(precoPacote),
        qtdPacote: Number(qtdPacote),
        diasAvisoValidade: Number(diasAvisoValidade),
        alertaMinimo: Number(alertaMinimo),
        estoqueMaximo: estoqueMaximo ? Number(estoqueMaximo) : null,
        tipoUso: tipoUso,
        insumoVinculado: insumoVinculado || null,
        estoqueRotativo: 0,
        isVariavel,
        estoqueEstacionario: estoqueAtual ? Number(estoqueAtual) : 0,
      });
      showToast('Insumo salvo com sucesso!', 'success');
    }


    setNome('');
    setSku('');
    setUnidade('g');
    setPrecoPacote('0');
    setQtdPacote('1');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
    setTipoUso('');
    setSearchTipoUso('');
    setShowForm(false);
  };

  const handleCadastroIA = async () => {
    if (!aiPrompt.trim()) {
      showToast('Preencha os dados dos insumos que deseja cadastrar.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey}`
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          stream: false,
          messages: [
            {
              role: 'system',
              content: `Você é um assistente de cadastro de estoque. Extraia os insumos do texto do usuário, onde cada linha representa um insumo com os valores separados por vírgula na seguinte ordem:
Nome, SKU, Preço Médio (Embalagem), Qtd na embalagem, Unidade de Medida, Estoque mínimo, Estoque máximo, Estoque atual, Tipo de uso.
Não inclua crases, formatação markdown ou texto adicional, apenas o array JSON.
Formato esperado para cada objeto:
[{
  "nome": "Nome do Insumo",
  "sku": "SKU (se omitido ou em branco, deixe vazio)",
  "unidade": "g" | "kg" | "ml" | "L" | "un" | "cx" | "fd" | "pc",
  "precoPacote": numero (preço de compra em reais da caixa/unidade),
  "qtdPacote": numero (quantidade na embalagem),
  "alertaMinimo": numero (estoque mínimo),
  "estoqueMaximo": numero (estoque máximo, opcional),
  "estoqueAtual": numero (estoque atual, opcional),
  "tipoUso": "texto" (opcional, ex: Matéria prima, Embalagem, Produto final),
  "isVariavel": boolean (opcional, true se zera e substitui o rotativo na transferência)
}]`
            },
            {
              role: 'user',
              content: aiPrompt
            }
          ]
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Detalhes do erro xAI:', data);
        throw new Error(data.error?.message || data.message || JSON.stringify(data) || 'Erro na API da IA');
      }
      
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('Resposta inválida da IA.');

      const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const insumosExtraidos = JSON.parse(cleanJson);
      if (!Array.isArray(insumosExtraidos)) throw new Error('Formato retornado não é um array.');

      let adicionados = 0;
      let atualizados = 0;

      for (const item of insumosExtraidos) {
        let existingInsumo;
        if (item.sku) {
          existingInsumo = insumos.find(i => ((i as any).sku || '').toLowerCase() === item.sku.toLowerCase());
        } else {
          existingInsumo = insumos.find(i => (i.nome || '').toLowerCase().trim() === (item.nome || '').toLowerCase().trim());
        }

        const finalSku = (item.sku ? String(item.sku).substring(0, 20) : null) || (existingInsumo ? (existingInsumo as any).sku : generateSku(item.nome || 'INSUMO'));

        if (existingInsumo) {
          const isBulk = ['pc', 'fd', 'kg', 'L', 'cx'].includes(item.unidade || existingInsumo.unidade);
          const updateData: any = {
            nome: item.nome || existingInsumo.nome,
            sku: finalSku,
            unidade: item.unidade || existingInsumo.unidade,
            precoPacote: item.precoPacote !== undefined ? Number(item.precoPacote) : existingInsumo.precoPacote,
            qtdPacote: item.qtdPacote !== undefined ? Number(item.qtdPacote) : existingInsumo.qtdPacote,
            alertaMinimo: item.alertaMinimo !== undefined ? Number(item.alertaMinimo) : existingInsumo.alertaMinimo,
          };
          if (item.estoqueMaximo) updateData.estoqueMaximo = Number(item.estoqueMaximo);
          if (item.estoqueAtual) updateData.estoqueEstacionario = (existingInsumo.estoqueEstacionario || 0) + Number(item.estoqueAtual);
          if (item.tipoUso) updateData.tipoUso = item.tipoUso;
          if (item.isVariavel !== undefined) updateData.isVariavel = !!item.isVariavel;
          if (!isBulk) updateData.insumoVinculado = null;
          
          await update(ref(db, `insumos/${existingInsumo.id}`), updateData);
          atualizados++;
        } else {
          const isBulk = ['pc', 'fd', 'kg', 'L', 'cx'].includes(item.unidade || 'un');
          await set(push(ref(db, 'insumos')), {
            nome: item.nome || 'Sem Nome',
            sku: finalSku,
            unidade: item.unidade || 'un',
            precoPacote: Number(item.precoPacote) || 0,
            qtdPacote: Number(item.qtdPacote) || 1,
            diasAvisoValidade: 7,
            alertaMinimo: Number(item.alertaMinimo) || 5,
            estoqueMaximo: item.estoqueMaximo ? Number(item.estoqueMaximo) : null,
            tipoUso: item.tipoUso || '',
            insumoVinculado: null,
            isVariavel: !!item.isVariavel,
            estoqueRotativo: 0,
            estoqueEstacionario: item.estoqueAtual ? Number(item.estoqueAtual) : 0,
          });
          adicionados++;
        }
      }
      
      showToast(`Sucesso! ${adicionados} cadastrados e ${atualizados} atualizados pela IA.`, 'success');
      setAiPrompt('');
      setCadastroMode('manual');
      setShowForm(false);
    } catch (error: any) {
      showToast('Erro ao processar com IA: ' + error.message, 'error');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
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
    setTipoUso((insumo as any).tipoUso || '');
    setSearchTipoUso((insumo as any).tipoUso || '');
    setInsumoVinculado((insumo as any).insumoVinculado || '');
    setIsVariavel((insumo as any).isVariavel || false);
    
    const linkedId = (insumo as any).insumoVinculado || '';
    if (linkedId) {
      const vinculado = insumos.find(i => i.id === linkedId);
      setSearchInsumoVinculado(vinculado ? vinculado.nome : '');
    } else {
      setSearchInsumoVinculado('');
    }
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNome('');
    setSku('');
    setUnidade('g');
    setPrecoPacote('0');
    setQtdPacote('1');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
    setIsVariavel(false);
    setTipoUso('');
    setSearchTipoUso('');
    setIsVariavel(false);
    setInsumoVinculado('');
    setSearchInsumoVinculado('');
    setSearchInsumoVinculado('');
    setShowForm(false);
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita.')) {
      await remove(ref(db, `insumos/${id}`));
      showToast('Insumo excluído com sucesso.', 'success');
    }
  };

  const filteredInsumos = insumos.filter(i => {
    const matchSearch = i.nome.toLowerCase().includes(searchTerm.toLowerCase()) || ((i as any).sku && (i as any).sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchTipo = filtroTipoUso ? (i as any).tipoUso === filtroTipoUso : true;
    return matchSearch && matchTipo;
  });

  const sortedInsumos = [...filteredInsumos].sort((a, b) => {
    if (!sortConfig) return a.nome.localeCompare(b.nome);
    const { key, direction } = sortConfig;
    let valA: any = ''; let valB: any = '';

    if (key === 'nome') { valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase(); }
    else if (key === 'sku') { valA = ((a as any).sku || '').toLowerCase(); valB = ((b as any).sku || '').toLowerCase(); }
    else if (key === 'tipo') { valA = ((a as any).tipoUso || '').toLowerCase(); valB = ((b as any).tipoUso || '').toLowerCase(); }
    else if (key === 'custo') { valA = Number(a.precoPacote) / Number(a.qtdPacote || 1); valB = Number(b.precoPacote) / Number(b.qtdPacote || 1); }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Base de Insumos</h2>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button onClick={handleSincronizarCustos} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition-colors shadow-sm flex items-center w-full sm:w-auto justify-center text-sm">
            <LinkIcon size={16} className="mr-2" /> Sincronizar Custos
          </button>
          <button onClick={handlePadronizarSkus} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors shadow-sm flex items-center w-full sm:w-auto justify-center text-sm">
            <RefreshCw size={16} className="mr-2" /> Padronizar SKUs
          </button>
          <button onClick={() => { handleCancelEdit(); setShowForm(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center w-full sm:w-auto justify-center">
            <Plus size={20} className="mr-2" /> Novo Insumo
          </button>
        </div>
      </div>
      
      {showForm && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6 animate-in slide-in-from-top-4 duration-300">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Package className="mr-2 text-green-600" size={20} />
            {editId ? 'Editar Insumo' : 'Novo Insumo'}
          </h3>
          <div className="flex items-center gap-2">
            {!editId && (
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setCadastroMode('manual')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${cadastroMode === 'manual' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Manual</button>
                <button onClick={() => setCadastroMode('ia')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center ${cadastroMode === 'ia' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><Sparkles size={12} className="mr-1"/> IA</button>
              </div>
            )}
            <button onClick={() => { handleCancelEdit(); setShowForm(false); }} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"><X size={20} /></button>
          </div>
        </div>
        
        {cadastroMode === 'manual' || editId ? (
          <div className="space-y-6">
            

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Informações Principais</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="space-y-1 sm:col-span-6">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome do Insumo</label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="Ex: Pão Brioche" />
                  {sku !== generateSku(nome) && nome && (
                    <button type="button" onClick={() => setSku(generateSku(nome))} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center mt-1 transition-colors">
                      <RefreshCw size={10} className="mr-1" /> Padronizar este SKU
                    </button>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Uso</label>
                    <button type="button" onClick={() => setShowTiposModal(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase leading-none pb-0.5">Gerenciar</button>
                  </div>
                  <div className="relative w-full">
                    <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-green-500">
                      <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                      <input 
                        type="text" 
                        value={searchTipoUso} 
                        onChange={e => { setSearchTipoUso(e.target.value); setTipoUso(e.target.value); setShowTipoUsoDropdown(true); }}
                        onFocus={() => setShowTipoUsoDropdown(true)}
                        onBlur={() => setTimeout(() => setShowTipoUsoDropdown(false), 200)}
                        className="w-full p-2 outline-none rounded-lg text-sm bg-transparent"
                        placeholder="Buscar ou digitar..."
                      />
                    </div>
                    {showTipoUsoDropdown && tiposUsoDb.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {tiposUsoDb.filter(t => t.nome.toLowerCase().includes(searchTipoUso.toLowerCase())).map(t => (
                          <div key={t.id} onClick={() => { setTipoUso(t.nome); setSearchTipoUso(t.nome); setShowTipoUsoDropdown(false); }} className="p-2 text-sm hover:bg-green-50 cursor-pointer border-b border-gray-50">
                            <span className="font-medium text-gray-800">{t.nome}</span>
                          </div>
                        ))}
                        {tiposUsoDb.filter(t => t.nome.toLowerCase().includes(searchTipoUso.toLowerCase())).length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhum tipo encontrado</div>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">SKU (Automático)</label>
                  <input type="text" maxLength={20} value={sku} onChange={e => setSku(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 font-mono bg-white text-sm" placeholder="Ex: #paobrioche" />
                  {sku !== generateSku(nome) && nome && (
                    <button type="button" onClick={() => setSku(generateSku(nome))} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center mt-1 transition-colors">
                      <RefreshCw size={10} className="mr-1" /> Padronizar este SKU
                    </button>
                  )}
                </div>
              </div>
            </div>


            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Compra e Medida</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Unidade de Medida</label>
                  <select value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    <option value="g">Grama (g)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="L">Litro (L)</option>
                    <option value="un">Unidade (un)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="fd">Fardo (fd)</option>
                    <option value="pc">Pacote (pc)</option>
                  </select>
                </div>
                <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Preço Médio (Embalagem)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                    <input 
                      type="text" 
                      value={precoPacote === '' ? '' : Number(precoPacote).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      disabled
                      title="O preço é calculado automaticamente pelas entradas de compras."
                      className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none bg-gray-100 text-gray-500 cursor-not-allowed font-medium" 
                      placeholder="0,00" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Qtd. na Embalagem</label>
                  <input type="number" value={qtdPacote} onChange={e => setQtdPacote(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="1 = Unidade" />
                </div>
                {['pc', 'fd', 'kg', 'L', 'cx'].includes(unidade) && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Vincular Insumo (Quebra)</label>
                    <div className="relative w-full">
                      <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-green-500">
                        <Search size={14} className="ml-2 text-gray-400 shrink-0" />
                        <input 
                          type="text" 
                          value={searchInsumoVinculado} 
                          onChange={e => {
                            setSearchInsumoVinculado(e.target.value);
                            setInsumoVinculado('');
                            setShowInsumoVinculadoDropdown(true);
                          }}
                          onFocus={() => setShowInsumoVinculadoDropdown(true)}
                          onBlur={() => setTimeout(() => setShowInsumoVinculadoDropdown(false), 200)}
                          className="w-full p-2 outline-none rounded-lg text-sm bg-transparent"
                          placeholder="Buscar insumo (Opcional)..."
                        />
                      </div>
                      {showInsumoVinculadoDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {insumos.filter(i => i.id !== editId && i.nome.toLowerCase().includes(searchInsumoVinculado.toLowerCase())).map(i => (
                            <div key={i.id} onClick={() => { setInsumoVinculado(i.id); setSearchInsumoVinculado(i.nome); setShowInsumoVinculadoDropdown(false); }} className="p-2 text-sm hover:bg-green-50 cursor-pointer border-b border-gray-50 flex justify-between items-center">
                              <span className="font-medium text-gray-800">{i.nome}</span>
                              <span className="text-gray-400 text-xs ml-2">{i.unidade}</span>
                            </div>
                          ))}
                          {insumos.filter(i => i.id !== editId && i.nome.toLowerCase().includes(searchInsumoVinculado.toLowerCase())).length === 0 && <div className="p-3 text-sm text-gray-500 text-center">Nenhum insumo encontrado</div>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>


            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Controle de Estoque</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Estoque Mínimo</label>
                  <input type="number" value={alertaMinimo} onChange={e => setAlertaMinimo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="Ex: 5" title="Alerta quando o estoque chegar neste limite" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Estoque Máximo</label>
                  <input type="number" value={estoqueMaximo} onChange={e => setEstoqueMaximo(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="Opcional" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Avisar Validade</label>
                  <div className="relative">
                    <input type="number" value={diasAvisoValidade} onChange={e => setDiasAvisoValidade(e.target.value)} className="w-full p-2 pr-10 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="7" />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">dias</span>
                  </div>
                </div>
                {!editId && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Estoque Atual</label>
                    <input type="number" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="Opcional" />
                  </div>
                )}
              </div>
              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer w-fit">
                  <input type="checkbox" checked={isVariavel} onChange={e => setIsVariavel(e.target.checked)} className="rounded text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer" />
                  <span className="text-sm font-bold text-gray-700">Insumo Variável (Zera e substitui o estoque rotativo na transferência)</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t flex gap-2">
              <button onClick={() => { handleCancelEdit(); setShowForm(false); }} className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm">
                Cancelar
              </button>
              <button onClick={handleSalvar} className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">
                {editId ? 'Atualizar Insumo' : 'Salvar Novo Insumo'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center text-purple-800 font-bold text-sm">
                  <Bot size={18} className="mr-2"/> Assistente IA
                </div>
              </div>
              
              <div className="bg-white p-3 rounded border border-purple-100 shadow-sm text-xs text-gray-600">
                <p className="font-bold text-purple-800 mb-1">Ordem de preenchimento (separado por vírgula):</p>
            <p>Nome, SKU, Preço Médio (Embalagem), Qtd na Embalagem, Unidade de Medida, Estoque mínimo, Estoque máximo, Estoque atual, Tipo de uso</p>
                <p className="font-mono text-purple-600 mt-2 bg-purple-50 p-1.5 rounded">Exemplo: Carne, CAR25, 150.00, 5, kg, 10, 50, 20, Matéria prima</p>
              </div>

              <textarea 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Carne, CAR25, 150.00, 5, kg, 10, 50, 20, Matéria prima&#10;Pão Brioche, PAO01, 24.00, 12, un, 5, 20, 10, Embalagem"
                className="w-full p-3 border border-purple-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm min-h-[140px] resize-y bg-white leading-relaxed font-mono"
              />

              <button 
                onClick={handleCadastroIA} 
                disabled={isGenerating}
                className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-70 shadow-sm"
              >
                {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Lendo e Cadastrando...</> : <><Sparkles size={18} className="mr-2"/> Cadastrar Insumos Automaticamente</>}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select 
              value={filtroTipoUso} 
              onChange={(e) => setFiltroTipoUso(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white"
            >
              <option value="">Todos os Tipos</option>
              {tiposUsoDb.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm w-full sm:w-64" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 z-10 shadow-sm bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase font-bold tracking-wider select-none">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('nome')}>
                  <div className="flex items-center">Insumo {sortConfig?.key === 'nome' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('sku')}>
                  <div className="flex items-center">SKU {sortConfig?.key === 'sku' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('tipo')}>
                  <div className="flex items-center">Tipo {sortConfig?.key === 'tipo' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('custo')}>
                  <div className="flex items-center">Custo Unitário {sortConfig?.key === 'custo' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>) : ''}</div>
                </th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>{[...Array(5)].map((_, i) => (<tr key={i} className="animate-pulse"><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td><td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td></tr>))}</tbody>
            ) : (
            <tbody className="divide-y divide-gray-100 text-sm">
              {sortedInsumos.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{i.nome}</td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{(i as any).sku || 'N/A'}</td>
                  <td className="px-6 py-4">
                    {(i as any).tipoUso ? <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-600 rounded-full uppercase">{(i as any).tipoUso}</span> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">
                      Custo: <span className="text-blue-600">R$ {Number(i.precoPacote).toFixed(i.qtdPacote > 1 ? 2 : 3)}</span> por {i.unidade}
                    </div>
                    {i.qtdPacote > 1 && <div className="text-xs text-gray-400 mt-1">(R$ {(i.precoPacote / i.qtdPacote).toFixed(3)} / un)</div>}
                  </td>
                  <td className="px-6 py-4 flex justify-end space-x-2">
                    <button onClick={() => handleEdit(i)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors"><Pencil size={18} /></button>
                    <button onClick={() => handleExcluir(i.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {sortedInsumos.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-400">Nenhum insumo encontrado.</td></tr>}
            </tbody>
            )}
          </table>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span className="whitespace-pre-line">{toast.message}</span>
        </div>
      )}

      {showTiposModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Tipos de Uso</h3>
              <button onClick={() => setShowTiposModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={novoTipoForm} onChange={e => setNovoTipoForm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTipo()} placeholder="Novo tipo (ex: Embalagem)" className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm" />
              <button onClick={handleAddTipo} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm">Adicionar</button>
            </div>
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {tiposUsoDb.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">{t.nome}</span>
                  <button onClick={() => handleDeleteTipo(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                </div>
              ))}
              {tiposUsoDb.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhum tipo cadastrado.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}