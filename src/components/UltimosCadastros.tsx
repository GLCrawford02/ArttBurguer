import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { Users, Search, Download, X, Pencil, MapPin } from 'lucide-react';
import ExcelJS from 'exceljs';
import { normalizeString } from '../utils/stringUtils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function UltimosCadastros() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState('');

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const unsub = onValue(clientesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          ...val,
          id,
          nome: val.nome || 'Sem Nome',
          telefone: val.telefone || '',
          timestamp: val.dataCadastro || val.timestamp || 0
        })).filter(c => c.timestamp > 0);
        
        list.sort((a, b) => b.timestamp - a.timestamp);
        setClientes(list);
      } else {
        setClientes([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Últimos Cadastros');

    ws.columns = [
      { header: 'Nome', key: 'nome', width: 40 },
      { header: 'Telefone', key: 'telefone', width: 20 },
      { header: 'Data Cadastro', key: 'data', width: 20 },
      { header: 'Hora Cadastro', key: 'hora', width: 15 },
    ];

    filteredClientes.forEach(cliente => {
      const dt = new Date(cliente.timestamp);
      ws.addRow({
        nome: cliente.nome,
        telefone: cliente.telefone,
        data: dt.toLocaleDateString('pt-BR'),
        hora: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ultimos_cadastros.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSalvarEdicao = async () => {
    try {
      const latNum = editData.lat ? parseFloat(String(editData.lat).replace(',', '.')) : NaN;
      const lngNum = editData.lng ? parseFloat(String(editData.lng).replace(',', '.')) : NaN;
      
      const payload: any = {
        nome: editData.nome || '',
        telefone: editData.telefone || '',
        cpf: editData.cpf || '',
        logradouro: editData.logradouro || '',
        numero: editData.numero || '',
        bairro: editData.bairro || '',
        cidade: editData.cidade || '',
      };

      if (!isNaN(latNum) && !isNaN(lngNum)) {
        payload.lat = latNum;
        payload.lng = lngNum;
        payload.coordAproximada = false;
      } else {
        payload.lat = null;
        payload.lng = null;
        payload.coordAproximada = false;
      }

      await update(ref(db, `clientes/${selectedCliente.id}`), payload);
      
      setSelectedCliente({ ...selectedCliente, ...payload });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar cliente.');
    }
  };

  const buscarCoordenadas = async () => {
    if (!editData.logradouro || !editData.cidade) {
      setGeocodingMsg('Preencha Logradouro e Cidade antes de buscar.');
      setTimeout(() => setGeocodingMsg(''), 3000);
      return;
    }
    setIsGeocoding(true);
    setGeocodingMsg('Buscando...');
    try {
      const q = encodeURIComponent(`${editData.logradouro}, ${editData.numero || ''}, ${editData.bairro || ''}, ${editData.cidade}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setEditData({ ...editData, lat: parseFloat(data[0].lat).toFixed(6), lng: parseFloat(data[0].lon).toFixed(6) });
        setGeocodingMsg('Coordenadas encontradas com sucesso!');
      } else {
        setGeocodingMsg('Endereço não encontrado no mapa.');
      }
    } catch (e) {
      setGeocodingMsg('Erro na busca das coordenadas.');
    } finally {
      setIsGeocoding(false);
      setTimeout(() => setGeocodingMsg(''), 3000);
    }
  };

  const filteredClientes = clientes.filter(cliente => {
    if (!searchTerm) return true;
    return normalizeString(cliente.nome).includes(normalizeString(searchTerm)) || (cliente.telefone || '').replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''));
  });

  const groupedClientes: Record<string, any[]> = {};
  filteredClientes.forEach(cliente => {
    const dateStr = new Date(cliente.timestamp).toLocaleDateString('pt-BR');
    if (!groupedClientes[dateStr]) groupedClientes[dateStr] = [];
    groupedClientes[dateStr].push(cliente);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <div className="bg-indigo-100 p-3 rounded-xl mr-4 text-indigo-600"><Users size={24} /></div>
          <div><h3 className="text-lg font-bold text-gray-800">Últimos Cadastros</h3><p className="text-sm text-gray-500">Acompanhe os clientes mais recentes cadastrados no sistema.</p></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <button onClick={exportToExcel} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-colors">
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 max-h-[70vh] overflow-y-auto">
        {loading ? <p className="text-gray-500 text-center py-4">Carregando...</p> : Object.keys(groupedClientes).length === 0 ? <p className="text-gray-500 text-center py-4">Nenhum cadastro encontrado.</p> : (
          <div className="space-y-8">
            {Object.entries(groupedClientes).map(([data, lista]) => (
              <div key={data}>
                <h4 className="font-bold text-indigo-600 text-lg border-b border-gray-100 pb-2 mb-3">{data}</h4>
                <div className="space-y-3">
                  {lista.map(c => (
                    <button key={c.id} onClick={() => setSelectedCliente(c)} className="w-full text-gray-700 text-base font-medium flex items-center hover:text-indigo-600 transition-colors text-left">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full mr-3 shrink-0"></span>
                      {c.nome} <span className="text-gray-400 ml-2">({new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCliente && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => { setSelectedCliente(null); setIsEditing(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-black">{selectedCliente.nome}</h2>
                <p className="text-indigo-200 mt-1">{selectedCliente.telefone}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button onClick={() => {
                    setEditData({
                      nome: selectedCliente.nome || '',
                      telefone: selectedCliente.telefone || '',
                      cpf: selectedCliente.cpf || '',
                      logradouro: selectedCliente.logradouro || '',
                      numero: selectedCliente.numero || '',
                      bairro: selectedCliente.bairro || '',
                      cidade: selectedCliente.cidade || '',
                      lat: selectedCliente.lat || '',
                      lng: selectedCliente.lng || '',
                    });
                    setIsEditing(true);
                  }} className="text-indigo-200 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-2 rounded-full transition-colors" title="Editar Cliente"><Pencil size={20}/></button>
                )}
                <button onClick={() => { setSelectedCliente(null); setIsEditing(false); }} className="text-indigo-200 hover:text-white bg-indigo-700/50 hover:bg-indigo-700 p-2 rounded-full transition-colors"><X size={20}/></button>
              </div>
            </div>
            
            {isEditing ? (
              <div className="p-6 overflow-y-auto max-h-[60vh] bg-gray-50 space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                  <h4 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2">Edição Rápida</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
                      <input type="text" value={editData.nome} onChange={e => setEditData({...editData, nome: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Telefone</label>
                      <input type="text" value={editData.telefone} onChange={e => setEditData({...editData, telefone: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">Logradouro</label>
                      <input type="text" value={editData.logradouro} onChange={e => setEditData({...editData, logradouro: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Número</label>
                      <input type="text" value={editData.numero} onChange={e => setEditData({...editData, numero: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Bairro</label>
                      <input type="text" value={editData.bairro} onChange={e => setEditData({...editData, bairro: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Cidade</label>
                      <input type="text" value={editData.cidade} onChange={e => setEditData({...editData, cidade: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 mt-3">
                    <div className="col-span-2 flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Coordenadas GPS</label>
                      <button type="button" onClick={buscarCoordenadas} disabled={isGeocoding} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold hover:bg-indigo-100 transition-colors flex items-center disabled:opacity-50">
                        <MapPin size={12} className="mr-1" />
                        {isGeocoding ? 'Buscando...' : 'Buscar pelo Endereço'}
                      </button>
                    </div>
                    {geocodingMsg && <div className="col-span-2 text-[10px] text-orange-600 font-bold -mt-2 mb-1">{geocodingMsg}</div>}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Latitude</label>
                      <input type="text" value={editData.lat} onChange={e => setEditData({...editData, lat: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-mono text-sm" placeholder="-18.758096" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Longitude</label>
                      <input type="text" value={editData.lng} onChange={e => setEditData({...editData, lng: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-mono text-sm" placeholder="-44.433364" />
                    </div>
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-300 transition-colors">Cancelar</button>
                    <button onClick={handleSalvarEdicao} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Salvar Alterações</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto max-h-[60vh] bg-gray-50 space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2">Dados Pessoais</h4>
                  <p className="text-sm text-gray-600 mb-1"><span className="font-bold">CPF:</span> {selectedCliente.cpf || 'Não informado'}</p>
                  <p className="text-sm text-gray-600 mb-1"><span className="font-bold">Nascimento:</span> {selectedCliente.dataNascimento ? new Date(selectedCliente.dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado'}</p>
                  <p className="text-sm text-gray-600 mb-1"><span className="font-bold">Data de Cadastro:</span> {new Date(selectedCliente.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2">Endereço Principal</h4>
                  {selectedCliente.logradouro ? (
                    <p className="text-sm text-gray-600">
                      {selectedCliente.logradouro}, {selectedCliente.numero} - {selectedCliente.bairro}
                      <br/>{selectedCliente.cidade}/{selectedCliente.uf}
                      {selectedCliente.complemento && <><br/>Comp: {selectedCliente.complemento}</>}
                      {selectedCliente.cep && <><br/>CEP: {selectedCliente.cep}</>}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Nenhum endereço cadastrado.</p>
                  )}
                </div>

                {selectedCliente.lat && selectedCliente.lng && (
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2 flex justify-between items-center">
                      <span>Localização no Mapa</span>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${selectedCliente.lat},${selectedCliente.lng}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded">Ver no Google Maps</a>
                    </h4>
                    <div className="h-48 rounded-lg overflow-hidden border border-gray-200">
                      <MapContainer center={[selectedCliente.lat, selectedCliente.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[selectedCliente.lat, selectedCliente.lng]} icon={new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/609/609803.png', iconSize: [32, 32], iconAnchor: [16, 32] })}>
                          <Popup>
                            <strong>{selectedCliente.nome}</strong><br/>
                            {selectedCliente.logradouro}, {selectedCliente.numero}
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                )}

                {(selectedCliente.observacaoCliente || selectedCliente.observacaoEntregador) && (
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-2">Observações</h4>
                      {selectedCliente.observacaoCliente && (
                        <div className="mb-2">
                          <span className="text-xs font-bold text-yellow-800 uppercase block mb-1">Do Cliente</span>
                          <p className="text-sm text-gray-600">{selectedCliente.observacaoCliente}</p>
                        </div>
                      )}
                      {selectedCliente.observacaoEntregador && (
                        <div>
                          <span className="text-xs font-bold text-blue-800 uppercase block mb-1">Para o Entregador</span>
                          <p className="text-sm text-gray-600">{selectedCliente.observacaoEntregador}</p>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}