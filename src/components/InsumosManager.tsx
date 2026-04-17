import { useState, useEffect } from 'react';
import { ref, push, set, onValue, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { Insumo } from '../types';
import { Package, Search, Trash2, CheckCircle, AlertTriangle, Pencil, Sparkles, Bot, Loader2, X } from 'lucide-react';

export default function InsumosManager() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editId, setEditId] = useState<string | null>(null);
  // Form state
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [unidade, setUnidade] = useState('g');
  const [precoPacote, setPrecoPacote] = useState('');
  const [qtdPacote, setQtdPacote] = useState('1');
  const [diasAvisoValidade, setDiasAvisoValidade] = useState('7');
  const [alertaMinimo, setAlertaMinimo] = useState('');
  const [estoqueMaximo, setEstoqueMaximo] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [tipoUso, setTipoUso] = useState('');

  const [filtroTipoUso, setFiltroTipoUso] = useState('');
  // Tipos de uso customizáveis
  const [tiposUsoDb, setTiposUsoDb] = useState<{id: string, nome: string}[]>([]);
  const [showTiposModal, setShowTiposModal] = useState(false);
  const [novoTipoForm, setNovoTipoForm] = useState('');

  const [cadastroMode, setCadastroMode] = useState<'manual' | 'ia'>('manual');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Chave da API da xAI (Grok) - Mantida fixa no código (sistema de uso interno restrito, conforme solicitado)
  const grokKey = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

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
    });
    
    const tiposRef = ref(db, 'tipos_uso');
    const unsubTipos = onValue(tiposRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTiposUsoDb(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      } else {
        setTiposUsoDb([]);
      }
    });

    return () => { unsub(); unsubTipos(); };
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

  const handleSalvar = async () => {
    if (!nome || !unidade || !precoPacote || !qtdPacote || !alertaMinimo) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    let existingInsumo;
    if (sku) {
      existingInsumo = insumos.find(i => ((i as any).sku || '').toLowerCase() === sku.toLowerCase());
    } else {
      existingInsumo = insumos.find(i => (i.nome || '').toLowerCase().trim() === (nome || '').toLowerCase().trim());
    }

    const finalSku = sku || (existingInsumo ? (existingInsumo as any).sku : generateSku(nome));
    const targetId = editId || (existingInsumo ? existingInsumo.id : null);

    if (targetId) {
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
      };

      if (!editId && estoqueAtual && existingInsumo) {
        updateData.estoqueEstacionario = (existingInsumo.estoqueEstacionario || 0) + Number(estoqueAtual);
      }

      await update(ref(db, `insumos/${targetId}`), updateData);
      showToast(existingInsumo && !editId ? 'Insumo já existia. Valores e estoque atualizados!' : 'Insumo atualizado com sucesso!', 'success');
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
    setQtdPacote('1');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
    setTipoUso('');
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
Nome, SKU, Preço Compra (CX/UN), Qtd na caixa (1 se UN), Unidade, Estoque mínimo, Estoque máximo, Estoque atual, Tipo de uso.
Não inclua crases, formatação markdown ou texto adicional, apenas o array JSON.
Formato esperado para cada objeto:
[{
  "nome": "Nome do Insumo",
  "sku": "SKU (se omitido ou em branco, deixe vazio)",
  "unidade": "g" | "kg" | "ml" | "L" | "un" | "cx",
  "precoPacote": numero (preço de compra em reais da caixa/unidade),
  "qtdPacote": numero (quantidade na caixa, ou 1 se unidade),
  "alertaMinimo": numero (estoque mínimo),
  "estoqueMaximo": numero (estoque máximo, opcional),
  "estoqueAtual": numero (estoque atual, opcional),
  "tipoUso": "texto" (opcional, ex: Matéria prima, Embalagem, Produto final)
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

        const finalSku = item.sku || (existingInsumo ? (existingInsumo as any).sku : generateSku(item.nome || 'INSUMO'));

        if (existingInsumo) {
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
          
          await update(ref(db, `insumos/${existingInsumo.id}`), updateData);
          atualizados++;
        } else {
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
            estoqueRotativo: 0,
            estoqueEstacionario: item.estoqueAtual ? Number(item.estoqueAtual) : 0,
          });
          adicionados++;
        }
      }
      
      showToast(`Sucesso! ${adicionados} cadastrados e ${atualizados} atualizados pela IA.`, 'success');
      setAiPrompt('');
      setCadastroMode('manual');
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
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setNome('');
    setSku('');
    setUnidade('g');
    setPrecoPacote('');
    setQtdPacote('1');
    setDiasAvisoValidade('7');
    setAlertaMinimo('');
    setEstoqueMaximo('');
    setEstoqueAtual('');
    setTipoUso('');
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Package className="mr-2 text-green-600" size={20} />
            {editId ? 'Editar Insumo' : 'Cadastro de Insumos'}
          </h3>
          {!editId && (
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setCadastroMode('manual')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${cadastroMode === 'manual' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>Manual</button>
              <button onClick={() => setCadastroMode('ia')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center ${cadastroMode === 'ia' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}><Sparkles size={12} className="mr-1"/> IA Mágica</button>
            </div>
          )}
        </div>
        
        {cadastroMode === 'manual' || editId ? (
          <div className="space-y-6">
            
            {/* Informações Principais */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
              <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Informações Principais</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="space-y-1 sm:col-span-6">
                  <label className="text-xs font-bold text-gray-500 uppercase">Nome do Insumo</label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="Ex: Pão Brioche" />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Uso</label>
                    <button type="button" onClick={() => setShowTiposModal(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase leading-none pb-0.5">Gerenciar</button>
                  </div>
                  <select value={tipoUso} onChange={e => setTipoUso(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm">
                    <option value="">Selecione...</option>
                    {tiposUsoDb.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">SKU (Automático)</label>
                  <input type="text" value={sku} onChange={e => setSku(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 font-mono bg-white text-sm" placeholder="Ex: PAO123" />
                </div>
              </div>
            </div>

            {/* Compra e Medida */}
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
                    <option value="cx">Caixa/Fardo (cx)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Preço Compra (CX/UN)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                    <input 
                      type="text" 
                      value={precoPacote === '' ? '' : Number(precoPacote).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      onChange={e => { const digits = e.target.value.replace(/\D/g, ''); const val = digits ? (parseInt(digits, 10) / 100).toString() : ''; setPrecoPacote(val); }} 
                      className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" 
                      placeholder="0,00" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Qtd. na Caixa</label>
                  <input type="number" value={qtdPacote} onChange={e => setQtdPacote(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white" placeholder="1 = Unidade" />
                </div>
              </div>
            </div>

            {/* Controle de Estoque */}
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
            </div>

            <div className="pt-4 border-t flex gap-2">
              <button onClick={handleSalvar} className="flex-1 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-sm">
                {editId ? 'Atualizar Insumo' : 'Salvar Novo Insumo'}
              </button>
              {editId && (
                <button onClick={handleCancelEdit} className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm">
                  Cancelar
                </button>
              )}
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
                <p>Nome, SKU, Preço Compra (CX/UN), Qtd na Caixa (1 se Un.), Unidade (L/ML/G/KG/UN/CX), Estoque mínimo, Estoque máximo, Estoque atual, Tipo de uso</p>
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

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="text-lg font-bold text-gray-800">Insumos Cadastrados</h3>
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
        
        <div className="grid grid-cols-1 gap-4 max-h-[450px] overflow-y-auto pr-2">
          {filteredInsumos.map(i => (
            <div key={i.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-bold text-gray-900">{i.nome}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{ (i as any).sku || 'N/A'}</span>
                  {(i as any).tipoUso && <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full uppercase">{(i as any).tipoUso}</span>}
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  Custo: <span className="text-blue-600">R$ {(i.precoPacote / (i.qtdPacote || 1)).toFixed(3)}</span> por {i.unidade}
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

      {showTiposModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Tipos de Uso</h3>
              <button onClick={() => setShowTiposModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={novoTipoForm} onChange={e => setNovoTipoForm(e.target.value)} placeholder="Novo tipo (ex: Embalagem)" className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm" />
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