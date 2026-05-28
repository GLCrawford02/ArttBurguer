import { X, Bot, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  isGenerating: boolean;
  onSubmit: () => void;
}

export default function GarcomIaModal({ show, onClose, aiPrompt, setAiPrompt, isGenerating, onSubmit }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center"><Bot size={20} className="mr-2 text-indigo-600"/> Garçom IA</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="bg-indigo-50 p-3 rounded border border-indigo-100 shadow-sm text-xs text-indigo-800">
          <p>Descreva o pedido como o cliente falou e a IA vai lançar no carrinho. Exemplo:</p>
          <p className="font-mono mt-1">"O cliente quer 2 combos de smash duplo sem cebola e um x-salada com extra de bacon"</p>
        </div>
        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="Descreva o pedido aqui..."
          className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[120px] resize-y bg-gray-50"
        />
        <button onClick={onSubmit} disabled={isGenerating} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70">
          {isGenerating ? <><Loader2 size={18} className="mr-2 animate-spin"/> Lendo Cardápio...</> : <><Sparkles size={18} className="mr-2"/> Adicionar ao Carrinho</>}
        </button>
      </div>
    </div>
  );
}
