import { Rocket, Star, CheckCircle, Flame, Map } from 'lucide-react';

export default function AtualizacoesSistema() {
  const updates = [
    {
      versao: '1.1.5',
      data: 'Versão Atual',
      titulo: 'Integração PDV & Cozinha e Mapa de Mesas',
      descricao: 'Uma revolução na forma de atender seus clientes e produzir os lanches.',
      features: [
        'Novo Frente de Caixa (PDV) com Mapa de Mesas visuais.',
        'Comanda Virtual enviada automaticamente para o monitor da cozinha (KDS).',
        'Abatimento inteligente de estoque apenas quando a cozinha finaliza o pedido.',
        'Integração dos pedidos de Delivery com a tela de Despachos/Motoboys.'
      ],
      icon: <Flame className="text-orange-500" size={20} />
    },
    {
      versao: '1.1.4',
      data: 'Atualização Anterior',
      titulo: 'Logística & Gestão de Equipe com IA',
      descricao: 'Controle total das entregas e inteligência artificial para o RH.',
      features: [
        'Nova aba "Logística" separada para focar na operação de rua.',
        'Planejador de Rotas integrado com Google Maps (Ida e Volta).',
        'Botão para enviar a rota pelo WhatsApp diretamente ao motoboy.',
        'Assistente IA para gerenciar faltas, escalar funcionários e realocar posições.'
      ],
      icon: <Map className="text-indigo-500" size={20} />
    },
    {
      versao: '1.1.3',
      data: 'Base Sólida',
      titulo: 'Financeiro, Calendário & Permissões',
      descricao: 'Seu dinheiro e segurança controlados em um só lugar.',
      features: [
        'Criação do módulo "Calendário e Contas" exclusivo para o Dono.',
        'Sistema avançado de Permissões: limite o que a equipe pode ver ou apagar.',
        'Contas a pagar e receber com recursos de "Recorrência" inteligente.',
        'Diferenciação clara entre Administrador, Gerente, Cozinheiro, Entregador e Atendente.'
      ],
      icon: <Star className="text-yellow-500" size={20} />
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
          <Rocket size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Atualizações do Sistema</h3>
          <p className="text-sm text-gray-500">Acompanhe as últimas novidades, recursos e melhorias adicionadas ao ArttBurger.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {updates.map((update, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:border-blue-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3"><div className="p-2 bg-gray-50 rounded-lg">{update.icon}</div><div><span className="font-black text-gray-800 text-lg">Versão {update.versao}</span><p className="text-xs font-bold text-gray-400">{update.data}</p></div></div>
            </div>
            <h4 className="font-bold text-gray-700 mb-1">{update.titulo}</h4>
            <p className="text-sm text-gray-500 mb-4">{update.descricao}</p>
            <ul className="space-y-2">
              {update.features.map((feat, fidx) => (<li key={fidx} className="text-sm text-gray-600 flex items-start"><CheckCircle size={16} className="text-green-500 mr-2 shrink-0 mt-0.5" /><span>{feat}</span></li>))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}