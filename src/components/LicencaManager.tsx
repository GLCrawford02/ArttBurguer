import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { ShieldCheck, ShieldOff, Save, CheckCircle, AlertTriangle, Calendar, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function LicencaManager() {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [senhaArmazenada, setSenhaArmazenada] = useState<string | null>(null);

  const [licenca, setLicenca] = useState<{ validade?: string; ativo?: boolean } | null>(null);
  const [novaValidade, setNovaValidade] = useState('');
  const [ativo, setAtivo] = useState(true);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const senhaRef = ref(db, 'sistema/licenca_senha');
    return onValue(senhaRef, (snap) => {
      setSenhaArmazenada(snap.val() ?? null);
    });
  }, []);

  useEffect(() => {
    if (!autenticado) return;
    const licRef = ref(db, 'sistema/licenca');
    return onValue(licRef, (snap) => {
      const val = snap.val() ?? {};
      setLicenca(val);
      setNovaValidade(val.validade ?? '');
      setAtivo(val.ativo !== false);
    });
  }, [autenticado]);

  const handleVerificarSenha = () => {
    if (senhaInput.length !== 8) {
      setErroSenha('A senha deve ter exatamente 8 dígitos.');
      return;
    }
    // Se ainda não há senha cadastrada, a primeira entrada cria a senha
    if (senhaArmazenada === null) {
      set(ref(db, 'sistema/licenca_senha'), senhaInput);
      setAutenticado(true);
      return;
    }
    if (senhaInput === senhaArmazenada) {
      setAutenticado(true);
    } else {
      setErroSenha('Senha incorreta.');
      setSenhaInput('');
    }
  };

  const handleSalvarLicenca = async () => {
    if (!novaValidade) {
      showToast('Informe uma data de validade.', 'error');
      return;
    }
    try {
      await set(ref(db, 'sistema/licenca'), { validade: novaValidade, ativo });
      showToast('Licença atualizada com sucesso!');
    } catch {
      showToast('Erro ao salvar licença.', 'error');
    }
  };

  const handleAlterarSenha = async () => {
    if (novaSenha.length !== 8) {
      showToast('A nova senha deve ter exatamente 8 dígitos.', 'error');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      showToast('As senhas não coincidem.', 'error');
      return;
    }
    try {
      await set(ref(db, 'sistema/licenca_senha'), novaSenha);
      setNovaSenha('');
      setConfirmarSenha('');
      showToast('Senha alterada com sucesso!');
    } catch {
      showToast('Erro ao alterar senha.', 'error');
    }
  };

  const hoje = new Date().toISOString().split('T')[0];
  const expirada = !licenca?.validade || licenca.ativo === false
    ? true
    : new Date(licenca.validade + 'T23:59:59') < new Date();

  const diasRestantes = licenca?.validade
    ? Math.ceil((new Date(licenca.validade + 'T23:59:59').getTime() - Date.now()) / 86400000)
    : null;

  // Tela de senha
  if (!autenticado) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
          <div className="mx-auto bg-indigo-100 text-indigo-600 w-14 h-14 rounded-full flex items-center justify-center mb-4">
            <KeyRound size={24} />
          </div>
          <h3 className="text-lg font-black text-gray-800 mb-1">Acesso Restrito</h3>
          <p className="text-sm text-gray-400 mb-6">
            {senhaArmazenada === null ? 'Defina uma senha de 8 dígitos para proteger esta área.' : 'Digite a senha de 8 dígitos para continuar.'}
          </p>

          <div className="relative mb-3">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              value={senhaInput}
              onChange={(e) => { setSenhaInput(e.target.value.replace(/\D/g, '')); setErroSenha(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleVerificarSenha()}
              placeholder="••••••••"
              className="w-full text-center text-2xl tracking-[0.4em] font-mono p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all pr-12"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {erroSenha && <p className="text-red-500 text-sm font-bold mb-3">{erroSenha}</p>}

          <button
            onClick={handleVerificarSenha}
            disabled={senhaInput.length !== 8}
            className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            {senhaArmazenada === null ? 'Criar Senha' : 'Entrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className={`p-3 rounded-xl mr-4 ${expirada ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {expirada ? <ShieldOff size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Licença do Sistema</h3>
          <p className="text-sm text-gray-500">Controle remoto de acesso. Visível apenas para TI.</p>
        </div>
      </div>

      {/* Status atual */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">Status Atual</h4>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className={`flex-1 p-4 rounded-xl border-2 text-center ${expirada ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-500">Situação</p>
            <p className={`text-xl font-black ${expirada ? 'text-red-600' : 'text-green-600'}`}>
              {licenca?.ativo === false ? 'Suspenso' : expirada ? 'Expirado' : 'Ativo'}
            </p>
          </div>
          <div className="flex-1 p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-500">Válido até</p>
            <p className="text-xl font-black text-gray-800">
              {licenca?.validade
                ? new Date(licenca.validade + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—'}
            </p>
          </div>
          {diasRestantes !== null && (
            <div className={`flex-1 p-4 rounded-xl border-2 text-center ${diasRestantes <= 7 ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-500">Dias restantes</p>
              <p className={`text-xl font-black ${diasRestantes <= 7 ? 'text-orange-600' : 'text-blue-600'}`}>
                {diasRestantes > 0 ? diasRestantes : 0}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Renovar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">Renovar / Configurar</h4>
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Nova data de validade</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                min={hoje}
                value={novaValidade}
                onChange={(e) => setNovaValidade(e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="font-bold text-gray-700 text-sm">Sistema ativo</p>
              <p className="text-xs text-gray-400">Desativar suspende o acesso imediatamente</p>
            </div>
            <button
              onClick={() => setAtivo(!ativo)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${ativo ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${ativo ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <button
            onClick={handleSalvarLicenca}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-sm"
          >
            <Save size={18} className="mr-2" /> Salvar Licença
          </button>
        </div>
      </div>

      {/* Alterar senha */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">Alterar Senha de Acesso</h4>
        <div className="max-w-md space-y-3">
          <div className="relative">
            <input
              type={mostrarNovaSenha ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value.replace(/\D/g, ''))}
              placeholder="Nova senha (8 dígitos)"
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm pr-10 font-mono tracking-widest"
            />
            <button type="button" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            type={mostrarNovaSenha ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={8}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirmar nova senha"
            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono tracking-widest"
          />
          <button
            onClick={handleAlterarSenha}
            disabled={novaSenha.length !== 8 || confirmarSenha.length !== 8}
            className="w-full bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-900 disabled:opacity-40 transition-colors flex items-center justify-center"
          >
            <KeyRound size={16} className="mr-2" /> Alterar Senha
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
