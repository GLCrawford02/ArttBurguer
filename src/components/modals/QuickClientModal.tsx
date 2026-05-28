import { X, User } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  quickClientName: string;
  setQuickClientName: (v: string) => void;
  quickClientPhone: string;
  setQuickClientPhone: (v: string) => void;
  onSalvar: () => void;
  formatPhone: (v: string) => string;
}

export default function QuickClientModal({ show, onClose, quickClientName, setQuickClientName, quickClientPhone, setQuickClientPhone, onSalvar, formatPhone }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[220] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold text-gray-800 flex items-center"><User className="mr-2 text-indigo-500"/> Cadastro Rápido</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Nome do Cliente</label>
          <input
            type="text"
            value={quickClientName}
            onChange={e => setQuickClientName(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
            placeholder="Ex: João Silva"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">WhatsApp / Telefone</label>
          <input
            type="tel"
            value={quickClientPhone}
            onChange={e => setQuickClientPhone(formatPhone(e.target.value))}
            className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
            placeholder="(00) 00000-0000"
          />
        </div>

        <button
          onClick={onSalvar}
          disabled={!quickClientName || quickClientPhone.replace(/\D/g, '').length < 10}
          className="w-full mt-2 bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Salvar e Vincular
        </button>
      </div>
    </div>
  );
}
