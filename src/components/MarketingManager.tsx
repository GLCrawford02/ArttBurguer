import { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Megaphone, Search, CheckCircle, AlertTriangle, Send, CheckSquare, Square, Info, Bot } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  pedidosCount?: number;
}

export default function MarketingManager() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const clientesRef = ref(db, 'clientes');
    const unsub = onValue(clientesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          nome: val.nome || 'Sem Nome',
          telefone: val.telefone || '',
          pedidosCount: val.pedidosCount || 0,
        }));
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        setClientes(list);
      } else {
        setClientes([]);
      }
    });

    return () => unsub();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.telefone.includes(searchTerm)
  );

  const toggleSelectAll = () => {
    if (selecionados.size === filteredClientes.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filteredClientes.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSel = new Set(selecionados);
    if (newSel.has(id)) {
      newSel.delete(id);
    } else {
      newSel.add(id);
    }
    setSelecionados(newSel);
  };

  const handleEnviarCampanha = async () => {
    if (selecionados.size === 0) {
      showToast('Selecione pelo menos um cliente para enviar a campanha.', 'error');
      return;
    }
    if (!mensagem.trim()) {
      showToast('A mensagem da campanha não pode estar vazia.', 'error');
      return;
    }

    setEnviando(true);
    let enviados = 0;
    
    try {
      const promessas = Array.from(selecionados).map(async (id) => {
        const cliente = clientes.find(c => c.id === id);
        if (!cliente || !cliente.telefone) return;

        let telLimpo = cliente.telefone.replace(/\D/g, '');
        if (telLimpo.length < 10) return; // Ignora se o telefone for inválido

        // Coloca o prefixo do Brasil se faltar
        if (!telLimpo.startsWith('55')) {
          telLimpo = '55' + telLimpo;
        }

        // Substitui a tag {nome} pelo primeiro nome do cliente para personalização
        const primeiroNome = cliente.nome.split(' ')[0] || '';
        const msgPersonalizada = mensagem.replace(/\{nome\}/gi, primeiroNome);

        // Envia para a fila do WhatsApp (Robô processa a cada 5 segundos automaticamente)
        await set(push(ref(db, 'fila_mensagens')), {
          telefone: telLimpo,
          mensagem: msgPersonalizada,
          status: 'pendente',
          timestamp: Date.now(),
          origem: 'marketing'
        });
        
        enviados++;
      });

      await Promise.all(promessas);

      showToast(`Campanha enviada para a fila! ${enviados} mensagens serão disparadas pelo robô gradativamente.`, 'success');
      setMensagem('');
      setSelecionados(new Set());
    } catch (error) {
      showToast('Erro ao agendar campanha. Tente novamente.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
      
      {/* Editor da Campanha */}
      <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-6 h-fit">
        <h3 className="text-xl font-bold text-gray-800 flex items-center">
          <Megaphone className="mr-2 text-purple-600" size={24} />
          Nova Campanha
        </h3>
        
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex flex-col space-y-3">
          <div className="flex items-start">
            <Info size={18} className="text-purple-600 mr-2 mt-0.5 shrink-0" />
            <p className="text-sm text-purple-800 leading-relaxed font-medium">
              As mensagens enviadas aqui serão enviadas individualmente pelo WhatsApp da loja. Use a tag <span className="font-bold text-purple-900 bg-purple-200 px-1.5 py-0.5 rounded">{"{nome}"}</span> para que o sistema troque automaticamente pelo nome de cada cliente!
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Texto da Mensagem</label>
          <textarea 
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Olá {nome}! Temos uma promoção especial para você hoje: Na compra de um hambúrguer, o refri é por nossa conta. Aproveite e peça agora pelo link abaixo!"
            className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm min-h-[220px] resize-y bg-gray-50"
          />
        </div>

        <button 
          onClick={handleEnviarCampanha} 
          disabled={enviando || selecionados.size === 0 || !mensagem.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-xl font-black text-lg transition-colors shadow-md flex items-center justify-center disabled:opacity-50 disabled:hover:bg-purple-600"
        >
          {enviando ? 'Processando Fila...' : `Disparar para ${selecionados.size} cliente${selecionados.size !== 1 ? 's' : ''}`}
          {!enviando && <Send size={20} className="ml-2" />}
        </button>
      </div>

      {/* Seleção do Público Alvo */}
      <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b border-gray-100 pb-3">
          <Bot className="mr-2 text-gray-500" size={20} />
          Público Alvo
        </h4>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou número..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-gray-50" 
          />
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-gray-500 uppercase">{filteredClientes.length} Contatos</span>
          <button onClick={toggleSelectAll} className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center transition-colors">
            {selecionados.size === filteredClientes.length && filteredClientes.length > 0 ? <><CheckSquare size={14} className="mr-1"/> Desmarcar Todos</> : <><Square size={14} className="mr-1"/> Marcar Todos</>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {filteredClientes.map(cliente => (
            <label key={cliente.id} className={`p-3 flex items-center cursor-pointer transition-colors hover:bg-gray-50 ${selecionados.has(cliente.id) ? 'bg-purple-50/50' : ''}`}>
              <input 
                type="checkbox" 
                checked={selecionados.has(cliente.id)}
                onChange={() => toggleSelect(cliente.id)}
                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 mr-3 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{cliente.nome}</p>
                <p className="text-xs text-gray-500">{cliente.telefone}</p>
              </div>
            </label>
          ))}
          {filteredClientes.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhum cliente encontrado.</p>}
        </div>
      </div>

      {toast && (<div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}<span>{toast.message}</span></div>)}
    </div>
  );
}