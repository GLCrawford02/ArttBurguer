import { useState, useEffect } from 'react';
import { ref, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Clock, Repeat, X } from 'lucide-react';

export default function ModalAgendamentos({ isOpen, onClose, itemEdit, setItemEdit, showToast }: any) {
  const [tituloAg, setTituloAg] = useState('');
  const [dataAg, setDataAg] = useState('');
  const [horaAg, setHoraAg] = useState('');
  const [descAg, setDescAg] = useState('');
  const [recorrenciaAg, setRecorrenciaAg] = useState<'Nenhuma' | 'Diária' | 'Semanal' | 'Mensal' | 'Anual'>('Nenhuma');
  const [fimRecorrenciaAg, setFimRecorrenciaAg] = useState('');

  useEffect(() => {
    if (itemEdit) {
      setTituloAg(itemEdit.titulo || '');
      setDataAg(itemEdit.data || '');
      setHoraAg(itemEdit.horario || '');
      setDescAg(itemEdit.descricao || '');
      setRecorrenciaAg(itemEdit.recorrencia || 'Nenhuma');
      setFimRecorrenciaAg(itemEdit.fimRecorrencia || '');
    } else {
      setTituloAg(''); setDataAg(''); setHoraAg(''); setDescAg('');
      setRecorrenciaAg('Nenhuma'); setFimRecorrenciaAg('');
    }
  }, [itemEdit, isOpen]);

  const salvarAgendamento = async () => {
    if (!tituloAg || !dataAg) return showToast('Título e Data são obrigatórios!', 'error');
    const data = { titulo: tituloAg, data: dataAg, horario: horaAg, descricao: descAg, recorrencia: recorrenciaAg, fimRecorrencia: fimRecorrenciaAg };
    if (itemEdit) {
      await update(ref(db, `agendamentos/${itemEdit.id}`), data);
      showToast('Agendamento atualizado!');
    } else {
      await set(push(ref(db, 'agendamentos')), data);
      showToast('Agendamento registrado!');
    }
    setItemEdit(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-50 rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-w-lg">
        <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Clock size={20} className="text-purple-500 mr-2"/> {itemEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
           <input type="text" placeholder="Título (Ex: Reunião Fornecedor)" value={tituloAg} onChange={e=>setTituloAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
           <div className="grid grid-cols-2 gap-2">
             <input type="date" value={dataAg} onChange={e=>setDataAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
             <input type="time" value={horaAg} onChange={e=>setHoraAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
           </div>
           <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="relative">
                <select value={recorrenciaAg} onChange={e=>setRecorrenciaAg(e.target.value as any)} className="w-full p-2 pl-8 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm"><option value="Nenhuma">Sem Recorrência</option><option value="Diária">Recorrência Diária</option><option value="Semanal">Recorrência Semanal</option><option value="Mensal">Recorrência Mensal</option><option value="Anual">Recorrência Anual</option></select>
                <Repeat size={16} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" />
              </div>
              {recorrenciaAg !== 'Nenhuma' && (
                <div className="relative"><label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500">Parar Em:</label><input type="date" value={fimRecorrenciaAg} onChange={e=>setFimRecorrenciaAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm" /></div>
              )}
           </div>
           <textarea placeholder="Descrição ou observações..." value={descAg} onChange={e=>setDescAg(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none h-24 text-sm"></textarea>
           <div className="flex gap-2">
             <button onClick={salvarAgendamento} className="flex-1 bg-purple-600 text-white p-2.5 rounded-lg font-bold hover:bg-purple-700 transition-colors text-sm shadow-sm">{itemEdit ? 'Atualizar' : 'Salvar Agendamento'}</button>
             {itemEdit && <button onClick={() => setItemEdit(null)} className="p-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 text-sm shadow-sm">Cancelar Edição</button>}
           </div>
        </div>
      </div>
    </div>
  );
}
