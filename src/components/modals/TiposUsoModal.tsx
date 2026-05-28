import { X, Trash2 } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  tiposUsoDb: { id: string; nome: string }[];
  novoTipoForm: string;
  setNovoTipoForm: (v: string) => void;
  onAddTipo: () => void;
  onDeleteTipo: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function TiposUsoModal({ show, onClose, tiposUsoDb, novoTipoForm, setNovoTipoForm, onAddTipo, onDeleteTipo, canEdit, canDelete }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-gray-800">Tipos de Uso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        {canEdit && (
          <div className="flex space-x-2">
            <input
              type="text"
              value={novoTipoForm}
              onChange={e => setNovoTipoForm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddTipo()}
              placeholder="Novo tipo (ex: Embalagem)"
              className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
            <button onClick={onAddTipo} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors text-sm">Adicionar</button>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
          {tiposUsoDb.map(t => (
            <div key={t.id} className="flex justify-between items-center p-3 hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-700">{t.nome}</span>
              {canDelete && <button onClick={() => onDeleteTipo(t.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>}
            </div>
          ))}
          {tiposUsoDb.length === 0 && <p className="p-4 text-center text-sm text-gray-400">Nenhum tipo cadastrado.</p>}
        </div>
      </div>
    </div>
  );
}
