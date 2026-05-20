import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { Rocket, Star, CheckCircle, Flame, Map, Zap, TrendingUp, Package, Calculator, Users, Shield, Smartphone, Save, AlertTriangle, Navigation, Printer } from 'lucide-react';
import { APP_VERSION } from '../App';

export default function AtualizacoesSistema({ temPermissao }: { temPermissao?: any }) {
  const [appUpdate, setAppUpdate] = useState({ versao: APP_VERSION, linkDownload: '', forcar: false, mensagem: '' });
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const canEdit = temPermissao ? temPermissao('atualizacoes_sistema', 'aba_configuracoes', 'editar') : true;

  useEffect(() => {
    const updateRef = ref(db, 'configuracoes/app_update');
    return onValue(updateRef, snap => {
      if (snap.val()) setAppUpdate(snap.val());
    });
  }, []);

  const handleSaveUpdate = async () => {
    try {
      await update(ref(db, 'configuracoes/app_update'), appUpdate);
      setToast({ message: 'Alerta de atualização configurado com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ message: 'Erro ao salvar configurações.', type: 'error' });
    }
  };

  const updates = [
    {
      versao: '1.2.6',
      titulo: 'DRE, Escala de Turnos, Fidelidade, Alertas e Planilhas Avançadas',
      descricao: 'Lançamento de novos módulos estratégicos de gestão, nova central de notificações em tempo real e reformulação visual de todas as exportações.',
      features: [
        'Balanço com Histórico: Após salvar o balanço, visualize um resumo completo em modal. O sistema agora salva o histórico de todos os balanços, acessíveis pelo botão "Histórico".',
        'Exportações Excel Premium: Planilhas remodeladas e mais profissionais. Cabeçalho laranja "ArttBurger", resumo geral na linha 3, linhas alternadas em branco/cinza, fundo verde/vermelho para ganhos e perdas e cabeçalhos fixados (freeze pane).',
        'DRE (Demonstrativo de Resultados): Nova aba mostrando Receita Bruta, CMV, Lucro Bruto, Despesas Operacionais, EBITDA e Lucro Líquido (com margem %). Possui filtros de período (mês, semestre, ano), gráfico de evolução e exportação.',
        'Programa de Fidelidade: Configure pontos por R$ gasto, pontos mínimos para resgate e recompensas personalizadas. Ranking de clientes, histórico de movimentações, resgate e ajustes manuais diretamente pela aba.',
        'Escala de Turnos: Tabela semanal com todos os funcionários. Clique nas células para turnos pré-definidos (Manhã, Tarde, Noite, Integral, Folga) ou horário manual. Calcula horas, permite copiar semanas e exportar CSV.',
        'Alertas em Tempo Real: Sino 🔔 no header com badge numérico (vermelho pulsante para urgentes). Monitora estoque abaixo do mínimo, validades próximas/vencidas e contas a pagar vencendo em até 3 dias.'
      ],
      icon: <Star className="text-emerald-500" size={20} />
    },
    {
      versao: '1.2.5',
      titulo: 'Impressão por Impressoras e Software .exe',
      descricao: 'Roteamento automático de impressão por categoria de produto, geração de executável Windows (.exe) com Electron, e sistema de licença com controle remoto de acesso.',
      features: [
        'Roteamento de Impressoras: Configure qual categoria de produto (Hambúrgueres, Bebidas, etc.) vai para a Cozinha ou para o Balcão. Ao confirmar um pedido, o sistema imprime automaticamente os tickets separados em cada impressora.',
        'Impressão Silenciosa no .exe: No software Windows, a impressão ocorre diretamente na impressora configurada, sem abrir nenhuma janela de diálogo.',
        'Software Windows (.exe): O sistema agora pode ser instalado como aplicativo desktop via Electron, com ícone da ArttBurger na barra de tarefas.',
        'Permissões de Impressoras: A aba de roteamento de impressoras agora aparece nas permissões de acesso por cargo.',
      ],
      icon: <Printer className="text-blue-500" size={20} />
    },
    {
      versao: '1.2.4',
      titulo: 'Correção do Mapa na Tela do Entregador',
      descricao: 'Correção de bug visual no mapa da tela "Minhas Entregas" que exibia apenas metade do mapa ao ser aberto.',
      features: [
        'Mapa Completo: O mapa da rota agora renderiza corretamente em tela cheia ao ser expandido, sem cortar metade da visualização.',
      ],
      icon: <Map className="text-indigo-500" size={20} />
    },
    {
      versao: '1.2.3',
      titulo: 'Suporte a Instalação no iOS (PWA) e Otimizações Internas',
      descricao: 'O sistema agora é um Progressive Web App (PWA), permitindo a instalação direto pelo navegador para todos os dispositivos, resolvendo definitivamente o acesso nos iPhones.',
      features: [
        'Instalação no iPhone: Usuários de iOS agora podem abrir o link do sistema no Safari, clicar em "Compartilhar" e escolher "Adicionar à Tela de Início". O sistema roda em tela cheia como um aplicativo nativo.',
        'Instalação Universal: O sistema agora pode ser "baixado" no Computador, Tablets e Android diretamente pela barra de endereços do Google Chrome/Edge.',
        'Otimização no Android (R8): Atualizamos as regras do ProGuard/R8 no Android Studio para gerar um aplicativo (.apk) mais leve e com melhor performance.',
        'Configurações PWA: Adicionado manifesto web e recursos modernos de cache nativo via Vite PWA.'
      ],
      icon: <Smartphone className="text-purple-500" size={20} />
    },
    {
      versao: '1.2.2',
      titulo: 'GPS de Precisão, Ponto Eletrônico e Banco de Horas',
      descricao: 'Entregadores rastreados em segundo plano, localização exata dos clientes no mapa, registro de ponto com verificação GPS e banco de horas completo para a equipe.',
      features: [
        'Coordenadas de Clientes: Ao cadastrar um cliente, o sistema busca automaticamente as coordenadas (latitude/longitude) pelo endereço usando uma cascata de 7 tentativas — incluindo CEP, rua sem número e bairro. O pin no mapa do entregador aponta para o local exato da casa.',
        'Mapa no App do Entregador: A tela "Minhas Entregas" agora tem um mapa em tempo real mostrando a posição do entregador (ícone de moto) e as casas dos clientes (pins coloridos). Localização aproximada exibe pin amarelo com aviso.',
        'GPS em Segundo Plano (Android): O rastreamento do entregador continua ativo mesmo com o app minimizado ou tela apagada, via serviço foreground com notificação persistente.',
        'Links de Rota por Coordenadas: O botão "Abrir Rota no GPS" e a mensagem WhatsApp enviada ao motoboy usam coordenadas exatas (lat/lng) em vez de texto de endereço, eliminando erros de localização.',
        'KDS Limpa ao Fechar Mesa: Ao retirar ou pagar um pedido de mesa, todos os itens pendentes na fila do KDS são cancelados automaticamente e somem dos monitores da cozinha imediatamente.',
        'Registro de Ponto com GPS: Nova tela "Registro de Ponto" acessível a todos os funcionários após o login. O botão "Bater Ponto" só fica verde quando o funcionário está a menos de 20 metros do estabelecimento. Registra 4 etapas: Chegada, Saída Almoço, Volta Almoço e Saída.',
        'Banco de Horas: Na aba Atribuições de cada funcionário, o gerente vê o banco de horas com horas trabalhadas, esperadas e saldo (+extras / -devendo) por período (semana, mês, mês anterior). Cada batida exibe um link "ver local" que abre o Google Maps no ponto exato onde o funcionário estava.',
        'Plataforma iOS: Projeto Capacitor configurado para iOS com permissões de localização em segundo plano. (Build requer Mac com Xcode.)',
      ],
      icon: <Navigation className="text-blue-500" size={20} />
    },
    {
      versao: '1.2.1',
      titulo: 'Gestão de Tags Avançada e Otimizações de Permissões',
      descricao: 'Novos controles rigorosos na visualização de botões, melhorias no PDV e gestão inteligente no estoque de adicionais.',
      features: [
        'Permissões Visuais Rigorosas: Botões de edição, exclusão e criação desaparecem da interface se o usuário não possuir a autorização prévia.',
        'Gerenciador de Tags Exclusivo: O controle de categorias de clientes agora exige permissão de administrador na aba de Logística.',
        'Restrições Manuais Livres: Crie restrições (ex: sem cebola) sem dar baixa no estoque, mantendo a flexibilidade.',
        'Adicionais Precisos no PDV: Informe a porção exata gasta de cada adicional (ex: 0.040kg de Bacon) para uma baixa perfeita no estoque.',
        'Cadastro Rápido e CNPJ: O sistema agora abre modais sobrepostos em compras e despesas para cadastro ágil de fornecedores com preenchimento via CNPJ.',
        'Cortesia e Descontos Totais: O caixa finaliza transações zeradas (R$ 0,00) de forma inteligente como cortesia, evitando erros de taxa.'
      ],
      icon: <Shield className="text-emerald-500" size={20} />
    },
    {
      versao: '1.2.0',
      titulo: 'Gestão de Entregas Turbinada, GPS Inteligente e Permissões Avançadas',
      descricao: 'O módulo de delivery ganhou aplicativo próprio, a comunicação pelo WhatsApp foi automatizada e a segurança de acessos foi completamente reestruturada.',
      features: [
        'App do Entregador: Tela "Minhas Entregas" exclusiva para motoboys darem baixa, reportarem problemas (WhatsApp avisa o cliente) e deixarem observações sobre a residência.',
        'Integração Maps Inteligente: Cadastre links curtos do Google Maps no perfil do cliente. O botão "Navegar" do motoboy abrirá o pino exato sem margem para erro.',
        'Comunicação Automatizada: O robô agora agradece e pede feedback pós-entrega, além de avisar o próximo cliente da rota que a moto está chegando.',
        'Matriz de Permissões Global: Bloqueio total visual e estrutural por abas, ocultação de funções críticas para gerentes e hierarquia estrita para Dono/TI.',
        'CRM e Marketing: Categorize clientes em massa através de Tags, visualize os produtos favoritos no novo Card de Perfil e dispare mensagens filtradas por categoria.',
        'Numeração Diária: Pedidos de balcão e delivery agora recebem um número sequencial (Ex: #1, #2...) reiniciado diariamente.'
      ],
      icon: <Shield className="text-red-500" size={20} />
    },
    {
      versao: '1.1.13',
      titulo: 'KDS Personalizado, Gestão de RH e Kanban de Tarefas',
      descricao: 'Controle total da sua equipe com registro de ponto, organização visual de tarefas e KDS que salva suas preferências.',
      features: [
        'KDS na Nuvem: As preferências de praças e filtros agora são vinculadas ao usuário (Conta). As configurações acompanham o usuário!',
        'Layout da Cozinha Otimizado: Nova exibição de comandas em formato "Grid / Colunas" otimizado para não perder espaço na tela.',
        'Quadro Kanban: Suas Tarefas agora estão divididas visualmente em colunas automáticas (Atrasadas, Hoje, Próximas e Concluídas).',
        'Segurança e CPF Obrigatório: O sistema passa a exigir CPF no cadastro para proteger e vincular o histórico do colaborador mesmo se for desligado.',
        'Controle de Ponto e Folgas: Registre horários de entrada/saída, férias e atestados diretamente no perfil de cada membro da equipe.'
      ],
      icon: <Users className="text-blue-500" size={20} />
    },
    {
      versao: '1.1.12',
      titulo: 'Tabelas Interativas, Calculadora Flutuante e Privacidade de Estoque',
      descricao: 'Melhorias massivas na experiência de uso: ordenação em tabelas, cálculos rápidos sem sair da tela e maior controle sobre o que a equipe acessa.',
      features: [
        'Calculadora Inteligente: Ferramenta flutuante com suporte ao teclado numérico para conferências rápidas no Balanço e no Financeiro.',
        'Ordenação Dinâmica: Clique nos cabeçalhos das tabelas (Nome, Custo, Rotativo, Vencimento) para classificar os dados em ordem crescente ou decrescente.',
        'Visibilidade de Insumos: Gestores agora podem ocultar itens específicos, limpando a visão dos funcionários nas Transferências e no Dashboard.',
        'Fornecedores por CNPJ: Preenchimento automático de dados e busca com dropdown inteligente na tela de Compras e Contas a Pagar.',
        'Insumo Variável e Refatoração: Novo controle de substituição de estoque diário e separação do sistema em modais independentes para maior agilidade.'
      ],
      icon: <Calculator className="text-emerald-500" size={20} />
    },
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
      {canEdit && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 space-y-4">
          <div className="flex items-center mb-2">
            <Smartphone className="text-indigo-600 mr-2" size={24}/>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Forçar Atualização do App / Sistema</h3>
              <p className="text-sm text-gray-500">Se a versão informada abaixo for maior que a do celular do funcionário, ele verá um aviso de atualização.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Versão Atual</label>
              <input type="text" value={appUpdate.versao} onChange={e => setAppUpdate({...appUpdate, versao: e.target.value})} placeholder={`Ex: ${APP_VERSION}`} className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold" />
            </div>
            <div className="lg:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Link p/ Baixar (Drive, Firebase, etc)</label>
              <input type="text" value={appUpdate.linkDownload} onChange={e => setAppUpdate({...appUpdate, linkDownload: e.target.value})} placeholder="https://meu-link-do-apk..." className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 cursor-pointer bg-red-50 p-2.5 rounded-lg border border-red-100 w-full">
                <input type="checkbox" checked={appUpdate.forcar} onChange={e => setAppUpdate({...appUpdate, forcar: e.target.checked})} className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer" />
                <span className="text-sm font-bold text-red-700">Obrigatório (Trava Tela)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Mensagem sobre a atualização (Opcional)</label>
            <input type="text" value={appUpdate.mensagem} onChange={e => setAppUpdate({...appUpdate, mensagem: e.target.value})} placeholder="Ex: Correção no GPS dos motoboys adicionada!" className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div className="flex justify-end pt-3 border-t border-gray-100 mt-4">
            <button onClick={handleSaveUpdate} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center">
              <Save size={18} className="mr-2"/> Ativar Alerta de Versão
            </button>
          </div>
        </div>
      )}

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

      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-bold flex items-center z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="mr-2" size={20} /> : <AlertTriangle className="mr-2" size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}