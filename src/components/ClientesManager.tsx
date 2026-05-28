import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { Users, MapPin, Phone, Search, Save, Trash2, Pencil, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ShoppingBag, Heart, Plus, X, User } from 'lucide-react';

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
  lat?: number;
  lng?: number;
  coordAproximada?: boolean;
  observacaoCliente?: string;
  observacaoEntregador?: string;
  ultimosPedidos?: any[];
  favoritos?: any[];
  categorias?: string[];
  googleMapsLink?: string;
}

const validarCPF = (cpf: string): boolean => {
  let apenasNumeros = "";
  for (let i = 0; i < cpf.length; i++) {
    const charCode = cpf.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) apenasNumeros += cpf[i];
  }
  
  if (apenasNumeros.length !== 11) return false;
  
  let tudoIgual = true;
  for (let i = 1; i < 11; i++) {
    if (apenasNumeros[i] !== apenasNumeros[0]) { tudoIgual = false; break; }
  }
  if (tudoIgual) return false;

  let peso1 = 0, peso2 = 0;
  for (let i = 0; i < 9; i++) {
    const valorDigito = apenasNumeros.charCodeAt(i) - 48;
    peso1 += valorDigito * (10 - i);
    peso2 += valorDigito * (11 - i);
  }

  let digito1 = (peso1 * 10) % 11;
  if (digito1 === 10 || digito1 === 11) digito1 = 0;
  if (digito1 !== (apenasNumeros.charCodeAt(9) - 48)) return false;

  let digito2 = ((peso2 + digito1 * 2) * 10) % 11;
  if (digito2 === 10 || digito2 === 11) digito2 = 0;

  return digito2 === (apenasNumeros.charCodeAt(10) - 48);
};

