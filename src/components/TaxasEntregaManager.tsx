import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { MapPin, Save, CheckCircle, AlertTriangle, Navigation, Wand2 } from 'lucide-react';

const KM_MAX = 20;

export default function TaxasEntregaManager() {
  const [taxas, setTaxas] = useState<Record<number, string>>(
    Object.fromEntries(Array.from({ length: KM_MAX }, (_, i) => [i + 1, '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoBase, setAutoBase] = useState('');
  const [autoPerKm, setAutoPerKm] = useState('');

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
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const taxasNum: Record<number, number> = {};
      for (let i = 1; i <= KM_MAX; i++) {
        taxasNum[i] = parseFloat(String(taxas[i]).replace(',', '.')) || 0;
      }
      await set(ref(db, 'configuracoes/taxas_entrega/taxas'), taxasNum);
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
