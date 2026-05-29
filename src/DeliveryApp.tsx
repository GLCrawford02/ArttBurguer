import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { db } from './firebase';
import { Utensils, Phone, User, ShoppingBag, LogOut, ChevronRight, ChevronDown, ChevronUp, MapPin, KeyRound, Clock, Star, Gift, History, X as XIcon, Trash2, CheckCircle, Minus, Plus } from 'lucide-react';
import logoImg from './assets/logo.png';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  pin?: string;
  cpf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  lat?: number;
  lng?: number;
  coordAproximada?: boolean;
  enderecos?: any[];
}

const getStateCode = (stateName: string) => {
  const states: Record<string, string> = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA",
    "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
    "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
    "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI",
    "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
    "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
    "Sergipe": "SE", "Tocantins": "TO"
  };
  return states[stateName] || (stateName ? stateName.substring(0, 2).toUpperCase() : '');
};

const isPointInPolygon = (point: [number, number], vs: number[][]) => {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1];
    let xj = vs[j][0], yj = vs[j][1];
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export default function DeliveryApp() {
  const [cliente, setCliente] = useState<Cliente | null>(() => {
    const saved = localStorage.getItem('arttburger_cliente_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');

  const [regNome, setRegNome] = useState('');
  const [regTelefone, setRegTelefone] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regCep, setRegCep] = useState('');
  const [regLogradouro, setRegLogradouro] = useState('');
  const [regNumero, setRegNumero] = useState('');
  const [regBairro, setRegBairro] = useState('');
  const [regComplemento, setRegComplemento] = useState('');
  const [regCidade, setRegCidade] = useState('');
  const [regUf, setRegUf] = useState('');
  const [regPin, setRegPin] = useState('');

  const [regLat, setRegLat] = useState<number | null>(null);
  const [regLng, setRegLng] = useState<number | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Endereços Adicionais
  const [enderecos, setEnderecos] = useState<any[]>([]);
  const [selectedEnderecoIndex, setSelectedEnderecoIndex] = useState<number>(0);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newEndCep, setNewEndCep] = useState('');
  const [newEndLogradouro, setNewEndLogradouro] = useState('');
  const [newEndNumero, setNewEndNumero] = useState('');
  const [newEndBairro, setNewEndBairro] = useState('');
  const [newEndComplemento, setNewEndComplemento] = useState('');
  const [newEndCidade, setNewEndCidade] = useState('');
  const [newEndUf, setNewEndUf] = useState('');
  const [newEndLat, setNewEndLat] = useState<number | null>(null);
  const [newEndLng, setNewEndLng] = useState<number | null>(null);
  const [isFetchingNewLocation, setIsFetchingNewLocation] = useState(false);

  const [clientesDb, setClientesDb] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedidos' | 'fidelidade'>('cardapio');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Carrinho e Checkout
  const [carrinho, setCarrinho] = useState<Record<string, any>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [produtoModal, setProdutoModal] = useState<any>(null);
  const [itemOptions, setItemOptions] = useState<any>({ montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, bebidas: {}, tamanho: '' });
  const [formaPagamento, setFormaPagamento] = useState('');
  const [tipoEntregaApp, setTipoEntregaApp] = useState<'delivery' | 'retirada'>('delivery');
  const [taxas, setTaxas] = useState<any[]>([]);
  const [zonasRestritas, setZonasRestritas] = useState<number[][][]>([]);
  const [entregasAbertas, setEntregasAbertas] = useState<any[]>([]);
  const [vendasPdv, setVendasPdv] = useState<any[]>([]);

  // Produtos
  const [produtos, setProdutos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasConfig, setCategoriasConfig] = useState<any[]>([]);

  // Dados do Cliente logado
  const [historicoPedidos, setHistoricoPedidos] = useState<any[]>([]);
  const [fidelidadePontos, setFidelidadePontos] = useState<any>(null);
  const [fidelidadeConfig, setFidelidadeConfig] = useState<any>(null);

  useEffect(() => {
    document.title = 'ArttBurger - Pedir Delivery';

    const clientesRef = ref(db, 'clientes');
    const unsubClientes = onValue(clientesRef, snap => {
      if (snap.val()) {
        setClientesDb(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      }
      setLoading(false);
    });

    const prodRef = ref(db, 'produtos');
    const unsubProd = onValue(prodRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        setProdutos(list);
        // Puxa as categorias únicas dos produtos cadastrados
        const cats = Array.from(new Set(list.map(p => p.categoria || 'Outros'))) as string[];
        setCategorias(cats.sort());
      }
    });

    const catRef = ref(db, 'categorias_produtos');
    const unsubCat = onValue(catRef, snap => {
      if (snap.val()) setCategoriasConfig(Object.values(snap.val()));
      else setCategoriasConfig([]);
    });

    const configRef = ref(db, 'configuracoes/taxas_entrega');
    const unsubConfig = onValue(configRef, snap => {
      if (snap.val()) {
        setZonasRestritas(snap.val().zonasRestritas || []);
      }
    });

    return () => { unsubClientes(); unsubProd(); unsubCat(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (cliente) {
      const pedidosRef = query(ref(db, 'vendas_pdv'), orderByChild('clienteId'), equalTo(cliente.id));
      const unsubPedidos = onValue(pedidosRef, snap => {
        if (snap.val()) {
          const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
          list.sort((a, b) => b.timestamp - a.timestamp);
          setHistoricoPedidos(list);
        } else {
          setHistoricoPedidos([]);
        }
      });

      const fidelidadeRef = ref(db, `fidelidade_pontos/${cliente.id}`);
      const unsubFidelidade = onValue(fidelidadeRef, snap => {
         setFidelidadePontos(snap.val() || null);
      });

      const configFidelidadeRef = ref(db, 'fidelidade_config');
      const unsubConfig = onValue(configFidelidadeRef, snap => {
         setFidelidadeConfig(snap.val() || null);
      });

      return () => { unsubPedidos(); unsubFidelidade(); unsubConfig(); };
    }
  }, [cliente]);

  useEffect(() => {
    if (cliente) {
      const list = [];
      if (cliente.logradouro) {
        list.push({
          logradouro: cliente.logradouro, numero: cliente.numero, bairro: cliente.bairro,
          cidade: cliente.cidade, uf: cliente.uf, cep: cliente.cep, complemento: cliente.complemento,
          lat: cliente.lat, lng: cliente.lng, coordAproximada: cliente.coordAproximada
        });
      }
      if (cliente.enderecos && Array.isArray(cliente.enderecos)) {
        list.push(...cliente.enderecos);
      }
      setEnderecos(list);
      setSelectedEnderecoIndex(0);
    }
  }, [cliente]);

  useEffect(() => {
    const unsubTaxas = onValue(ref(db, 'taxas_cartoes'), snap => {
      if (snap.val()) setTaxas(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
    });
    const unsubEntregas = onValue(ref(db, 'entregas_abertas'), snap => {
      if (snap.val()) setEntregasAbertas(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setEntregasAbertas([]);
    });
    const unsubVendas = onValue(ref(db, 'vendas_pdv'), snap => {
      if (snap.val()) setVendasPdv(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setVendasPdv([]);
    });
    return () => { unsubTaxas(); unsubEntregas(); unsubVendas(); };
  }, []);

  const valorTotalCarrinho = Object.values(carrinho).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);

  const formatCEP = (val: string) => val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  const formatCPF = (val: string) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
  const formatPhone = (val: string) => {
    let v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
    return v;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatCEP(e.target.value);
    setRegCep(val);
    const justNumbers = val.replace(/\D/g, '');
    
    if (justNumbers.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${justNumbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setRegLogradouro(data.logradouro || '');
          setRegBairro(data.bairro || '');
          setRegCidade(data.localidade || '');
          setRegUf(data.uf || '');
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleGetLocation = () => {
    setIsFetchingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setRegLat(lat);
        setRegLng(lng);
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'pt-BR' }
          });
          const data = await response.json();
          
          if (data && data.address) {
            setRegCep(data.address.postcode ? data.address.postcode.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2') : '');
            setRegLogradouro(data.address.road || data.address.pedestrian || '');
            setRegBairro(data.address.suburb || data.address.neighbourhood || data.address.city_district || '');
            setRegCidade(data.address.city || data.address.town || data.address.village || data.address.municipality || '');
            setRegUf(data.address.state ? getStateCode(data.address.state) : '');
            setRegNumero('');
            document.getElementById('reg_numero')?.focus();
          }
        } catch (error) {
          console.error("Erro ao buscar endereço:", error);
          alert("Não foi possível preencher o endereço automaticamente.");
        } finally {
          setIsFetchingLocation(false);
        }
      }, (error) => {
        console.error(error);
        alert("Não foi possível obter sua localização. Verifique as permissões de GPS.");
        setIsFetchingLocation(false);
      }, { enableHighAccuracy: true });
    } else {
      alert("Geolocalização não suportada.");
      setIsFetchingLocation(false);
    }
  };

  const handleNewEndGetLocation = () => {
    setIsFetchingNewLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setNewEndLat(lat);
        setNewEndLng(lng);
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'pt-BR' }
          });
          const data = await response.json();
          
          if (data && data.address) {
            setNewEndCep(data.address.postcode ? data.address.postcode.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2') : '');
            setNewEndLogradouro(data.address.road || data.address.pedestrian || '');
            setNewEndBairro(data.address.suburb || data.address.neighbourhood || data.address.city_district || '');
            setNewEndCidade(data.address.city || data.address.town || data.address.village || data.address.municipality || '');
            setNewEndUf(data.address.state ? getStateCode(data.address.state) : '');
            setNewEndNumero('');
          }
        } catch (error) {
          console.error("Erro ao buscar endereço:", error);
        } finally {
          setIsFetchingNewLocation(false);
        }
      }, (error) => {
        console.error(error);
        alert("Não foi possível obter sua localização. Verifique as permissões de GPS.");
        setIsFetchingNewLocation(false);
      }, { enableHighAccuracy: true });
    } else {
      alert("Geolocalização não suportada.");
      setIsFetchingNewLocation(false);
    }
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndLogradouro || !newEndNumero || !newEndBairro || !newEndCidade || !newEndUf) {
      alert("Preencha os campos obrigatórios do endereço.");
      return;
    }
    const novoEnd = {
      cep: newEndCep, logradouro: newEndLogradouro, numero: newEndNumero, bairro: newEndBairro,
      complemento: newEndComplemento, cidade: newEndCidade, uf: newEndUf,
      ...(newEndLat && newEndLng ? { lat: newEndLat, lng: newEndLng, coordAproximada: false } : {})
    };
    
    const novasEnderecos = [...(cliente?.enderecos || []), novoEnd];
    await update(ref(db, `clientes/${cliente!.id}`), {
      enderecos: novasEnderecos
    });

    const updatedCliente = { ...cliente!, enderecos: novasEnderecos };
    setCliente(updatedCliente);
    localStorage.setItem('arttburger_cliente_session', JSON.stringify(updatedCliente));
    
    setEnderecos([...enderecos, novoEnd]);
    setSelectedEnderecoIndex(enderecos.length);
    setIsAddingAddress(false);
    
    setNewEndCep(''); setNewEndLogradouro(''); setNewEndNumero(''); setNewEndBairro('');
    setNewEndComplemento(''); setNewEndCidade(''); setNewEndUf('');
    setNewEndLat(null); setNewEndLng(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = loginPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return alert('Por favor, digite um telefone válido com DDD.');

    const existe = clientesDb.find(c => (c.telefone || '').replace(/\D/g, '') === cleanPhone);

    if (existe) {
      if (existe.pin && existe.pin !== loginPin) {
        return alert('PIN incorreto.');
      }
      if (!existe.pin) {
        await update(ref(db, `clientes/${existe.id}`), { pin: loginPin });
        existe.pin = loginPin;
      }
      setCliente(existe);
      localStorage.setItem('arttburger_cliente_session', JSON.stringify(existe));
    } else {
      alert('Cliente não encontrado. Por favor, cadastre-se.');
      setAuthMode('register');
      setRegTelefone(loginPhone);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = regTelefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return alert('Por favor, digite um telefone válido.');
    if (regPin.length !== 6) return alert('A senha deve ter 6 dígitos.');

    const existe = clientesDb.find(c => (c.telefone || '').replace(/\D/g, '') === cleanPhone);

    const clienteData: any = { nome: regNome.trim(), telefone: regTelefone, cpf: regCpf, cep: regCep, logradouro: regLogradouro.trim(), numero: regNumero.trim(), bairro: regBairro.trim(), complemento: regComplemento.trim(), cidade: regCidade.trim(), uf: regUf.trim(), pin: regPin, dataCadastro: Date.now() };
    
    if (regLat !== null && regLng !== null) {
      clienteData.lat = regLat;
      clienteData.lng = regLng;
      clienteData.coordAproximada = false;
    }

    let clienteFinal;

    if (existe) {
      await update(ref(db, `clientes/${existe.id}`), clienteData);
      clienteFinal = { ...existe, ...clienteData };
    } else {
      const newRef = push(ref(db, 'clientes'));
      await set(newRef, clienteData);
      clienteFinal = { id: newRef.key!, ...clienteData };
    }
    
    setCliente(clienteFinal);
    localStorage.setItem('arttburger_cliente_session', JSON.stringify(clienteFinal));
  };

  const handleLogout = () => {
    setCliente(null);
    localStorage.removeItem('arttburger_cliente_session');
    setLoginPhone('');
    setLoginPin('');
    setAuthMode('login');
  };

  const getInicioDiaComercial = () => {
    const agora = new Date();
    const limite = new Date(agora);
    limite.setHours(6, 59, 59, 999);
    if (agora.getTime() <= limite.getTime()) {
      agora.setDate(agora.getDate() - 1);
    }
    agora.setHours(7, 0, 0, 0);
    return agora.getTime();
  };

  const handleEnviarPedido = async () => {
    if (Object.keys(carrinho).length === 0) return alert('Carrinho vazio.');
    if (!formaPagamento) return alert('Selecione a forma de pagamento.');

    if (tipoEntregaApp === 'delivery') {
      const enderecoSelecionado = enderecos[selectedEnderecoIndex];
      if (!enderecoSelecionado) return alert('Selecione um endereço de entrega.');
      
      let lat = enderecoSelecionado.lat;
      let lng = enderecoSelecionado.lng;

      if (!lat || !lng) {
        const q = encodeURIComponent(`${enderecoSelecionado.logradouro}, ${enderecoSelecionado.numero}, ${enderecoSelecionado.cidade}, Brasil`);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
          const data = await res.json();
          if (data && data.length > 0) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); } 
          else return alert('Não conseguimos localizar o seu endereço no mapa para validar a área de entrega. Por favor, ajuste ou use a localização atual.');
        } catch (e) {
          return alert('Erro ao validar a área de entrega com o mapa.');
        }
      }

      if (zonasRestritas.some(zona => isPointInPolygon([lat, lng], zona))) {
        return alert('Desculpe, este endereço está em uma área fora da nossa área de entregas. Por favor, escolha a opção "Retirar na loja".');
      }
    }

    const inicioHoje = getInicioDiaComercial();
    const maxEntrega = Math.max(0, 
      ...entregasAbertas.filter((e: any) => e.timestamp >= inicioHoje).map((e: any) => e.numeroDiario || 0), 
      ...vendasPdv.filter((v: any) => v.tipoPedido === 'Entrega' && v.timestamp >= inicioHoje).map((v: any) => v.numeroDiario || 0)
    );
    const numDiario = maxEntrega + 1;

    const id = `delivery_${Date.now()}`;
    const sessaoId = `sessao_${Date.now()}`;

    const itensParaEnviar = Object.entries(carrinho).map(([cId, item]: any) => {
      const prod = produtos.find(p => p.id === item.produtoId);
      return {
        cartItemId: cId,
        produtoId: item.produtoId,
        nome: item.nome,
        categoria: prod?.categoria || 'Outros',
        qtd: item.qtd,
        opcoes: item.opcoes || null
      };
    });

    const dedupKey = `pedido_app_${Date.now()}`;
    const pedidoPayload = {
      identificador: `Delivery: ${cliente!.nome}`,
      tipo: 'Entrega',
      isRetirada: tipoEntregaApp === 'retirada',
      referenciaId: id,
      itens: itensParaEnviar,
      status: 'Pendente',
      sessaoId,
      timestamp: Date.now(),
      dedupKey,
      origem: 'App Cliente'
    };

    const novoCarrinho = { ...carrinho };
    Object.keys(novoCarrinho).forEach(k => { novoCarrinho[k].enviadoCozinha = novoCarrinho[k].qtd; });

    let nomePagamento = formaPagamento;
    if (formaPagamento === 'pix') nomePagamento = 'Pix';
    else if (formaPagamento === 'dinheiro') nomePagamento = 'Dinheiro';
    else { const t = taxas.find(x => x.id === formaPagamento); if (t) nomePagamento = t.nome; }

    try {
      await set(ref(db, `pedidos_cozinha/${dedupKey}`), pedidoPayload);
      await set(ref(db, `entregas_abertas/${id}`), { clienteId: cliente!.id, clienteNome: cliente!.nome, clienteTelefone: cliente!.telefone, enderecoEntrega: tipoEntregaApp === 'retirada' ? null : enderecos[selectedEnderecoIndex], isRetirada: tipoEntregaApp === 'retirada', carrinho: novoCarrinho, numeroDiario: numDiario, timestamp: Date.now(), sessaoId, formaPagamentoStr: nomePagamento, statusEntrega: 'Pendente', origem: 'App Cliente' });

      setCarrinho({});
      setIsCartOpen(false);
      setActiveTab('pedidos');
      alert('Pedido enviado para o restaurante com sucesso!');
    } catch (e: any) { alert('Erro ao enviar pedido: ' + e.message); }
  };

  const handleForgotPassword = () => {
    const text = encodeURIComponent('Olá, esqueci a senha (PIN) do meu aplicativo de delivery. Podem me ajudar?');
    window.open(`https://wa.me/553898119347?text=${text}`, '_blank');
  };

  const toggleCategory = (cat: string) => {
     if (expandedCategories.includes(cat)) setExpandedCategories(expandedCategories.filter(c => c !== cat));
     else setExpandedCategories([...expandedCategories, cat]);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">Carregando cardápio...</div>;
  }

  // TELA DE LOGIN DO CLIENTE
  if (!cliente) {
    return (
      <div className="min-h-screen bg-orange-500 flex flex-col items-center justify-center p-4" translate="no">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-300">
          <img src={logoImg} alt="ArttBurger" className="h-32 w-auto object-contain mb-6" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">Delivery ArttBurger</h2>
          
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="w-full space-y-4 mt-4">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="tel" required value={loginPhone} onChange={e => setLoginPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-gray-700" />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="password" required maxLength={6} value={loginPin} onChange={e => setLoginPin(e.target.value.replace(/\D/g, ''))} placeholder="Senha (6 dígitos)" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-gray-700 tracking-widest text-center" />
              </div>
              <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-colors shadow-lg flex items-center justify-center gap-2 mt-4">
                Entrar <ChevronRight size={20} />
              </button>
              <div className="flex flex-col gap-2 mt-4 text-center">
                <button type="button" onClick={() => setAuthMode('register')} className="text-orange-600 font-bold hover:underline">Ainda não tem conta? Cadastre-se</button>
                <button type="button" onClick={handleForgotPassword} className="text-gray-400 text-sm hover:underline mt-2">Esqueci minha senha</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="w-full space-y-3 mt-4 max-h-[60vh] overflow-y-auto px-1 pb-4">
              <input type="text" required value={regNome} onChange={e => setRegNome(e.target.value)} placeholder="Nome Completo *" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              <input type="tel" required value={regTelefone} onChange={e => setRegTelefone(formatPhone(e.target.value))} placeholder="Telefone / WhatsApp *" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              <input type="password" required maxLength={6} value={regPin} onChange={e => setRegPin(e.target.value.replace(/\D/g, ''))} placeholder="Criar Senha (6 números) *" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm tracking-widest text-center" />
              <input type="text" value={regCpf} onChange={e => setRegCpf(formatCPF(e.target.value))} placeholder="CPF (Opcional)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              
              <button 
                type="button" 
                onClick={handleGetLocation} 
                disabled={isFetchingLocation}
                className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 border border-blue-200"
              >
                <MapPin size={18} />
                {isFetchingLocation ? 'Buscando localização...' : 'Usar minha localização atual'}
              </button>

              <div className="flex gap-2">
                <input type="text" value={regCep} onChange={handleCepChange} placeholder="CEP *" required className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                <input type="text" value={regUf} onChange={e => setRegUf(e.target.value)} placeholder="UF *" required maxLength={2} className="w-16 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm uppercase text-center" />
              </div>
              <input type="text" value={regLogradouro} onChange={e => setRegLogradouro(e.target.value)} placeholder="Logradouro (Rua/Av) *" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              <div className="flex gap-2">
                <input type="text" id="reg_numero" value={regNumero} onChange={e => setRegNumero(e.target.value)} placeholder="Número *" required className="w-1/3 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                <input type="text" value={regBairro} onChange={e => setRegBairro(e.target.value)} placeholder="Bairro *" required className="w-2/3 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              </div>
              <input type="text" value={regCidade} onChange={e => setRegCidade(e.target.value)} placeholder="Cidade *" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              <input type="text" value={regComplemento} onChange={e => setRegComplemento(e.target.value)} placeholder="Complemento (Apto, Bloco...)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              
              <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-base hover:bg-orange-600 transition-colors shadow-md mt-4">
                Finalizar Cadastro
              </button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-gray-500 py-3 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                Voltar para o Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // TELA DE CARDÁPIO
  return (
    <>
      <div className="min-h-screen bg-animated-gradient flex flex-col font-sans pb-24" translate="no">
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-animated-gradient {
          background: linear-gradient(-45deg, #fdfbfb, #fff7ed, #fffbeb, #fefce8);
          background-size: 400% 400%;
          animation: gradientMove 15s ease infinite;
        }
        .card-hover-effect {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-hover-effect:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 12px 25px -5px rgba(249, 115, 22, 0.15), 0 8px 10px -6px rgba(249, 115, 22, 0.1);
          border-color: #fdba74;
        }
      `}</style>
      {/* Cabeçalho */}
      <header className="bg-white/80 backdrop-blur-md px-4 py-4 shadow-sm sticky top-0 z-50 flex justify-between items-center border-b border-orange-100">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="ArttBurger" className="h-10 w-auto" />
          <div>
            <p className="text-xs text-gray-500">Olá,</p>
            <p className="font-bold text-gray-800 leading-tight truncate max-w-[150px]">{cliente.nome.split(' ')[0]}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full transition-colors"><LogOut size={18} /></button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {activeTab === 'cardapio' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center mb-8 mt-2">
              <h2 className="text-3xl font-black text-gray-800 flex items-center gap-2 drop-shadow-sm"><Utensils className="text-orange-500" size={28} /> Nosso Cardápio</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">O que você vai pedir hoje?</p>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-4 mb-6 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                return (
                  <button 
                    key={cat} 
                    onClick={() => {
                      document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex flex-col items-center min-w-[90px] w-[90px] gap-3 group"
                  >
                    <div className="w-20 h-20 bg-white rounded-[24px] shadow-sm border-2 border-orange-50 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 group-hover:border-orange-400 group-hover:shadow-lg transition-all duration-300 group-active:scale-95">
                      {config?.imageUrl ? (
                        <img src={config.imageUrl} alt={cat} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <Utensils className="text-orange-300 group-hover:text-orange-500 transition-colors duration-300" size={32} />
                      )}
                    </div>
                    <span className="text-sm font-black text-gray-600 text-center leading-tight line-clamp-2 w-full group-hover:text-orange-600 transition-colors duration-300">{cat}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-10">
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                const prodsCat = produtos.filter(p => !p.oculto && (p.categoria || 'Outros') === cat).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
                if (prodsCat.length === 0) return null;
                return (
                  <div key={cat} id={`cat-${cat}`} className="space-y-5 pt-2 scroll-mt-24">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-2 bg-orange-500 rounded-full"></div>
                      <h3 className="text-2xl font-black text-gray-800 tracking-tight">{cat}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-5">
                      {prodsCat.map((p, idx) => (
                        <div 
                          key={p.id} 
                          onClick={() => { setProdutoModal(p); setItemOptions({ montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, bebidas: {}, tamanho: p.opcoes?.tamanhos?.[0]?.nome || '' }); }} 
                          className="bg-white/95 backdrop-blur-sm p-5 rounded-[28px] border border-gray-100 shadow-sm flex gap-4 cursor-pointer card-hover-effect relative overflow-hidden group"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-orange-600 transition-colors duration-300">{p.nome}</h4>
                              {p.ingredientes && <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">Acompanha: {p.ingredientes.map((ing: any) => ing.nome || 'Ingrediente').join(', ')}</p>}
                            </div>
                            <div className="mt-4">
                              <span className="inline-block font-black text-orange-600 text-lg bg-orange-50 px-3 py-1 rounded-xl border border-orange-100 shadow-sm">
                                R$ {Number(p.precoVenda || 0).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          </div>
                          {p.imageUrl ? (
                            <div className="w-32 h-32 shrink-0 rounded-[20px] overflow-hidden shadow-sm border border-gray-100 relative">
                              <img src={p.imageUrl} alt={p.nome} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </div>
                          ) : (
                            <div className="w-32 h-32 bg-gray-50 rounded-[20px] flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-orange-50 transition-colors duration-300">
                              <Utensils size={36} className="text-gray-300 group-hover:text-orange-300 transition-colors duration-300" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="space-y-4">
            <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center"><History className="mr-2 text-orange-500"/> Meus Pedidos</h3>
            {historicoPedidos.length > 0 ? (
              historicoPedidos.map(pedido => (
                <div key={pedido.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                   <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-3">
                     <span className="text-sm font-bold text-gray-500">
                       {new Date(pedido.timestamp).toLocaleDateString('pt-BR')} às {new Date(pedido.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                     </span>
                     <span className={`text-xs font-black px-2 py-1 rounded-lg ${pedido.statusEntrega === 'Concluída' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                       {pedido.statusEntrega || 'Retirado no Local'}
                     </span>
                   </div>
                   <div className="space-y-2 mb-4">
                      {(pedido.itens || []).map((item: any, idx: number) => (
                         <div key={idx} className="flex justify-between text-sm">
                           <span className="font-medium text-gray-800"><span className="text-gray-400 mr-1 font-bold">{item.qtd}x</span> {item.nome}</span>
                           <span className="text-gray-600 font-bold">R$ {(item.preco * item.qtd).toFixed(2).replace('.', ',')}</span>
                         </div>
                      ))}
                   </div>
                   <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total</span>
                     <span className="text-lg font-black text-green-600">R$ {pedido.valor.toFixed(2).replace('.', ',')}</span>
                   </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
                <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Você ainda não fez nenhum pedido.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fidelidade' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
              <h3 className="text-xl font-black text-gray-800 mb-2">Programa Fidelidade</h3>
              <p className="text-sm text-gray-500 mb-4">Acumule carimbos e troque por prêmios incríveis!</p>
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 inline-block mb-4">
                <p className="text-4xl font-black text-orange-600">{fidelidadePontos?.pontos || 0}</p>
                <p className="text-xs font-bold text-orange-800 uppercase tracking-widest mt-1">Carimbos</p>
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl text-left border border-gray-100 leading-relaxed font-medium">
                Lembrando: Somente os produtos consumidos no estabelecimento (presencialmente) são contabilizados no programa de fidelidade. Pedidos via delivery não geram carimbos.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center"><Gift className="mr-2 text-green-500" size={20}/> Prêmios Disponíveis</h4>
              {fidelidadeConfig?.recompensas ? (
                <div className="space-y-3">
                   {Object.entries(fidelidadeConfig.recompensas).filter(([_, r]: any) => r.ativo).map(([id, r]: any) => (
                      <div key={id} className="flex justify-between items-center p-4 border border-gray-100 rounded-xl bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-800">{r.nome}</p>
                          {r.descricao && <p className="text-xs text-gray-500 mt-1">{r.descricao}</p>}
                        </div>
                        <span className="text-xs font-black bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg shrink-0">
                          {fidelidadeConfig.carimbosParaPremio || 10} ★
                        </span>
                      </div>
                   ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhum prêmio configurado no momento.</p>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center"><Star className="mr-2 text-blue-500" size={20}/> Histórico de Pontos</h4>
              {fidelidadePontos?.historico ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                   {Object.entries(fidelidadePontos.historico).sort((a: any, b: any) => b[1].timestamp - a[1].timestamp).map(([id, h]: any) => (
                      <div key={id} className="flex justify-between items-center p-3 border-b border-gray-50 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{h.descricao}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{new Date(h.timestamp).toLocaleString('pt-BR')}</p>
                        </div>
                        <span className={`font-black text-lg ${h.pontos > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {h.pontos > 0 ? '+' : ''}{h.pontos} ★
                        </span>
                      </div>
                   ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Você ainda não possui histórico de pontos.</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] pb-safe z-50">
        <div className="flex justify-around items-center p-2 max-w-2xl mx-auto">
           <button onClick={() => setActiveTab('cardapio')} className={`flex flex-col items-center p-2 flex-1 rounded-xl transition-colors ${activeTab === 'cardapio' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}>
              <Utensils size={22} className="mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Cardápio</span>
           </button>
           <button onClick={() => setActiveTab('pedidos')} className={`flex flex-col items-center p-2 flex-1 rounded-xl transition-colors ${activeTab === 'pedidos' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}>
              <History size={22} className="mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Pedidos</span>
           </button>
           <button onClick={() => setActiveTab('fidelidade')} className={`flex flex-col items-center p-2 flex-1 rounded-xl transition-colors ${activeTab === 'fidelidade' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}>
              <Star size={22} className="mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Fidelidade</span>
           </button>
        </div>
      </div>

      {activeTab === 'cardapio' && Object.keys(carrinho).length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 p-4 pointer-events-none z-40">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <button onClick={() => setIsCartOpen(true)} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 transition-all shadow-lg flex items-center justify-between px-6 border-2 border-orange-400"><div className="flex items-center gap-2"><ShoppingBag size={20} /><span>Ver Carrinho ({Object.keys(carrinho).length})</span></div><span>R$ {valorTotalCarrinho.toFixed(2).replace('.', ',')}</span></button>
          </div>
        </div>
      )}
      </div>

      {/* Modal de Adicionar Produto */}
      {produtoModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start mb-4 shrink-0">
            <div>
              <h3 className="text-xl font-black text-gray-800">{produtoModal.nome}</h3>
              <p className="text-gray-500 mt-1">R$ {Number(produtoModal.precoVenda || 0).toFixed(2).replace('.', ',')}</p>
            </div>
            <button onClick={() => setProdutoModal(null)} className="p-2 bg-gray-100 rounded-full text-gray-500"><XIcon size={20}/></button>
          </div>
          
          <div className="space-y-6 mb-6 overflow-y-auto max-h-[50vh] pr-2">
            {produtoModal.opcoes?.tamanhos && produtoModal.opcoes.tamanhos.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Tamanho</label>
                <div className="flex flex-wrap gap-2">
                  {produtoModal.opcoes.tamanhos.map((t: any) => (
                    <button key={t.id} onClick={() => setItemOptions({...itemOptions, tamanho: t.nome})} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${itemOptions.tamanho === t.nome ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {t.nome} (R$ {Number(t.preco).toFixed(2)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Tipo de Montagem</h4>
              <div className="flex flex-wrap gap-2">
                {(produtoModal.opcoes?.tiposMontagem || []).map((t: any) => (
                  <button key={t.id} onClick={() => setItemOptions((prev: any) => ({ ...prev, montagem: prev.montagem.includes(t.nome) ? [] : [t.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${itemOptions.montagem.includes(t.nome) ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t.nome}</button>
                ))}
                {(produtoModal.opcoes?.tiposMontagem || []).length === 0 && <span className="text-xs text-gray-400">Nenhum configurado.</span>}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Ponto da Carne</h4>
              <div className="flex flex-wrap gap-2">
                {(produtoModal.opcoes?.pontosCarne || []).map((p: any) => (
                  <button key={p.id} onClick={() => setItemOptions({...itemOptions, pontoCarne: itemOptions.pontoCarne === p.nome ? '' : p.nome})} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${itemOptions.pontoCarne === p.nome ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{p.nome}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Adicionais</h4>
              <div className="grid grid-cols-1 gap-3">
                {(produtoModal.opcoes?.adicionais || []).map((a: any) => {
                  const qtd = itemOptions.adicionais[a.id] || 0;
                  return (
                    <div key={a.id} className="flex justify-between items-center p-2 border rounded-lg bg-gray-50">
                      <div>
                        <span className="font-medium text-sm text-gray-800">{a.nome}</span>
                        {a.preco > 0 && <span className="block text-xs text-green-600 font-bold">+ R$ {a.preco.toFixed(2)}</span>}
                      </div>
                      <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border shadow-sm">
                        <button onClick={() => setItemOptions((prev: any) => { const n = {...prev.adicionais}; if (qtd <= 1) delete n[a.id]; else n[a.id] = qtd - 1; return {...prev, adicionais: n}; })} className="text-gray-500 hover:text-red-500 px-3 py-1">-</button>
                        <span className="text-sm font-bold w-4 text-center">{qtd}</span>
                        <button onClick={() => setItemOptions((prev: any) => ({...prev, adicionais: {...prev.adicionais, [a.id]: qtd + 1}}))} className="text-gray-500 hover:text-green-500 px-3 py-1">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Restrições (Sem)</h4>
              <div className="flex flex-wrap gap-2">
                {(produtoModal.opcoes?.restricoesLivres || []).map((r: any) => (
                  <button key={r.id} onClick={() => setItemOptions((prev: any) => ({ ...prev, restricoes: prev.restricoes.includes(r.nome) ? prev.restricoes.filter((n: any) => n !== r.nome) : [...prev.restricoes, r.nome] }))} className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${itemOptions.restricoes.includes(r.nome) ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{r.nome}</button>
                ))}
              </div>
            </div>

            {itemOptions.montagem.some((m: string) => m.toLowerCase().includes('levar com pedido')) && (() => {
              const bebidaProdutos = produtos.filter((p: any) => (p.categoria || '').toLowerCase() === 'bebidas' && !p.oculto);
              if (bebidaProdutos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-700 uppercase tracking-wider text-xs flex items-center gap-1.5">Bebidas</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {bebidaProdutos.map((bev: any) => {
                      const qtd = itemOptions.bebidas?.[bev.id] || 0;
                      return (
                        <div key={bev.id} className="flex justify-between items-center p-2 border rounded-lg bg-orange-50 border-orange-200">
                          <div>
                            <span className="font-medium text-sm text-gray-800">{bev.nome}</span>
                            {Number(bev.precoVenda) > 0 && <span className="block text-xs text-green-600 font-bold">+ R$ {Number(bev.precoVenda).toFixed(2)}</span>}
                          </div>
                          <div className="flex items-center space-x-3 bg-white p-1 rounded-lg border shadow-sm">
                            <button onClick={() => setItemOptions((prev: any) => { const n = {...(prev.bebidas||{})}; if (qtd <= 1) delete n[bev.id]; else n[bev.id] = qtd - 1; return {...prev, bebidas: n}; })} className="text-gray-500 hover:text-red-500 px-3 py-1">-</button>
                            <span className="text-sm font-bold w-4 text-center">{qtd}</span>
                            <button onClick={() => setItemOptions((prev: any) => ({...prev, bebidas: {...(prev.bebidas||{}), [bev.id]: qtd + 1}}))} className="text-gray-500 hover:text-green-500 px-3 py-1">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Observações (opcional)</label>
              <textarea value={itemOptions.observacao} onChange={e => setItemOptions({...itemOptions, observacao: e.target.value})} placeholder="Ex: Tirar cebola, ponto da carne..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 outline-none focus:border-orange-500 text-sm" rows={2}/>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="font-bold text-gray-700">Quantidade</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setItemOptions({...itemOptions, quantidade: Math.max(1, itemOptions.quantidade - 1)})} className="p-2 bg-white rounded-lg shadow-sm text-orange-600"><Minus size={18}/></button>
                <span className="font-black text-lg w-4 text-center">{itemOptions.quantidade}</span>
                <button onClick={() => setItemOptions({...itemOptions, quantidade: itemOptions.quantidade + 1})} className="p-2 bg-white rounded-lg shadow-sm text-orange-600"><Plus size={18}/></button>
              </div>
            </div>
          </div>
          
          <button onClick={() => {
            const cartItemId = `${produtoModal.id}_${Date.now()}`;
            const selectedTamanho = (produtoModal.opcoes?.tamanhos || []).find((t: any) => t.nome === itemOptions.tamanho);
            const basePrice = selectedTamanho ? Number(selectedTamanho.preco) : Number(produtoModal.precoVenda || 0);
            
            let adicionaisPrice = 0;
            Object.entries(itemOptions.adicionais).forEach(([addId, qtd]: [string, any]) => {
              const add = (produtoModal.opcoes?.adicionais || []).find((a: any) => a.id === addId);
              if (add) adicionaisPrice += Number(add.preco || 0) * qtd;
            });

            let bebidasPrice = 0;
            const bebidasSelecionadas = Object.entries(itemOptions.bebidas || {}).filter(([, qtd]: [string, any]) => qtd > 0);
            bebidasSelecionadas.forEach(([prodId, qtd]: [string, any]) => {
              const prod = produtos.find((p: any) => p.id === prodId);
              if (prod) bebidasPrice += Number(prod.precoVenda || 0) * qtd;
            });

            const unitPrice = basePrice + adicionaisPrice + bebidasPrice;
            const hasOptions = itemOptions.tamanho || itemOptions.montagem.length > 0 || itemOptions.pontoCarne || Object.keys(itemOptions.adicionais).length > 0 || itemOptions.restricoes.length > 0 || itemOptions.observacao || bebidasSelecionadas.length > 0;
            const nomeFinal = selectedTamanho ? `${produtoModal.nome} (${selectedTamanho.nome})` : produtoModal.nome;
            
            const opcoesObj = hasOptions ? { tamanho: itemOptions.tamanho, montagem: itemOptions.montagem, pontoCarne: itemOptions.pontoCarne, adicionais: Object.entries(itemOptions.adicionais).map(([addId, qtd]: [string, any]) => { const add = (produtoModal.opcoes?.adicionais || []).find((a: any) => a.id === addId); return { id: add?.id, nome: add?.nome, qtd, preco: Number(add?.preco || 0), insumoId: add?.insumoId, quantidadeInsumo: add?.quantidade || 1 }; }), restricoes: itemOptions.restricoes, observacao: itemOptions.observacao, bebidas: bebidasSelecionadas.map(([prodId, qtd]: [string, any]) => { const prod = produtos.find((p: any) => p.id === prodId); return { id: prodId, nome: prod?.nome || prodId, qtd, preco: Number(prod?.precoVenda || 0) }; }) } : null;
            
            setCarrinho(prev => ({ ...prev, [cartItemId]: { produtoId: produtoModal.id, nome: nomeFinal, preco: unitPrice, qtd: itemOptions.quantidade, opcoes: opcoesObj, enviadoCozinha: 0, adicionadoPor: cliente?.nome || 'App Delivery', adicionadoEm: Date.now() } }));
            setProdutoModal(null);
            setItemOptions({ montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, bebidas: {}, tamanho: '' });
            alert('Item adicionado ao carrinho!');
          }} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 shadow-md shrink-0">
            Adicionar — R$ {(((() => { const st = (produtoModal.opcoes?.tamanhos || []).find((t: any) => t.nome === itemOptions.tamanho); const bp = st ? Number(st.preco) : Number(produtoModal.precoVenda || 0); let addP = 0; Object.entries(itemOptions.adicionais).forEach(([id, q]: [string, any]) => { const a = (produtoModal.opcoes?.adicionais||[]).find((ad:any)=>ad.id===id); if(a) addP += Number(a.preco||0)*q; }); let bevP = 0; Object.entries(itemOptions.bebidas||{}).forEach(([id, q]: [string, any]) => { const p = produtos.find(pr=>pr.id===id); if(p) bevP += Number(p.precoVenda||0)*q; }); return bp + addP + bevP; })()) * itemOptions.quantidade).toFixed(2).replace('.', ',')}
          </button>
        </div>
      </div>
    )}

    {/* Checkout / Carrinho */}
    {isCartOpen && (
      <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col animate-in slide-in-from-bottom-4">
        <div className="bg-white px-4 py-4 shadow-sm flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black text-gray-800 flex items-center"><ShoppingBag className="mr-2 text-orange-500"/> Seu Carrinho</h2>
          <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><XIcon size={20}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            {Object.entries(carrinho).map(([id, item]: any) => (
              <div key={id} className="flex justify-between items-start border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                <div><p className="font-bold text-gray-800">{item.qtd}x {item.nome}</p>{item.opcoes?.observacao && <p className="text-xs text-gray-500 mt-1">Obs: {item.opcoes.observacao}</p>}<p className="text-sm font-black text-orange-600 mt-1">R$ {(item.preco * item.qtd).toFixed(2).replace('.', ',')}</p></div>
                <button onClick={() => { const novo = {...carrinho}; delete novo[id]; setCarrinho(novo); if (Object.keys(novo).length === 0) setIsCartOpen(false); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-lg"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-gray-800 mb-2">Forma de Entrega</h3>
            <div className="flex gap-2">
              <button onClick={() => setTipoEntregaApp('delivery')} className={`flex-1 p-3 rounded-xl font-bold transition-colors border ${tipoEntregaApp === 'delivery' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-200 text-gray-500'}`}>Receber em casa</button>
              <button onClick={() => setTipoEntregaApp('retirada')} className={`flex-1 p-3 rounded-xl font-bold transition-colors border ${tipoEntregaApp === 'retirada' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-200 text-gray-500'}`}>Retirar na loja</button>
            </div>
          </div>

          {tipoEntregaApp === 'delivery' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-gray-800 mb-2">Enviar para qual endereço?</h3>
            
            {enderecos.map((end, idx) => (
              <label key={idx} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedEnderecoIndex === idx ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="enderecoEntrega" 
                  checked={selectedEnderecoIndex === idx} 
                  onChange={() => setSelectedEnderecoIndex(idx)}
                  className="mt-1 accent-orange-500"
                />
                <div className="text-sm">
                  <p className="font-bold text-gray-800">{end.logradouro}, {end.numero}</p>
                  <p className="text-gray-500">{end.bairro} - {end.cidade}/{end.uf}</p>
                  {end.complemento && <p className="text-gray-400 text-xs">Comp: {end.complemento}</p>}
                </div>
              </label>
            ))}

            {isAddingAddress ? (
              <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/50 mt-4 space-y-3">
                <h4 className="font-bold text-orange-800 text-sm mb-2 flex justify-between items-center">
                  Novo Endereço
                  <button onClick={() => setIsAddingAddress(false)} className="text-gray-400 hover:text-gray-600"><XIcon size={16}/></button>
                </h4>
                <button 
                  type="button" 
                  onClick={handleNewEndGetLocation} 
                  disabled={isFetchingNewLocation}
                  className="w-full bg-blue-50 text-blue-600 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 border border-blue-200"
                >
                  <MapPin size={14} />
                  {isFetchingNewLocation ? 'Buscando...' : 'Usar localização atual'}
                </button>

                <div className="flex gap-2">
                  <input type="text" value={newEndCep} onChange={(e) => { const val = formatCEP(e.target.value); setNewEndCep(val); if (val.replace(/\D/g, '').length === 8) { fetch(`https://viacep.com.br/ws/${val.replace(/\D/g, '')}/json/`).then(r=>r.json()).then(d=>{if(!d.erro){setNewEndLogradouro(d.logradouro||'');setNewEndBairro(d.bairro||'');setNewEndCidade(d.localidade||'');setNewEndUf(d.uf||'');}}); } }} placeholder="CEP *" className="flex-1 p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                  <input type="text" value={newEndUf} onChange={e => setNewEndUf(e.target.value)} placeholder="UF *" maxLength={2} className="w-12 p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs uppercase text-center" />
                </div>
                <input type="text" value={newEndLogradouro} onChange={e => setNewEndLogradouro(e.target.value)} placeholder="Logradouro (Rua/Av) *" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                <div className="flex gap-2">
                  <input type="text" value={newEndNumero} onChange={e => setNewEndNumero(e.target.value)} placeholder="Número *" className="w-1/3 p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                  <input type="text" value={newEndBairro} onChange={e => setNewEndBairro(e.target.value)} placeholder="Bairro *" className="w-2/3 p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                </div>
                <input type="text" value={newEndCidade} onChange={e => setNewEndCidade(e.target.value)} placeholder="Cidade *" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                <input type="text" value={newEndComplemento} onChange={e => setNewEndComplemento(e.target.value)} placeholder="Complemento (Apto, Bloco...)" className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500 font-bold text-xs" />
                <button onClick={handleAddNewAddress} className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-orange-600 transition-colors shadow-sm">Salvar Endereço</button>
              </div>
            ) : (
              <button onClick={() => setIsAddingAddress(true)} className="w-full py-2.5 mt-2 border-2 border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-500 hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> Adicionar novo endereço
              </button>
            )}
          </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h3 className="font-bold text-gray-800 mb-2">Forma de Pagamento (Pagar na Entrega)</h3>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-gray-700">
              <option value="">Selecione como vai pagar...</option><option value="pix">Pix (Chave com entregador)</option><option value="dinheiro">Dinheiro Físico</option>{taxas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex justify-between items-center"><span className="font-bold text-orange-800">Total do Pedido</span><span className="text-2xl font-black text-orange-600">R$ {valorTotalCarrinho.toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div className="bg-white p-4 border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] shrink-0 pb-safe">
          <div className="max-w-2xl mx-auto"><button onClick={handleEnviarPedido} disabled={!formaPagamento || Object.keys(carrinho).length === 0} className="w-full bg-green-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-green-600 disabled:opacity-50 transition-colors shadow-lg flex justify-center items-center"><CheckCircle size={20} className="mr-2"/> Confirmar e Fazer Pedido</button></div>
        </div>
      </div>
      )}
    </>
  );
}