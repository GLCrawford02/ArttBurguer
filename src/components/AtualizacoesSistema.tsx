import { Rocket, Star, CheckCircle, Flame, Map, Zap, TrendingUp, Package } from 'lucide-react';

export default function AtualizacoesSistema() {
  const updates = [
    {
      versao: '1.1.11',
      titulo: 'Quebra de Estoque, Buscas Inteligentes e Opções por Produto',
      descricao: 'Otimizamos o fluxo de caixas para unidades, introduzimos barras de pesquisa em todas as telas e individualizamos os adicionais no PDV.',
      features: [
        'Quebra Automática na Compra: Compre a caixa fechada (ex: Caixa 36un) e o sistema converte e deposita direto no estoque do insumo unitário base.',
        'Transferências Facilitadas: Digite quantos "Volumes" quer mandar para a cozinha e o sistema fraciona automaticamente para o rotativo.',
        'Busca Inteligente (Dropdowns): Várias telas (Ficha Técnica, Contas a Pagar, Tarefas) agora possuem campo de digitar para buscar e filtrar as opções.',
        'Opções de PDV (Adicionais): Agora os adicionais, pontos da carne e tipos de montagem são salvos individualmente dentro de cada produto.',
        'Organização Geral: Todas as categorias e tipos de uso organizados em ordem alfabética. SKUs encurtados, exatos e atualizados em tempo real.'
      ],
      icon: <Package className="text-indigo-500" size={20} />
    },
    {
      versao: '1.1.10',
      titulo: 'Otimização Extrema, Simulador Turbinado e KDS Inteligente',
      descricao: 'Reduzimos o consumo de dados a quase zero, criamos filtros incríveis para a cozinha e detalhamos o lucro real no caixa.',
      features: [
        'Sincronização Delta (Robô): O bot do WhatsApp agora usa cache em tempo real, eliminando downloads redundantes e economizando gigabytes no Firebase.',
        'Simulador de Conferência Melhorado: Adicione títulos customizados (Ex: Mesa 1 - 19:00) e edite as simulações já salvas.',
        'Cálculo de Lucro Líquido Real: O PDV/Caixa agora desconta os custos de produção da ficha técnica para exibir seu lucro exato livre de taxas.',
        'KDS com Filtros Dinâmicos: As telas da cozinha ganharam um menu suspenso de categorias, permitindo à equipe escolher o que ver de forma customizada.',
        'Organização de Tarefas: O Calendário Financeiro ganhou um atalho unificado e agora exibe suas Tarefas programadas ao lado das contas.'
      ],
      icon: <Rocket className="text-purple-500" size={20} />
    },
    {
      versao: '1.1.9',
      titulo: 'Dashboard Integrado, Modais Rápidos e Gráficos Financeiros',
      descricao: 'O módulo financeiro agora está interligado ao PDV, possui gráficos de gastos e é incrivelmente ágil com os novos modais.',
      features: [
        'Integração Automática PDV x Financeiro: As vendas realizadas e finalizadas no Caixa/PDV agora somam automaticamente na sua Receita Total.',
        'Interface Rápida (Modais): Lançar contas a pagar/receber e agendamentos agora acontece em pop-ups sobrepostos, sem que você perca a visão do calendário.',
        'Novo Gráfico de Despesas: Avalie a saúde do seu negócio visualizando exatamente a porcentagem de gasto direcionada para cada categoria de despesa.',
        'Cálculo Inteligente de Parcelas: Na hora de comprar parcelado, você pode escolher informar o "Valor Total da Compra" ou o "Valor Direto da Parcela".'
      ],
      icon: <TrendingUp className="text-green-500" size={20} />
    },
    {
      versao: '1.1.8',
      titulo: 'Escala Fluida, Nova Tela de Compras e Robô Silencioso',
      descricao: 'Layout 100% adaptável, entrada profissional de mercadorias e envio de mensagens em segundo plano.',
      features: [
        'Escala Fluida: O sistema usa Matemática CSS para ajustar e adaptar perfeitamente a todos os monitores, grandes ou pequenos.',
        'Nova Entrada de Mercadorias: Modelo de carrinho de compras (nota fiscal) para buscar e finalizar múltiplos itens de uma vez.',
        'Robô Integrado e Silencioso: Envio automático da lista de compras e de rotas de motoboy sem precisar abrir abas do WhatsApp Web.',
        'Estoque Inteligente: O painel de Alertas agora soma o Almoxarifado com a Cozinha (Estoque Total) antes de pedir reposição.'
      ],
      icon: <Zap className="text-blue-500" size={20} />
    },
    {
      versao: '1.1.7',
      titulo: 'Categorias Dinâmicas e IA para Produtos',
      descricao: 'Mais flexibilidade no cadastro de produtos e um assistente inteligente para agilizar seu trabalho.',
      features: [
        'Categorias de produtos agora são totalmente personalizáveis (adicionar, editar, excluir).',
        'Assistente de IA para cadastro de produtos: descreva o produto e a IA preenche os detalhes.',
        'Melhorias na interface de usuário para gerenciamento de categorias e tipos de insumos.',
        'Otimização de performance no carregamento de listas de produtos e insumos.'
      ],
      icon: <Star className="text-yellow-500" size={20} />
    },
    {
      versao: '1.1.6',
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
      versao: '1.1.5',
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
      versao: '1.1.4',
      titulo: 'Financeiro, Calendário & Permissões',
      descricao: 'Seu dinheiro e segurança controlados em um só lugar.',
      features: [
        'Criação do módulo "Calendário e Contas" exclusivo para o Dono.',
        'Sistema avançado de Permissões: limite o que a equipe pode ver ou apagar.',
        'Contas a pagar e receber com recursos de "Recorrência" inteligente.',
        'Diferenciação clara entre Administrador, Gerente, Cozinheiro, Entregador e Atendente.'
      ],
      icon: <Flame className="text-orange-500" size={20} />
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
              <div className="flex items-center space-x-3"><div className="p-2 bg-gray-50 rounded-lg">{update.icon}</div><div><span className="font-black text-gray-800 text-lg">Versão {update.versao}</span></div></div>
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