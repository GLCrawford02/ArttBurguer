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
}

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

  const [clientesDb, setClientesDb] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'cardapio' | 'pedidos' | 'fidelidade'>('cardapio');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Carrinho e Checkout
  const [carrinho, setCarrinho] = useState<Record<string, any>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [produtoModal, setProdutoModal] = useState<any>(null);
  const [itemOptions, setItemOptions] = useState<any>({ quantidade: 1, observacao: '' });
  const [formaPagamento, setFormaPagamento] = useState('');
  const [taxas, setTaxas] = useState<any[]>([]);
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

    return () => { unsubClientes(); unsubProd(); unsubCat(); };
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

    const clienteData = { nome: regNome.trim(), telefone: regTelefone, cpf: regCpf, cep: regCep, logradouro: regLogradouro.trim(), numero: regNumero.trim(), bairro: regBairro.trim(), complemento: regComplemento.trim(), cidade: regCidade.trim(), uf: regUf.trim(), pin: regPin, dataCadastro: Date.now() };
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
      await set(ref(db, `entregas_abertas/${id}`), { clienteId: cliente!.id, clienteNome: cliente!.nome, clienteTelefone: cliente!.telefone, carrinho: novoCarrinho, numeroDiario: numDiario, timestamp: Date.now(), sessaoId, formaPagamentoStr: nomePagamento, statusEntrega: 'Pendente', origem: 'App Cliente' });

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
              <div className="flex gap-2">
                <input type="text" value={regCep} onChange={handleCepChange} placeholder="CEP *" required className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
                <input type="text" value={regUf} onChange={e => setRegUf(e.target.value)} placeholder="UF *" required maxLength={2} className="w-16 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm uppercase text-center" />
              </div>
              <input type="text" value={regLogradouro} onChange={e => setRegLogradouro(e.target.value)} placeholder="Logradouro (Rua/Av) *" required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
              <div className="flex gap-2">
                <input type="text" value={regNumero} onChange={e => setRegNumero(e.target.value)} placeholder="Número *" required className="w-1/3 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-500 font-bold text-sm" />
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
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-24" translate="no">
      {/* Cabeçalho */}
      <header className="bg-white px-4 py-4 shadow-sm sticky top-0 z-50 flex justify-between items-center">
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
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 mb-4"><Utensils className="text-orange-500" /> Nosso Cardápio</h2>
            
            <div className="flex overflow-x-auto gap-4 pb-4 mb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                return (
                  <button 
                    key={cat} 
                    onClick={() => {
                      document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex flex-col items-center min-w-[100px] w-[100px] gap-2"
                  >
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {config?.imageUrl ? (
                        <img src={config.imageUrl} alt={cat} className="w-full h-full object-cover" />
                      ) : (
                        <MapPin className="text-orange-300" size={28} />
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-700 text-center leading-tight line-clamp-2 w-full">{cat}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-8">
              {categoriasConfig.filter(c => !c.oculto).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)).map(config => {
                const cat = config.nome;
                const prodsCat = produtos.filter(p => !p.oculto && (p.categoria || 'Outros') === cat).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
                if (prodsCat.length === 0) return null;
                return (
                  <div key={cat} id={`cat-${cat}`} className="space-y-4 pt-4">
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                      <MapPin className="text-orange-500" size={20} /> {cat}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {prodsCat.map(p => (
                        <div key={p.id} onClick={() => { setProdutoModal(p); setItemOptions({ quantidade: 1, observacao: '', tamanho: p.opcoes?.tamanhos?.[0]?.nome || '' }); }} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4 cursor-pointer hover:border-orange-300 transition-colors">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-lg">{p.nome}</h4>
                            {p.ingredientes && <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">Acompanha: {p.ingredientes.map((ing: any) => ing.nome || 'Ingrediente').join(', ')}</p>}
                            <p className="font-black text-green-600 mt-3 text-lg">R$ {Number(p.precoVenda || 0).toFixed(2).replace('.', ',')}</p>
                          </div>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.nome} className="w-28 h-28 object-cover rounded-xl shrink-0 bg-gray-50 border border-gray-100" />
                          ) : (
                            <div className="w-28 h-28 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100">
                              <Utensils size={32} className="text-gray-300" />
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-black text-gray-800">{produtoModal.nome}</h3>
              <p className="text-gray-500 mt-1">R$ {Number(produtoModal.precoVenda || 0).toFixed(2).replace('.', ',')}</p>
            </div>
            <button onClick={() => setProdutoModal(null)} className="p-2 bg-gray-100 rounded-full text-gray-500"><XIcon size={20}/></button>
          </div>
          
          <div className="space-y-4 mb-6">
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
            const nomeFinal = selectedTamanho ? `${produtoModal.nome} (${selectedTamanho.nome})` : produtoModal.nome;
            setCarrinho(prev => ({ ...prev, [cartItemId]: { produtoId: produtoModal.id, nome: nomeFinal, preco: basePrice, qtd: itemOptions.quantidade, opcoes: itemOptions.observacao || itemOptions.tamanho ? { observacao: itemOptions.observacao, tamanho: itemOptions.tamanho } : null, enviadoCozinha: 0 } }));
            setProdutoModal(null);
            alert('Item adicionado ao carrinho!');
          }} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-orange-600 shadow-md">
            Adicionar — R$ {(((() => { const st = (produtoModal.opcoes?.tamanhos || []).find((t: any) => t.nome === itemOptions.tamanho); return st ? Number(st.preco) : Number(produtoModal.precoVenda || 0); })()) * itemOptions.quantidade).toFixed(2).replace('.', ',')}
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