import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { CheckCircle, Clock, MapPin, AlertTriangle, Coffee, LogIn, LogOut, RefreshCw, ScanFace, X } from 'lucide-react';
import { ensureFaceModelsLoaded, faceapi, getCameraStream, getCameraErrorMsg } from '../faceApiUtils';

const RESTAURANTE_LAT = -18.757167;
const RESTAURANTE_LNG = -44.429278;
const MAX_DISTANCIA_M = 20;

function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PontoEntry {
  hora: string;
  timestamp: number;
  lat: number;
  lng: number;
}

interface PontoHoje {
  data: string;
  timestamp: number;
  entrada?: string;
  saida?: string;
  chegada?: PontoEntry;
  saida_almoco?: PontoEntry;
  volta_almoco?: PontoEntry;
  saida_final?: PontoEntry;
}

function LiveClock() {
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
      1000
    );
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono font-bold text-2xl text-orange-400">{time}</span>;
}

export default function RegistroPonto({ currentUser }: { currentUser: any }) {
  const [pontoHoje, setPontoHoje] = useState<PontoHoje | null>(null);
  const [localizacao, setLocalizacao] = useState<{ lat: number; lng: number } | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(true);
  const [gpsErro, setGpsErro] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'success' | 'error' } | null>(null);

  const capWatchRef = useRef<string | null>(null);
  const webWatchRef = useRef<number | null>(null);

  const [faceModeAtivo, setFaceModeAtivo] = useState(false);
  const [faceStatus, setFaceStatus] = useState('');
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const faceScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baterPontoRef = useRef<(tipo: 'chegada' | 'saida_almoco' | 'volta_almoco' | 'saida_final') => Promise<void>>(null!);

  const dataHoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (chave Firebase)
  const dataHojeBR = new Date().toLocaleDateString('pt-BR'); // DD/MM/YYYY (exibição)

  const showToast = (msg: string, tipo: 'success' | 'error' = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // Assina o registro de ponto de hoje do Firebase
  useEffect(() => {
    if (!currentUser?.id) return;
    const r = ref(db, `gestao_equipe/${currentUser.id}/ponto/${dataHoje}`);
    return onValue(r, snap => setPontoHoje(snap.val() ?? null));
  }, [currentUser?.id, dataHoje]);

  // Inicia monitoramento de GPS
  const iniciarGps = async () => {
    setBuscandoGps(true);
    setGpsErro(false);

    const onPos = (lat: number, lng: number) => {
      setLocalizacao({ lat, lng });
      setDistancia(calcularDistancia(lat, lng, RESTAURANTE_LAT, RESTAURANTE_LNG));
      setBuscandoGps(false);
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted') { setGpsErro(true); setBuscandoGps(false); return; }
        capWatchRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
          (pos) => { if (pos) onPos(pos.coords.latitude, pos.coords.longitude); }
        );
      } catch { setGpsErro(true); setBuscandoGps(false); }
    } else if ('geolocation' in navigator) {
      webWatchRef.current = navigator.geolocation.watchPosition(
        pos => onPos(pos.coords.latitude, pos.coords.longitude),
        () => { setGpsErro(true); setBuscandoGps(false); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    } else {
      setGpsErro(true);
      setBuscandoGps(false);
    }
  };

  useEffect(() => {
    iniciarGps();
    return () => {
      if (capWatchRef.current) { Geolocation.clearWatch({ id: capWatchRef.current }); capWatchRef.current = null; }
      if (webWatchRef.current !== null) { navigator.geolocation.clearWatch(webWatchRef.current); webWatchRef.current = null; }
      if (faceScanIntervalRef.current) { clearInterval(faceScanIntervalRef.current); }
      if (faceStreamRef.current) { faceStreamRef.current.getTracks().forEach(t => t.stop()); }
    };
  }, []);

  const dentroDaArea = distancia !== null && distancia <= MAX_DISTANCIA_M;

  const baterPonto = async (tipo: 'chegada' | 'saida_almoco' | 'volta_almoco' | 'saida_final') => {
    if (!dentroDaArea || !localizacao || !currentUser?.id) {
      showToast('Você precisa estar no estabelecimento para bater o ponto!', 'error');
      return;
    }

    setSalvando(tipo);
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const entry: PontoEntry = { hora, timestamp: Date.now(), lat: localizacao.lat, lng: localizacao.lng };

    const updates: Record<string, any> = {
      [tipo]: entry,
      data: dataHojeBR,
    };

    // Compatibilidade com GestaoEquipeManager (usa entrada/saida)
    if (tipo === 'chegada') { updates.entrada = hora; updates.timestamp = Date.now(); }
    if (tipo === 'saida_final') updates.saida = hora;
    if (!pontoHoje) updates.timestamp = Date.now();

    const nomes: Record<string, string> = {
      chegada: 'Chegada',
      saida_almoco: 'Saída para almoço',
      volta_almoco: 'Volta do almoço',
      saida_final: 'Saída do dia',
    };

    try {
      const r = ref(db, `gestao_equipe/${currentUser.id}/ponto/${dataHoje}`);
      if (pontoHoje) await update(r, updates);
      else await set(r, updates);
      showToast(`✅ ${nomes[tipo]} registrada às ${hora}!`, 'success');
    } catch {
      showToast('Erro ao registrar. Tente novamente.', 'error');
    } finally {
      setSalvando(null);
    }
  };

  // Mantém baterPontoRef sempre atualizado para o interval não usar closure stale
  baterPontoRef.current = baterPonto;

  const pararFaceMode = () => {
    if (faceScanIntervalRef.current) { clearInterval(faceScanIntervalRef.current); faceScanIntervalRef.current = null; }
    if (faceStreamRef.current) { faceStreamRef.current.getTracks().forEach(t => t.stop()); faceStreamRef.current = null; }
    setFaceModeAtivo(false);
    setFaceStatus('');
  };

  const ativarFaceMode = async () => {
    if (!dentroDaArea) {
      showToast('Você precisa estar no estabelecimento para usar esta função!', 'error');
      return;
    }
    if (!currentUser?.faceDescriptor?.length) {
      showToast('Seu rosto não está cadastrado. Solicite ao gerente para cadastrar na aba Funcionários.', 'error');
      return;
    }

    setFaceModeAtivo(true);
    setFaceStatus('Iniciando câmera...');

    try {
      const stream = await getCameraStream();
      faceStreamRef.current = stream;
      setTimeout(() => {
        if (faceVideoRef.current) { faceVideoRef.current.srcObject = stream; faceVideoRef.current.play(); }
      }, 100);
    } catch (e) {
      setFaceStatus(getCameraErrorMsg(e));
      return;
    }

    setFaceStatus('Carregando modelos de IA...');
    try {
      await ensureFaceModelsLoaded();
    } catch {
      setFaceStatus('Falha ao carregar modelos. Verifique a conexão.');
      return;
    }

    const descriptor = new Float32Array(currentUser.faceDescriptor);

    // Captura o próximo step disponível no momento de abertura da câmera
    const proximoStepId = (['chegada', 'saida_almoco', 'volta_almoco', 'saida_final'] as const).find(id => {
      if (id === 'chegada') return !pontoHoje?.chegada;
      if (id === 'saida_almoco') return !!pontoHoje?.chegada && !pontoHoje?.saida_almoco;
      if (id === 'volta_almoco') return !!pontoHoje?.saida_almoco && !pontoHoje?.volta_almoco;
      if (id === 'saida_final') return !!pontoHoje?.chegada && !pontoHoje?.saida_final && (!pontoHoje?.saida_almoco || !!pontoHoje?.volta_almoco);
      return false;
    });

    const nomeStep: Record<string, string> = {
      chegada: 'Chegada',
      saida_almoco: 'Saída Almoço',
      volta_almoco: 'Volta Almoço',
      saida_final: 'Saída',
    };

    if (!proximoStepId) {
      setFaceStatus('Nenhum registro pendente para hoje.');
      setTimeout(pararFaceMode, 2000);
      return;
    }

    setFaceStatus(`Olhe para a câmera — ${nomeStep[proximoStepId]}`);

    faceScanIntervalRef.current = setInterval(async () => {
      if (!faceVideoRef.current) return;
      try {
        const detection = await faceapi
          .detectSingleFace(faceVideoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setFaceStatus(`Olhe para a câmera — ${nomeStep[proximoStepId]}`);
          return;
        }

        const distFace = faceapi.euclideanDistance(detection.descriptor, descriptor);

        if (distFace < 0.5) {
          pararFaceMode();
          await baterPontoRef.current(proximoStepId);
        } else {
          setFaceStatus('Rosto não reconhecido. Tente se aproximar...');
        }
      } catch { /* frame error, continua */ }
    }, 1500);
  };

  const steps = [
    {
      id: 'chegada' as const,
      label: 'Chegada',
      desc: 'Início do turno',
      Icon: LogIn,
      valor: pontoHoje?.chegada,
      disponivel: !pontoHoje?.chegada,
    },
    {
      id: 'saida_almoco' as const,
      label: 'Saída Almoço',
      desc: 'Pausa para refeição',
      Icon: Coffee,
      valor: pontoHoje?.saida_almoco,
      disponivel: !!pontoHoje?.chegada && !pontoHoje?.saida_almoco,
    },
    {
      id: 'volta_almoco' as const,
      label: 'Volta Almoço',
      desc: 'Retorno da refeição',
      Icon: RefreshCw,
      valor: pontoHoje?.volta_almoco,
      disponivel: !!pontoHoje?.saida_almoco && !pontoHoje?.volta_almoco,
    },
    {
      id: 'saida_final' as const,
      label: 'Saída',
      desc: 'Fim do turno',
      Icon: LogOut,
      valor: pontoHoje?.saida_final,
      // disponível após chegada, e se almoço foi iniciado, exige que voltou
      disponivel:
        !!pontoHoje?.chegada &&
        !pontoHoje?.saida_final &&
        (!pontoHoje?.saida_almoco || !!pontoHoje?.volta_almoco),
    },
  ];

  return (
    <div className="max-w-md mx-auto space-y-5 pb-10 animate-in fade-in duration-300">

      {/* Header */}
      <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black leading-tight">{currentUser.nome}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {Array.isArray(currentUser.cargo) ? currentUser.cargo.join(', ') : (currentUser.cargo || 'Funcionário')}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-gray-400 text-xs font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
            </p>
            <LiveClock />
          </div>
        </div>
      </div>

      {/* GPS Status */}
      <div className={`rounded-xl p-4 border-2 flex items-center gap-3 transition-all ${
        buscandoGps ? 'bg-gray-50 border-gray-200' :
        gpsErro ? 'bg-red-50 border-red-200' :
        dentroDaArea ? 'bg-green-50 border-green-300 shadow-sm shadow-green-100' :
        'bg-red-50 border-red-200'
      }`}>
        <MapPin size={24} className={
          buscandoGps ? 'text-gray-400' :
          gpsErro ? 'text-red-400' :
          dentroDaArea ? 'text-green-600' : 'text-red-500'
        } />
        <div className="flex-1">
          {buscandoGps && (
            <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block"/>
              Obtendo localização GPS...
            </p>
          )}
          {!buscandoGps && gpsErro && (
            <div>
              <p className="text-sm font-bold text-red-700">GPS não disponível</p>
              <button onClick={iniciarGps} className="text-xs text-red-600 underline mt-0.5">Tentar novamente</button>
            </div>
          )}
          {!buscandoGps && !gpsErro && distancia !== null && (
            <>
              <p className={`font-bold text-sm ${dentroDaArea ? 'text-green-700' : 'text-red-700'}`}>
                {dentroDaArea
                  ? `✅ No estabelecimento (${Math.round(distancia)}m)`
                  : `❌ Fora do estabelecimento (${Math.round(distancia)}m)`}
              </p>
              <p className={`text-xs mt-0.5 ${dentroDaArea ? 'text-green-600' : 'text-red-500'}`}>
                {dentroDaArea ? 'Botão liberado — pode bater o ponto' : `Permitido até ${MAX_DISTANCIA_M}m do local`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Botão Face ou Preview da câmera */}
      {!faceModeAtivo ? (
        <button
          onClick={ativarFaceMode}
          disabled={!dentroDaArea || !!salvando}
          className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold text-sm transition-all ${
            dentroDaArea
              ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-200'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          <ScanFace size={20} />
          Bater Ponto com Reconhecimento Facial
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="relative h-72">
            <video ref={faceVideoRef} className="w-full h-full object-cover" muted playsInline />
            {faceStatus && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-white text-sm text-center py-2.5 px-3 font-medium">
                {faceStatus}
              </div>
            )}
          </div>
          <button
            onClick={pararFaceMode}
            className="w-full p-3 flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            <X size={16} /> Cancelar
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Clock size={16} className="text-orange-500" />
          <h2 className="font-bold text-gray-700 text-sm">Registro do Dia — {dataHojeBR}</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {steps.map((step, idx) => {
            const { Icon } = step;
            const jaBatido = !!step.valor;
            const eSeguinte = step.disponivel;
            const bloqueado = !jaBatido && !eSeguinte;
            const estaCarregando = salvando === step.id;
            const podeBater = eSeguinte && dentroDaArea && !salvando && !faceModeAtivo;

            return (
              <div key={step.id} className={`flex items-center gap-4 p-4 transition-colors ${jaBatido ? 'bg-green-50/40' : ''}`}>
                {/* Número / Check */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                  ${jaBatido ? 'bg-green-100 text-green-700' :
                    bloqueado ? 'bg-gray-100 text-gray-300' :
                    'bg-orange-100 text-orange-600'}`}>
                  {jaBatido
                    ? <CheckCircle size={20} className="text-green-600" />
                    : <span>{idx + 1}</span>}
                </div>

                {/* Label + hora */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${jaBatido ? 'text-gray-600' : bloqueado ? 'text-gray-300' : 'text-gray-800'}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs ${jaBatido ? 'text-gray-400' : bloqueado ? 'text-gray-200' : 'text-gray-400'}`}>
                    {step.desc}
                  </p>
                  {jaBatido && (
                    <p className="text-sm font-black text-green-600 mt-0.5">{step.valor!.hora}</p>
                  )}
                </div>

                {/* Botão */}
                {!jaBatido && (
                  <button
                    onClick={() => baterPonto(step.id)}
                    disabled={!podeBater || estaCarregando || bloqueado}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 flex items-center gap-2 transition-all select-none
                      ${estaCarregando
                        ? 'bg-gray-200 text-gray-400 cursor-wait'
                        : bloqueado
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : dentroDaArea
                        ? 'bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-lg shadow-green-200'
                        : 'bg-red-100 text-red-300 cursor-not-allowed'
                      }`}
                  >
                    {estaCarregando ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando</>
                    ) : bloqueado ? (
                      <><AlertTriangle size={15} /> Bloqueado</>
                    ) : !dentroDaArea ? (
                      <><AlertTriangle size={15} /> Longe</>
                    ) : (
                      <><Icon size={15} /> Bater Ponto</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumo do dia (quando tem pelo menos chegada) */}
      {pontoHoje?.chegada && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2">Resumo do Dia</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Chegada', valor: pontoHoje.chegada?.hora },
              { label: 'Saída Almoço', valor: pontoHoje.saida_almoco?.hora },
              { label: 'Volta Almoço', valor: pontoHoje.volta_almoco?.hora },
              { label: 'Saída', valor: pontoHoje.saida_final?.hora },
            ].map(({ label, valor }) => (
              <div key={label} className={`p-3 rounded-xl border ${valor ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
                <p className={`text-lg font-black mt-0.5 ${valor ? 'text-green-700' : 'text-gray-300'}`}>
                  {valor ?? '--:--'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 p-4 rounded-xl shadow-2xl text-white font-bold z-50 animate-in slide-in-from-bottom-4 duration-200 ${toast.tipo === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
