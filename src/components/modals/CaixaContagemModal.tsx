import { useState } from 'react';
import { X, Wallet, Calculator } from 'lucide-react';
import { DENOMINACOES_CAIXA, calcularTotalContagem } from '../../utils/caixaUtils';

interface Props {
  title: string;
  subtitle?: string;
  onConfirm: (contagem: Record<string, number>, total: number) => void;
  onClose?: () => void;
}

export default function CaixaContagemModal({ title, subtitle, onConfirm, onClose }: Props) {
  const [contagem, setContagem] = useState<Record<string, number>>({});

  const total = calcularTotalContagem(contagem);

  const handleChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    setContagem(prev => ({ ...prev, [key]: isNaN(num) || num < 0 ? 0 : num }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-lg text-gray-800 flex items-center"><Wallet className="mr-2 text-orange-500" size={22} /> {title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>}
        </div>

        <div className="p-5 overflow-y-auto space-y-2">
          {DENOMINACOES_CAIXA.map(d => {
            const qtd = contagem[d.key] || 0;
            const subtotal = qtd * d.valor;
            return (
              <div key={d.key} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-50">
                <span className="text-sm font-bold text-gray-700 w-32">{d.label}</span>
                <input
                  type="number"
                  min={0}
                  value={contagem[d.key] ?? ''}
                  onChange={e => handleChange(d.key, e.target.value)}
                  className="w-24 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-center font-mono"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500 w-24 text-right font-mono">R$ {subtotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-100 shrink-0 space-y-4">
          <div className="flex items-center justify-between bg-orange-50 p-4 rounded-xl">
            <span className="font-black text-gray-800 flex items-center"><Calculator className="mr-2" size={18} /> Total Contado</span>
            <span className="font-black text-2xl text-orange-600">R$ {total.toFixed(2)}</span>
          </div>
          <button onClick={() => onConfirm(contagem, total)} className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors">
            Confirmar Contagem
          </button>
        </div>
      </div>
    </div>
  );
}
