import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Cliente } from './ClientesManager';
import { Funcionario } from '../types';
import { Map, Navigation, MapPin, Search, Plus, Trash2, CheckCircle, Truck, AlertTriangle, ExternalLink, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';

interface ParadaRota {
  clienteId: string;
  clienteNome: string;
  endereco: string;
  observacaoEntregador?: string;
  pedidoId: string;
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

export default function DespachoManager() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [pedidosPendente, setPedidosPendente] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMotoboy, setSelectedMotoboy] = useState('');
  const [rotaAtual, setRotaAtual] = useState<ParadaRota[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const funcRef = ref(db, 'funcionarios');
    const despachosRef = ref(db, 'despachos');
    const vendasRef = ref(db, 'vendas_pdv');

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

    return () => { unsubClientes(); unsubFunc(); unsubDespachos(); unsubVendas(); };
  }, []);

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
    setRotaAtual([...rotaAtual, { clienteId: c.id, clienteNome: c.nome, endereco, observacaoEntregador: c.observacaoEntregador, pedidoId: pedido.id }]);
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
    const stops = paradas.map(p => encodeURIComponent(p.endereco)).join('/');
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
        if (p.pedidoId) await update(ref(db, `vendas_pdv/${p.pedidoId}`), { statusEntrega: 'Em Rota' });
      }

      showToast('Despacho registrado! Rota iniciada.', 'success');
      setRotaAtual([]);
      setSelectedMotoboy('');
    } catch (error) {
      showToast('Erro ao registrar despacho.', 'error');
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
          if (p.pedidoId) await update(ref(db, `vendas_pdv/${p.pedidoId}`), { statusEntrega: 'Concluído' });
        }
      }

      showToast('Rota concluída com sucesso.', 'success');
    }
  };

  const enviarWhatsApp = (d: Despacho) => {
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
    d.paradas.forEach((p, idx) => { mensagem += `*Parada ${idx + 1}:* ${p.clienteNome}\n📍 ${p.endereco}${p.observacaoEntregador ? `\n⚠️ Obs: ${p.observacaoEntregador}` : ''}\n\n`; });
    window.open(`https://wa.me/55${telefoneStr}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const filteredPedidos = searchTerm ? pedidosPendente.filter(p => (p.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase())) : pedidosPendente;
  const despachosAtivos = despachos.filter(d => d.status === 'Em Rota');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const resumoMotoboys = despachos
    .filter(d => d.timestampSaida >= hoje.getTime() && d.status === 'Concluído')
    .reduce((acc, d) => {
      if (!acc[d.motoboyId]) {
        acc[d.motoboyId] = { nome: d.motoboyNome, viagens: 0, paradas: 0 };
      }
      acc[d.motoboyId].viagens += 1;
      acc[d.motoboyId].paradas += d.paradas.length;
      return acc;
    }, {} as Record<string, { nome: string, viagens: number, paradas: number }>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
      
      {/* Coluna Esquerda: Construtor de Rota */}
      <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center"><Map className="mr-2 text-indigo-600" size={24}/> Planejador de Rotas</h3>
        
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Motoboy / Entregador Responsável</label>
            <select value={selectedMotoboy} onChange={e => setSelectedMotoboy(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium">
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

          <div className="flex flex-col h-64">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Pedidos Aguardando Entrega ({pedidosPendente.length})</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Filtrar pedidos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white" />
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-50">
              {filteredPedidos.map(ped => {
                const c = clientes.find(client => client.id === ped.clienteId);
                if (!c) return null;
                return (
                  <div key={ped.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div className="truncate pr-2">
                      <p className="font-bold text-gray-800 text-sm">{c.nome}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{formatarEndereco(c) || 'Sem endereço'}</p>
                      <p className="text-[10px] text-indigo-500 font-bold mt-0.5">Pedido às {new Date(ped.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <button onClick={() => handleAddParada(ped)} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg font-bold flex items-center transition-colors shrink-0">
                      <Plus size={16} />
                    </button>
                  </div>
                );
              })}
              {filteredPedidos.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhum pedido pendente para entrega.</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[300px]">
          <h4 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">Paradas da Rota ({rotaAtual.length})</h4>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {rotaAtual.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm group">
                <div className="flex items-center flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0">{idx + 1}</div>
                  <div className="truncate pr-2">
                    <p className="font-bold text-sm text-gray-800 truncate">{p.clienteNome}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center mt-0.5"><MapPin size={12} className="mr-1"/> {p.endereco}</p>
                    {p.observacaoEntregador && <p className="text-[10px] text-blue-600 font-bold truncate mt-0.5">Obs: {p.observacaoEntregador}</p>}
                  </div>
                </div>
                <div className="flex space-x-1 flex-shrink-0 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="flex flex-col border-r border-gray-100 pr-1 mr-1">
                    <button onClick={() => moveParada(idx, 'up')} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={() => moveParada(idx, 'down')} disabled={idx === rotaAtual.length - 1} className="p-0.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30"><ArrowDown size={14}/></button>
                  </div>
                  <button onClick={() => handleRemoveParada(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            {rotaAtual.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-10"><Navigation size={48} className="mb-3"/><p className="text-sm">Nenhuma parada adicionada.</p></div>}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <button onClick={() => openGoogleMaps(rotaAtual)} disabled={rotaAtual.length === 0} className="flex-1 bg-white border-2 border-indigo-100 text-indigo-700 p-3 rounded-lg font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center disabled:opacity-50">
            <ExternalLink size={18} className="mr-2"/> Abrir Rota no GPS
          </button>
          <button onClick={handleRegistrarSaida} disabled={rotaAtual.length === 0 || !selectedMotoboy} className="flex-1 bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50 shadow-md">
            <Truck size={18} className="mr-2"/> Despachar Motoboy
          </button>
        </div>
      </div>

      {/* Coluna Direita: Acompanhamento */}
      <div className="lg:col-span-5 flex flex-col space-y-6">
        <div className="bg-indigo-900 p-6 rounded-xl shadow-lg border border-indigo-800 text-white flex-1 min-h-[300px] flex flex-col">
          <h3 className="text-lg font-bold mb-4 flex items-center"><Navigation className="mr-2 text-indigo-400"/> Motoboys em Rota</h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {despachosAtivos.map(d => (
              <div key={d.id} className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-lg flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div><h4 className="font-bold text-indigo-100 flex items-center"><Truck size={16} className="mr-1.5"/> {d.motoboyNome}</h4><p className="text-xs text-indigo-300 mt-1">Saiu às {new Date(d.timestampSaida).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p></div>
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">Na Rua</span>
                </div>
                <p className="text-xs text-gray-300 mb-3 line-clamp-2 leading-relaxed border-l-2 border-indigo-500 pl-2 ml-1">Destinos: {d.paradas.map(p => p.clienteNome).join(', ')}</p>
                <div className="flex flex-col xl:flex-row gap-2 mt-auto">
                  <button onClick={() => enviarWhatsApp(d)} className="flex-1 bg-green-500 hover:bg-green-400 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center"><MessageSquare size={14} className="mr-1"/> Enviar Rota</button>
                  <button onClick={() => openGoogleMaps(d.paradas)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center"><MapPin size={14} className="mr-1"/> Ver GPS</button>
                  <button onClick={() => handleConcluirDespacho(d.id)} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-2 rounded text-xs font-bold transition-colors flex items-center justify-center"><CheckCircle size={14} className="mr-1"/> Retornou</button>
                </div>
              </div>
            ))}
            {despachosAtivos.length === 0 && <div className="h-full flex flex-col items-center justify-center text-indigo-300/50"><Truck size={40} className="mb-2"/><p className="text-sm">Nenhum entregador na rua agora.</p></div>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 min-h-[250px] flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center"><CheckCircle className="mr-2 text-green-500"/> Resumo do Dia (Concluídos)</h3>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
             {Object.values(resumoMotoboys).map((m: any) => (
               <div key={m.nome} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                 <span className="font-bold text-gray-800 flex items-center"><Truck size={14} className="mr-2 text-gray-400"/>{m.nome}</span>
                 <div className="text-sm text-right">
                   <p className="text-indigo-600 font-bold">{m.viagens} {m.viagens === 1 ? 'viagem' : 'viagens'}</p>
                   <p className="text-gray-500 text-xs">{m.paradas} {m.paradas === 1 ? 'entrega finalizada' : 'entregas finalizadas'}</p>
                 </div>
               </div>
             ))}
             {Object.keys(resumoMotoboys).length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400"><p className="text-sm">Nenhuma entrega finalizada hoje.</p></div>}
          </div>
        </div>
      </div>

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}