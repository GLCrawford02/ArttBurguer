import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from './firebase';
import { Utensils, Phone, User, ShoppingBag, LogOut, ChevronRight, ChevronDown, ChevronUp, MapPin, KeyRound, Clock, Star, Gift, History, X as XIcon, Trash2, CheckCircle, Minus, Plus, Heart, WifiOff, RefreshCw, Download } from 'lucide-react';
import logoImg from './assets/logo.png';

export const APP_CLIENTE_VERSION = '1.2.13';

const isVersionOutdated = (server: string, local: string) => {
  const sv = server.split('.').map(Number);
  const lv = local.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((sv[i] || 0) > (lv[i] || 0)) return true;
    if ((sv[i] || 0) < (lv[i] || 0)) return false;
  }
  return false;
};

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  pin?: string;
  cpf?: string;
  dataNascimento?: string;
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
  favoritos?: string[];
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
  let x = Number(point[0]), y = Number(point[1]);
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = Number(vs[i][0]), yi = Number(vs[i][1]);
    let xj = Number(vs[j][0]), yj = Number(vs[j][1]);
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

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateConfig, setUpdateConfig] = useState<{ versao: string; linkDownload: string; forcar: boolean; mensagem: string } | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const [otpTelefone, setOtpTelefone] = useState('');
  const [otpCodigo, setOtpCodigo] = useState('');
  const [otpStep, setOtpStep] = useState<'telefone' | 'codigo' | 'nome'>('telefone');
  const [otpNome, setOtpNome] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpErro, setOtpErro] = useState('');

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

  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedidos' | 'perfil'>('cardapio');
  const [perfilSubTab, setPerfilSubTab] = useState<'dados' | 'fidelidade'>('dados');
  const [categoriaExpandida, setCategoriaExpandida] = useState<string | null>(null);
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);
  const [carrosselImagens, setCarrosselImagens] = useState<string[]>([]);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // Carrinho e Checkout
  const [carrinho, setCarrinho] = useState<Record<string, any>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [produtoModal, setProdutoModal] = useState<any>(null);
  const [itemOptions, setItemOptions] = useState<any>({ montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, bebidas: {}, tamanho: '' });
  const [formaPagamento, setFormaPagamento] = useState('');
  const [trocoPara, setTrocoPara] = useState('');
  const [tipoEntregaApp, setTipoEntregaApp] = useState<'delivery' | 'retirada'>('delivery');
  const [taxas, setTaxas] = useState<any[]>([]);
  const [zonasRestritas, setZonasRestritas] = useState<any[]>([]);
  const [zonasValor, setZonasValor] = useState<any[]>([]);
  const [taxasEntregaConfig, setTaxasEntregaConfig] = useState<any>({ taxas: {}, lojaLat: null, lojaLng: null });
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

  // Edição de Perfil
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editCep, setEditCep] = useState('');
  const [editLogradouro, setEditLogradouro] = useState('');
  const [editNumero, setEditNumero] = useState('');
  const [editBairro, setEditBairro] = useState('');
  const [editComplemento, setEditComplemento] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [editUf, setEditUf] = useState('');
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [isFetchingEditLocation, setIsFetchingEditLocation] = useState(false);

  // Detecção offline
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Permissões (localização + notificações)
  useEffect(() => {
    const requestPerms = async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        await Geolocation.requestPermissions();
      } catch {
        try { navigator.geolocation.getCurrentPosition(() => {}); } catch {}
      }
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') PushNotifications.register();
      } catch {
        try { await (Notification as any).requestPermission(); } catch {}
      }
    };
    requestPerms();
  }, []);

  // Verificar atualização do app cliente
  useEffect(() => {
    const r = ref(db, 'configuracoes/app_update_cliente');
    return onValue(r, snap => { if (snap.val()) setUpdateConfig(snap.val()); });
  }, []);

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
        let z = snap.val().zonasRestritas;
        if (z && !Array.isArray(z)) z = Object.values(z);
        setZonasRestritas(z || []);
        let zv = snap.val().zonasValor;
        if (zv && !Array.isArray(zv)) zv = Object.values(zv);
        setZonasValor(zv || []);
        setTaxasEntregaConfig({ taxas: snap.val().taxas || {}, lojaLat: snap.val().loja_lat || null, lojaLng: snap.val().loja_lng || null });
      }
    });

    const carrosselRef = ref(db, 'configuracoes/app_delivery/carrossel');
    const unsubCar = onValue(carrosselRef, snap => {
      if (snap.val()) {
        const list = Object.values(snap.val()).map((c: any) => c.url).filter(Boolean);
        setCarrosselImagens(list);
      } else {
        setCarrosselImagens([]);
      }
    });

    return () => { unsubClientes(); unsubProd(); unsubCat(); unsubConfig(); unsubCar(); };
  }, []);

  useEffect(() => {
    if (carrosselImagens.length > 1 && !categoriaExpandida) {
      const interval = setInterval(() => {
        setCurrentImgIndex(prev => (prev + 1) % carrosselImagens.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [carrosselImagens, categoriaExpandida]);

  useEffect(() => {
    if (cliente) {
      setEditNome(cliente.nome || '');
      setEditTelefone(cliente.telefone || '');
      setEditCpf(cliente.cpf || '');
      setEditDataNascimento(cliente.dataNascimento || '');
      setEditCep(cliente.cep || '');
      setEditLogradouro(cliente.logradouro || '');
      setEditNumero(cliente.numero || '');
      setEditBairro(cliente.bairro || '');
      setEditComplemento(cliente.complemento || '');
      setEditCidade(cliente.cidade || '');
      setEditUf(cliente.uf || '');
      setEditLat(cliente.lat ?? null);
      setEditLng(cliente.lng ?? null);

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

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateDeliveryFee = (endereco: any) => {
    if (!endereco || !endereco.lat || !endereco.lng) return null;

    // 1. Checa se está em zona com valor fixo (MAIS ESPECÍFICO)
    const zonaComValor = zonasValor.find(zona => isPointInPolygon([Number(endereco.lat), Number(endereco.lng)], zona.coords || zona));
    if (zonaComValor) {
      return Number(zonaComValor.valor);
    }

    // 2. Se não, checa se está em zona restrita
    if (zonasRestritas.some(zona => isPointInPolygon([Number(endereco.lat), Number(endereco.lng)], zona.coords || zona))) {
      return 'restrita';
    }

    // 3. Calcula por distância (fallback)
    if (taxasEntregaConfig.lojaLat && taxasEntregaConfig.lojaLng) {
      const dist = getDistanceFromLatLonInKm(taxasEntregaConfig.lojaLat, taxasEntregaConfig.lojaLng, endereco.lat, endereco.lng);
      const km = Math.ceil(dist);
      if (km <= 20 && taxasEntregaConfig.taxas[km] && taxasEntregaConfig.taxas[km] > 0) {
        return Number(taxasEntregaConfig.taxas[km]);
      }
    }
    
    // 4. Se não se encaixa em nenhuma regra, é fora da área.
    return 'restrita';
  };

  const taxaEntregaCalculada = tipoEntregaApp === 'delivery' && enderecos[selectedEnderecoIndex] ? calculateDeliveryFee(enderecos[selectedEnderecoIndex]) : 0;
  const taxaEntrega = typeof taxaEntregaCalculada === 'number' ? taxaEntregaCalculada : 0;
  const subtotalCarrinho = Object.values(carrinho).reduce((acc: number, item: any) => acc + (item.preco * item.qtd), 0);
  const valorTotalCarrinho = subtotalCarrinho + (taxaEntrega || 0);

  const formatCEP = (val: string) => val.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  const formatCPF = (val: string) => val.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
  const formatPhone = (val: string) => {
    let v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
    return v;
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

  const handleEditGetLocation = () => {
    setIsFetchingEditLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setEditLat(lat);
        setEditLng(lng);
        
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'pt-BR' }
          });
          const data = await response.json();
          
          if (data && data.address) {
            setEditCep(data.address.postcode ? data.address.postcode.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2') : '');
            setEditLogradouro(data.address.road || data.address.pedestrian || '');
            setEditBairro(data.address.suburb || data.address.neighbourhood || data.address.city_district || '');
            setEditCidade(data.address.city || data.address.town || data.address.village || data.address.municipality || '');
            setEditUf(data.address.state ? getStateCode(data.address.state) : '');
            setEditNumero('');
            document.getElementById('edit_numero')?.focus();
          }
        } catch (error) {
          console.error("Erro ao buscar endereço:", error);
          alert("Não foi possível preencher o endereço automaticamente.");
        } finally {
          setIsFetchingEditLocation(false);
        }
      }, (error) => {
        console.error(error);
        alert("Não foi possível obter sua localização. Verifique as permissões de GPS.");
        setIsFetchingEditLocation(false);
      }, { enableHighAccuracy: true });
    } else {
      alert("Geolocalização não suportada.");
      setIsFetchingEditLocation(false);
    }
  };

  const handleEditCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatCEP(e.target.value);
    setEditCep(val);
    const justNumbers = val.replace(/\D/g, '');
    
    if (justNumbers.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${justNumbers}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setEditLogradouro(data.logradouro || '');
          setEditBairro(data.bairro || '');
          setEditCidade(data.localidade || '');
          setEditUf(data.uf || '');
          document.getElementById('edit_numero')?.focus();
        }
      } catch (error) {
        console.error(error);
      }
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

  const handleEnviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const tel = otpTelefone.replace(/\D/g, '');
    if (tel.length < 10) { setOtpErro('Telefone inválido. Inclua o DDD.'); return; }
    setOtpLoading(true);
    setOtpErro('');
    try {
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      await set(ref(db, `otp_codigos/${tel}`), { code: codigo, expiresAt, usado: false });
      const mensagem = `🍔 *ArttBurger*\n\nSeu código de verificação: *${codigo}*\n\nVálido por 5 minutos.`;
      await set(ref(db, `fila_mensagens/${Date.now()}_otp_${tel}`), {
        telefone: tel,
        mensagem,
        status: 'pendente',
        timestamp: Date.now(),
        origem: 'login_cliente',
      });
      setOtpStep('codigo');
    } catch (e: any) {
      setOtpErro('Erro ao enviar código: ' + (e?.message || e?.code || 'Tente novamente.'));
    }
    setOtpLoading(false);
  };

  const handleVerificarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const tel = otpTelefone.replace(/\D/g, '');
    setOtpLoading(true);
    setOtpErro('');
    try {
      const snap = await get(ref(db, `otp_codigos/${tel}`));
      const data = snap.val();
      if (!data) { setOtpErro('Código expirado. Solicite um novo.'); setOtpLoading(false); return; }
      if (data.usado) { setOtpErro('Código já utilizado. Solicite um novo.'); setOtpLoading(false); return; }
      if (Date.now() > data.expiresAt) { setOtpErro('Código expirado. Solicite um novo.'); setOtpLoading(false); return; }
      if (data.code !== otpCodigo.trim()) { setOtpErro('Código incorreto.'); setOtpLoading(false); return; }
      await set(ref(db, `otp_codigos/${tel}/usado`), true);
      const normalizePhone = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 11 ? d.substring(0, 2) + d.substring(3) : d; };
      const existe = clientesDb.find(c => normalizePhone(c.telefone || '') === normalizePhone(tel));
      if (existe) {
        setCliente(existe);
        localStorage.setItem('arttburger_cliente_session', JSON.stringify(existe));
      } else {
        setOtpStep('nome');
      }
    } catch {
      setOtpErro('Erro ao verificar código. Tente novamente.');
    }
    setOtpLoading(false);
  };

  const handleCompletarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpNome.trim()) { setOtpErro('Por favor, informe seu nome.'); return; }
    setOtpLoading(true);
    setOtpErro('');
    try {
      const tel = otpTelefone.replace(/\D/g, '');
      const clienteData = { nome: otpNome.trim(), telefone: tel, dataCadastro: Date.now() };
      const newRef = push(ref(db, 'clientes'));
      await set(newRef, clienteData);
      const clienteFinal = { id: newRef.key!, ...clienteData };
      setCliente(clienteFinal);
      localStorage.setItem('arttburger_cliente_session', JSON.stringify(clienteFinal));
    } catch {
      setOtpErro('Erro ao finalizar cadastro. Tente novamente.');
    }
    setOtpLoading(false);
  };

  const handleLogout = () => {
    setCliente(null);
    localStorage.removeItem('arttburger_cliente_session');
    setOtpTelefone('');
    setOtpCodigo('');
    setOtpStep('telefone');
    setOtpErro('');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    const cleanPhone = editTelefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return alert('Por favor, digite um telefone válido.');

    const normalizePhoneForComparison = (p: string) => {
      const digits = p.replace(/\D/g, '');
      if (digits.length === 11) return digits.substring(0, 2) + digits.substring(3);
      return digits;
    };
    const targetPhone = normalizePhoneForComparison(cleanPhone);
    const existe = clientesDb.find(c => normalizePhoneForComparison(c.telefone || '') === targetPhone && c.id !== cliente.id);
    if (existe) return alert('Este telefone já está sendo usado por outro cliente.');

    const updateData: any = {
      nome: editNome.trim(),
      telefone: editTelefone,
      cpf: editCpf,
      dataNascimento: editDataNascimento,
      cep: editCep,
      logradouro: editLogradouro.trim(),
      numero: editNumero.trim(),
      bairro: editBairro.trim(),
      complemento: editComplemento.trim(),
      cidade: editCidade.trim(),
      uf: editUf.trim()
    };

    if (editLat !== null && editLng !== null) {
      updateData.lat = editLat;
      updateData.lng = editLng;
      updateData.coordAproximada = false;
    }

    try {
      await update(ref(db, `clientes/${cliente.id}`), updateData);
      const updatedCliente = { ...cliente, ...updateData };
      setCliente(updatedCliente);
      localStorage.setItem('arttburger_cliente_session', JSON.stringify(updatedCliente));
      alert('Perfil atualizado com sucesso!');
    } catch (err) {
      alert('Erro ao atualizar perfil.');
    }
  };

  const toggleFavorito = async (produtoId: string) => {
    if (!cliente) return;
    const favs = cliente.favoritos || [];
    const newFavs = favs.includes(produtoId) ? favs.filter((id: string) => id !== produtoId) : [...favs, produtoId];
    
    await update(ref(db, `clientes/${cliente.id}`), { favoritos: newFavs });
    const updatedCliente = { ...cliente, favoritos: newFavs };
    setCliente(updatedCliente);
    localStorage.setItem('arttburger_cliente_session', JSON.stringify(updatedCliente));
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
    
    let taxaFinal = taxaEntregaCalculada;
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
          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lng = parseFloat(data[0].lon);
            // Recalcula a taxa com as coordenadas encontradas
            taxaFinal = calculateDeliveryFee({ ...enderecoSelecionado, lat, lng });
          } else {
            return alert('Não conseguimos localizar o seu endereço no mapa para validar a área de entrega. Por favor, ajuste ou use a localização atual.');
          }
        } catch (e) {
          return alert('Erro ao validar a área de entrega com o mapa.');
        }
      }

      if (taxaFinal === 'restrita') {
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
    if (formaPagamento === 'Pix') nomePagamento = 'Pix';
    else if (formaPagamento === 'Dinheiro') nomePagamento = `Dinheiro${trocoPara ? ` (Troco para R$ ${trocoPara})` : ''}`;
    else if (formaPagamento === 'Credito') nomePagamento = 'Cartão de Crédito';
    else if (formaPagamento === 'Debito') nomePagamento = 'Cartão de Débito';
    else { const t = taxas.find(x => x.id === formaPagamento); if (t) nomePagamento = t.nome; }

    try {
      await set(ref(db, `pedidos_cozinha/${dedupKey}`), pedidoPayload);
      await set(ref(db, `entregas_abertas/${id}`), {
        clienteId: cliente!.id,
        clienteNome: cliente!.nome,
        clienteTelefone: cliente!.telefone,
        enderecoEntrega: tipoEntregaApp === 'retirada' ? null : enderecos[selectedEnderecoIndex],
        isRetirada: tipoEntregaApp === 'retirada',
        carrinho: novoCarrinho,
        numeroDiario: numDiario,
        timestamp: Date.now(),
        sessaoId,
        formaPagamentoStr: nomePagamento,
        statusEntrega: 'Pendente',
        origem: 'App Cliente',
        taxaEntrega: tipoEntregaApp === 'retirada' ? 0 : (taxaFinal === 'restrita' ? 0 : (taxaFinal || 0))
      });
      await set(ref(db, `despachos/${id}`), {
        id,
        clienteId: cliente!.id,
        clienteNome: cliente!.nome,
        clienteTelefone: cliente!.telefone,
        enderecoEntrega: tipoEntregaApp === 'retirada' ? null : enderecos[selectedEnderecoIndex],
        isRetirada: tipoEntregaApp === 'retirada',
        itens: itensParaEnviar,
        numeroDiario: numDiario,
        timestamp: Date.now(),
        sessaoId,
        formaPagamentoStr: nomePagamento,
        status: 'aguardando',
        taxaEntrega: tipoEntregaApp === 'retirada' ? 0 : (taxaFinal === 'restrita' ? 0 : (taxaFinal || 0)),
        total: valorTotalCarrinho,
        origem: 'App Cliente',
      });

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

  const renderProdutoCard = (p: any, idx: number) => (
    <div 
      key={p.id} 
      onClick={() => { setProdutoModal(p); setItemOptions({ montagem: [], pontoCarne: '', adicionais: {}, restricoes: [], observacao: '', quantidade: 1, bebidas: {}, tamanho: p.opcoes?.tamanhos?.[0]?.nome || '' }); }} 
      className="bg-white/95 backdrop-blur-sm p-5 rounded-[28px] border border-gray-100 shadow-sm flex gap-4 cursor-pointer card-hover-effect relative overflow-hidden group"
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-orange-600 transition-colors duration-300 pr-2">{p.nome}</h4>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleFavorito(p.id); }}
              className="p-2 -mt-2 -mr-2 rounded-full hover:bg-red-50 transition-colors shrink-0"
            >
              <Heart size={22} className={cliente?.favoritos?.includes(p.id) ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-red-400'} />
            </button>
          </div>
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
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-500 flex flex-col items-center justify-center p-4" translate="no">
        <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
          <div className="bg-white p-6 rounded-[2rem] shadow-2xl mb-6 relative">
            <div className="absolute inset-0 bg-white rounded-[2rem] animate-ping opacity-20"></div>
            <img src={logoImg} alt="ArttBurger" className="h-32 w-auto object-contain relative z-10 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 drop-shadow-md">ArttBurger</h2>
          <div className="flex items-center gap-2 text-orange-100 font-bold tracking-wide">
            <div className="w-4 h-4 border-4 border-orange-200 border-t-white rounded-full animate-spin"></div>
            Carregando cardápio...
          </div>
        </div>
      </div>
    );
  }

  // TELA SEM INTERNET
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-center" translate="no">
        <div className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6">
          <img src={logoImg} alt="ArttBurger" className="h-24 w-auto object-contain" />
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <WifiOff size={32} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Sem conexão com a internet</h2>
            <p className="text-sm text-gray-500 leading-relaxed">Conecte-se ao Wi-Fi ou ative seus dados móveis para continuar pedindo.</p>
          </div>
          <div className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700 font-medium">
            ⚠️ Pedidos sem internet não chegam ao restaurante. Não faça pedidos nessa situação.
          </div>
        </div>
      </div>
    );
  }

  // TELA DE ATUALIZAÇÃO OBRIGATÓRIA
  const needsUpdate = updateConfig && isVersionOutdated(updateConfig.versao, APP_CLIENTE_VERSION);
  if (needsUpdate && updateConfig!.forcar) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-center" translate="no">
        <div className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6">
          <img src={logoImg} alt="ArttBurger" className="h-24 w-auto object-contain" />
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
            <RefreshCw size={32} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Nova versão disponível</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {updateConfig!.mensagem || 'Uma atualização obrigatória está disponível. Baixe a nova versão para continuar.'}
            </p>
            <p className="text-xs text-gray-400 mt-2">Versão atual: {APP_CLIENTE_VERSION} → Nova: {updateConfig!.versao}</p>
          </div>
          {updateConfig!.linkDownload && (
            <a href={updateConfig!.linkDownload} target="_blank" rel="noreferrer"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg">
              <Download size={20} /> Baixar Atualização
            </a>
          )}
        </div>
      </div>
    );
  }

  // TELA DE LOGIN DO CLIENTE
  if (!cliente) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4" translate="no">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-300">
          <div className="flex justify-center mb-6">
            <img src={logoImg} alt="ArttBurger" className="h-36 w-auto object-contain" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-1 text-center">ArttBurger Delivery</h2>

          {otpStep === 'telefone' && (
            <form onSubmit={handleEnviarOtp} className="w-full space-y-4 mt-5">
              <p className="text-sm text-gray-500 text-center">Informe seu WhatsApp para receber o código de acesso.</p>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="tel" required value={otpTelefone} onChange={e => setOtpTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-gray-700 text-lg" />
              </div>
              {otpErro && <p className="text-red-500 text-sm font-medium text-center">{otpErro}</p>}
              <button type="submit" disabled={otpLoading} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg flex items-center justify-center gap-2">
                {otpLoading ? 'Enviando...' : <><ChevronRight size={20} /> Receber código no WhatsApp</>}
              </button>
            </form>
          )}

          {otpStep === 'codigo' && (
            <form onSubmit={handleVerificarOtp} className="w-full space-y-4 mt-5">
              <div className="text-center">
                <p className="text-gray-500 text-sm">Código enviado para</p>
                <p className="font-black text-gray-800 text-lg">{otpTelefone}</p>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="number" required value={otpCodigo} onChange={e => setOtpCodigo(e.target.value.slice(0, 6))} placeholder="000000" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-gray-700 tracking-widest text-center text-3xl" />
              </div>
              {otpErro && <p className="text-red-500 text-sm font-medium text-center">{otpErro}</p>}
              <button type="submit" disabled={otpLoading || otpCodigo.length !== 6} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg flex items-center justify-center gap-2">
                {otpLoading ? 'Verificando...' : <><ChevronRight size={20} /> Entrar</>}
              </button>
              <button type="button" onClick={() => { setOtpStep('telefone'); setOtpErro(''); setOtpCodigo(''); }} className="w-full text-orange-500 font-bold py-2 text-sm hover:underline">
                Trocar número
              </button>
            </form>
          )}

          {otpStep === 'nome' && (
            <form onSubmit={handleCompletarCadastro} className="w-full space-y-4 mt-5">
              <p className="text-sm text-gray-500 text-center">Bem-vindo! Como podemos te chamar?</p>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" required autoFocus value={otpNome} onChange={e => setOtpNome(e.target.value)} placeholder="Seu nome completo" className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-gray-700" />
              </div>
              {otpErro && <p className="text-red-500 text-sm font-medium text-center">{otpErro}</p>}
              <button type="submit" disabled={otpLoading} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-lg flex items-center justify-center gap-2">
                {otpLoading ? 'Salvando...' : <><ChevronRight size={20} /> Continuar</>}
              </button>
            </form>
          )}

          <button type="button" onClick={handleForgotPassword} className="text-gray-400 text-xs hover:underline mt-6">Precisa de ajuda?</button>
        </div>
      </div>
    );
  }

  // TELA DE CARDÁPIO
  return (
    <>
      {/* Banner de atualização disponível (não obrigatória) */}
      {needsUpdate && !updateConfig!.forcar && !updateDismissed && updateConfig!.linkDownload && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0">
            <RefreshCw size={16} className="shrink-0" />
            <span className="truncate">Nova versão {updateConfig!.versao} disponível!</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={updateConfig!.linkDownload} target="_blank" rel="noreferrer"
              className="bg-white text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1">
              <Download size={12} /> Atualizar
            </a>
            <button onClick={() => setUpdateDismissed(true)} className="text-indigo-200 hover:text-white">
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-animated-gradient flex flex-col font-sans pb-24" translate="no">
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-animated-gradient {
          background: linear-gradient(-45deg, #ffedd5, #fed7aa, #fde68a, #fef3c7);
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
            <div className="flex justify-between items-center mb-6 mt-2 px-1">
              <h2 className="text-3xl font-black text-gray-800 flex items-center gap-2 drop-shadow-sm"><Utensils className="text-orange-500" size={28} /> Nosso Cardápio</h2>
              <button 
                onClick={() => setMostrarFavoritos(!mostrarFavoritos)} 
                className="p-2.5 rounded-full bg-white border border-gray-100 shadow-sm hover:bg-red-50 transition-colors"
                title="Meus Favoritos"
              >
                <Heart size={24} className={mostrarFavoritos ? "fill-red-500 text-red-500" : "text-red-400"} />
              </button>
            </div>
            
            {mostrarFavoritos ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="grid grid-cols-1 gap-4">
                  {produtos.filter(p => cliente?.favoritos?.includes(p.id)).length > 0 ? (
                    produtos.filter(p => cliente?.favoritos?.includes(p.id)).map((p, idx) => renderProdutoCard(p, idx))
                  ) : (
                    <div className="text-center py-10 bg-white rounded-3xl shadow-sm border border-gray-100">
                      <Heart size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">Você ainda não tem produtos favoritos.</p>
                      <button onClick={() => setMostrarFavoritos(false)} className="mt-4 text-orange-500 font-bold hover:underline">Ver cardápio completo</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
            <div className="flex overflow-x-auto gap-4 pb-4 mb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                const isSelected = categoriaExpandida === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoriaExpandida(isSelected ? null : cat)}
                    className={`flex flex-col items-center min-w-[100px] w-[100px] gap-2 p-1 rounded-2xl transition-all ${isSelected ? 'scale-105' : 'hover:scale-105'}`}
                  >
                    <div className={`w-20 h-20 bg-white rounded-2xl shadow-sm border flex items-center justify-center overflow-hidden shrink-0 transition-colors ${isSelected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-100'}`}>
                      {config.imageUrl ? <img src={config.imageUrl} alt={cat} className="w-full h-full object-cover" /> : <Utensils className={isSelected ? 'text-orange-500' : 'text-orange-300'} size={28} />}
                    </div>
                    <span className={`text-sm font-bold text-center leading-tight line-clamp-2 w-full ${isSelected ? 'text-orange-600' : 'text-gray-700'}`}>{cat}</span>
                  </button>
                );
              })}
            </div>

            <div className={`grid transition-all duration-700 ease-in-out ${categoriaExpandida ? 'grid-rows-[0fr] opacity-0 mb-0' : 'grid-rows-[1fr] opacity-100 mb-6'}`}>
              <div className="overflow-hidden">
                 {carrosselImagens.length > 0 && (
                   <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                     {carrosselImagens.map((img, idx) => (
                       <img key={idx} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentImgIndex ? 'opacity-100' : 'opacity-0'}`} />
                     ))}
                   </div>
                 )}
              </div>
            </div>

            <div className="space-y-4">
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                if (categoriaExpandida !== cat) return null;
                const prodsCat = produtos.filter(p => !p.oculto && (p.categoria || 'Outros') === cat).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
                if (prodsCat.length === 0) return null;

                return (
                  <div key={cat} id={`cat-${cat}`} className="space-y-4 pt-2">
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                      <Utensils className="text-orange-500" size={20}/> {cat}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {prodsCat.map((p, idx) => renderProdutoCard(p, idx))}
                    </div>
                  </div>
                );
              })}
            </div>
              </>
            )}
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

        {activeTab === 'perfil' && (
          <div className="space-y-6">
            <div className="flex bg-white p-1 rounded-xl w-fit mx-auto mb-4 border border-gray-200 shadow-sm">
              <button onClick={() => setPerfilSubTab('dados')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${perfilSubTab === 'dados' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Meus Dados</button>
              <button onClick={() => setPerfilSubTab('fidelidade')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${perfilSubTab === 'fidelidade' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fidelidade</button>
            </div>

            {perfilSubTab === 'dados' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center"><User className="mr-2 text-orange-500"/> Meus Dados</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <input type="text" required value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome Completo *" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                  <input type="tel" required value={editTelefone} onChange={e => setEditTelefone(formatPhone(e.target.value))} placeholder="Telefone / WhatsApp *" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                  <input type="text" value={editCpf} onChange={e => setEditCpf(formatCPF(e.target.value))} placeholder="CPF (Opcional)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                  <div>
                    <p className="text-xs text-orange-600 font-bold mb-1 ml-1">Por favor, informe sua data de nascimento! 🎂</p>
                    <input type="date" value={editDataNascimento} onChange={e => setEditDataNascimento(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm text-gray-500" title="Data de Nascimento (Opcional)" />
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 mt-2">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                      <MapPin size={16} className="mr-1 text-orange-500"/> Endereço Principal
                    </h4>
                    <button 
                      type="button" 
                      onClick={handleEditGetLocation} 
                      disabled={isFetchingEditLocation}
                      className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 border border-blue-200 mb-4"
                    >
                      <MapPin size={18} />
                      {isFetchingEditLocation ? 'Buscando localização...' : 'Usar minha localização atual'}
                    </button>

                    <div className="flex gap-2 mb-4">
                      <input type="text" value={editCep} onChange={handleEditCepChange} placeholder="CEP *" required className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                      <input type="text" value={editUf} onChange={e => setEditUf(e.target.value)} placeholder="UF *" required maxLength={2} className="w-16 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm uppercase text-center" />
                    </div>
                    <input type="text" value={editLogradouro} onChange={e => setEditLogradouro(e.target.value)} placeholder="Logradouro (Rua/Av) *" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm mb-4" />
                    <div className="flex gap-2 mb-4">
                      <input type="text" id="edit_numero" value={editNumero} onChange={e => setEditNumero(e.target.value)} placeholder="Número *" required className="w-1/3 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                      <input type="text" value={editBairro} onChange={e => setEditBairro(e.target.value)} placeholder="Bairro *" required className="w-2/3 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                    </div>
                    <input type="text" value={editCidade} onChange={e => setEditCidade(e.target.value)} placeholder="Cidade *" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm mb-4" />
                    <input type="text" value={editComplemento} onChange={e => setEditComplemento(e.target.value)} placeholder="Complemento (Apto, Bloco...)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                  </div>
                  
                  <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-base hover:bg-orange-600 transition-colors shadow-md mt-6">
                    Salvar Alterações
                  </button>
                </form>
              </div>
            )}

            {perfilSubTab === 'fidelidade' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                  <h3 className="text-xl font-black text-gray-800 mb-2">Programa Fidelidade</h3>
                  <p className="text-sm text-gray-500 mb-4">Acumule carimbos e troque por prêmios incríveis!</p>
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 inline-block mb-4">
                    <p className="text-4xl font-black text-orange-600">{fidelidadePontos?.pontos || 0}</p>
                    <p className="text-xs font-bold text-orange-800 uppercase tracking-widest mt-1">Carimbos</p>
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl text-left border border-gray-100 leading-relaxed font-medium">
                    Lembrando: Somente os produtos consumidos no estabelecimento (presencialmente) são contabilizados no programa de fidelidade. Pedidos via delivery não geram carimbos.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center"><Gift className="mr-2 text-green-500" size={20}/> Prêmios Disponíveis</h4>
                  {fidelidadeConfig?.recompensas ? (
                    <div className="space-y-3">
                       {Object.entries(fidelidadeConfig.recompensas).filter(([_, r]: any) => r.ativo).map(([id, r]: any) => (
                          <div key={id} className="flex justify-between items-center p-4 border border-gray-100 rounded-2xl bg-gray-50">
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

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
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
           <button onClick={() => setActiveTab('perfil')} className={`flex flex-col items-center p-2 flex-1 rounded-xl transition-colors ${activeTab === 'perfil' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}>
              <User size={22} className="mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
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
              <option value="">Selecione como vai pagar...</option>
              <option value="Pix">Pix (Chave com entregador)</option>
              <option value="Dinheiro">Dinheiro Físico</option>
              <option value="Credito">Cartão de Crédito</option>
              <option value="Debito">Cartão de Débito</option>
            </select>
            {formaPagamento === 'Dinheiro' && (
              <div className="mt-3 animate-in fade-in">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Troco para quanto? (Opcional)</label>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={trocoPara}
                    onChange={e => { const digits = e.target.value.replace(/\D/g, ''); setTrocoPara(digits ? (parseInt(digits, 10) / 100).toFixed(2).replace('.', ',') : ''); }}
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-gray-700"
                    placeholder="Ex: 50,00"
                  />
                </div>
              </div>
            )}
          </div>
          {tipoEntregaApp === 'delivery' && (
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex justify-between items-center mt-3">
              <span className="font-bold text-orange-800 text-sm">Taxa de Entrega</span>
              <span className="font-black text-orange-600">
                {taxaEntregaCalculada === null ? 'A Calcular' : taxaEntregaCalculada === 'restrita' ? 'Área Restrita' : `+ R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`}
              </span>
            </div>
          )}
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