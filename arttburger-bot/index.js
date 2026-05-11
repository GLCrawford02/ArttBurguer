const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const readline = require('readline');

const serviceAccount = require('./serviceAccountKey.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--start-minimized',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    },
    webVersionCache: {
        type: 'none' // Desativa o cache local da versão web para evitar o travamento no 100%
    }
});

let hasPrompted = false;

client.on('qr', async (qr) => {
    if (!hasPrompted) {
        hasPrompted = true;
        console.log('\n==================================================');
        console.log('🤖 CONEXÃO DO ROBÔ COM O WHATSAPP');
        console.log('==================================================');
        rl.question('Deseja conectar usando o Número de Telefone (Código)? (s/n): ', async (resposta) => {
            if (resposta.toLowerCase() === 's') {
                rl.question('Digite o número do WhatsApp com DDD (Ex: 38999999999): ', async (numero) => {
                    let numLimpo = numero.replace(/\D/g, '');
                    if (!numLimpo.startsWith('55')) numLimpo = '55' + numLimpo;
                    console.log(`⏳ Gerando código para ${numLimpo}...`);
                    try {
                        const code = await client.requestPairingCode(numLimpo);
                        console.log(`\n==============================================`);
                        console.log(`📲 CÓDIGO DE CONEXÃO: ${code}`);
                        console.log(`Abra o WhatsApp no celular > Aparelhos Conectados > Conectar com Número de Telefone`);
                        console.log(`==============================================\n`);
                    } catch (e) {
                        console.error('❌ Erro ao gerar código:', e.message);
                        qrcode.generate(qr, { small: true });
                    }
                });
            } else {
                console.log('Exibindo QR Code...');
                qrcode.generate(qr, { small: true });
            }
        });
    }
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Carregando o WhatsApp: ${percent}% - ${message}`);
    
    // Se chegar em 100%, o WhatsApp abrir na tela, mas o bot não destravar em 15 segundos...
    if (Number(percent) === 100 && !botReady && !autoReloaded) {
        setTimeout(async () => {
            if (!botReady && client.pupPage) {
                console.log('🔄 O WhatsApp abriu, mas o robô não detectou. Dando um "F5" automático para destravar...');
                autoReloaded = true;
                try {
                    await client.pupPage.reload();
                } catch (err) {}
            }
        }, 15000);
    }
});

let botReady = false;
let autoReloaded = false;

client.on('ready', () => {
    if (botReady) return; // Impede a duplicidade caso a biblioteca dispare o evento mais de uma vez
    botReady = true;
    autoReloaded = false;

    console.log('✅ Bot do WhatsApp conectado e pronto para enviar mensagens!');
    
    // Dá um fôlego de 5 segundos para a interface do WhatsApp terminar de estabilizar (evita o "context destroyed")
    setTimeout(() => {
        iniciarChecagemTarefas();
    }, 5000);
});

client.on('disconnected', async (reason) => {
    console.log(`❌ O bot do WhatsApp foi desconectado! Motivo: ${reason}`);
    console.log('🔄 Tentando reconectar automaticamente...');
    botReady = false;
    try {
        // Destrói a instância travada antes de reiniciar
        await client.destroy();
    } catch (err) {
        // Ignora erros se já estiver destruído
    }
    // Reinicia o ciclo (vai chamar 'qr' ou 'ready' de novo)
    client.initialize();
});

// Cache local Super Otimizado (Sincronização Delta - Baixa apenas o que mudou)
let cacheTarefas = {};
let cacheFuncionarios = {};
let cacheFila = {};

// Tarefas
db.ref('tarefas').on('child_added', snap => cacheTarefas[snap.key] = snap.val());
db.ref('tarefas').on('child_changed', snap => cacheTarefas[snap.key] = snap.val());
db.ref('tarefas').on('child_removed', snap => delete cacheTarefas[snap.key]);

// Funcionários
db.ref('funcionarios').on('child_added', snap => cacheFuncionarios[snap.key] = snap.val());
db.ref('funcionarios').on('child_changed', snap => cacheFuncionarios[snap.key] = snap.val());
db.ref('funcionarios').on('child_removed', snap => delete cacheFuncionarios[snap.key]);

// Fila de Mensagens
db.ref('fila_mensagens').on('child_added', snap => cacheFila[snap.key] = snap.val());
db.ref('fila_mensagens').on('child_changed', snap => cacheFila[snap.key] = snap.val());
db.ref('fila_mensagens').on('child_removed', snap => delete cacheFila[snap.key]);

// 4. Escutar Mensagens Recebidas
client.on('message', async (msg) => {
    // Ignora atualizações de status (stories) do WhatsApp para economizar processamento
    if (msg.from === 'status@broadcast') return;

    // Imprime no console do bot a mensagem e o número de quem enviou
    console.log(`📩 Mensagem recebida de ${msg.from}: ${msg.body}`);
    
    // Remove acentos e converte para minúsculas (Ex: "Concluído" -> "concluido")
    const textoLimpo = msg.body.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const codigoMatch = textoLimpo.match(/#?(\d{4})/);
    const codigoInformado = codigoMatch ? codigoMatch[1] : null;
    const temPalavraConclusao = /(conclui|ok|pronto|feit)/.test(textoLimpo);
    
    const ehMensagemDeFalta = /passando mal|vou faltar|não vou|nao vou|doente|atestado|hospital|emergencia|emergência/.test(textoLimpo);

    // Verifica se é um comando válido do bot antes de consultar o banco
    const isComando = textoLimpo === 'ping' || textoLimpo.startsWith('vincular') || 
                      textoLimpo === 'concluido' || textoLimpo === 'concluida' || textoLimpo === 'ok' || 
                      (codigoInformado && temPalavraConclusao) ||
                      textoLimpo.startsWith('assistente ') || ehMensagemDeFalta;

    if (!isComando) return; // Ignora mensagens comuns (ex: clientes fazendo pedidos)

    // 1. Autenticação Global e Criação de Vínculo
    const funcionarios = cacheFuncionarios; // Uso imediato da RAM (Zero download)
    let funcionarioId = null;
    let funcionarioNome = '';
    let funcionarioCargo = 'Funcionário';
    let numeroRemetente = '';

    // Tentativa 1: Busca pelo ID exato já vinculado (Ultra-rápido e à prova de falhas)
    for (const [id, func] of Object.entries(funcionarios)) {
        if (func.whatsappId === msg.from) {
            funcionarioId = id;
            funcionarioNome = func.nome;
            funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
            break;
        }
    }

    // Tentativa 2: Busca por PIN (Recomendado: vincular + PIN)
    if (!funcionarioId && textoLimpo.startsWith('vincular ')) {
        const possivelPin = textoLimpo.replace(/\D/g, '');
        if (possivelPin.length === 4) {
            for (const [id, func] of Object.entries(funcionarios)) {
                if (String(func.pin) === possivelPin) {
                    funcionarioId = id;
                    funcionarioNome = func.nome;
                    funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                    
                    await db.ref(`funcionarios/${funcionarioId}`).update({ whatsappId: msg.from });
                    console.log(`🔗 VÍNCULO CRIADO via PIN: O ID ${msg.from} foi salvo no cadastro de ${funcionarioNome}.`);
                    break;
                }
            }
        }
    }

    // Tentativa 3: Busca pelo Telefone (Fallback de segurança)
    if (!funcionarioId) {
        const contact = await msg.getContact();
        numeroRemetente = contact.number || msg.from.split('@')[0];

        // NOVO: Se o WhatsApp ocultou o número (@lid) e o usuário usou "vincular <numero>", pegamos daqui!
        const digitosTexto = textoLimpo.replace(/\D/g, '');
        if (textoLimpo.startsWith('vincular ') && digitosTexto.length >= 10) {
            numeroRemetente = digitosTexto;
        }

        let remetenteFormatado = numeroRemetente;
        if (!remetenteFormatado.startsWith('55') && remetenteFormatado.length >= 10) {
            remetenteFormatado = '55' + remetenteFormatado;
        }

        for (const [id, func] of Object.entries(funcionarios)) {
            if (func.telefone) {
                let telLimpo = func.telefone.replace(/\D/g, '');
                if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
                
                // Verifica se o número bate
                if (telLimpo === remetenteFormatado || 
                   (telLimpo.length === 13 && telLimpo.substring(0,4) + telLimpo.substring(5) === remetenteFormatado) ||
                   (remetenteFormatado.length === 13 && remetenteFormatado.substring(0,4) + remetenteFormatado.substring(5) === telLimpo)) {
                    
                    funcionarioId = id;
                    funcionarioNome = func.nome;
                    funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                    
                    // SUCESSO! Cria o vínculo permanente salvando o ID Oficial
                    await db.ref(`funcionarios/${funcionarioId}`).update({ whatsappId: msg.from });
                    console.log(`🔗 VÍNCULO CRIADO: O ID ${msg.from} foi salvo no cadastro de ${funcionarioNome}.`);
                    break;
                }
            }
        }
    }

    if (!funcionarioId) {
        // Se a pessoa tentou vincular mas o PIN estava incorreto ou ausente
        if (textoLimpo.startsWith('vincular')) {
            await msg.reply(`⚠️ *Não foi possível realizar o vínculo!*\n\nO PIN informado está incorreto ou o número não corresponde.\nPor favor, responda com a palavra vincular seguida do seu PIN exato de 4 dígitos cadastrado no sistema.\n\nExemplo:\n*vincular 1234*`);
            return;
        }
        
        console.log(`🚫 Mensagem ignorada: O número ${numeroRemetente || msg.from} tentou usar o bot, mas não é um funcionário cadastrado.`);
        return;
    }

    if (textoLimpo.startsWith('vincular')) {
        await msg.reply(`✅ Olá *${funcionarioNome.split(' ')[0]}*!\n\nSeu WhatsApp foi vinculado com sucesso ao seu cadastro no sistema ArttBurger.\n\n*Seu ID de Segurança:* \n_${msg.from}_`);
        return;
    }

    if (textoLimpo === 'ping') {
        await msg.reply(`pong! 🍔 Olá ${funcionarioNome.split(' ')[0]}, o bot do ArttBurger está te escutando!`);
        return;
    }

    if (textoLimpo === 'concluido' || textoLimpo === 'concluida' || textoLimpo === 'ok' || (codigoInformado && temPalavraConclusao)) {
        try {
            const tarefas = cacheTarefas; // Uso imediato da RAM (Zero download)
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
                await db.ref(`tarefas/${idDaTarefa}`).update({ status: 'concluida', dataConclusao: Date.now() });
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
                        delete novaTarefa.dataConclusao;
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
    // Lógica para Assistente IA (Lê todas as outras mensagens de funcionários vinculados)
    else {
        try {
            // Remove a palavra assistente caso o funcionário ainda a use por hábito
            const pergunta = msg.body.replace(/^assistente\s+/i, '').trim();
            await msg.reply('🧠 *Assistente IA:* Estou pensando, só um instante...');

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROK_KEY}` },
                body: JSON.stringify({
                    model: 'grok-3-mini',
                    messages: [
                        { role: 'system', content: `Você é o Assistente Virtual Oficial da hamburgueria ArttBurger, atendendo via WhatsApp. Você está conversando com ${funcionarioNome}, cujo cargo é ${funcionarioCargo}. Seja prestativo, educado, curto e direto nas respostas. Se o funcionário relatar que vai faltar, que está doente ou passando mal, adicione EXATAMENTE a tag [REGISTRAR_FALTA] no final da sua resposta e explique de forma empática que você já registrou a ausência no sistema e avisou a gerência. Para conversas triviais ou outros assuntos, responda amigavelmente sem a tag.` },
                        { role: 'user', content: pergunta }
                    ]
                })
            });

            const data = await response.json();
            let respostaIA = data.choices?.[0]?.message?.content || 'Desculpe, tive um problema de conexão com meus servidores cerebrais.';

            // Se a IA julgou que é realmente uma falta, interceptamos a tag e salvamos no banco de dados!
            if (respostaIA.includes('[REGISTRAR_FALTA]')) {
                respostaIA = respostaIA.replace('[REGISTRAR_FALTA]', '').trim();
                
                const dataSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
                const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
                
                await db.ref(`gestao_equipe/${funcionarioId}/faltas`).push({
                    data: hojeStr,
                    motivo: pergunta, // Salva o que a pessoa escreveu ("To passando mal, não vou hoje")
                    timestamp: Date.now()
                });
                console.log(`✅ Falta automática registrada para ${funcionarioNome}.`);

                // 🔔 NOTIFICAR DONOS E GERENTES
                let mensagemAlerta = `🚨 *ALERTA DE FALTA (Bot)*\n\nO funcionário *${funcionarioNome}* (${funcionarioCargo}) acabou de avisar pelo WhatsApp que vai faltar.\n\n*Mensagem original:* "${pergunta}"`;
                
                for (const [idAlvo, funcAlvo] of Object.entries(funcionarios)) {
                    // Evita notificar o próprio funcionário que está faltando (caso ele seja gerente/dono)
                    if (idAlvo === funcionarioId) continue;

                    const cargosAlvo = Array.isArray(funcAlvo.cargo) ? funcAlvo.cargo : [funcAlvo.cargo || ''];
                    const isGestor = cargosAlvo.some(c => c.toLowerCase() === 'dono' || c.toLowerCase() === 'gerente' || c.toLowerCase() === 'administrador');
                    
                    if (isGestor) {
                        if (funcAlvo.whatsappId) {
                            try {
                                await client.sendMessage(funcAlvo.whatsappId, mensagemAlerta);
                                console.log(`📲 Aviso de falta enviado diretamente para o gestor ${funcAlvo.nome}`);
                            } catch (err) {
                                console.error(`❌ Erro ao avisar gestor ${funcAlvo.nome}:`, err);
                            }
                        } else if (funcAlvo.telefone) {
                            let telLimpo = funcAlvo.telefone.replace(/\D/g, '');
                            if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
                            await db.ref('fila_mensagens').push({
                                telefone: telLimpo,
                                mensagem: mensagemAlerta,
                                status: 'pendente',
                                timestamp: Date.now()
                            });
                            console.log(`📩 Aviso de falta enfileirado para o gestor ${funcAlvo.nome}`);
                        }
                    }
                }
            }

            await msg.reply(`🤖 *Assistente ArttBurger:*\n\n${respostaIA}`);
        } catch (error) {
            console.error('❌ Erro na IA:', error);
            await msg.reply('Desculpe, meu sistema de inteligência artificial está temporariamente indisponível.');
        }
    }
});

