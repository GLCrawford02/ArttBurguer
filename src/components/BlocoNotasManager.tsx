import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { FileEdit, Loader2, CheckCircle, Bold, Italic, Underline } from 'lucide-react';

export default function BlocoNotasManager({ currentUser }: { currentUser: any }) {
  const [texto, setTexto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    const notaRef = ref(db, `bloco_notas/${currentUser.id}`);
    const unsub = onValue(notaRef, (snap) => {
      const data = snap.val();
      if (data && data.texto !== undefined && !isLoaded) {
        setTexto(data.texto);
        setLastSaved(data.timestamp);
      }
      setIsLoaded(true);
    }, { onlyOnce: true });
    
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.id || !isLoaded) return;
    
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      try {
        await set(ref(db, `bloco_notas/${currentUser.id}`), {
          texto,
          timestamp: Date.now()
        });
        setLastSaved(Date.now());
      } catch (error) {
        console.error("Erro ao salvar nota:", error);
      } finally {
        setIsSaving(false);
      }
    }, 1500); // Salva automaticamente 1,5s após parar de digitar

    return () => clearTimeout(timeoutId);
  }, [texto, currentUser, isLoaded]);

  const insertMarkdown = (syntax: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = texto.substring(start, end);

    let newText;
    if (syntax === '**' || syntax === '*' || syntax === '__') {
      newText = texto.substring(0, start) + syntax + selectedText + syntax + texto.substring(end);
    } else {
      newText = texto.substring(0, start) + syntax + selectedText + texto.substring(end);
    }
    
    setTexto(newText);

    // Reposiciona o cursor
    setTimeout(() => {
      if (textarea) {
        textarea.selectionStart = start + syntax.length;
        textarea.selectionEnd = end + syntax.length;
      }
    }, 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <div className="bg-yellow-100 p-3 rounded-xl mr-4 text-yellow-600"><FileEdit size={24} /></div>
          <div><h3 className="text-lg font-bold text-gray-800">Bloco de Notas Pessoal</h3><p className="text-sm text-gray-500">Suas anotações são privadas e salvas automaticamente em nuvem.</p></div>
        </div>
        <div className="flex items-center text-sm font-bold text-gray-400">
          <span className="mr-4 text-gray-500">{texto.length} caracteres</span>
          {isSaving ? <span className="flex items-center text-blue-500"><Loader2 size={16} className="mr-2 animate-spin" /> Salvando...</span> : lastSaved ? <span className="flex items-center text-green-500"><CheckCircle size={16} className="mr-2" /> Salvo às {new Date(lastSaved).toLocaleTimeString('pt-BR')}</span> : null}
        </div>
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-100 flex gap-2">
          <button onClick={() => insertMarkdown('**')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold" title="Negrito"><Bold size={18} /></button>
          <button onClick={() => insertMarkdown('*')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 italic" title="Itálico"><Italic size={18} /></button>
          <button onClick={() => insertMarkdown('__')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 underline" title="Sublinhado"><Underline size={18} /></button>
        </div>
        <textarea ref={textareaRef} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comece a digitar suas ideias, lembretes operacionais ou informações úteis aqui..." className="flex-1 w-full p-6 outline-none resize-none bg-transparent text-gray-700 leading-relaxed text-base" />
      </div>
    </div>
  );
}