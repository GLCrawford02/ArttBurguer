import { useState, useEffect, useRef, FormEvent } from 'react';
import { ref, push, set, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { Funcionario, TransferenciaLog } from '../types';
import { Plus, Trash2, Save, Pencil, X, History, Users, CheckCircle, AlertTriangle, UserX, UserCheck, MessageSquare, Camera, ScanFace } from 'lucide-react';
import { ensureFaceModelsLoaded, faceapi, getCameraStream, getCameraErrorMsg } from '../faceApiUtils';

const validarCPF = (cpf: string): boolean => {
  let apenasNumeros = "";
  for (let i = 0; i < cpf.length; i++) {
    const charCode = cpf.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) apenasNumeros += cpf[i];
  }
  
  if (apenasNumeros.length !== 11) return false;
  
  let tudoIgual = true;
  for (let i = 1; i < 11; i++) {
    if (apenasNumeros[i] !== apenasNumeros[0]) { tudoIgual = false; break; }
  }
  if (tudoIgual) return false;

  let peso1 = 0, peso2 = 0;
  for (let i = 0; i < 9; i++) {
    const valorDigito = apenasNumeros.charCodeAt(i) - 48;
    peso1 += valorDigito * (10 - i);
    peso2 += valorDigito * (11 - i);
  }

  let digito1 = (peso1 * 10) % 11;
  if (digito1 === 10 || digito1 === 11) digito1 = 0;
  if (digito1 !== (apenasNumeros.charCodeAt(9) - 48)) return false;

  let digito2 = ((peso2 + digito1 * 2) * 10) % 11;
  if (digito2 === 10 || digito2 === 11) digito2 = 0;

  return digito2 === (apenasNumeros.charCodeAt(10) - 48);
};

