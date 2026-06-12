import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';
import { MapPin, Save, CheckCircle, AlertTriangle, Navigation, Wand2, Map, Plus, Trash2, DollarSign } from 'lucide-react';
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const KM_MAX = 20;

export interface ZonaRestrita {
  id: string;
  nome: string;
  coords: [number, number][];
}

export interface ZonaValor {
  id: string;
  nome: string;
  coords: [number, number][];
  valor: number;
}

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
  const [zonasRestritas, setZonasRestritas] = useState<ZonaRestrita[]>([]);
  const [zonasValor, setZonasValor] = useState<ZonaValor[]>([]);
  const [currentZona, setCurrentZona] = useState<[number, number][]>([]);
  const [drawingMode, setDrawingMode] = useState<'restrita' | 'valor' | null>(null);
  const [lojaCoords, setLojaCoords] = useState<{lat: number, lng: number} | null>(null);
  const [editingZonaId, setEditingZonaId] = useState<string | null>(null);
  const [editingZonaTipo, setEditingZonaTipo] = useState<'restrita' | 'valor' | null>(null);
  const [renamingZonaId, setRenamingZonaId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const [hoveredZona, setHoveredZona] = useState<{ tipo: 'restrita' | 'valor'; id: string } | null>(null);

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
        let z = data.zonasRestritas;
        if (!Array.isArray(z)) z = Object.values(z);
        if (z.length > 0) {
          if (Array.isArray(z[0]) && Array.isArray(z[0][0])) {
            setZonasRestritas(z.map((coords: any, idx: number) => ({
              id: `zona_legado_${idx}`,
              nome: `Área Restrita ${idx + 1}`,
              coords
            })));
          } else {
            setZonasRestritas(z);
          }
        } else {
          setZonasRestritas([]);
        }
      }
      if (data.zonasValor) {
        setZonasValor(Object.values(data.zonasValor));
      } else {
        setZonasValor([]);
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
        zonasRestritas,
        zonasValor
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
            {drawingMode ? (
              <>
                <button onClick={() => { setDrawingMode(null); setCurrentZona([]); setEditingZonaId(null); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">Cancelar Desenho</button>
                {drawingMode === 'restrita' && (
                  <button onClick={() => { 
                    if (currentZona.length < 3) return;
                    if (editingZonaId) setZonasRestritas(prev => prev.map(z => z.id === editingZonaId ? { ...z, coords: currentZona } : z));
                    else setZonasRestritas([...zonasRestritas, { id: `zona_${Date.now()}`, nome: `Área Restrita ${zonasRestritas.length + 1}`, coords: currentZona }]); 
                    setDrawingMode(null); setCurrentZona([]); setEditingZonaId(null);
                  }} disabled={currentZona.length < 3} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">Salvar Área Restrita</button>
                )}
                {drawingMode === 'valor' && (
                  <button onClick={() => {
                    if (currentZona.length < 3) return;
                    const valor = prompt('Qual o valor da taxa de entrega para esta área? (Ex: 5.50)');
                    if (valor === null) return;
                    const valorNum = parseFloat(valor.replace(',', '.'));
                    if (isNaN(valorNum) || valorNum <= 0) { alert('Valor inválido.'); return; }
                    if (editingZonaId) setZonasValor(prev => prev.map(z => z.id === editingZonaId ? { ...z, coords: currentZona, valor: valorNum } : z));
                    else setZonasValor([...zonasValor, { id: `zona_valor_${Date.now()}`, nome: `Área com Valor ${zonasValor.length + 1}`, coords: currentZona, valor: valorNum }]);
                    setDrawingMode(null); setCurrentZona([]); setEditingZonaId(null);
                  }} disabled={currentZona.length < 3} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">Salvar Área com Valor</button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => {if(confirm('Tem certeza que deseja apagar TODAS as áreas?')) setZonasRestritas([]);}} disabled={zonasRestritas.length === 0} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center"><Trash2 size={14} className="mr-1"/> Limpar Áreas</button>
                <button onClick={() => { setDrawingMode('restrita'); setCurrentZona([]); setEditingZonaId(null); }} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center"><Plus size={14} className="mr-1"/> Desenhar Área Restrita</button>
              </>
            )}
          </div>
        </div>
        
        {drawingMode && <p className="text-xs text-orange-600 font-bold mb-3 animate-pulse">Clique no mapa para adicionar os pontos. Arraste as bolinhas para ajustar. Clique em uma bolinha para ver a opção de remover. No mínimo 3 pontos.</p>}

        {(zonasRestritas.length > 0 || zonasValor.length > 0) && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Áreas Cadastradas — passe o mouse para destacar no mapa</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4 max-h-64 overflow-y-auto p-1">
              {[
                ...zonasRestritas.map(z => ({ ...z, tipo: 'restrita' as const })),
                ...zonasValor.map(z => ({ ...z, tipo: 'valor' as const })),
              ].map((zona, idx) => {
                const isHovered = hoveredZona?.tipo === zona.tipo && hoveredZona?.id === zona.id;
                const isRestrita = zona.tipo === 'restrita';
                return (
                  <div
                    key={`${zona.tipo}_${zona.id}`}
                    onMouseEnter={() => setHoveredZona({ tipo: zona.tipo, id: zona.id })}
                    onMouseLeave={() => setHoveredZona(null)}
                    className={`h-20 sm:h-24 rounded-xl border-2 flex flex-col items-center justify-center text-center px-1 transition-all cursor-default ${
                      isRestrita ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                    } ${isHovered ? (isRestrita ? 'ring-4 ring-red-400 border-red-400 scale-105 shadow-lg' : 'ring-4 ring-green-400 border-green-400 scale-105 shadow-lg') : ''}`}
                  >
                    <span className={`text-xl sm:text-2xl font-black ${isRestrita ? 'text-red-600' : 'text-green-600'}`}>{idx + 1}</span>
                    <span className="text-[10px] font-bold text-gray-600 mt-0.5 truncate w-full">{zona.nome}</span>
                    {!isRestrita && <span className="text-[10px] font-black text-green-700">R$ {zona.valor.toFixed(2)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-xl overflow-hidden relative" style={{ height: 800, zIndex: 0 }}>
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

            {drawingMode && <MapClickHandler onClick={(latlng) => setCurrentZona([...currentZona, latlng])} />}
            
            {zonasRestritas.map(zona => {
              if (editingZonaId === zona.id) return null;
              const isHovered = hoveredZona?.tipo === 'restrita' && hoveredZona?.id === zona.id;
              return <Polygon key={zona.id} positions={zona.coords} pathOptions={{ color: '#ef4444', fillColor: isHovered ? '#ef4444' : '#fca5a5', fillOpacity: isHovered ? 0.8 : 0.5, weight: isHovered ? 4 : 2 }} />
            })}

            {zonasValor.map(zona => {
              if (editingZonaId === zona.id) return null;
              const isHovered = hoveredZona?.tipo === 'valor' && hoveredZona?.id === zona.id;
              return <Polygon key={zona.id} positions={zona.coords} pathOptions={{ color: '#22c55e', fillColor: isHovered ? '#22c55e' : '#86efac', fillOpacity: isHovered ? 0.8 : 0.5, weight: isHovered ? 4 : 2 }} />
            })}
            
            {currentZona.length > 0 && (
              <Polygon positions={currentZona} pathOptions={{ color: drawingMode === 'restrita' ? '#ef4444' : '#22c55e', dashArray: '5, 5', fillOpacity: 0.2 }} />
            )}
            
            {currentZona.map((pt, idx) => (
              <Marker 
                key={idx} 
                position={pt} 
              draggable={true}
              icon={L.divIcon({html: `<div style="background:${drawingMode === 'restrita' ? '#ef4444' : '#22c55e'};width:14px;height:14px;border-radius:50%;border:2px solid white;cursor:grab;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`, className: ''})}
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

        <div className="mt-6 space-y-3">
          {zonasRestritas.map(zona => (
            <div key={zona.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border border-gray-200 rounded-lg bg-gray-50 gap-3">
              {renamingZonaId === zona.id ? (
                <div className="flex gap-2 w-full sm:w-auto flex-1">
                  <input type="text" value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} className="p-1.5 border border-gray-300 rounded text-sm w-full outline-none focus:border-blue-500" autoFocus />
                  <button onClick={() => {
                    setZonasRestritas(prev => prev.map(z => z.id === zona.id ? { ...z, nome: nomeEdit || z.nome } : z));
                    setRenamingZonaId(null);
                  }} className="text-green-600 font-bold text-sm bg-green-50 px-2 rounded">Salvar</button>
                  <button onClick={() => setRenamingZonaId(null)} className="text-gray-500 font-bold text-sm bg-gray-200 px-2 rounded">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-red-500" />
                  <span className="font-bold text-gray-700">{zona.nome}</span>
                </div>
              )}
              
              {!renamingZonaId && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => { setRenamingZonaId(zona.id); setNomeEdit(zona.nome); setEditingZonaTipo('restrita'); }} className="flex-1 sm:flex-none text-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Renomear</button>
                  <button onClick={() => { setDrawingMode('restrita'); setEditingZonaId(zona.id); setCurrentZona(zona.coords); window.scrollTo({top: 0, behavior: 'smooth'}) }} className="flex-1 sm:flex-none text-center text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Editar Área no Mapa</button>
                  <button onClick={() => { if(confirm('Deseja excluir esta área?')) setZonasRestritas(prev => prev.filter(z => z.id !== zona.id)); }} className="flex-1 sm:flex-none text-center text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Excluir</button>
                </div>
              )}
            </div>
          ))}
          {zonasRestritas.length === 0 && (
            <p className="text-xs text-gray-400 italic mt-4">Nenhuma zona de não-entrega configurada.</p>
          )}
        </div>
      </div>

      {/* Zonas com Valor */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 mb-4 gap-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center">
            <DollarSign size={15} className="mr-2 text-green-500" />
            Zonas de Entrega com Valor Fixo
          </h4>
          {!drawingMode && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => {if(confirm('Tem certeza que deseja apagar TODAS as áreas com valor?')) setZonasValor([]);}} disabled={zonasValor.length === 0} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center"><Trash2 size={14} className="mr-1"/> Limpar Áreas</button>
              <button onClick={() => { setDrawingMode('valor'); setCurrentZona([]); setEditingZonaId(null); }} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors flex items-center"><Plus size={14} className="mr-1"/> Desenhar Área com Valor</button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {zonasValor.map(zona => (
            <div key={zona.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border border-gray-200 rounded-lg bg-gray-50 gap-3">
              {renamingZonaId === zona.id ? (
                <div className="flex gap-2 w-full sm:w-auto flex-1">
                  <input type="text" value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} className="p-1.5 border border-gray-300 rounded text-sm w-full outline-none focus:border-blue-500" autoFocus />
                  <button onClick={() => { setZonasValor(prev => prev.map(z => z.id === zona.id ? { ...z, nome: nomeEdit || z.nome } : z)); setRenamingZonaId(null); }} className="text-green-600 font-bold text-sm bg-green-50 px-2 rounded">Salvar</button>
                  <button onClick={() => setRenamingZonaId(null)} className="text-gray-500 font-bold text-sm bg-gray-200 px-2 rounded">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-green-500" />
                  <span className="font-bold text-gray-700">{zona.nome}</span>
                  <span className="text-xs font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full">R$ {zona.valor.toFixed(2)}</span>
                </div>
              )}
              {!renamingZonaId && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => { setRenamingZonaId(zona.id); setNomeEdit(zona.nome); setEditingZonaTipo('valor'); }} className="flex-1 sm:flex-none text-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Renomear</button>
                  <button onClick={() => { setDrawingMode('valor'); setEditingZonaId(zona.id); setCurrentZona(zona.coords); window.scrollTo({top: 0, behavior: 'smooth'}) }} className="flex-1 sm:flex-none text-center text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Editar Área no Mapa</button>
                  <button onClick={() => { if(confirm('Deseja excluir esta área?')) setZonasValor(prev => prev.filter(z => z.id !== zona.id)); }} className="flex-1 sm:flex-none text-center text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded text-xs font-bold transition-colors">Excluir</button>
                </div>
              )}
            </div>
          ))}
          {zonasValor.length === 0 && <p className="text-xs text-gray-400 italic mt-4">Nenhuma zona com valor fixo configurada.</p>}
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
