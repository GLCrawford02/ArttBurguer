import { Ticket } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  descontoInput: string;
  setDescontoInput: (v: string) => void;
  descontoPin: string;
  setDescontoPin: (v: string) => void;
  onSubmit: () => void;
}

export default function DescontoModal({ show, onClose, descontoInput, setDescontoInput, descontoPin, setDescontoPin, onSubmit }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[130] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center justify-center mb-2">
          <Ticket className="mr-2 text-blue-500"/> Aplicar Desconto
        </h3>
        <p className="text-sm text-gray-500 text-center">Informe o código promocional ou o valor exato em R$ do desconto a ser aplicado.</p>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Cupom ou Valor (R$)</label>
          <input
            type="text"
            value={descontoInput}
            onChange={e => setDescontoInput(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mt-1"
            placeholder="Ex: R$ 10,00 ou NATAL15"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase flex items-center">PIN de Autorização (Caixa ou Gerente)</label>
          <input
            type="tel"
            maxLength={4}
            value={descontoPin}
            onChange={e => setDescontoPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center tracking-[1em] font-mono p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mt-1 text-xl"
            placeholder="****"
            style={{ WebkitTextSecurity: 'disc' } as any}
          />
        </div>

        <div className="flex space-x-3 pt-2">
          <button onClick={onClose} className="flex-1 p-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
          <button onClick={onSubmit} disabled={!descontoInput || descontoPin.length !== 4} className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">Autorizar</button>
        </div>
      </div>
    </div>
  );
}