export default function ClientesManager({ currentUser, temPermissao }: { currentUser?: any, temPermissao?: any }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendasPdv, setVendasPdv] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfilClienteModal, setPerfilClienteModal] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedClientesIds, setSelectedClientesIds] = useState<string[]>([]);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [showGerenciarTagsModal, setShowGerenciarTagsModal] = useState(false);
  const [editTagOldName, setEditTagOldName] = useState<string | null>(null);
  const [editTagNewName, setEditTagNewName] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [observacaoCliente, setObservacaoCliente] = useState('');
  const [observacaoEntregador, setObservacaoEntregador] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);

  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');
  const [geocodingFeito, setGeocodingFeito] = useState(false);
  const [pendingCoordsData, setPendingCoordsData] = useState<{ lat?: number; lng?: number; coordAproximada?: boolean }>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const canEdit = temPermissao ? temPermissao('clientes', 'aba_logistica', 'editar') : true;
  const canDelete = temPermissao ? temPermissao('clientes', 'aba_logistica', 'apagar') : true;
  const canManageTags = temPermissao ? temPermissao('gerenciar_tags', 'aba_logistica', 'visualizar') : true;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const geocodiarEndereco = async (
    rua: string, num: string, bairroParam: string, cid: string, estado: string, cepParam: string
  ): Promise<{lat: number, lng: number, aproximado: boolean} | null> => {
    const h = { 'Accept-Language': 'pt-BR' };
    const buscar = async (url: string) => {
      try {
        const r = await fetch(url, { headers: h });
        const d = await r.json();
        if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
      } catch {}
      return null;
    };

    // 1. Rua + número + cidade + estado (exato)
    let r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(`${rua} ${num}`.trim())}&city=${encodeURIComponent(cid)}&state=${encodeURIComponent(estado)}&country=Brasil&limit=1&countrycodes=br`);
    if (r) return { ...r, aproximado: false };

    // 2. Rua + número sem estado
    r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${rua}, ${num}, ${cid}, Brasil`)}&limit=1&countrycodes=br`);
    if (r) return { ...r, aproximado: false };

    // 3. Rua sem número + cidade + estado (localiza a rua)
    r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(rua)}&city=${encodeURIComponent(cid)}&state=${encodeURIComponent(estado)}&country=Brasil&limit=1&countrycodes=br`);
    if (r) return { ...r, aproximado: true };

    // 4. CEP — muito preciso no Brasil (identifica rua ou quarteirão)
    const cepLimpo = cepParam.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&postalcode=${cepLimpo}&country=Brasil&limit=1&countrycodes=br`);
      if (r) return { ...r, aproximado: true };
    }

    // 5. Rua + cidade (sem estado, busca mais ampla)
    r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${rua}, ${cid}, Brasil`)}&limit=1&countrycodes=br`);
    if (r) return { ...r, aproximado: true };

    // 6. Bairro + cidade (localiza o bairro)
    if (bairroParam) {
      r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${bairroParam}, ${cid}, ${estado}, Brasil`)}&limit=1&countrycodes=br`);
      if (r) return { ...r, aproximado: true };
    }

    // 7. Cidade + estado (último recurso — ao menos mostra a região)
    r = await buscar(`https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(cid)}&state=${encodeURIComponent(estado)}&country=Brasil&limit=1&countrycodes=br`);
    if (r) return { ...r, aproximado: true };

    return null;
  };

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const unsub = onValue(clientesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setClientes(list);
      } else {
        setClientes([]);
      }
      setLoading(false);
    });

    const vendasRef = ref(db, 'vendas_pdv');
    const unsubVendas = onValue(vendasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setVendasPdv(Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })));
      else setVendasPdv([]);
    });

    return () => { unsub(); unsubVendas(); };
  }, []);


  const formatCPF = (val: string) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
  const formatPhone = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2').substring(0, 15);
  const formatCEP = (val: string) => val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatCEP(e.target.value);
    setCep(val);
    const justNumbers = val.replace(/\D/g, '');
    
    if (justNumbers.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${justNumbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setLogradouro(data.logradouro || '');
          setBairro(data.bairro || '');
          setCidade(data.localidade || '');
          setUf(data.uf || '');

          document.getElementById('numero_end')?.focus();
        } else {
          showToast('CEP não encontrado.', 'error');
        }
      } catch (error) {
        showToast('Erro ao consultar o CEP.', 'error');
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const resetForm = () => {
    setEditId(null); setNome(''); setTelefone(''); setCpf(''); setCep('');
    setLogradouro(''); setNumero(''); setBairro(''); setComplemento('');
    setCidade(''); setUf(''); setObservacaoCliente(''); setObservacaoEntregador('');
    setGoogleMapsLink('');
    setCategoriasSelecionadas([]);
    setLatInput(''); setLngInput('');
    setGeocodingError(''); setGeocodingFeito(false); setPendingCoordsData({});
  };

  const handleSalvar = async () => {
    if (!nome || !telefone) {
      showToast('Nome e Telefone são obrigatórios!', 'error');
      return;
    }

    const telLimpo = telefone.replace(/\D/g, '');
    const clienteExistente = clientes.find(c => (c.telefone || '').replace(/\D/g, '') === telLimpo && c.id !== editId);
    if (clienteExistente) {
      showToast(`Este telefone já está cadastrado para o cliente: ${clienteExistente.nome}`, 'error');
      return;
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo && !validarCPF(cpfLimpo)) {
      showToast('O CPF digitado é inválido.', 'error');
      return;
    }

    // Determinar coordenadas a usar
    let coordsData: { lat?: number; lng?: number; coordAproximada?: boolean } = {};

    const latNum = latInput.trim() ? parseFloat(latInput.replace(',', '.')) : NaN;
    const lngNum = lngInput.trim() ? parseFloat(lngInput.replace(',', '.')) : NaN;
    const temCoordsManual = !isNaN(latNum) && !isNaN(lngNum);

    if (temCoordsManual) {
      // Usuário inseriu coordenadas manualmente — usar diretamente, sem geocoding
      coordsData = { lat: latNum, lng: lngNum, coordAproximada: false };
      setGeocodingError('');
    } else if (geocodingFeito) {
      // Usuário já viu o aviso e está confirmando — usar coords pendentes
      coordsData = pendingCoordsData;
    } else if (logradouro && cidade) {
      // Primeira tentativa — rodar geocoding
      setIsGeocoding(true);
      setGeocodingError('');
      const coords = await geocodiarEndereco(logradouro, numero, bairro, cidade, uf, cep);
      setIsGeocoding(false);

      if (!coords) {
        // Nenhum resultado — avisar e aguardar confirmação do usuário
        setPendingCoordsData({});
        setGeocodingFeito(true);
        setGeocodingError('__sem_resultado__');
        return;
      } else if (coords.aproximado) {
        // Resultado aproximado — mostrar aviso e aguardar confirmação
        setPendingCoordsData({ lat: coords.lat, lng: coords.lng, coordAproximada: true });
        setLatInput(coords.lat.toFixed(6));
        setLngInput(coords.lng.toFixed(6));
        setGeocodingFeito(true);
        setGeocodingError('__aviso__');
        return;
      } else {
        // Exato — salvar de imediato sem interrupção
        coordsData = { lat: coords.lat, lng: coords.lng, coordAproximada: false };
        setLatInput(coords.lat.toFixed(6));
        setLngInput(coords.lng.toFixed(6));
      }
    }

    const clienteData = {
      nome: nome || '',
      telefone: telefone || '',
      cpf: cpf || '',
      cep: cep || '',
      logradouro: logradouro || '',
      numero: numero || '',
      bairro: bairro || '',
      complemento: complemento || '',
      cidade: cidade || '',
      uf: uf || '',
      observacaoCliente: observacaoCliente || '',
      observacaoEntregador: observacaoEntregador || '',
      googleMapsLink: googleMapsLink || '',
      categorias: categoriasSelecionadas,
      ...coordsData,
    };

    try {
      // Verifica duplicação de telefone ANTES de salvar (se não for edição e se tiver telefone)
      if (!editId && telefone) {
        const cleanPhone = telefone.replace(/\D/g, '');
        if (cleanPhone) {
          const existe = clientes.find((c: Cliente) => (c.telefone || '').replace(/\D/g, '') === cleanPhone);
          if (existe) {
            showToast(`Telefone já cadastrado para o cliente: ${existe.nome}`, 'error');
            return;
          }
        }
      }

      if (editId) {
        await update(ref(db, `clientes/${editId}`), clienteData);
        showToast('Cliente atualizado com sucesso!', 'success');
        setEditId(null);
      } else {
        const pinAleatorio = Math.floor(100000 + Math.random() * 900000).toString();
        
        await set(push(ref(db, 'clientes')), {
          ...clienteData,
          pin: pinAleatorio,
          dataCadastro: Date.now()
        });
        
        // Enviar mensagem de boas vindas / fidelidade se tiver telefone
        if (telefone) {
          const cleanPhone = telefone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            const msgFidelidade = `*🍔 Bem-vindo ao ArttBurger! 🍔*\n\nSeu cadastro foi realizado com sucesso e você já está participando do nosso *Programa de Fidelidade*!\n\n*Sua senha de acesso ao aplicativo:* ${pinAleatorio}\n\n*Como funciona?*\n✨ Cada ponto é adquirido com o consumo de R$ 50,00 (independente do produto).\n✨ Os pontos não são acumulativos nem transferíveis.\n✨ Nosso sistema irá avisar sempre que você receber uma pontuação.\n\n*Recompensa:*\nA cada 10 pontos, você pode trocar por qualquer um dos nossos *Artesanais Clássicos*:\n🍔 Artt Burger\n🍔 Artt Burger Pepper Jelly\n🍔 Artt Burger Barbecue\n🍔 Artt Burger Cheddar\n🍔 Artt Burger Bacon\n\nAgradecemos a preferência e bom apetite!`;
            await set(push(ref(db, 'fila_mensagens')), {
              telefone: cleanPhone,
              mensagem: msgFidelidade,
              status: 'pendente',
              timestamp: Date.now()
            });
          }
        }
        
        showToast('Cliente cadastrado com sucesso!', 'success');
      }

      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      showToast('Erro ao salvar cliente: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditId(cliente.id);
    setNome(cliente.nome || '');
    setTelefone(cliente.telefone || '');
    setCpf(cliente.cpf || '');
    setCep(cliente.cep || '');
    setLogradouro(cliente.logradouro || '');
    setNumero(cliente.numero || '');
    setBairro(cliente.bairro || '');
    setComplemento(cliente.complemento || '');
    setCidade(cliente.cidade || '');
    setUf(cliente.uf || '');
    setObservacaoCliente(cliente.observacaoCliente || '');
    setObservacaoEntregador(cliente.observacaoEntregador || '');
    setGoogleMapsLink(cliente.googleMapsLink || '');
    setCategoriasSelecionadas(cliente.categorias || []);
    setLatInput(cliente.lat != null ? String(cliente.lat) : '');
    setLngInput(cliente.lng != null ? String(cliente.lng) : '');
    setGeocodingError(''); setGeocodingFeito(false); setPendingCoordsData({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      await remove(ref(db, `clientes/${id}`));
      showToast('Cliente excluído.', 'success');
    }
  };

  const filteredClientes = clientes.filter(c => 
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.telefone || '').includes(searchTerm) ||
    (c.cpf || '').includes(searchTerm)
  );

  const todasCategorias = Array.from(new Set([...clientes.flatMap(c => c.categorias || []), ...categoriasSelecionadas])).sort();

  const handleEditTag = async () => {
    if (!editTagNewName.trim() || !editTagOldName) return;
    const oldName = editTagOldName;
    const newName = editTagNewName.trim();
    if (oldName === newName) {
      setEditTagOldName(null);
      setEditTagNewName('');
      return;
    }
    
    let atualizados = 0;
    for (const c of clientes) {
      if (c.categorias && c.categorias.includes(oldName)) {
        const novasCats = c.categorias.map(cat => cat === oldName ? newName : cat);
        const uniqueCats = Array.from(new Set(novasCats));
        await update(ref(db, `clientes/${c.id}`), { categorias: uniqueCats });
        atualizados++;
      }
    }
    
    setCategoriasSelecionadas(prev => {
      if (prev.includes(oldName)) {
        const novas = prev.map(cat => cat === oldName ? newName : cat);
        return Array.from(new Set(novas));
      }
      return prev;
    });

    showToast(`Tag renomeada em ${atualizados} clientes!`, 'success');
    setEditTagOldName(null);
    setEditTagNewName('');
  };

  const handleDeleteTag = async (tagToDel: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a tag "${tagToDel}" de todos os clientes?`)) return;
    
    let atualizados = 0;
    for (const c of clientes) {
      if (c.categorias && c.categorias.includes(tagToDel)) {
        const novasCats = c.categorias.filter(cat => cat !== tagToDel);
        await update(ref(db, `clientes/${c.id}`), { categorias: novasCats });
        atualizados++;
      }
    }

    setCategoriasSelecionadas(prev => prev.filter(cat => cat !== tagToDel));
    showToast(`Tag removida de ${atualizados} clientes!`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Base de Clientes</h2>
        {canEdit && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center">
            <Plus size={20} className="mr-2" /> Novo Cliente
          </button>
        )}
      </div>

      {showForm && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6 animate-in slide-in-from-top-4 duration-300">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Users className="mr-2 text-indigo-600" size={20} />
            {editId ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button onClick={() => { resetForm(); setShowForm(false); }} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"><X size={20} /></button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Dados Pessoais</h4>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Nome Completo *</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Ex: João da Silva" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Telefone / WhatsApp *</label>
                <input type="text" value={telefone} onChange={e => setTelefone(formatPhone(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">CPF (Opcional)</label>
                <input type="text" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="000.000.000-00" />
              </div>
            </div>
          </div>


          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2 flex items-center">
              <MapPin size={16} className="mr-1 text-indigo-500"/> Endereço de Entrega
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">CEP</label>
                <div className="relative">
                  <input type="text" value={cep} onChange={handleCepChange} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="00000-000" />
                  {isFetchingCep && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Logradouro (Rua/Av)</label>
                <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Nome da rua" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                <input type="text" id="numero_end" value={numero} onChange={e => setNumero(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="S/N" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Complemento / Ref.</label>
                <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Apto, Bloco..." />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Bairro</label>
                <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
              <div className="space-y-1 col-span-1">
                <label className="text-xs font-bold text-gray-500 uppercase">UF</label>
                <input type="text" value={uf} onChange={e => setUf(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase" maxLength={2} />
              </div>
            </div>
            {/* Coordenadas manuais */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center">
                  <MapPin size={12} className="mr-1"/>
                  Coordenadas GPS
                  {latInput && lngInput && <span className="ml-2 text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Definidas</span>}
                </label>
                {(latInput || lngInput) && (
                  <button type="button" onClick={() => { setLatInput(''); setLngInput(''); setGeocodingFeito(false); setGeocodingError(''); }} className="text-[10px] text-red-500 hover:text-red-700 font-bold">Limpar</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Latitude</label>
                  <input
                    type="text" value={latInput}
                    onChange={e => { setLatInput(e.target.value); setGeocodingFeito(false); setGeocodingError(''); }}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-mono"
                    placeholder="-18.758096"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Longitude</label>
                  <input
                    type="text" value={lngInput}
                    onChange={e => { setLngInput(e.target.value); setGeocodingFeito(false); setGeocodingError(''); }}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-mono"
                    placeholder="-44.433364"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Deixe em branco para buscar automaticamente pelo endereço. Para pegar as coordenadas: abra o Google Maps, clique com o botão direito no local exato e copie os números.</p>
            </div>

            {/* Avisos de geocoding */}
            {geocodingError === '__aviso__' && (
              <div className="flex items-start bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                <AlertTriangle size={15} className="text-yellow-600 mr-2 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs text-yellow-800 font-bold">Endereço exato não encontrado — localização aproximada.</p>
                  <p className="text-xs text-yellow-700 mt-0.5">As coordenadas foram preenchidas automaticamente com o local mais próximo encontrado. Você pode corrigi-las manualmente acima ou clicar em <strong>Confirmar e Salvar</strong> para aceitar.</p>
                </div>
              </div>
            )}
            {geocodingError === '__sem_resultado__' && (
              <div className="flex items-start bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertTriangle size={15} className="text-red-500 mr-2 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs text-red-700 font-bold">Nenhuma localização encontrada para este endereço.</p>
                  <p className="text-xs text-red-600 mt-0.5">Insira as coordenadas manualmente acima, ou clique em <strong>Salvar sem Localização</strong> para continuar.</p>
                </div>
              </div>
            )}
            {isGeocoding && (
              <div className="flex items-center text-xs text-indigo-600 font-medium">
                <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                Buscando localização no mapa...
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Link do Google Maps (Opcional)</label>
              <input type="text" value={googleMapsLink} onChange={e => setGoogleMapsLink(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm" placeholder="Ex: https://maps.app.goo.gl/..." />
            </div>
          </div>


          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4 lg:col-span-2">
            <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-2">Observações (Cadastro / Entrega)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações do Cliente</label>
                <textarea value={observacaoCliente} onChange={e => setObservacaoCliente(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" placeholder="Ex: Alergia a algum ingrediente, cliente exigente..." rows={2}></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Observações para o Entregador</label>
                <textarea value={observacaoEntregador} onChange={e => setObservacaoEntregador(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" placeholder="Ex: Deixar na portaria, campainha não funciona, cachorro solto..." rows={2}></textarea>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
              <h4 className="text-sm font-bold text-gray-700">Categorias / Tags do Cliente</h4>
              {canManageTags && <button type="button" onClick={() => setShowGerenciarTagsModal(true)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase leading-none pb-0.5">Gerenciar Tags</button>}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {todasCategorias.map(cat => (
                 <button
                   key={cat}
                   type="button"
                   onClick={() => {
                     if (categoriasSelecionadas.includes(cat)) {
                       setCategoriasSelecionadas(prev => prev.filter(c => c !== cat));
                     } else {
                       setCategoriasSelecionadas(prev => [...prev, cat]);
                     }
                   }}
                   className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${categoriasSelecionadas.includes(cat) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                 >
                   {cat}
                 </button>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Nova categoria..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !categoriasSelecionadas.includes(val)) {
                      setCategoriasSelecionadas([...categoriasSelecionadas, val]);
                      e.currentTarget.value = '';
                    }
                  }
                }}
                className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-64 bg-white"
              />
              <span className="text-xs text-gray-400 self-center">Pressione Enter para adicionar</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => { resetForm(); setShowForm(false); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300 transition-colors shadow-sm">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={isGeocoding}
            className={`px-6 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center disabled:opacity-70 text-white ${
              geocodingError === '__aviso__' ? 'bg-yellow-500 hover:bg-yellow-600' :
              geocodingError === '__sem_resultado__' ? 'bg-orange-500 hover:bg-orange-600' :
              'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isGeocoding
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> Buscando mapa...</>
              : geocodingError === '__aviso__'
              ? <><CheckCircle size={18} className="mr-2"/> Confirmar e Salvar</>
              : geocodingError === '__sem_resultado__'
              ? <><Save size={18} className="mr-2"/> Salvar sem Localização</>
              : <><Save size={18} className="mr-2"/> {editId ? 'Atualizar Cliente' : 'Salvar Cliente'}</>
            }
          </button>
        </div>
      </div>
      )}

      {showGerenciarTagsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-4" onClick={() => setShowGerenciarTagsModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Gerenciar Tags</h3>
              <button onClick={() => setShowGerenciarTagsModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Atenção: Renomear ou excluir uma tag afetará todos os clientes que a possuem.</p>
            <div className="max-h-[60vh] overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
              {todasCategorias.map((cat: string) => (
                <div key={cat} className="flex justify-between items-center p-3 hover:bg-gray-50">
                  {editTagOldName === cat ? (
                    <div className="flex w-full space-x-2">
                      <input type="text" value={editTagNewName} onChange={e => setEditTagNewName(e.target.value)} className="flex-1 p-1 border border-indigo-300 rounded outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white" autoFocus />
                      <button onClick={handleEditTag} className="text-green-600 hover:bg-green-50 px-2 rounded font-bold text-sm">Salvar</button>
                      <button onClick={() => { setEditTagOldName(null); setEditTagNewName(''); }} className="text-gray-500 hover:bg-gray-100 px-2 rounded font-bold text-sm">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-700">{cat}</span>
                      <div className="flex space-x-1">
                        {canManageTags && <button onClick={() => { setEditTagOldName(cat); setEditTagNewName(cat); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Pencil size={16}/></button>}
                        {canManageTags && <button onClick={() => handleDeleteTag(cat)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {todasCategorias.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhuma tag cadastrada.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Clientes */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full" />
          </div>
          {!isSelectionMode && canEdit && (
            <button onClick={() => setIsSelectionMode(true)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors shadow-sm text-sm">
              Selecionar Múltiplos
            </button>
          )}
        </div>

        {isSelectionMode && (
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <span className="font-bold text-indigo-800">{selectedClientesIds.length} clientes selecionados</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => {
                if (selectedClientesIds.length === filteredClientes.length) setSelectedClientesIds([]);
                else setSelectedClientesIds(filteredClientes.map(c => c.id));
              }} className="px-3 py-1.5 bg-white text-indigo-600 font-bold rounded-lg shadow-sm text-sm border border-indigo-100 hover:bg-indigo-50 transition-colors">
                {selectedClientesIds.length === filteredClientes.length ? 'Desmarcar Todos' : 'Selecionar Visíveis'}
              </button>
              <button onClick={() => setShowBulkCategoryModal(true)} disabled={selectedClientesIds.length === 0} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg shadow-sm text-sm disabled:opacity-50 hover:bg-indigo-700 transition-colors">
                Adicionar Categoria
              </button>
              <button onClick={() => { setIsSelectionMode(false); setSelectedClientesIds([]); }} className="px-3 py-1.5 bg-gray-200 text-gray-700 font-bold rounded-lg shadow-sm text-sm hover:bg-gray-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto pr-2">
          {filteredClientes.map(c => (
            <div key={c.id} className={`bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden transition-colors ${selectedClientesIds.includes(c.id) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-100'}`}>
              <div className="p-4 flex justify-between items-start">
                {isSelectionMode && (
                  <input type="checkbox" checked={selectedClientesIds.includes(c.id)} onChange={() => {
                    if (selectedClientesIds.includes(c.id)) setSelectedClientesIds(prev => prev.filter(id => id !== c.id));
                    else setSelectedClientesIds(prev => [...prev, c.id]);
                  }} className="mr-3 mt-1 w-5 h-5 rounded text-indigo-600 cursor-pointer shrink-0" />
                )}
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-bold text-gray-900 truncate">{c.nome}</h4>
                  <p className="text-sm text-gray-500 font-medium flex items-center mt-1"><Phone size={14} className="mr-1 text-indigo-400"/> {c.telefone}</p>
                  {c.logradouro && (
                    <p className="text-xs text-gray-400 mt-1 truncate flex items-center">
                      <MapPin size={12} className={`mr-1 shrink-0 ${c.lat ? (c.coordAproximada ? 'text-yellow-400' : 'text-green-400') : 'text-gray-300'}`}/>
                      {c.logradouro}, {c.numero} - {c.bairro}
                      {c.coordAproximada && <span className="ml-1 text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded font-bold shrink-0">~Aprox.</span>}
                    </p>
                  )}
                  {c.categorias && c.categorias.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.categorias.map(cat => (
                        <span key={cat} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 font-bold uppercase tracking-wider">{cat}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex space-x-1 shrink-0">
                  {canEdit && <button onClick={() => handleEdit(c)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={16} /></button>}
                  {canDelete && <button onClick={() => handleExcluir(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>}
                </div>
              </div>
              

              <div className="bg-gray-50 border-t border-gray-100">
                <button onClick={() => setPerfilClienteModal(c)} className="w-full p-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors flex justify-center items-center">
                  <User size={14} className="mr-1"/> Ver Perfil Completo
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {perfilClienteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPerfilClienteModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-black">{perfilClienteModal.nome}</h2>
                <p className="text-indigo-200 mt-1 flex items-center"><Phone size={14} className="mr-1"/> {perfilClienteModal.telefone}</p>
              </div>
              <button onClick={() => setPerfilClienteModal(null)} className="text-indigo-200 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-2 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-gray-50">
              {perfilClienteModal.categorias && perfilClienteModal.categorias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {perfilClienteModal.categorias.map(cat => (
                    <span key={cat} className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold uppercase tracking-wider">{cat}</span>
                  ))}
                </div>
              )}
              
              {(() => {
                const historicoCliente = vendasPdv.filter(v => v.clienteId === perfilClienteModal.id).sort((a, b) => b.timestamp - a.timestamp);
                const totalGasto = historicoCliente.reduce((acc, ped) => acc + (ped.valor || 0), 0);
                const ticketMedio = historicoCliente.length > 0 ? totalGasto / historicoCliente.length : 0;
                
                const contagemProdutos: Record<string, number> = {};
                historicoCliente.forEach(v => {
                  if (v.itens && Array.isArray(v.itens)) {
                    v.itens.forEach((item: any) => {
                       contagemProdutos[item.nome] = (contagemProdutos[item.nome] || 0) + item.qtd;
                    });
                  }
                });
                const topFavoritos = Object.entries(contagemProdutos).sort((a, b) => b[1] - a[1]).slice(0, 5);
                
                return (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">Pedidos Realizados</span>
                        <span className="text-2xl font-black text-indigo-600">{historicoCliente.length}</span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Gasto</span>
                        <span className="text-xl font-black text-green-600">R$ {totalGasto.toFixed(2)}</span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">Ticket Médio</span>
                        <span className="text-xl font-black text-blue-600">R$ {ticketMedio.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-bold text-gray-700 flex items-center mb-3"><Heart size={16} className="mr-1 text-red-500"/> Produtos Mais Comprados</h4>
                        {topFavoritos.length > 0 ? (
                          <div className="space-y-2">
                            {topFavoritos.map(([nome, qtd], idx) => (
                              <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                                <span className="font-bold text-sm text-gray-800">{nome}</span>
                                <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">{qtd}x</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Nenhum histórico suficiente.</p>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {(perfilClienteModal.observacaoCliente || perfilClienteModal.observacaoEntregador) && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-700 flex items-center mb-3"><AlertTriangle size={16} className="mr-1 text-orange-500"/> Observações</h4>
                            <div className="space-y-2">
                              {perfilClienteModal.observacaoCliente && (
                                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                  <span className="text-[10px] font-bold text-yellow-800 uppercase block mb-1">Do Cliente</span>
                                  <p className="text-sm text-yellow-900">{perfilClienteModal.observacaoCliente}</p>
                                </div>
                              )}
                              {perfilClienteModal.observacaoEntregador && (
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                  <span className="text-[10px] font-bold text-blue-800 uppercase block mb-1">Para o Entregador</span>
                                  <p className="text-sm text-blue-900">{perfilClienteModal.observacaoEntregador}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
      
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 flex items-center mb-3"><ShoppingBag size={16} className="mr-1 text-emerald-500"/> Histórico Completo</h4>
                      {historicoCliente.length > 0 ? (
                        <div className="space-y-3">
                          {historicoCliente.map((ped: any, idx: number) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                              <div className="flex justify-between items-center border-b border-gray-50 pb-2 mb-2">
                                <span className="font-bold text-gray-800 text-sm">
                                  {new Date(ped.timestamp).toLocaleDateString('pt-BR')} às {new Date(ped.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <span className="font-black text-green-600">R$ {ped.valor.toFixed(2)}</span>
                              </div>
                              {ped.descricao && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded block w-fit mb-2">{ped.descricao} {ped.tipoPedido ? `(${ped.tipoPedido})` : ''}</span>}
                              <p className="text-sm text-gray-600 leading-relaxed">{ped.itens?.map((i: any) => `${i.qtd}x ${i.nome}`).join(', ')}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Nenhum pedido registrado.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showBulkCategoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg text-gray-800">Categorizar em Massa</h3>
            <p className="text-sm text-gray-500">Adicionar uma categoria aos {selectedClientesIds.length} clientes selecionados.</p>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Selecione ou digite uma nova</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {todasCategorias.map(cat => (
                   <button key={cat} onClick={() => setBulkCategory(cat)} className={`px-2 py-1 text-xs font-bold rounded border transition-colors ${bulkCategory === cat ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{cat}</button>
                ))}
              </div>
              <input type="text" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} placeholder="Nome da Categoria" className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50 focus:bg-white" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowBulkCategoryModal(false)} className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={async () => {
                if (!bulkCategory.trim()) return showToast('Informe uma categoria', 'error');
                let atualizados = 0;
                for (const id of selectedClientesIds) {
                  const cliente = clientes.find(c => c.id === id);
                  if (cliente) {
                    const cats = cliente.categorias || [];
                    if (!cats.includes(bulkCategory.trim())) {
                      await update(ref(db, `clientes/${id}`), { categorias: [...cats, bulkCategory.trim()] });
                      atualizados++;
                    }
                  }
                }
                showToast(`Categoria adicionada a ${atualizados} clientes!`, 'success');
                setShowBulkCategoryModal(false);
                setSelectedClientesIds([]);
                setIsSelectionMode(false);
                setBulkCategory('');
              }} className="flex-1 bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}