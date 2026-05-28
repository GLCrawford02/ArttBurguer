import { RefObject } from 'react';
import { X, Lock } from 'lucide-react';

interface AuthEditItem {
  itemId: string;
  delta: 1 | -1;
}

interface Props {
  authEditModal: AuthEditItem | null;
  onClose: () => void;
  authEditMethod: 'face' | 'pin';
  setAuthEditMethod: (v: 'face' | 'pin') => void;
  authEditPin: string;
  setAuthEditPin: (v: string) => void;
  faceAuthVideoRef: RefObject<HTMLVideoElement | null>;
  faceAuthStatus: string;
  onAutorizarPin: () => void;
}

export default function AuthEditModal({
  authEditModal, onClose, authEditMethod, setAuthEditMethod,
  authEditPin, setAuthEditPin, faceAuthVideoRef, faceAuthStatus, onAutorizarPin
}: Props) {
  if (!authEditModal) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-gray-800 flex items-center gap-2"><Lock size={18} className="text-orange-500"/> Edição Bloqueada</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <p className="text-sm text-gray-500">Este item já foi salvo/enviado à cozinha. Para alterar a quantidade dele, use reconhecimento facial ou PIN de <strong>Caixa, Gerente ou superior</strong>. Para adicionar sem autorização, busque o produto novamente e lance como novo item.</p>
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setAuthEditMethod('face')} className={`py-2 rounded-lg text-sm font-bold transition-colors ${authEditMethod === 'face' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Facial</button>
          <button onClick={() => setAuthEditMethod('pin')} className={`py-2 rounded-lg text-sm font-bold transition-colors ${authEditMethod === 'pin' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>PIN</button>
        </div>
        {authEditMethod === 'face' ? (
          <div className="relative rounded-xl overflow-hidden bg-gray-900 h-56">
            <video ref={faceAuthVideoRef} className="w-full h-full object-cover" muted playsInline />
            {faceAuthStatus && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-white text-xs text-center py-2 px-3">{faceAuthStatus}</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">PIN Autorizador</label>
              <input
                type="tel"
                maxLength={4}
                value={authEditPin}
                onChange={e => setAuthEditPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && authEditPin.length === 4) onAutorizarPin(); }}
                className="w-full text-center tracking-[1em] font-mono p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 mt-1 text-xl"
                placeholder="****"
                style={{ WebkitTextSecurity: 'disc' } as any}
              />
            </div>
            <button onClick={onAutorizarPin} disabled={authEditPin.length !== 4} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50">Autorizar com PIN</button>
          </div>
        )}
        <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
      </div>
    </div>
  );
}
