import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, set, push } from 'firebase/database';
import { db } from '../firebase';
import { Truck, CheckCircle, MapPin, Navigation, ExternalLink, AlertTriangle, PhoneOff, Map, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { KeepAwake } from '@capacitor-community/keep-awake';

export default function MinhasEntregas({ currentUser }: { currentUser: any }) {
  const [despachos, setDespachos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const capWatchIdRef = useRef<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [reportModal, setReportModal] = useState<number | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const despachosRef = ref(db, 'despachos');
    const clientesRef = ref(db, 'clientes');

    const unsubDespachos = onValue(despachosRef, snap => {
      if (snap.val()) setDespachos(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setDespachos([]);
    });

    const unsubClientes = onValue(clientesRef, snap => {
      if (snap.val()) setClientes(Object.entries(snap.val()).map(([id, val]: any) => ({ id, ...val })));
      else setClientes([]);
    });

    return () => { unsubDespachos(); unsubClientes(); };
  }, []);

  const activeRoute = despachos.find(d => d.motoboyId === currentUser?.id && d.status === 'Em Rota');

  // Iniciar Rastreamento e Impedir a tela de apagar
  useEffect(() => {
    if (activeRoute && !isTracking) {
      iniciarRastreamento();
    } else if (!activeRoute && isTracking) {
      pararRastreamento();
    }

    return () => pararRastreamento();
  }, [activeRoute, isTracking]);

  const iniciarRastreamento = async () => {
    if (Capacitor.isNativePlatform()) {
      // Rodando dentro do Aplicativo (APK)
      await KeepAwake.keepAwake(); // Trava a tela para não apagar no bolso/painel
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'granted') {
        capWatchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
          (pos, err) => {
            if (pos && currentUser?.id) {
              update(ref(db, `funcionarios/${currentUser.id}/localizacao`), {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                velocidade: pos.coords.speed || 0,
                timestamp: Date.now()
              });
            }
          }
        );
        setIsTracking(true);
      } else {
        showToast('Você precisa autorizar o GPS do celular!', 'error');
      }
    } else {
      // Rodando no Navegador (Computador/Safari)
      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } 
        catch (err) { console.error('Erro Wake Lock', err); }
      }

      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (currentUser?.id) {
              update(ref(db, `funcionarios/${currentUser.id}/localizacao`), {
                lat: pos.coords.latitude, lng: pos.coords.longitude,
                velocidade: pos.coords.speed || 0, timestamp: Date.now()
              });
            }
          },
          (err) => console.error('Erro de GPS', err),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        setIsTracking(true);
      }
    }
  };

  const pararRastreamento = () => {
    if (Capacitor.isNativePlatform()) {
      KeepAwake.allowSleep();
      if (capWatchIdRef.current !== null) {
        Geolocation.clearWatch({ id: capWatchIdRef.current });
        capWatchIdRef.current = null;
      }
    } else {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      if (wakeLockRef.current !== null) { wakeLockRef.current.release().then(() => wakeLockRef.current = null); }
    }
    setIsTracking(false);
  };

  const openGoogleMaps = (endereco: string, link?: string) => {
     if (link && link.trim() !== '') {
       let finalLink = link.trim();
       if (!finalLink.startsWith('http')) finalLink = 'https://' + finalLink;
       window.open(finalLink, '_blank');
     } else {
       const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
       window.open(url, '_blank');
     }
  };

  const handleEntregue = async (paradaIndex: number) => {
     if (!activeRoute) return;

     const parada = activeRoute.paradas[paradaIndex];
     const confirmacao = window.confirm(`Confirmar entrega para ${parada.clienteNome}?`);
     if (!confirmacao) return;

     const obs = window.prompt(`Deseja adicionar uma observação para ajudar os próximos entregadores?\nEx: "Casa verde", "Campainha quebrada"\n(Deixe em branco se não quiser adicionar)`);
     if (obs && obs.trim()) {
       const c = clientes.find(client => client.id === parada.clienteId);
       if (c) {
         const novaObs = c.observacaoEntregador ? `${c.observacaoEntregador} | ${obs.trim()}` : obs.trim();
         await update(ref(db, `clientes/${parada.clienteId}`), { observacaoEntregador: novaObs });
       }
     }

     // Risca a parada atual (colocando o status nela)
     const novasParadas = [...activeRoute.paradas];
     novasParadas[paradaIndex] = { ...novasParadas[paradaIndex], status: 'Concluída' };
     
     await update(ref(db, `despachos/${activeRoute.id}`), {
       paradas: novasParadas
     });

     let proxAvisado = false;

     // Procura a PRÓXIMA parada que ainda não foi concluída na rota (caso entreguem fora de ordem)
     const nextParada = novasParadas.slice(paradaIndex + 1).find((p: any) => p.status !== 'Concluída');
     
     if (nextParada) {
        const c = clientes.find(client => client.id === nextParada.clienteId);
        if (c && c.telefone) {
           let telLimpo = c.telefone.replace(/\D/g, '');
           if (telLimpo.length >= 10) {
             if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
             const msg = `🚨 *Atenção, ${c.nome.split(' ')[0]}!* 🛵\n\nO entregador está a caminho do seu endereço e o seu pedido já é o próximo da rota!\nFique atento para receber sua entrega.`;
             await set(push(ref(db, 'fila_mensagens')), {
               telefone: telLimpo,
               mensagem: msg,
               status: 'pendente',
               timestamp: Date.now()
             });
             proxAvisado = true;
           }
        }
     }

     if (proxAvisado) {
       showToast('Entrega confirmada! O próximo cliente foi avisado via WhatsApp.', 'success');
     } else {
       showToast('Entrega confirmada no sistema!', 'success');
     }
  };

  const handleReportarProblema = async (paradaIndex: number, tipo: 'endereco' | 'telefone') => {
    if (!activeRoute) return;
    const parada = activeRoute.paradas[paradaIndex];
    const c = clientes.find(client => client.id === parada.clienteId);
    
    if (!c || !c.telefone) {
      showToast('O cliente não possui telefone cadastrado.', 'error');
      return;
    }

    let telLimpo = c.telefone.replace(/\D/g, '');
    if (telLimpo.length >= 10) {
      if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
      
      let msg = '';
      if (tipo === 'endereco') {
        msg = `⚠️ *Atenção, ${c.nome.split(' ')[0]}!* 🛵\n\nO nosso entregador está na sua região, mas não está conseguindo localizar o seu endereço exato:\n📍 *${parada.endereco}*\n\nPor favor, responda esta mensagem com um ponto de referência ou atenda o telefone para ajudá-lo a realizar a entrega!`;
      } else if (tipo === 'telefone') {
        msg = `⚠️ *Atenção, ${c.nome.split(' ')[0]}!* 🛵\n\nO nosso entregador chegou no endereço ou está tentando entrar em contato com você pelo telefone, mas não está sendo atendido.\n\nPor favor, verifique o seu celular ou vá até o portão para receber o seu pedido!`;
      }

      await set(push(ref(db, 'fila_mensagens')), {
        telefone: telLimpo,
        mensagem: msg,
        status: 'pendente',
        timestamp: Date.now()
      });

      showToast('Aviso de problema enviado ao cliente via WhatsApp!', 'success');
      setReportModal(null);
    } else {
      showToast('Telefone do cliente é inválido.', 'error');
    }
  };

  if (!activeRoute) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-gray-400">
        <Truck size={64} className="mb-4 opacity-50 text-indigo-400" />
        <h2 className="text-xl font-bold text-gray-600 mb-2">Nenhuma rota ativa</h2>
        <p>Você não possui entregas em andamento.</p>
        <p className="text-sm mt-2 text-gray-400 text-center">Aguarde no restaurante até que o caixa<br/>despache seus pedidos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <div className="bg-indigo-900 p-6 rounded-xl shadow-lg border border-indigo-800 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        {isTracking && <div className="absolute top-0 right-0 m-4 flex items-center text-xs font-bold text-green-400 animate-pulse"><Navigation size={12} className="mr-1"/> GPS Ativo</div>}
        <div>
          <h2 className="text-2xl font-black flex items-center"><Navigation className="mr-2 text-indigo-400" size={28}/> Rota Ativa</h2>
          <p className="text-indigo-200 text-sm mt-1">Saiu do estabelecimento às {new Date(activeRoute.timestampSaida).toLocaleTimeString('pt-BR')}</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
           <span className="font-bold text-lg">{activeRoute.paradas.filter((p:any)=>p.status === 'Concluída').length}</span> de <span className="font-bold text-lg">{activeRoute.paradas.length}</span> entregas
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {activeRoute.paradas.map((parada: any, index: number) => {
           const isConcluida = parada.status === 'Concluída';
           const clienteAtual = clientes.find(c => c.id === parada.clienteId);
           const linkMaps = clienteAtual?.googleMapsLink || parada.googleMapsLink;
           return (
             <div key={index} className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden ${isConcluida ? 'border-green-200 opacity-60' : 'border-gray-200 hover:border-indigo-300'}`}>
               <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="flex items-start">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mr-3 mt-1 ${isConcluida ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}`}>{index + 1}</div>
                   <div>
                     <h3 className={`font-black text-lg ${isConcluida ? 'text-gray-500 line-through' : 'text-gray-800'}`}>#{parada.numeroDiario || '?'} - {parada.clienteNome}</h3>
                     <p className="text-sm text-gray-500 mt-1 flex items-start"><MapPin size={16} className="mr-1 shrink-0 mt-0.5"/> {parada.endereco}</p>
                     {parada.observacaoEntregador && <p className="text-xs text-orange-600 font-bold mt-2 bg-orange-50 p-2 rounded-lg"><AlertTriangle size={12} className="inline mr-1"/>{parada.observacaoEntregador}</p>}
                   </div>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto shrink-0">
                   <button onClick={() => setReportModal(index)} disabled={isConcluida} className="px-3 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm flex items-center justify-center disabled:opacity-50 transition-colors" title="Reportar Problema"><AlertTriangle size={18}/></button>
                   <button onClick={() => openGoogleMaps(parada.endereco, linkMaps)} disabled={isConcluida} className="flex-1 sm:flex-none px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-bold text-sm flex items-center justify-center disabled:opacity-50 transition-colors"><ExternalLink size={18} className="mr-2 sm:mr-0 lg:mr-2"/> <span className="sm:hidden lg:inline">Navegar</span></button>
                   <button onClick={() => handleEntregue(index)} disabled={isConcluida} className="flex-1 sm:flex-none px-6 py-3 bg-green-500 text-white hover:bg-green-600 rounded-lg font-bold text-sm flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm"><CheckCircle size={18} className="mr-2"/> Feito</button>
                 </div>
               </div>
             </div>
           )
         })}
      </div>

      {activeRoute.paradas.length > 0 && activeRoute.paradas.every((p: any) => p.status === 'Concluída') && (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center shadow-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-emerald-100 text-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-xl font-black text-emerald-800 mb-2">Todas as entregas concluídas!</h3>
          <p className="text-sm text-emerald-700 font-medium leading-relaxed">Você já pode voltar para a loja em segurança. O seu GPS continuará ligado para o Gerente te acompanhar no mapa!</p>
        </div>
      )}

      {reportModal !== null && activeRoute && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-700 flex items-center"><AlertTriangle size={20} className="mr-2"/> Reportar Problema</h3>
              <button onClick={() => setReportModal(null)} className="text-red-400 hover:text-red-600 bg-red-100 hover:bg-red-200 rounded-full p-1 transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">Escolha o problema abaixo para que o robô envie um aviso automaticamente para o WhatsApp do cliente.</p>
              
              <button onClick={() => handleReportarProblema(reportModal, 'endereco')} className="w-full bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 p-4 rounded-xl flex items-center text-left transition-colors group shadow-sm">
                <Map className="text-gray-400 group-hover:text-red-500 mr-4 shrink-0" size={28}/>
                <div>
                  <h4 className="font-bold text-gray-800 group-hover:text-red-700">Não encontro o endereço</h4>
                  <p className="text-xs text-gray-500 mt-1">Avisa o cliente para mandar ponto de referência.</p>
                </div>
              </button>

              <button onClick={() => handleReportarProblema(reportModal, 'telefone')} className="w-full bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 p-4 rounded-xl flex items-center text-left transition-colors group shadow-sm">
                <PhoneOff className="text-gray-400 group-hover:text-red-500 mr-4 shrink-0" size={28}/>
                <div>
                  <h4 className="font-bold text-gray-800 group-hover:text-red-700">Cliente não atende</h4>
                  <p className="text-xs text-gray-500 mt-1">Avisa o cliente para verificar o celular ou portão.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto p-4 rounded-xl shadow-2xl text-white font-bold flex items-center z-[100] transition-all animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-3 shrink-0" size={20} /> : <AlertTriangle className="mr-3 shrink-0" size={20} />}
          <span className="whitespace-pre-line break-words text-sm flex-1">{toast.message}</span>
        </div>
      )}
    </div>
  );
}