client.initialize();

// 5. Lógica de Checagem Automática (Roda a cada 5 segundos)
let checagemInterval = null;
function iniciarChecagemTarefas() {
    console.log('⏳ Iniciando monitoramento de tarefas...');
    
    if (checagemInterval) clearInterval(checagemInterval);

    let rastreadorDePendentes = -1;
    let isRunning = false;
    
    checagemInterval = setInterval(async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            // Força o fuso horário de Brasília para evitar bugs de UTC no servidor/Node
            const dataSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
            const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
            const horaAtualStr = String(dataSP.getHours()).padStart(2, '0') + ':' + String(dataSP.getMinutes()).padStart(2, '0');

            // Usa o cache sincronizado em tempo real ao invés de baixar do banco a cada 5 segundos
            const tarefas = cacheTarefas;
            const funcionarios = cacheFuncionarios;

            // RASTREADOR: Avisa no console sempre que o número de tarefas mudar, para podermos diagnosticar
            const tarefasAguardando = Object.values(tarefas).filter(t => t.status && t.status.trim().toLowerCase() === 'pendente' && !t.notificadoWhatsApp);
            if (tarefasAguardando.length !== rastreadorDePendentes) {
                console.log(`[RADAR INFORMATIVO] O robô enxergou ${tarefasAguardando.length} tarefa(s) pendente(s) e não notificada(s) no banco de dados.`);
                rastreadorDePendentes = tarefasAguardando.length;
            }

            for (const [id, tarefa] of Object.entries(tarefas)) {
                // Limpeza Automática: Remove tarefas concluídas há mais de 7 dias
                const isConcluida = tarefa.status && tarefa.status.trim().toLowerCase() === 'concluida';
                if (isConcluida) {
                    if (!tarefa.dataConclusao) {
                        // Marca a data de hoje nas antigas para apagar daqui a 7 dias
                        await db.ref(`tarefas/${id}`).update({ dataConclusao: Date.now() });
                        continue;
                    }
                    if (Date.now() - tarefa.dataConclusao > 7 * 24 * 60 * 60 * 1000) {
                        await db.ref(`tarefas/${id}`).remove();
                        console.log(`🧹 Tarefa concluída removida automaticamente (7 dias): ${tarefa.titulo || 'Sem título'}`);
                        continue;
                    }
                }

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
            const fila = cacheFila;
            
            for (const [idMsg, itemMsg] of Object.entries(fila)) {
                // Limpeza Automática: Remove mensagens processadas (enviadas ou com erro) há mais de 7 dias
                if (itemMsg.status === 'enviada' || itemMsg.status === 'erro') {
                    if (itemMsg.timestamp && (Date.now() - itemMsg.timestamp > 7 * 24 * 60 * 60 * 1000)) {
                        await db.ref(`fila_mensagens/${idMsg}`).remove();
                        console.log(`🧹 Mensagem antiga removida da fila automaticamente (7 dias).`);
                        continue;
                    }
                }

                if (itemMsg.status === 'pendente') {
                    await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'processando' });
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
                        await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'erro' });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar tarefas:', error);
        } finally {
            isRunning = false;
        }
    }, 5000); 
}
