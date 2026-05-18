import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Cliente } from './ClientesManager';
import { Funcionario } from '../types';
import { Map, Navigation, MapPin, Search, Plus, Trash2, CheckCircle, Truck, AlertTriangle, ExternalLink, ArrowUp, ArrowDown, MessageSquare, Package, Flame, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
// @ts-ignore
import 'leaflet/dist/leaflet.css';

interface ParadaRota {
  clienteId: string;
  clienteNome: string;
  endereco: string;
  observacaoEntregador?: string;
  pedidoId: string;
  isAberta?: boolean;
  numeroDiario?: number;
  googleMapsLink?: string;
  lat?: number;
  lng?: number;
  coordAproximada?: boolean;
  status?: string;
  timestampEntrega?: number;
}

interface Despacho {
  id: string;
  motoboyId: string;
  motoboyNome: string;
  status: 'Em Rota' | 'Concluído';
  timestampSaida: number;
  timestampRetorno?: number;
  paradas: ParadaRota[];
}

export default function DespachoManager({ currentUser, temPermissao }: { currentUser?: any, temPermissao?: any }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [pedidosPendente, setPedidosPendente] = useState<any[]>([]);
  const [entregasAbertas, setEntregasAbertas] = useState<any[]>([]);
  const [pedidosCozinha, setPedidosCozinha] = useState<any[]>([]);
  
  const [activeDespachoTab, setActiveDespachoTab] = useState<'ativos' | 'mapa' | 'concluidos'>('ativos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMotoboy, setSelectedMotoboy] = useState('');
  const [rotaAtual, setRotaAtual] = useState<ParadaRota[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [modalMotoboyAtivo, setModalMotoboyAtivo] = useState<Despacho | null>(null);
  const [modalResumoMotoboy, setModalResumoMotoboy] = useState<string | null>(null);
  const [geocodedStops, setGeocodedStops] = useState<Record<string, {lat: number, lng: number} | null>>({});
  const geocodingQueue = useRef<Set<string>>(new Set());
  
  const canEdit = temPermissao ? temPermissao('despacho', 'aba_logistica', 'editar') : true;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const funcRef = ref(db, 'funcionarios');
    const despachosRef = ref(db, 'despachos');
    const vendasRef = ref(db, 'vendas_pdv');
    const entregasRef = ref(db, 'entregas_abertas');
    const pedidosCozRef = ref(db, 'pedidos_cozinha');

    const unsubClientes = onValue(clientesRef, snap => {
      if (snap.val()) setClientes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setClientes([]);
    });

    const unsubFunc = onValue(funcRef, snap => {
      if (snap.val()) setFuncionarios(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setFuncionarios([]);
    });

    const unsubDespachos = onValue(despachosRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        list.sort((a, b) => b.timestampSaida - a.timestampSaida);
        setDespachos(list);
      } else setDespachos([]);
    });

    const unsubVendas = onValue(vendasRef, snap => {
      if (snap.val()) {
        const list = Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val }));
        const pendentes = list.filter(v => v.tipoPedido === 'Entrega' && v.statusEntrega === 'Pendente');
        pendentes.sort((a, b) => a.timestamp - b.timestamp);
        setPedidosPendente(pendentes);
      } else setPedidosPendente([]);
    });

    const unsubEntregas = onValue(entregasRef, snap => {
      if (snap.val()) setEntregasAbertas(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val, isAberta: true })));
      else setEntregasAbertas([]);
    });

    const unsubPedidosCoz = onValue(pedidosCozRef, snap => {
      if (snap.val()) setPedidosCozinha(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setPedidosCozinha([]);
    });

    return () => { unsubClientes(); unsubFunc(); unsubDespachos(); unsubVendas(); unsubEntregas(); unsubPedidosCoz(); };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const processGeocoding = async () => {
      const ativos = despachos.filter(d => d.status === 'Em Rota');
      const addressesToGeocode: string[] = [];

      for (const d of ativos) {
        for (const p of d.paradas) {
          if (p.status !== 'Concluída' && !geocodingQueue.current.has(p.endereco)) {
            geocodingQueue.current.add(p.endereco);
            if (p.lat && p.lng) {
              // Usa coordenadas já salvas no cadastro do cliente
              setGeocodedStops(prev => ({ ...prev, [p.endereco]: { lat: p.lat!, lng: p.lng! } }));
            } else {
              addressesToGeocode.push(p.endereco);
            }
          }
        }
      }

      for (const endereco of addressesToGeocode) {
        if (!isMounted) break;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`);
          const data = await res.json();
          if (isMounted) {
            setGeocodedStops(prev => ({
              ...prev,
              [endereco]: data && data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
            }));
          }
        } catch (e) {
          if (isMounted) setGeocodedStops(prev => ({ ...prev, [endereco]: null }));
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    };
    if (activeDespachoTab === 'mapa') processGeocoding();
    return () => { isMounted = false; };
  }, [despachos, activeDespachoTab]);

  const formatarEndereco = (c: Cliente) => {
    const partes = [];
    if (c.logradouro) partes.push(c.logradouro);
    if (c.numero) partes.push(c.numero);
    if (c.bairro) partes.push(c.bairro);
    if (c.cidade) partes.push(c.cidade);
    if (c.uf) partes.push(c.uf);
    return partes.join(', ');
  };

  const handleAddParada = (pedido: any) => {
    if (rotaAtual.find(p => p.pedidoId === pedido.id)) {
      showToast('Este pedido já está na rota!', 'error');
      return;
    }
    const c = clientes.find(client => client.id === pedido.clienteId);
    if (!c) return showToast('Cliente não encontrado.', 'error');

    const endereco = formatarEndereco(c);
    if (!endereco) {
      showToast('Este cliente não possui endereço cadastrado.', 'error');
      return;
    }
    setRotaAtual([...rotaAtual, {
      clienteId: c.id,
      clienteNome: c.nome,
      endereco: endereco,
      observacaoEntregador: c.observacaoEntregador || '',
      pedidoId: pedido.id,
      isAberta: pedido.isAberta || false,
      numeroDiario: pedido.numeroDiario || 0,
      googleMapsLink: c.googleMapsLink || '',
      ...(c.lat && c.lng ? { lat: c.lat, lng: c.lng, coordAproximada: c.coordAproximada ?? false } : {}),
    }]);
    setSearchTerm('');
  };

  const handleRemoveParada = (index: number) => {
    setRotaAtual(rotaAtual.filter((_, i) => i !== index));
  };

  const moveParada = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === rotaAtual.length - 1)) return;
    const newRota = [...rotaAtual];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newRota[index], newRota[swapIndex]] = [newRota[swapIndex], newRota[index]];
    setRotaAtual(newRota);
  };

  const openGoogleMaps = (paradas: ParadaRota[]) => {
    if (paradas.length === 0) return;
    const originAddress = encodeURIComponent('Avenida Antonio Olinto, 8, Centro, Curvelo, 35790-001');
    const mapBaseUrl = `https://www.google.com/maps/dir/${originAddress}/`;
    const stops = paradas.map(p => p.lat && p.lng ? `${p.lat},${p.lng}` : encodeURIComponent(p.endereco)).join('/');
    const finalUrl = `${mapBaseUrl}${stops}/${originAddress}`;
    window.open(finalUrl, '_blank');
  };

  const handleRegistrarSaida = async () => {
    if (!selectedMotoboy) return showToast('Selecione um Motoboy / Entregador.', 'error');
    if (rotaAtual.length === 0) return showToast('Adicione pelo menos um cliente à rota.', 'error');

    const motoboy = funcionarios.find(f => f.id === selectedMotoboy);
    if (!motoboy) return;

    try {
      await set(push(ref(db, 'despachos')), {
        motoboyId: motoboy.id,
        motoboyNome: motoboy.nome,
        status: 'Em Rota',
        timestampSaida: Date.now(),
        paradas: rotaAtual
      });

      // Atualiza o status dos pedidos para 'Em Rota'
      for (const p of rotaAtual) {
        if (p.isAberta) {
          await update(ref(db, `entregas_abertas/${p.pedidoId}`), { statusEntrega: 'Em Rota' });
        } else if (p.pedidoId) {
          await update(ref(db, `vendas_pdv/${p.pedidoId}`), { statusEntrega: 'Em Rota' });
        }

        const c = clientes.find(client => client.id === p.clienteId);
        if (c && c.telefone) {
          let telLimpo = c.telefone.replace(/\D/g, '');
          if (telLimpo.length >= 10) {
            if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
            const msg = `Olá *${c.nome.split(' ')[0]}*! 🛵\n\nSeu pedido acabou de sair para entrega com o nosso entregador *${motoboy.nome}*.\n\nFique de olho, em breve chegará aí no endereço:\n📍 ${p.endereco}`;
            await set(push(ref(db, 'fila_mensagens')), {
              telefone: telLimpo,
              mensagem: msg,
              status: 'pendente',
              timestamp: Date.now()
            });
          }
        }
      }

      showToast('Despacho registrado! Rota iniciada e clientes notificados.', 'success');
      setRotaAtual([]);
      setSelectedMotoboy('');
    } catch (error: any) {
      console.error(error);
      showToast('Erro ao registrar despacho: ' + error.message, 'error');
    }
  };

  const handleConcluirDespacho = async (id: string) => {
    if (confirm('Confirmar que o entregador retornou desta rota?')) {
      await update(ref(db, `despachos/${id}`), {
        status: 'Concluído',
        timestampRetorno: Date.now()
      });

      // Atualiza o status dos pedidos para 'Concluído'
      const despacho = despachos.find(d => d.id === id);
      if (despacho) {
        for (const p of despacho.paradas) {
          if (p.isAberta) {
            await update(ref(db, `entregas_abertas/${p.pedidoId}`), { statusEntrega: 'Concluída' });
          } else if (p.pedidoId) {
            await update(ref(db, `vendas_pdv/${p.pedidoId}`), { statusEntrega: 'Concluída' });
          }
        }
      }

      showToast('Rota concluída com sucesso.', 'success');
    }
  };

  const enviarWhatsApp = async (d: Despacho) => {
    const motoboy = funcionarios.find(f => f.id === d.motoboyId);
    const telefoneRaw = (motoboy as any)?.telefone;
    if (!telefoneRaw) {
      showToast('Este entregador não possui um telefone cadastrado!', 'error');
      return;
    }
    const telefoneStr = telefoneRaw.replace(/\D/g, '');
    if (telefoneStr.length < 10) {
      showToast('Número de telefone inválido para este entregador.', 'error');
      return;
    }
    let mensagem = `*Nova Rota de Entrega!*\n\n`;
    d.paradas.forEach((p, idx) => {
      const c = clientes.find(client => client.id === p.clienteId);
      const telefone = c?.telefone || 'Não informado';
      const mapsLink = p.lat && p.lng
        ? `https://maps.google.com/maps?q=${p.lat},${p.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco)}`;
      mensagem += `*Parada ${idx + 1} - Pedido #${p.numeroDiario || '?'}*\n👤 ${p.clienteNome}\n📞 ${telefone}\n📍 ${p.endereco}\n🗺️ ${mapsLink}${p.observacaoEntregador ? `\n⚠️ Obs: ${p.observacaoEntregador}` : ''}\n\n`;
    });
    
    try {
      await set(push(ref(db, 'fila_mensagens')), {
        telefone: `55${telefoneStr}`,
        mensagem: mensagem,
        status: 'pendente',
        timestamp: Date.now()
      });
      showToast('O robô está enviando a rota para o motoboy!', 'success');
    } catch (error) {
      showToast('Erro ao enviar rota pelo robô.', 'error');
    }
  };

  const todosPedidosPendente = [
    ...entregasAbertas.filter(e => !e.statusEntrega || e.statusEntrega === 'Pendente'),
    ...pedidosPendente
  ].sort((a, b) => a.timestamp - b.timestamp);

  const filteredPedidos = searchTerm ? todosPedidosPendente.filter(p => (p.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase())) : todosPedidosPendente;
  const despachosAtivos = despachos.filter(d => d.status === 'Em Rota');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const resumoMotoboys = despachos
    .filter(d => d.timestampSaida >= hoje.getTime() && d.status === 'Concluído')
    .reduce((acc, d) => {
      if (!acc[d.motoboyId]) {
        acc[d.motoboyId] = { nome: d.motoboyNome, viagens: 0, paradas: 0, despachos: [] };
      }
      acc[d.motoboyId].viagens += 1;
      acc[d.motoboyId].paradas += d.paradas.length;
      acc[d.motoboyId].despachos.push(d);
      return acc;
    }, {} as Record<string, { nome: string, viagens: number, paradas: number, despachos: Despacho[] }>);

  return (
    <div className="animate-in fade-in duration-300 flex flex-col h-full">
      <div className="flex bg-gray-200 p-1 rounded-xl w-fit mb-6 shrink-0">
        <button onClick={() => setActiveDespachoTab('ativos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeDespachoTab === 'ativos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Despachos Ativos</button>
        <button onClick={() => setActiveDespachoTab('mapa')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors flex items-center ${activeDespachoTab === 'mapa' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><MapPin size={16} className="mr-1"/> Mapa (GPS)</button>
        <button onClick={() => setActiveDespachoTab('concluidos')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${activeDespachoTab === 'concluidos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Resumo (Concluídos)</button>
      </div>
      
      {activeDespachoTab === 'ativos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Coluna Esquerda: Pedidos Aguardando */}
          <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[600px]">
            <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4"><Package className="mr-2 text-indigo-600" size={24}/> Pedidos Aguardando Entrega ({todosPedidosPendente.length})</h3>
            
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Filtrar pedidos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-gray-50" />
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {filteredPedidos.map(ped => {
                const c = clientes.find(client => client.id === ped.clienteId);
                if (!c) return null;
                
                const isPronto = (() => {
                  let relacionados = [];
                  if (ped.isAberta) {
                    relacionados = pedidosCozinha.filter(p => p.referenciaId === ped.id);
                  } else {
                    relacionados = pedidosCozinha.filter(p => p.identificador === `Delivery: ${ped.clienteNome}` && Math.abs(p.timestamp - ped.timestamp) < 120000);
                  }
                  if (relacionados.length === 0) return true;
                  return relacionados.every(p => p.status === 'Concluído' || p.status === 'Cancelado');
                })();

                return (
                  <div key={ped.id} className={`p-4 rounded-xl border ${isPronto ? 'border-gray-200 bg-white hover:border-indigo-300' : 'border-orange-200 bg-orange-50 opacity-90'} transition-colors shadow-sm flex justify-between items-center group`}>
                    <div className="truncate pr-2">
                      <p className="font-bold text-gray-800">#{ped.numeroDiario || '?'} - {c.nome}</p>
                      <p className="text-sm text-gray-500 truncate mt-1 flex items-center"><MapPin size={14} className="mr-1"/> {formatarEndereco(c) || 'Sem endereço'}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {ped.isAberta ? <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[11px] font-bold">Falta Pagar</span> : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[11px] font-bold">Pago</span>}
                        <span className="text-[11px] text-indigo-500 font-bold">Pedido às {new Date(ped.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        {!isPronto && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[11px] font-bold flex items-center"><Flame size={12} className="mr-1" /> Na Cozinha</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={() => isPronto ? handleAddParada(ped) : showToast('Aguarde a cozinha finalizar o pedido.', 'error')} className={`${isPronto ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-400 bg-gray-200 cursor-not-allowed'} p-3 rounded-xl font-bold flex items-center transition-colors shrink-0`}>
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredPedidos.length === 0 && <p className="p-8 text-center text-gray-400">Nenhum pedido pendente para entrega.</p>}
            </div>
          </div>

          {/* Coluna Direita: Acompanhamento */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Top: Paradas da Rota */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-1/2 min-h-[350px]">
              <h3 className="text-md font-bold text-gray-800 flex items-center mb-3"><MapPin className="mr-2 text-indigo-600" size={20}/> Paradas por Rota ({rotaAtual.length})</h3>
              
              <div className="mb-3 shrink-0">
                <select value={selectedMotoboy} onChange={e => setSelectedMotoboy(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-medium text-sm">
                  <option value="">Selecione o entregador...</option>
                  {funcionarios.filter(f => {
                    const cargos = Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente'];
                    return (f as any).ativo !== false && cargos.some(c => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy'));
                  }).map(f => {
                    const cargosStr = Array.isArray(f.cargo) ? f.cargo.join(', ') : (f.cargo || '');
                    return <option key={f.id} value={f.id}>{f.nome} {cargosStr ? `(${cargosStr})` : ''}</option>;
                  })}
                </select>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                {rotaAtual.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm group">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0">{idx + 1}</div>
                      <div className="truncate pr-2">
                        <p className="font-bold text-xs text-gray-800 truncate">#{p.numeroDiario || '?'} - {p.clienteNome}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{p.endereco}</p>
                        {p.observacaoEntregador && <p className="text-[9px] text-blue-600 font-bold truncate mt-0.5">Obs: {p.observacaoEntregador}</p>}
                      </div>
                    </div>
                    <div className="flex space-x-1 flex-shrink-0 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <div className="flex flex-col border-r border-gray-100 pr-1 mr-1">
                          <button onClick={() => moveParada(idx, 'up')} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ArrowUp size={12}/></button>
                          <button onClick={() => moveParada(idx, 'down')} disabled={idx === rotaAtual.length - 1} className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ArrowDown size={12}/></button>
                        </div>
                      )}
                      {canEdit && <button onClick={() => handleRemoveParada(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>}
                    </div>
                  </div>
                ))}
                {rotaAtual.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-6"><Navigation size={32} className="mb-2"/><p className="text-xs">Nenhuma parada adicionada.</p></div>}
              </div>

              <div className="border-t border-gray-100 pt-3 flex flex-col gap-2 shrink-0">
                <button onClick={() => openGoogleMaps(rotaAtual)} disabled={rotaAtual.length === 0} className="w-full bg-white border border-indigo-200 text-indigo-700 py-2 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center disabled:opacity-50">
                  <ExternalLink size={16} className="mr-2"/> Abrir Rota no GPS
                </button>
                {canEdit && (
                  <button onClick={handleRegistrarSaida} disabled={rotaAtual.length === 0 || !selectedMotoboy} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50 shadow-md">
                    <Truck size={16} className="mr-2"/> Despachar Entregador
                  </button>
                )}
              </div>
            </div>

            {/* Bottom: Motoboys em Rota */}
            <div className="bg-indigo-900 p-5 rounded-xl shadow-lg border border-indigo-800 text-white flex-1 flex flex-col min-h-[300px]">
              <h3 className="text-md font-bold mb-3 flex items-center"><Navigation className="mr-2 text-indigo-400" size={20}/> Entregadores em Rota</h3>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {despachosAtivos.map(d => (
                  <div key={d.id} className="bg-white/10 backdrop-blur-sm border border-white/20 p-3 rounded-lg flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div><h4 onClick={() => setModalMotoboyAtivo(d)} className="font-bold text-indigo-100 text-sm flex items-center cursor-pointer hover:text-white transition-colors" title="Ver detalhes da rota"><Truck size={14} className="mr-1.5"/> {d.motoboyNome}</h4><p className="text-[10px] text-indigo-300 mt-1">Saiu às {new Date(d.timestampSaida).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p></div>
                      <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">Na Rua</span>
                    </div>
                    <p className="text-[11px] text-gray-300 mb-3 line-clamp-2 leading-relaxed border-l-2 border-indigo-500 pl-2 ml-1">Destinos: {d.paradas.map(p => p.clienteNome).join(', ')}</p>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <button onClick={() => enviarWhatsApp(d)} className="flex-1 bg-green-500 hover:bg-green-400 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center"><MessageSquare size={12} className="mr-1"/> Enviar</button>
                      <button onClick={() => openGoogleMaps(d.paradas)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center"><MapPin size={12} className="mr-1"/> GPS</button>
                      {canEdit && <button onClick={() => handleConcluirDespacho(d.id)} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-1.5 rounded text-[10px] font-bold transition-colors flex items-center justify-center"><CheckCircle size={12} className="mr-1"/> Retornou</button>}
                    </div>
                  </div>
                ))}
                {despachosAtivos.length === 0 && <div className="h-full flex flex-col items-center justify-center text-indigo-300/50 py-6"><Truck size={32} className="mb-2"/><p className="text-xs">Nenhum entregador na rua.</p></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeDespachoTab === 'mapa' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 min-h-[500px] flex flex-col relative z-0">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center"><Map className="mr-2 text-indigo-600"/> Rastreamento em Tempo Real</h3>
          <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 relative z-0" style={{ minHeight: '500px' }}>
            <MapContainer center={[-18.7580961, -44.4333648]} zoom={13} style={{ height: '100%', minHeight: '500px', width: '100%', zIndex: 1 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {despachosAtivos.map(d => {
                const func = funcionarios.find(f => f.id === d.motoboyId);
                const loc = (func as any)?.localizacao;
                if (!loc || !loc.lat || !loc.lng) return null;
                
                const diffMinutos = Math.floor((Date.now() - loc.timestamp) / 60000);
                const isOffline = diffMinutos > 5;
                const speedKmh = Math.round((loc.velocidade || 0) * 3.6);

                const motoIcon = new L.Icon({
                  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3209/3209935.png',
                  iconSize: [40, 40],
                  iconAnchor: [20, 40],
                  popupAnchor: [0, -40],
                  className: isOffline ? 'grayscale opacity-50' : ''
                });

                return (
                  <Marker key={d.id} position={[loc.lat, loc.lng]} icon={motoIcon}>
                    <Popup>
                      <div className="text-sm font-bold text-gray-800 mb-1">{d.motoboyNome}</div>
                      <div className="text-xs text-gray-600 mb-1">
                        {isOffline ? <span className="text-red-500">Sem sinal há {diffMinutos}m</span> : <span className="text-green-500">Online 🟢</span>}
                      </div>
                      <div className="text-xs text-gray-500 font-bold mb-2">Velocidade: <span className="text-indigo-600">{speedKmh} km/h</span></div>
                      
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Destinos da Rota:</div>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {d.paradas.map((p, i) => (
                          <div key={i} className="text-xs flex items-center justify-between bg-gray-50 p-1 rounded">
                            <span className="truncate pr-2 w-32" title={p.clienteNome}>#{p.numeroDiario || '?'} - {p.clienteNome}</span>
                            <span className="shrink-0">{p.status === 'Concluída' ? '✅' : '⏳'}</span>
                          </div>
                        ))}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          {despachosAtivos.flatMap(d => d.paradas).map((p, idx) => {
            if (p.status === 'Concluída') return null;
            const coords = geocodedStops[p.endereco];
            if (!coords) return null;

            const destIcon = new L.Icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png', // Ícone de Casinha
              iconSize: [32, 32],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32],
            });

            return (
              <Marker key={`dest-${p.pedidoId}-${idx}`} position={[coords.lat, coords.lng]} icon={destIcon}>
                <Popup>
                  <div className="text-sm font-bold text-gray-800 mb-1">#{p.numeroDiario || '?'} - Destino: {p.clienteNome}</div>
                  <div className="text-xs text-gray-600 mb-1">{p.endereco}</div>
                  {p.coordAproximada && <div className="text-xs font-bold text-yellow-600 mb-1">⚠️ Localização aproximada</div>}
                  <div className="text-xs font-bold text-orange-500 mt-1">Aguardando Entrega ⏳</div>
                </Popup>
              </Marker>
            );
          })}
            </MapContainer>
            {despachosAtivos.filter(d => {
                const func = funcionarios.find(f => f.id === d.motoboyId);
                return (func as any)?.localizacao?.lat;
            }).length === 0 && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 text-sm font-bold text-gray-500 flex items-center">
                <AlertTriangle size={16} className="text-orange-500 mr-2"/> Nenhum GPS ativo detectado.
              </div>
            )}
          </div>
        </div>
      )}

      {activeDespachoTab === 'concluidos' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center"><CheckCircle className="mr-2 text-green-500"/> Resumo do Dia (Concluídos)</h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
             {Object.entries(resumoMotoboys).map(([motoboyId, m]: [string, any]) => (
               <div key={motoboyId} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-colors">
                 <span onClick={() => setModalResumoMotoboy(motoboyId)} className="font-bold text-gray-800 flex items-center text-lg cursor-pointer hover:text-indigo-600 transition-colors" title="Ver histórico da noite"><Truck size={20} className="mr-3 text-gray-400"/>{m.nome}</span>
                 <div className="text-sm text-right pointer-events-none">
                   <p className="text-indigo-600 font-black text-lg">{m.viagens} {m.viagens === 1 ? 'viagem' : 'viagens'}</p>
                   <p className="text-gray-500 font-medium">{m.paradas} {m.paradas === 1 ? 'entrega finalizada' : 'entregas finalizadas'}</p>
                 </div>
               </div>
             ))}
             {Object.keys(resumoMotoboys).length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400"><p>Nenhuma entrega finalizada hoje.</p></div>}
          </div>
        </div>
      )}

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}

      {modalMotoboyAtivo && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setModalMotoboyAtivo(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-800 flex items-center"><Truck size={20} className="mr-2"/> Entregas na Rota: {modalMotoboyAtivo.motoboyNome}</h3>
              <button onClick={() => setModalMotoboyAtivo(null)} className="text-indigo-400 hover:text-indigo-600 bg-indigo-100 hover:bg-indigo-200 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              <p className="text-xs text-gray-500 mb-2 font-bold">Despachado às {new Date(modalMotoboyAtivo.timestampSaida).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
              {modalMotoboyAtivo.paradas.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="pr-2">
                     <p className="font-bold text-gray-800 text-sm">#{p.numeroDiario || '?'} - {p.clienteNome}</p>
                     <p className="text-[10px] text-gray-500 mt-1">{p.endereco}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap ${p.status === 'Concluída' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    {p.status === 'Concluída' ? 'Entregue' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalResumoMotoboy && resumoMotoboys[modalResumoMotoboy] && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setModalResumoMotoboy(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center"><CheckCircle size={20} className="mr-2 text-green-500"/> Entregas da Noite: {resumoMotoboys[modalResumoMotoboy].nome}</h3>
              <button onClick={() => setModalResumoMotoboy(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {resumoMotoboys[modalResumoMotoboy].despachos.sort((a, b) => b.timestampSaida - a.timestampSaida).map((d: Despacho, idx: number) => (
                <div key={d.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-100 p-3 flex justify-between items-center border-b border-gray-200">
                    <span className="font-bold text-gray-700 text-sm flex items-center"><MapPin size={16} className="mr-1.5 text-gray-400"/> Rota {resumoMotoboys[modalResumoMotoboy].despachos.length - idx}</span>
                    <div className="text-xs text-gray-500 flex gap-3 font-medium">
                       <span><strong className="text-gray-600">Saiu:</strong> {new Date(d.timestampSaida).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                       <span><strong className="text-gray-600">Retornou:</strong> {d.timestampRetorno ? new Date(d.timestampRetorno).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white space-y-2">
                    {d.paradas.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                        <span className="font-medium text-gray-800">#{p.numeroDiario || '?'} - {p.clienteNome}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${p.timestampEntrega ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                          {p.timestampEntrega ? `Entregue às ${new Date(p.timestampEntrega).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` : 'Não finalizada'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}