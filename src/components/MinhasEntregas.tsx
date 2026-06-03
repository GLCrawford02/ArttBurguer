import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, set, push } from 'firebase/database';
import { db } from '../firebase';
import { Truck, CheckCircle, MapPin, Navigation, ExternalLink, AlertTriangle, PhoneOff, Map, X, ChevronDown, ChevronUp } from 'lucide-react';
import ReportarProblemaModal from './modals/ReportarProblemaModal';
import { logInfo, startTimer } from '../utils/logger';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { KeepAwake } from '@capacitor-community/keep-awake';
import type { BackgroundGeolocationPlugin, Location } from '@capacitor-community/background-geolocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
// @ts-ignore
import 'leaflet/dist/leaflet.css';
import motoImg from '../assets/moto.png';

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 16);
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [50, 50], maxZoom: 16 });
    }
  }, [JSON.stringify(positions)]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 400);
    
    let observer: ResizeObserver | null = null;
    const container = map.getContainer();
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(container);
    }
    
    return () => {
      clearTimeout(timer);
      if (observer && container) {
        observer.unobserve(container);
        observer.disconnect();
      }
    };
  }, [map]);
  return null;
}

export default function MinhasEntregas({ currentUser }: { currentUser: any }) {
  const [despachos, setDespachos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [bgDenied, setBgDenied] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [mapaAberto, setMapaAberto] = useState(true);
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

  useEffect(() => {
    if (!currentUser?.id) return;
    const locRef = ref(db, `funcionarios/${currentUser.id}/localizacao`);
    const unsub = onValue(locRef, snap => {
      const val = snap.val();
      // Só usa localização se foi atualizada nos últimos 10 minutos
      if (val?.lat && val?.lng && val?.timestamp && (Date.now() - val.timestamp) < 10 * 60 * 1000) {
        setMyLocation({ lat: val.lat, lng: val.lng });
      }
    });
    return () => unsub();
  }, [currentUser?.id]);

  const activeRoute = despachos.find(d => d.motoboyId === currentUser?.id && d.status === 'Em Rota');

  // Iniciar Rastreamento e Impedir a tela de apagar
  useEffect(() => {
    if (activeRoute && !isTracking) {
      iniciarRastreamento();
    } else if (!activeRoute && isTracking) {
      pararRastreamento();
    }
  }, [activeRoute, isTracking]);

  const iniciarRastreamento = async () => {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.keepAwake();
      
      // Solicita permissão para notificações (essencial para o serviço de fundo no Android 13+)
      if (Capacitor.getPlatform() === 'android') {
        let permStatus = await PushNotifications.checkPermissions();
  
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
  
        if (permStatus.receive !== 'granted') {
          showToast('Permissão de notificação negada. O rastreio pode não funcionar com o app fechado.', 'error');
          // Não retornamos aqui, pois o GPS pode funcionar em primeiro plano mesmo sem a notificação.
        }
      }

      try {
        capWatchIdRef.current = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Sua rota está sendo rastreada em tempo real.",
            backgroundTitle: "ArttBurger - Entregador em Rota",
            requestPermissions: false, // Já pedimos as permissões antes
            stale: false,
            distanceFilter: 10,
          },
          (location, error) => {
            if (error) {
              if (error.code === "NOT_AUTHORIZED") {
                setBgDenied(true);
                showToast('Permissão de GPS em segundo plano negada. O rastreio não funcionará com o app fechado.', 'error');
              }
              return;
            }

            if (location && location.accuracy < 100) {
              if (currentUser?.id) {
                update(ref(db, `funcionarios/${currentUser.id}/localizacao`), {
                  lat: location.latitude,
                  lng: location.longitude,
                  velocidade: location.speed || 0,
                  precisao: location.accuracy,
                  timestamp: Date.now(),
                });
              }
            }
          }
        );
        setIsTracking(true);
        setBgDenied(false);

      } catch (err: any) {
        const errorMsg = err?.message || err?.toString() || 'Erro desconhecido';
        console.error('BackgroundGeolocation falhou para iniciar:', errorMsg);
        setBgDenied(true);
        showToast(`Não foi possível iniciar o GPS em segundo plano. O rastreio pode não funcionar com a tela bloqueada. Causa: ${errorMsg}`, 'error');
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

  const pararRastreamento = async () => {
    setBgDenied(false);
    if (Capacitor.isNativePlatform()) {
      KeepAwake.allowSleep();
      if (capWatchIdRef.current) {
        await BackgroundGeolocation.removeWatcher({
          id: capWatchIdRef.current,
        });
        capWatchIdRef.current = null;
      }
    } else {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      if (wakeLockRef.current !== null) { wakeLockRef.current.release().then(() => wakeLockRef.current = null); }
    }
    setIsTracking(false);
  };

  const openGoogleMaps = (endereco: string, link?: string, lat?: number, lng?: number) => {
    if (link && link.trim() !== '') {
      let finalLink = link.trim();
      if (!finalLink.startsWith('http')) finalLink = 'https://' + finalLink;
      window.open(finalLink, '_blank');
    } else if (lat && lng) {
      window.open(`https://maps.google.com/maps?q=${lat},${lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, '_blank');
    }
  };

  const handleEntregue = async (paradaIndex: number) => {
     if (!activeRoute) return;

     const parada = activeRoute.paradas[paradaIndex];
     const confirmacao = window.confirm(`Confirmar entrega para ${parada.clienteNome}?`);
     if (!confirmacao) return;
     const timer = startTimer();

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
     novasParadas[paradaIndex] = { ...novasParadas[paradaIndex], status: 'Concluída', timestampEntrega: Date.now() };
     
     await update(ref(db, `despachos/${activeRoute.id}`), {
       paradas: novasParadas
     });

     // Verifica se todas as paradas da rota foram concluídas para voltar os pedidos para o PDV
     const todasConcluidas = novasParadas.every((p: any) => p.status === 'Concluída');
     if (todasConcluidas) {
       for (const p of novasParadas) {
         if (p.pedidoId) {
           if (p.isAberta) {
             await update(ref(db, `entregas_abertas/${p.pedidoId}`), { statusEntrega: 'Concluída' });
           } else {
             await update(ref(db, `vendas_pdv/${p.pedidoId}`), { statusEntrega: 'Concluída' });
           }
         }
       }
     }

     // Dispara mensagem automática de feedback de entrega para o cliente recém-entregue
     const clienteAtualMsg = clientes.find(client => client.id === parada.clienteId);
     if (clienteAtualMsg && clienteAtualMsg.telefone) {
        let telLimpo = clienteAtualMsg.telefone.replace(/\D/g, '');
        if (telLimpo.length >= 10) {
           if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
           const msgFeedback = `Olá *${clienteAtualMsg.nome.split(' ')[0]}*! ✅\n\nSeu pedido foi entregue.\nMuito obrigado por escolher a *ArttBurger*!\nEsperamos que tenha gostado e até a próxima! 🍔\n\nMe conta, correu tudo bem com a sua entrega?`;
           await set(push(ref(db, 'fila_mensagens')), {
               telefone: telLimpo,
               mensagem: msgFeedback,
               status: 'pendente',
               timestamp: Date.now()
           });
        }
     }

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

     logInfo('Entrega', 'Entrega marcada como concluída', { cliente: parada.clienteNome, endereco: parada.endereco, todasConcluidas, proximoAvisado: proxAvisado }, timer());

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
        {isTracking && !bgDenied && <div className="absolute top-0 right-0 m-4 flex items-center text-xs font-bold text-green-400 animate-pulse"><Navigation size={12} className="mr-1"/> GPS Ativo</div>}
        {isTracking && bgDenied && <div className="absolute top-0 right-0 m-4 flex items-center text-xs font-bold text-yellow-400"><Navigation size={12} className="mr-1"/> GPS Parcial</div>}
        <div>
          <h2 className="text-2xl font-black flex items-center"><Navigation className="mr-2 text-indigo-400" size={28}/> Rota Ativa</h2>
          <p className="text-indigo-200 text-sm mt-1">Saiu do estabelecimento às {new Date(activeRoute.timestampSaida).toLocaleTimeString('pt-BR')}</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
           <span className="font-bold text-lg">{activeRoute.paradas.filter((p:any)=>p.status === 'Concluída').length}</span> de <span className="font-bold text-lg">{activeRoute.paradas.length}</span> entregas
        </div>
      </div>

      {bgDenied && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800">GPS para com a tela bloqueada</p>
            <p className="text-xs text-yellow-700 mt-1">
              A permissão de localização em segundo plano não foi concedida. Para o rastreio continuar com a tela bloqueada, vá em <strong>Configurações → Aplicativos → ArttBurger → Permissões → Localização</strong> e selecione <strong>"Permitir sempre"</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Mapa do entregador */}
      {(() => {
        const motoIcon = new L.Icon({
          iconUrl: motoImg,
          iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40],
        });
        const casaPendenteIcon = new L.Icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png',
          iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -34],
        });
        const casaAproximadaIcon = new L.DivIcon({
          html: `<div style="background:#f59e0b;border:2px solid #b45309;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg);font-size:14px">~</span></div>`,
          iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -34],
          className: '',
        });
        const casaConcluidaIcon = new L.Icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png',
          iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
          className: 'grayscale opacity-50',
        });

        const paradasComCoords = activeRoute.paradas.filter((p: any) => p.lat && p.lng);
        const paradasSemCoords = activeRoute.paradas.filter((p: any) => !p.lat || !p.lng);

        const allPositions: [number, number][] = [
          ...(myLocation ? [[myLocation.lat, myLocation.lng] as [number, number]] : []),
          ...paradasComCoords.map((p: any) => [p.lat, p.lng] as [number, number]),
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setMapaAberto(v => !v)}
              className="w-full flex justify-between items-center px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <span className="font-bold text-indigo-800 text-sm flex items-center">
                <Map size={16} className="mr-2"/> Mapa da Rota
                {myLocation && <span className="ml-2 text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">GPS Ativo</span>}
              </span>
              {mapaAberto ? <ChevronUp size={18} className="text-indigo-500"/> : <ChevronDown size={18} className="text-indigo-500"/>}
            </button>

            {mapaAberto && (
              <div className="relative" style={{ height: '300px' }}>
                {allPositions.length > 0 ? (
                  <MapContainer
                    center={allPositions[0]}
                    zoom={14}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    zoomControl={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <InvalidateSize />
                    <FitBounds positions={allPositions} />

                    {myLocation && (
                      <Marker position={[myLocation.lat, myLocation.lng]} icon={motoIcon}>
                        <Popup>
                          <div className="text-sm font-bold text-gray-800">Você está aqui</div>
                          <div className="text-xs text-green-600 font-bold">GPS Ativo</div>
                        </Popup>
                      </Marker>
                    )}

                    {paradasComCoords.map((p: any, idx: number) => {
                      const isConcluida = p.status === 'Concluída';
                      const icone = isConcluida ? casaConcluidaIcon : (p.coordAproximada ? casaAproximadaIcon : casaPendenteIcon);
                      return (
                        <Marker key={idx} position={[p.lat, p.lng]} icon={icone}>
                          <Popup>
                            <div className="text-sm font-bold text-gray-800">#{p.numeroDiario || '?'} — {p.clienteNome}</div>
                            <div className="text-xs text-gray-500 mt-1">{p.endereco}</div>
                            {p.coordAproximada && !isConcluida && <div className="text-xs text-yellow-600 font-bold mt-1">⚠️ Localização aproximada</div>}
                            {isConcluida
                              ? <div className="text-xs text-green-600 font-bold mt-1">✅ Entregue</div>
                              : <div className="text-xs text-orange-500 font-bold mt-1">⏳ Pendente</div>
                            }
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                    <Navigation size={32} className="mb-2 opacity-40"/>
                    <p className="text-sm font-medium">Aguardando sinal de GPS...</p>
                  </div>
                )}

                {paradasSemCoords.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-[10px] text-yellow-800 font-bold flex items-center">
                    <AlertTriangle size={12} className="mr-1.5 shrink-0 text-yellow-600"/>
                    {paradasSemCoords.length} parada(s) sem coordenadas cadastradas não aparecem no mapa.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

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
                   <button onClick={() => openGoogleMaps(parada.endereco, linkMaps, parada.lat, parada.lng)} disabled={isConcluida} className="flex-1 sm:flex-none px-4 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-bold text-sm flex items-center justify-center disabled:opacity-50 transition-colors"><ExternalLink size={18} className="mr-2 sm:mr-0 lg:mr-2"/> <span className="sm:hidden lg:inline">Navegar</span></button>
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
          <p className="text-sm text-emerald-700 font-medium leading-relaxed">Você já pode voltar para a loja em segurança.</p>
        </div>
      )}

      <ReportarProblemaModal
        reportModal={reportModal}
        activeRoute={activeRoute}
        onClose={() => setReportModal(null)}
        onReportarProblema={handleReportarProblema}
      />

      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto p-4 rounded-xl shadow-2xl text-white font-bold flex items-center z-[100] transition-all animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-3 shrink-0" size={20} /> : <AlertTriangle className="mr-3 shrink-0" size={20} />}
          <span className="whitespace-pre-line break-words text-sm flex-1">{toast.message}</span>
        </div>
      )}
    </div>
  );
}