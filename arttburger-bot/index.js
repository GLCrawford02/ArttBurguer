const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// Chave da API da IA (Grok) que usamos no sistema web
const GROK_KEY = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

console.log('Iniciandoo robô...');

// 2. Inicializar o Cliente do WhatsApp
const client = new Client({
    // LocalAuth salva a sua sessão. Você só escaneia o QR Code na primeira vez!
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('🤖 Escaneie o QR Code acima com o WhatsApp da Arttburger.');
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando o WhatsApp: ${percent}% - ${message}`);
});

client.on('ready', () => {
    console.log('✅ Bot do WhatsApp conectado e pronto para enviar mensagens!');
    iniciarChecagemTarefas();
});

client.on('disconnected', async (reason) => {
    console.log(`❌ O bot do WhatsApp foi desconectado! Motivo: ${reason}`);
    console.log('🔄 Tentando reconectar automaticamente...');
    try {
        // Destrói a instância travada antes de reiniciar
        await client.destroy();
    } catch (err) {
        // Ignora erros se já estiver destruído
    }
    // Reinicia o ciclo (vai chamar 'qr' ou 'ready' de novo)
    client.initialize();
});

// 4. Escutar Mensagens Recebidas
client.on('message', async (msg) => {
    // Imprime no console do bot a mensagem e o número de quem enviou
    console.log(`📩 Mensagem recebida de ${msg.from}: ${msg.body}`);
    
    // Remove acentos e converte para minúsculas (Ex: "Concluído" -> "concluido")
    const textoLimpo = msg.body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const codigoMatch = textoLimpo.match(/#?(\d{4})/);
    const codigoInformado = codigoMatch ? codigoMatch[1] : null;
    const temPalavraConclusao = /(conclui|ok|pronto|feit)/.test(textoLimpo);

    // Verifica se é um comando válido do bot antes de consultar o banco
    const isComando = textoLimpo === 'ping' || 
                      textoLimpo === 'concluido' || textoLimpo === 'concluida' || textoLimpo === 'ok' || 
                      (codigoInformado && temPalavraConclusao) ||
                      textoLimpo.startsWith('assistente ');

    if (!isComando) return; // Ignora mensagens comuns (ex: clientes fazendo pedidos)

    // 1. Autenticação Global: Encontrar o funcionário dono deste número de telefone
    const numeroRemetente = msg.from.replace('@c.us', '');
    const funcSnap = await db.ref('funcionarios').once('value');
    const funcionarios = funcSnap.val() || {};
    let funcionarioId = null;
    let funcionarioNome = '';
    let funcionarioCargo = 'Funcionário';

    for (const [id, func] of Object.entries(funcionarios)) {
        if (func.telefone) {
            let telLimpo = func.telefone.replace(/\D/g, '');
            if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
            
            // Verifica se o número bate (Lida com o problema do 9º dígito)
            if (telLimpo === numeroRemetente || 
               (telLimpo.length === 13 && telLimpo.substring(0,4) + telLimpo.substring(5) === numeroRemetente) ||
               (numeroRemetente.length === 13 && numeroRemetente.substring(0,4) + numeroRemetente.substring(5) === telLimpo)) {
                funcionarioId = id;
                funcionarioNome = func.nome;
                funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                break;
            }
        }
    }

    if (!funcionarioId) {
        console.log(`🚫 Mensagem ignorada: O número ${numeroRemetente} tentou usar o bot, mas não é um funcionário cadastrado.`);
        return;
    }

    if (textoLimpo === 'ping') {
        await msg.reply(`pong! 🍔 Olá ${funcionarioNome.split(' ')[0]}, o bot do ArttBurger está te escutando!`);
        return;
    }

    if (textoLimpo === 'concluido' || textoLimpo === 'concluida' || textoLimpo === 'ok' || (codigoInformado && temPalavraConclusao)) {
        try {
            const tarefasSnap = await db.ref('tarefas').once('value');
            const tarefas = tarefasSnap.val() || {};
            let tarefaParaBaixar = null;
            let idDaTarefa = null;

            for (const [id, tar] of Object.entries(tarefas)) {
                if (tar.status === 'pendente') {
                    const responsaveis = tar.responsaveisIds || (tar.responsavelId ? [tar.responsavelId] : []);
                    if (responsaveis.includes(funcionarioId)) {
                        if (codigoInformado) {
                            if (tar.codigo === codigoInformado) {
                                tarefaParaBaixar = tar;
                                idDaTarefa = id;
                                break;
                            }
                        } else {
                            tarefaParaBaixar = tar;
                            idDaTarefa = id;
                            break; 
                        }
                    }
                }
            }

            if (tarefaParaBaixar) {
                await db.ref(`tarefas/${idDaTarefa}`).update({ status: 'concluida' });
                await msg.reply(`✅ Excelente, ${funcionarioNome.split(' ')[0]}!\nA tarefa *"${tarefaParaBaixar.titulo}"* foi marcada como concluída!`);

                if (tarefaParaBaixar.recorrencia && tarefaParaBaixar.recorrencia !== 'Nenhuma') {
                    const d = new Date(`${tarefaParaBaixar.dataAgendada}T12:00:00`);
                    if (tarefaParaBaixar.recorrencia === 'Diária') d.setDate(d.getDate() + 1);
                    else if (tarefaParaBaixar.recorrencia === 'Semanal') d.setDate(d.getDate() + 7);
                    else if (tarefaParaBaixar.recorrencia === 'Quinzenal') d.setDate(d.getDate() + 14);
                    else if (tarefaParaBaixar.recorrencia === 'Mensal') d.setMonth(d.getMonth() + 1);
                    else if (tarefaParaBaixar.recorrencia === 'Anual') d.setFullYear(d.getFullYear() + 1);
                    else if (tarefaParaBaixar.recorrencia === 'Personalizado') {
                        const v = tarefaParaBaixar.recorrenciaCustomValor || 1;
                        const u = tarefaParaBaixar.recorrenciaCustomUnidade || 'dia';
                        if (u === 'dia') d.setDate(d.getDate() + v);
                        else if (u === 'semana') d.setDate(d.getDate() + (v * 7));
                        else if (u === 'mes') d.setMonth(d.getMonth() + v);
                        else if (u === 'ano') d.setFullYear(d.getFullYear() + v);
                    }
                    const nextDateStr = d.toISOString().split('T')[0];
                    
                    let recreate = true;
                    if (tarefaParaBaixar.terminarRepeticao === 'em_data' && tarefaParaBaixar.dataFimRepeticao) {
                        if (nextDateStr > tarefaParaBaixar.dataFimRepeticao) recreate = false;
                    }

                    if (recreate) {
                        const novaTarefa = { ...tarefaParaBaixar, status: 'pendente', dataAgendada: nextDateStr, notificadoWhatsApp: false, timestamp: Date.now() };
                        novaTarefa.codigo = Math.floor(1000 + Math.random() * 9000).toString();
                        await db.ref('tarefas').push(novaTarefa);
                    }
                }
            } else if (codigoInformado) {
                await msg.reply(`⚠️ ${funcionarioNome.split(' ')[0]}, não encontrei nenhuma tarefa pendente sua com o código *#${codigoInformado}*. Verifique o código e tente novamente.`);
            } else {
                await msg.reply(`Tudo limpo, ${funcionarioNome.split(' ')[0]}! Você não tem nenhuma tarefa pendente no momento. 🍔`);
            }
        } catch (error) {
            console.error('❌ Erro ao processar baixa via WhatsApp:', error);
            await msg.reply('Ocorreu um erro interno no sistema ao tentar baixar a tarefa.');
        }
    } 
    // Lógica para Assistente IA (Ativado quando a mensagem começa com "assistente")
    else if (textoLimpo.startsWith('assistente ')) {
        try {
            // Extrai apenas a pergunta feita após a palavra "assistente"
            const pergunta = msg.body.substring(11).trim();
            await msg.reply('🧠 *Assistente IA:* Estou pensando, só um instante...');

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROK_KEY}` },
                body: JSON.stringify({
                    model: 'grok-3-mini',
                    messages: [
                        { role: 'system', content: `Você é o Assistente Virtual Oficial da hamburgueria ArttBurger, atendendo via WhatsApp. Você está conversando com ${funcionarioNome}, cujo cargo é ${funcionarioCargo}. Seja prestativo, educado, curto e direto nas respostas. Se for um pedido de RH/DP (como atestado ou falta), oriente-o a avisar o gerente, mas diga que você registrou a intenção.` },
                        { role: 'user', content: pergunta }
                    ]
                })
            });

            const data = await response.json();
            const respostaIA = data.choices?.[0]?.message?.content || 'Desculpe, tive um problema de conexão com meus servidores cerebrais.';
            await msg.reply(`🤖 *Assistente ArttBurger:*\n\n${respostaIA}`);
        } catch (error) {
            console.error('❌ Erro na IA:', error);
            await msg.reply('Desculpe, meu sistema de inteligência artificial está temporariamente indisponível.');
        }
    }
});

client.initialize();

// 5. Lógica de Checagem Automática (Roda a cada 5 segundos)
function iniciarChecagemTarefas() {
    console.log('⏳ Iniciando monitoramento de tarefas...');
    
    let rastreadorDePendentes = -1;
    
    // 5000 milissegundos = 5 segundos
    setInterval(async () => {
        try {
            // Força o fuso horário de Brasília para evitar bugs de UTC no servidor/Node
            const dataSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
            const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
            const horaAtualStr = String(dataSP.getHours()).padStart(2, '0') + ':' + String(dataSP.getMinutes()).padStart(2, '0');

            // Busca as tarefas e funcionários do banco
            const tarefasSnap = await db.ref('tarefas').once('value');
            const tarefas = tarefasSnap.val() || {}; // <-- CORREÇÃO: Força a leitura mesmo se o banco estiver vazio

            const funcionariosSnap = await db.ref('funcionarios').once('value');
            const funcionarios = funcionariosSnap.val() || {};

            // RASTREADOR: Avisa no console sempre que o número de tarefas mudar, para podermos diagnosticar
            const tarefasAguardando = Object.values(tarefas).filter(t => t.status && t.status.trim().toLowerCase() === 'pendente' && !t.notificadoWhatsApp);
            if (tarefasAguardando.length !== rastreadorDePendentes) {
                console.log(`[RADAR INFORMATIVO] O robô enxergou ${tarefasAguardando.length} tarefa(s) pendente(s) e não notificada(s) no banco de dados.`);
                rastreadorDePendentes = tarefasAguardando.length;
            }

            for (const [id, tarefa] of Object.entries(tarefas)) {
                // Se a tarefa tá pendente (ignora se tá escrito Pendente ou pendente) e AINDA NÃO FOI notificada
                const isPendente = tarefa.status && tarefa.status.trim().toLowerCase() === 'pendente';
                if (isPendente && !tarefa.notificadoWhatsApp) {
                    const dataTarefa = tarefa.dataAgendada;
                    const horaTarefa = tarefa.horaAgendada;

                    // Evita falhas se a tarefa não tiver data ou hora
                    if (!dataTarefa || !horaTarefa) {
                        console.log(`⚠️ Tarefa "${tarefa.titulo || 'Sem Título'}" ignorada: Está faltando Data ou Hora de Agendamento.`);
                        await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                        continue;
                    }

                    // Verifica se a data é hoje (ou antes) e a hora já deu
                    if (dataTarefa < hojeStr || (dataTarefa === hojeStr && horaTarefa <= horaAtualStr)) {
                        
                        // Proteção Extra: Firebase às vezes converte Arrays em Objetos
                        let responsaveis = [];
                        if (Array.isArray(tarefa.responsaveisIds)) responsaveis = tarefa.responsaveisIds;
                        else if (tarefa.responsaveisIds && typeof tarefa.responsaveisIds === 'object') responsaveis = Object.values(tarefa.responsaveisIds);
                        else if (tarefa.responsavelId) responsaveis = [tarefa.responsavelId];
                        
                        if (responsaveis.length === 0) {
                            console.log(`⚠️ Tarefa "${tarefa.titulo}" ignorada: Nenhum responsável válido encontrado no sistema.`);
                            await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                            continue; // Pula pra próxima tarefa
                        }
                        
                        for (const funcId of responsaveis) {
                            const funcionario = funcionarios[funcId];
                            
                            if (funcionario && funcionario.telefone) {
                                // Limpa o telefone deixando só números
                                let telefoneLimpo = funcionario.telefone.replace(/\D/g, '');
                                
                                // Formata o telefone (Adiciona 55 se não tiver)
                                let numeroMovel = telefoneLimpo;
                                if (!numeroMovel.startsWith('55')) {
                                    numeroMovel = '55' + numeroMovel;
                                }

                                const codigoExibicao = tarefa.codigo ? `[#${tarefa.codigo}] ` : '';
                                const mensagem = `🔔 *ArttBurger Tasks*\nOlá *${funcionario.nome}*, você tem uma tarefa programada para agora!\n\n👉 *${codigoExibicao}${tarefa.titulo}*\n📝 ${tarefa.descricao || 'Sem instruções adicionais.'}\n⏰ Prazo: *${tarefa.horaAgendada}*\n\nPor favor, responda com *"Concluído ${tarefa.codigo ? '#' + tarefa.codigo : ''}"* para finalizar no sistema. Bom trabalho! 🍔`;

                                console.log(`📤 Tentando enviar mensagem para ${funcionario.nome} (${numeroMovel})...`);
                                
                                try {
                                    // Valida se o número possui WhatsApp ativo
                                    let numberId = await client.getNumberId(numeroMovel);

                                    // Tratamento para o problema do 9º dígito no Brasil
                                    if (!numberId && numeroMovel.startsWith('55') && numeroMovel.length === 13) {
                                        // Remove o 9 após o DDD (ex: 55 38 9 9999-9999 vira 55 38 9999-9999)
                                        const numeroSemNove = numeroMovel.substring(0, 4) + numeroMovel.substring(5);
                                        numberId = await client.getNumberId(numeroSemNove);
                                    }

                                    if (numberId) {
                                        // Envia a mensagem usando o ID exato validado pela API
                                        await client.sendMessage(numberId._serialized, mensagem);
                                        console.log(`✅ Tarefa "${tarefa.titulo}" notificada com sucesso para ${funcionario.nome}.`);
                                    } else {
                                        console.log(`⚠️ O número ${numeroMovel} não possui WhatsApp ou está incorreto.`);
                                    }
                                } catch (sendError) {
                                    console.error(`❌ Erro interno do WhatsApp ao notificar ${funcionario.nome}:`, sendError.message);
                                    console.log(`💡 DICA: Envie um "Oi" do celular da hamburgueria para este funcionário uma única vez para o WhatsApp criar a rota!`);
                                }
                            }
                        }
                        
                        // Marca a tarefa como notificada apenas UMA vez após disparar para TODOS os responsáveis
                        await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                    }
                }
            }

            // --- LÓGICA DA FILA DE MENSAGENS DIRETAS (EX: PEDIDO DE REPOSIÇÃO) ---
            const filaSnap = await db.ref('fila_mensagens').once('value');
            const fila = filaSnap.val() || {};
            
            for (const [idMsg, itemMsg] of Object.entries(fila)) {
                if (itemMsg.status === 'pendente') {
                    console.log(`📤 Robô disparando mensagem avulsa para ${itemMsg.telefone}...`);
                    try {
                        let numberId = await client.getNumberId(itemMsg.telefone);
                        // Tratamento para o 9º dígito
                        if (!numberId && itemMsg.telefone.startsWith('55') && itemMsg.telefone.length === 13) {
                            const numeroSemNove = itemMsg.telefone.substring(0, 4) + itemMsg.telefone.substring(5);
                            numberId = await client.getNumberId(numeroSemNove);
                        }
                        // Tratamento inverso (Novo): Se o número foi cadastrado sem o 9, o robô coloca sozinho
                        else if (!numberId && itemMsg.telefone.startsWith('55') && itemMsg.telefone.length === 12) {
                            const numeroComNove = itemMsg.telefone.substring(0, 4) + '9' + itemMsg.telefone.substring(4);
                            numberId = await client.getNumberId(numeroComNove);
                        }
                        if (numberId) {
                            await client.sendMessage(numberId._serialized, itemMsg.mensagem);
                            await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'enviada' });
                            console.log(`✅ Mensagem avulsa enviada com sucesso!`);
                        } else {
                            console.log(`⚠️ O número ${itemMsg.telefone} não possui WhatsApp ou está incorreto.`);
                            await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'erro' });
                        }
                    } catch (sendError) {
                        console.error(`❌ Erro ao enviar mensagem avulsa:`, sendError.message);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar tarefas:', error);
        }
    }, 5000); 
}
