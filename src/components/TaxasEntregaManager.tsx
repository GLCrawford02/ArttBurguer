import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';
import { MapPin, Save, CheckCircle, AlertTriangle, Navigation, Wand2, Map, Plus, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const KM_MAX = 20;

function MapClickHandler({ onClick }: { onClick: (latlng: [number, number]) => void }) {
  useMapEvents({ click(e) { onClick([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function TaxasEntregaManager() {
  const [taxas, setTaxas] = useState<Record<number, string>>(
    Object.fromEntries(Array.from({ length: KM_MAX }, (_, i) => [i + 1, '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoBase, setAutoBase] = useState('');
  const [autoPerKm, setAutoPerKm] = useState('');
  const [zonasRestritas, setZonasRestritas] = useState<number[][][]>([]);
  const [currentZona, setCurrentZona] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lojaCoords, setLojaCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    return onValue(ref(db, 'configuracoes/taxas_entrega'), snap => {
      const data = snap.val();
      if (!data?.taxas) return;
      setTaxas(prev => {
        const next = { ...prev };
        for (let i = 1; i <= KM_MAX; i++) {
          next[i] = data.taxas[i] !== undefined ? String(data.taxas[i]) : '';
        }
        return next;
      });
      if (data.zonasRestritas) {
        setZonasRestritas(data.zonasRestritas);
      }
      if (data.loja_lat && data.loja_lng) {
         setLojaCoords({ lat: data.loja_lat, lng: data.loja_lng });
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const taxasNum: Record<number, number> = {};
      for (let i = 1; i <= KM_MAX; i++) {
        taxasNum[i] = parseFloat(String(taxas[i]).replace(',', '.')) || 0;
      }
      await update(ref(db, 'configuracoes/taxas_entrega'), { 
        taxas: taxasNum,
        zonasRestritas
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = () => {
    const base = parseFloat(autoBase.replace(',', '.')) || 0;
    const perKm = parseFloat(autoPerKm.replace(',', '.')) || 0;
    const next: Record<number, string> = {};
    for (let i = 1; i <= KM_MAX; i++) {
      next[i] = (base + perKm * i).toFixed(2);
    }
    setTaxas(next);
  };

  const setTaxa = (km: number, val: string) =>
    setTaxas(prev => ({ ...prev, [km]: val }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-800">Taxas de Entrega</h3>
          <p className="text-sm text-gray-500 mt-1">
            Valor de referência cobrado por distância (km) entre a loja e o cliente.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm self-start"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>

      {/* Info coords */}
      <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-start gap-3">
        <MapPin size={15} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          As coordenadas da loja usadas para calcular a distância são as mesmas configuradas no <strong>Registro de Ponto</strong>.
        </p>
      </div>

      {/* Auto-preenchimento */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 flex items-center border-b border-gray-100 pb-2 mb-4">
          <Wand2 size={15} className="mr-2 text-purple-500" />
          Preencher Automaticamente
        </h4>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Taxa base (R$)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">R$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={autoBase}
                onChange={e => setAutoBase(e.target.value)}
                className="w-28 pl-8 pr-2 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>
          </div>
          <span className="text-gray-400 font-bold pb-2.5">+</span>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Valor por KM (R$)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">R$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={autoPerKm}
                onChange={e => setAutoPerKm(e.target.value)}
                className="w-28 pl-8 pr-2 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>
          </div>
          <button
            onClick={handleAutoFill}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors"
          >
            <Wand2 size={14} /> Aplicar nos 20 km
          </button>
        </div>
        {(autoBase || autoPerKm) && (
          <p className="text-xs text-gray-400 mt-2">
            Prévia:{' '}
            {Array.from({ length: 4 }, (_, i) => i + 1).map(km => {
              const base = parseFloat(autoBase.replace(',', '.')) || 0;
              const per = parseFloat(autoPerKm.replace(',', '.')) || 0;
              return `${km} km = R$ ${(base + per * km).toFixed(2)}`;
            }).join(' · ')} · ...
          </p>
        )}
      </div>

      {/* Tabela de taxas */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 flex items-center border-b border-gray-100 pb-2 mb-5">
          <Navigation size={15} className="mr-2 text-green-500" />
          Tabela de Taxas — 1 a 20 km
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-4">
          {Array.from({ length: KM_MAX }, (_, i) => i + 1).map(km => (
            <div key={km}>
              <label className="text-xs font-bold text-gray-500 block mb-1">{km} km</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">R$</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={taxas[km] ?? ''}
                  onChange={e => setTaxa(km, e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  placeholder="0,00"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Áreas Restritas (Mapa) */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 mb-4 gap-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center">
            <Map size={15} className="mr-2 text-red-500" />
            Zonas de Não-Entrega (Áreas Restritas)
          </h4>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isDrawing ? (
              <>
                <button onClick={() => { setIsDrawing(false); setCurrentZona([]); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                <button onClick={() => { if (currentZona.length >= 3) { setZonasRestritas([...zonasRestritas, currentZona]); setIsDrawing(false); setCurrentZona([]); } }} disabled={currentZona.length < 3} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">Fechar Polígono</button>
              </>
            ) : (
              <>
                <button onClick={() => setZonasRestritas([])} disabled={zonasRestritas.length === 0} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center"><Trash2 size={14} className="mr-1"/> Limpar Áreas</button>
                <button onClick={() => setIsDrawing(true)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center"><Plus size={14} className="mr-1"/> Desenhar Nova Área</button>
              </>
            )}
          </div>
        </div>
        
        {isDrawing && <p className="text-xs text-orange-600 font-bold mb-3 animate-pulse">Clique no mapa para adicionar os pontos. Arraste as bolinhas para ajustar. Clique em uma bolinha para ver a opção de remover. No mínimo 3 pontos.</p>}
        
        <div className="border border-gray-200 rounded-xl overflow-hidden relative" style={{ height: 400, zIndex: 0 }}>
          <MapContainer 
            center={lojaCoords ? [lojaCoords.lat, lojaCoords.lng] : [-18.7580961, -44.4333648]} 
            zoom={13} 
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            <InvalidateSize />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {lojaCoords && (
              <Marker position={[lojaCoords.lat, lojaCoords.lng]} icon={L.divIcon({html: '<div style="background:red;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px black;"></div>', className: ''})}>
              </Marker>
            )}

            {isDrawing && <MapClickHandler onClick={(latlng) => setCurrentZona([...currentZona, latlng])} />}
            
            {zonasRestritas.map((zona, idx) => (
              <Polygon key={idx} positions={zona as [number, number][]} pathOptions={{ color: '#ef4444', fillColor: '#fca5a5', fillOpacity: 0.5, weight: 2 }} />
            ))}
            
            {currentZona.length > 0 && (
              <Polygon positions={currentZona} pathOptions={{ color: '#f59e0b', dashArray: '5, 5', fillOpacity: 0.2 }} />
            )}
            
            {currentZona.map((pt, idx) => (
              <Marker 
                key={idx} 
                position={pt} 
              draggable={true}
              icon={L.divIcon({html: '<div style="background:#f59e0b;width:14px;height:14px;border-radius:50%;border:2px solid white;cursor:grab;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>', className: ''})}
                eventHandlers={{
                dragend: (e) => {
                  const newPos = e.target.getLatLng();
                  setCurrentZona(prev => {
                    const next = [...prev];
                    next[idx] = [newPos.lat, newPos.lng];
                    return next;
                  });
                }
                }}
            >
              <Popup>
                <button onClick={(e) => { e.stopPropagation(); setCurrentZona(prev => prev.filter((_, i) => i !== idx)); }} className="bg-red-500 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-600 transition-colors shadow-sm">
                  Remover Ponto
                </button>
              </Popup>
            </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3">
        <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Estas taxas são de referência para a equipe durante o atendimento.
          A cobrança efetiva é registrada manualmente no momento da venda.
        </p>
      </div>

    </div>
  );
}