export default function FuncionariosManager({ currentUser }: { currentUser?: any }) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaLog[]>([]);
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [historicoFuncionarioId, setHistoricoFuncionarioId] = useState<string | null>(null);
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  
  const [formData, setFormData] = useState<{nome: string, pin: string, cargo: string[], ativo: boolean, telefone: string, cpf: string}>({ nome: '', pin: '', cargo: ['Atendente'], ativo: true, telefone: '', cpf: '' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [faceModalFuncId, setFaceModalFuncId] = useState<string | null>(null);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [faceCaptureStatus, setFaceCaptureStatus] = useState('');
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
      
  useEffect(() => {
    let isFirstLoad = true;
    const funcRef = ref(db, 'funcionarios');
    const unsubFunc = onValue(funcRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => {
          const cargoA = Array.isArray(a.cargo) ? a.cargo[0] || 'Atendente' : a.cargo || 'Atendente';
          const cargoB = Array.isArray(b.cargo) ? b.cargo[0] || 'Atendente' : b.cargo || 'Atendente';
          const cargoCompare = cargoA.localeCompare(cargoB);
          if (cargoCompare !== 0) return cargoCompare;
          return (a.nome || '').localeCompare(b.nome || '');
        });
        setFuncionarios(list);
      } else {
        setFuncionarios([]);
        if (isFirstLoad) {
          set(push(ref(db, 'funcionarios')), { nome: 'Admin', pin: '0000', cargo: 'Administrador' });
        }
      }
      isFirstLoad = false;
    });

    const transRef = ref(db, 'historico_transferencias');
    const unsubTrans = onValue(transRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        list.sort((a, b) => b.timestamp - a.timestamp);
        setTransferencias(list);
      } else {
        setTransferencias([]);
      }
    });

    const cargosRef = ref(db, 'cargos');
    const unsubCargos = onValue(cargosRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: any) => ({ id, nome: val.nome }));
        if (!list.some(c => c.nome === 'Dono')) {
          push(ref(db, 'cargos'), { nome: 'Dono' });
        }
        if (!list.some(c => c.nome === 'TI')) {
          push(ref(db, 'cargos'), { nome: 'TI' });
        }
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setCargos(list);
      } else {
        const defaultCargos = [
          { id: 'dono', nome: 'Dono' },
          { id: 'admin', nome: 'Administrador' },
          { id: 'gerente', nome: 'Gerente' },
          { id: 'cozinheiro', nome: 'Cozinheiro' },
          { id: 'atendente', nome: 'Atendente' }
        ];
        defaultCargos.sort((a, b) => a.nome.localeCompare(b.nome));
        setCargos(defaultCargos);
      }
    });

    return () => {
      unsubFunc();
      unsubTrans();
      unsubCargos();
    };
  }, []);

  const formatPhone = (val: string) => {
    let v = val.replace(/\D/g, '').substring(0, 10);
    if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
    return v;
  };

  const formatCpf = (v: string) => {
    if (!v) return '';
    let val = v.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    val = val.replace(/(\d{3})(\d)/, '$1.$2');
    val = val.replace(/(\d{3})(\d)/, '$1.$2');
    val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return val;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.pin.length !== 4 || !/^\d+$/.test(formData.pin)) {
      showToast('O PIN deve conter exatamente 4 números.', 'error');
      return;
    }
    if (formData.cargo.length === 0) {
      showToast('Selecione pelo menos um cargo.', 'error');
      return;
    }

    if (funcionarios.some(f => String(f.pin) === String(formData.pin) && f.id !== editId)) {
      showToast('Este PIN já está em uso por outro funcionário. Escolha outro.', 'error');
      return;
    }

    const cpfLimpo = formData.cpf.replace(/\D/g, '');
    if (cpfLimpo) {
      if (!validarCPF(cpfLimpo)) {
        showToast('O CPF digitado é inválido.', 'error');
        return;
      }
      const cpfDuplicado = funcionarios.find(f => (f as any).cpf === cpfLimpo && f.id !== editId);
      if (cpfDuplicado) {
        showToast('Este CPF já está sendo usado por outro funcionário.', 'error');
        return;
      }
    }

    const dataToSave = { ...formData, cpf: formData.cpf.replace(/\D/g, '') };

    if (editId) {
      await set(ref(db, `funcionarios/${editId}`), dataToSave);
      setEditId(null);
      showToast('Funcionário atualizado!', 'success');
    } else {
      await set(push(ref(db, 'funcionarios')), dataToSave);
      showToast('Funcionário cadastrado!', 'success');
    }
    setFormData({ nome: '', pin: '', cargo: ['Atendente'], ativo: true, telefone: '', cpf: '' });
  };

  const handleEdit = (f: Funcionario) => {
    setEditId(f.id);
    const cargosArr = Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente'];
    setFormData({ nome: f.nome, pin: f.pin, cargo: cargosArr, ativo: (f as any).ativo !== false, telefone: (f as any).telefone || '', cpf: formatCpf((f as any).cpf || '') });
  };

  const toggleAtivo = async (f: Funcionario) => {
    if (confirm(`Deseja ${(f as any).ativo === false ? 'ativar' : 'inativar'} o funcionário ${f.nome}?`)) {
      await set(ref(db, `funcionarios/${f.id}/ativo`), (f as any).ativo === false);
      showToast((f as any).ativo === false ? 'Funcionário ativado!' : 'Funcionário inativado!', 'success');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este funcionário? Recomenda-se apenas inativar.')) {
      await remove(ref(db, `funcionarios/${id}`));
      showToast('Funcionário excluído!', 'success');
    }
  };

  const getCargoColor = (cargo: string) => {
    const c = cargo.toLowerCase();
    if (c === 'dono') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (c === 'administrador') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (c === 'gerente') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (c.includes('entregador') || c.includes('motoboy')) return 'bg-green-100 text-green-700 border-green-200';
    if (c.includes('cozinheiro') || c.includes('chapa')) return 'bg-red-100 text-red-700 border-red-200';
    if (c.includes('kds')) return 'bg-teal-100 text-teal-700 border-teal-200';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  };

  const isAdminOrDono = currentUser && (
    Array.isArray(currentUser.cargo)
      ? currentUser.cargo.some((c: string) => c === 'Administrador' || c === 'Dono' || c === 'TI')
      : currentUser.cargo === 'Administrador' || currentUser.cargo === 'Dono' || currentUser.cargo === 'TI'
  );

  const closeFaceModal = () => {
    if (faceStreamRef.current) { faceStreamRef.current.getTracks().forEach(t => t.stop()); faceStreamRef.current = null; }
    setFaceModalFuncId(null);
    setFaceCapturing(false);
    setFaceCaptureStatus('');
  };

  const openFaceModal = async (funcId: string) => {
    setFaceModalFuncId(funcId);
    setFaceCaptureStatus('Iniciando câmera...');
    try {
      const stream = await getCameraStream();
      faceStreamRef.current = stream;
      setTimeout(() => {
        if (faceVideoRef.current) { faceVideoRef.current.srcObject = stream; faceVideoRef.current.play(); }
      }, 100);
      setFaceCaptureStatus('Posicione o rosto centralizado e clique em Capturar.');
    } catch (e) {
      setFaceCaptureStatus(getCameraErrorMsg(e));
    }
  };

  const captureFace = async () => {
    if (!faceVideoRef.current || !faceModalFuncId) return;
    setFaceCapturing(true);
    setFaceCaptureStatus('Carregando modelos de IA...');
    try {
      await ensureFaceModelsLoaded();
      setFaceCaptureStatus('Detectando rosto...');
      const detection = await faceapi
        .detectSingleFace(faceVideoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        setFaceCaptureStatus('Nenhum rosto detectado. Centralize o rosto e tente novamente.');
        setFaceCapturing(false);
        return;
      }
      await set(ref(db, `funcionarios/${faceModalFuncId}/faceDescriptor`), Array.from(detection.descriptor));
      setFaceCaptureStatus('✓ Rosto cadastrado com sucesso!');
      showToast('Rosto cadastrado!', 'success');
      setTimeout(() => closeFaceModal(), 1200);
    } catch {
      setFaceCaptureStatus('Erro ao processar. Verifique a conexão com a internet.');
      setFaceCapturing(false);
    }
  };

  const funcHistorico = transferencias.filter(t => t.funcionarioId === historicoFuncionarioId);
  const selectedFunc = funcionarios.find(f => f.id === historicoFuncionarioId);

  const solicitarVinculo = async (f: Funcionario | any) => {
    if (!f) return;
    if (isRequestingLink) return;
    
    if (!f.telefone) {
      showToast('O funcionário precisa ter um telefone cadastrado para receber a mensagem!', 'error');
      return;
    }
    
    setIsRequestingLink(true);
    let telLimpo = f.telefone.replace(/\D/g, '');
    if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
    
    const msg = `Olá *${f.nome.split(' ')[0]}*! 👋\n\nPara receber suas tarefas e rotas diretamente aqui no WhatsApp, precisamos vincular o seu número ao sistema da ArttBurger.\n\nPor favor, responda esta mensagem exatamente com o comando abaixo:\n\n*vincular ${f.pin}*`;
    
    try {
      await set(push(ref(db, 'fila_mensagens')), {
        telefone: telLimpo,
        mensagem: msg,
        status: 'pendente',
        timestamp: Date.now()
      });
      showToast('A solicitação está sendo enviada pelo robô!', 'success');
    } catch (err) {
      showToast('Erro ao enviar solicitação.', 'error');
    } finally {
      setIsRequestingLink(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
          <Users size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Gerenciar Equipe</h3>
          <p className="text-sm text-gray-500">Cadastre os funcionários e defina um PIN de 4 dígitos para cada um.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h4 className="font-bold text-gray-800 mb-4">{editId ? 'Editar Funcionário' : 'Novo Funcionário'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Nome</label>
                <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">CPF</label>
                <input type="text" value={formData.cpf} onChange={e => setFormData({...formData, cpf: formatCpf(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Cargos</label>
                <div className="flex flex-wrap gap-2 border border-gray-200 p-3 rounded-lg bg-white max-h-48 overflow-y-auto">
                  {cargos.map(c => {
                    const isSelected = formData.cargo.includes(c.nome);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (!isSelected) setFormData({...formData, cargo: [...formData.cargo, c.nome]});
                          else setFormData({...formData, cargo: formData.cargo.filter(cargo => cargo !== c.nome)});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors flex items-center ${
                          isSelected 
                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                      >
                        <span className="mr-1 text-lg leading-none font-black">{isSelected ? '-' : '+'}</span> {c.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Telefone / WhatsApp (DDD + 8 Dígitos, sem o 9 extra) {formData.cargo.some(c => c.toLowerCase().includes('entregador') || c.toLowerCase().includes('motoboy')) ? '(Obrigatório)' : '(Opcional)'}</label>
                <input type="text" maxLength={14} value={formData.telefone} onChange={e => setFormData({...formData, telefone: formatPhone(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="(00) 0000-0000" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">PIN (4 dígitos)</label>
                <input type="tel" autoComplete="off" maxLength={4} required value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg font-mono" placeholder="****" style={isAdminOrDono ? {} : { WebkitTextSecurity: 'disc' } as any} />
              </div>
              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                  <span className="text-sm font-bold text-gray-700">Funcionário Ativo no Sistema</span>
                </label>
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 my-4">
                  <div>
                      <h4 className="font-bold text-indigo-800 flex items-center">
                          <MessageSquare className="mr-2 text-indigo-600" size={18}/> Vínculo WhatsApp (Robô)
                      </h4>
                      <p className="text-xs text-indigo-600 mt-1">Status da comunicação deste funcionário com o robô.</p>
                  </div>
                  <div>
                      {editId && (funcionarios.find(f => f.id === editId) as any)?.whatsappId ? (
                          <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center shadow-sm">
                              <CheckCircle size={16} className="text-green-500 mr-2" />
                              <span className="text-xs font-mono text-gray-600">{(funcionarios.find(f => f.id === editId) as any)?.whatsappId}</span>
                          </div>
                      ) : (
                          editId ? (
                            <button type="button" disabled={isRequestingLink} onClick={() => solicitarVinculo(funcionarios.find(f => f.id === editId))} className="bg-white px-3 py-1.5 rounded-lg border border-orange-300 flex items-center shadow-md hover:bg-orange-50 transition-colors group cursor-pointer disabled:opacity-60">
                                <AlertTriangle size={16} className="text-orange-500 mr-2 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold text-orange-700">
                                  {isRequestingLink ? 'Enviando...' : 'Pendente (Solicitar via WhatsApp)'}
                                </span>
                            </button>
                          ) : (
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 flex items-center shadow-sm opacity-60 cursor-not-allowed" title="Salve o cadastro primeiro">
                                <AlertTriangle size={16} className="text-gray-400 mr-2" />
                                <span className="text-xs font-bold text-gray-500">Pendente (Salve primeiro)</span>
                            </div>
                          )
                      )}
                  </div>
              </div>

              <div className="flex space-x-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center">
                  <Save size={18} className="mr-2" /> Salvar
                </button>
                {editId && (
                  <button type="button" onClick={() => {setEditId(null); setFormData({nome:'', pin:'', cargo: ['Atendente'], ativo: true, telefone: '', cpf: ''});}} className="bg-gray-200 text-gray-700 p-2 rounded-lg font-bold hover:bg-gray-300">
                    <X size={20} />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h4 className="font-bold text-gray-800">Equipe</h4>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {funcionarios.map(f => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className={`font-bold ${(f as any).ativo === false ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{f.nome}</p>
                      {(f as any).ativo === false && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-100 text-red-600">Inativo</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(Array.isArray(f.cargo) ? f.cargo : [f.cargo || 'Atendente']).map(c => (
                        <span key={c} className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase border shadow-sm ${getCargoColor(c)}`}>{c}</span>
                      ))}
                    </div>
                    {(f as any).cpf && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">CPF: {formatCpf((f as any).cpf)}</p>
                    )}
                    <p className="text-xs text-gray-500 font-mono">PIN: {isAdminOrDono ? f.pin : '****'}</p>
                    {f.faceDescriptor && f.faceDescriptor.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full mt-1">
                        <ScanFace size={10} /> Rosto cadastrado
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => openFaceModal(f.id)} className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg" title="Cadastrar Rosto">
                      <Camera size={18} />
                    </button>
                    <button onClick={() => setHistoricoFuncionarioId(f.id)} className={`p-1.5 rounded-lg ${historicoFuncionarioId === f.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Ver Histórico">
                      <History size={18} />
                    </button>
                    <button onClick={() => toggleAtivo(f)} className={`p-1.5 rounded-lg ${(f as any).ativo === false ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`} title={(f as any).ativo === false ? 'Ativar Funcionário' : 'Inativar Funcionário'}>
                      {(f as any).ativo === false ? <UserCheck size={18} /> : <UserX size={18} />}
                    </button>
                    <button onClick={() => handleEdit(f)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Pencil size={18} /></button>
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {funcionarios.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Nenhum funcionário cadastrado.</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h4 className="font-bold text-gray-800">{selectedFunc ? `Histórico de Transferências: ${selectedFunc.nome}` : 'Selecione um funcionário para ver o histórico'}</h4>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {!selectedFunc ? (<div className="h-full flex items-center justify-center text-gray-400 flex-col"><History size={48} className="mb-4 opacity-20" /><p>Clique no ícone de histórico ao lado de um funcionário.</p></div>) : funcHistorico.length === 0 ? (<div className="h-full flex items-center justify-center text-gray-400"><p>Nenhuma transferência registrada para este funcionário.</p></div>) : (<div className="space-y-4">{funcHistorico.map(t => (<div key={t.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50"><div><p className="font-bold text-gray-800">{t.quantidade}x {t.nomeInsumo}</p><p className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleString('pt-BR')}</p></div><span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Transferência</span></div>))}</div>)}
            </div>
          </div>
        </div>
      </div>
      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span className="whitespace-pre-line">{toast.message}</span></div>)}

      {faceModalFuncId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ScanFace size={20} className="text-purple-500" />
                Cadastrar Rosto
              </h3>
              <button onClick={closeFaceModal} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              <span className="font-semibold text-gray-700">{funcionarios.find(f => f.id === faceModalFuncId)?.nome}</span>
            </p>
            <div className="relative rounded-xl overflow-hidden bg-gray-900 mb-4" style={{ aspectRatio: '4/3' }}>
              <video ref={faceVideoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
            {faceCaptureStatus && (
              <p className={`text-xs text-center mb-4 font-medium ${faceCaptureStatus.startsWith('✓') ? 'text-green-600' : 'text-gray-500'}`}>
                {faceCaptureStatus}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={closeFaceModal}
                className="flex-1 p-3 text-gray-600 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={captureFace}
                disabled={faceCapturing || !faceStreamRef.current}
                className="flex-1 p-3 text-white bg-purple-500 rounded-xl font-bold hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Camera size={16} />
                {faceCapturing ? 'Processando...' : 'Capturar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}