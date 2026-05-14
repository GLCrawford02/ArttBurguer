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

    // 1. Autenticação Global e Criação de Vínculo (Verifica sempre primeiro)
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

    // 2. Inteligência Artificial Mestra (Lê TODAS as mensagens dos funcionários)
    try {
        const tarefas = cacheTarefas;
        const tarefasPendentes = [];
        for (const [id, tar] of Object.entries(tarefas)) {
            if (tar.status === 'pendente') {
                const responsaveis = tar.responsaveisIds || (tar.responsavelId ? [tar.responsavelId] : []);
                if (responsaveis.includes(funcionarioId)) {
                    tarefasPendentes.push({ id: id, titulo: tar.titulo, codigo: tar.codigo });
                }
            }
        }

        const contextoTarefas = tarefasPendentes.length > 0 
            ? `O funcionário possui as seguintes tarefas pendentes: ${tarefasPendentes.map(t => `"${t.titulo}" (Código: #${t.codigo})`).join(', ')}.`
            : `O funcionário NÃO possui tarefas pendentes no momento.`;

        // Pequeno feedback de processamento para não deixar o funcionário no vácuo
        await msg.reply('🧠 *Assistente IA:* Processando...');

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROK_KEY}` },
                body: JSON.stringify({
                    model: 'grok-3-mini',
                    messages: [
                    { 
                        role: 'system', 
                        content: `Você é o Assistente Virtual Oficial da hamburgueria ArttBurger conversando no WhatsApp com o funcionário ${funcionarioNome} (${funcionarioCargo}).
${contextoTarefas}

Sua missão principal é ler a mensagem do usuário e CLASSIFICAR a intenção.
REGRAS DE CLASSIFICAÇÃO OBRIGATÓRIAS:
Você deve adicionar EXATAMENTE UMA destas tags ocultas no FINAL da sua resposta, caso a intenção do usuário seja clara:
1. Se o funcionário estiver respondendo a um lembrete confirmando que JÁ FEZ, CONCLUIU ou TERMINOU uma tarefa (ex: "sim", "já fiz", "pronto", "concluído #1234"), adicione a tag [CONCLUSAO_TAREFA]. Se ele mencionou um código na frase, inclua o código na tag, ex: [CONCLUSAO_TAREFA_1234].
2. Se o funcionário avisar que vai faltar, que está doente ou não vai trabalhar, adicione a tag [REGISTRAR_FALTA].
3. Se for uma conversa normal, pergunta avulsa, ou não se encaixar acima, NÃO adicione nenhuma tag.

Responda sempre de forma amigável, educada e bem curta. Se for registrar falta, diga que avisou a gerência e deseje melhoras.` 
                    },
                    { role: 'user', content: msg.body }
                    ]
                })
            });

            const data = await response.json();
            let respostaIA = data.choices?.[0]?.message?.content || 'Desculpe, tive um problema de conexão com meus servidores cerebrais.';

        // Processa as tags mágicas geradas pela IA
        let isTarefa = false;
        let isFalta = false;
        let codigoTarefaIA = null;

        const regexTarefa = /\[CONCLUSAO_TAREFA(?:_(\d{4}))?\]/;
        const matchTarefa = respostaIA.match(regexTarefa);

        if (matchTarefa) {
            isTarefa = true;
            codigoTarefaIA = matchTarefa[1] || null;
            respostaIA = respostaIA.replace(regexTarefa, '').trim();
        }

        if (respostaIA.includes('[REGISTRAR_FALTA]')) {
            isFalta = true;
            respostaIA = respostaIA.replace('[REGISTRAR_FALTA]', '').trim();
        }

        if (isTarefa) {
            let tarefaParaBaixar = null;
            let idDaTarefa = null;

            if (tarefasPendentes.length > 0) {
                if (codigoTarefaIA) {
                    const tarEncontrada = tarefasPendentes.find(t => t.codigo === codigoTarefaIA);
                    if (tarEncontrada) {
                        tarefaParaBaixar = tarEncontrada;
                        idDaTarefa = tarEncontrada.id;
                    }
                } 
                if (!tarefaParaBaixar) {
                    // Se a IA não pegou um código específico, apenas conclui a primeira pendente da lista
                    tarefaParaBaixar = tarefasPendentes[0];
                    idDaTarefa = tarefaParaBaixar.id;
                }
            }

            if (tarefaParaBaixar) {
                const tarCompleta = cacheTarefas[idDaTarefa];
                await db.ref(`tarefas/${idDaTarefa}`).update({ status: 'concluida', dataConclusao: Date.now() });
                await msg.reply(`✅ *Tarefa Concluída!*\n\nA tarefa *"${tarefaParaBaixar.titulo}"* foi marcada como concluída no sistema.`);

                let nextContaVinculadaId = null;
                if (tarCompleta.contaVinculadaId && tarCompleta.contaVinculadaTipo) {
                    const contaPath = `contas_${tarCompleta.contaVinculadaTipo}/${tarCompleta.contaVinculadaId}`;
                    const snap = await db.ref(contaPath).once('value');
                    if (snap.exists()) {
                        const conta = snap.val();
                        const contaFinalStatus = tarCompleta.contaVinculadaTipo === 'pagar' ? 'Pago' : 'Recebido';
                        if (conta.status !== contaFinalStatus) {
                            await db.ref(contaPath).update({ status: contaFinalStatus });
                            console.log(`✅ Conta vinculada ${tarCompleta.contaVinculadaId} marcada como ${contaFinalStatus}`);
                            
                            if (conta.recorrencia && conta.recorrencia !== 'Nenhuma') {
                                const nextDate = new Date(conta.vencimento + 'T12:00:00');
                                if (conta.recorrencia === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
                                else if (conta.recorrencia === 'Semanal') nextDate.setDate(nextDate.getDate() + 7);
                                else if (conta.recorrencia === 'Diária') nextDate.setDate(nextDate.getDate() + 1);
                                else if (conta.recorrencia === 'Anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
                                
                                const nextVencimento = nextDate.toISOString().split('T')[0];
                                if (!conta.fimRecorrencia || nextVencimento <= conta.fimRecorrencia) {
                                    const novaConta = { ...conta, status: 'Pendente', vencimento: nextVencimento };
                                    const novaContaRef = db.ref(`contas_${tarCompleta.contaVinculadaTipo}`).push();
                                    await novaContaRef.set(novaConta);
                                    nextContaVinculadaId = novaContaRef.key;
                                }
                            }
                        }
                    }
                }

                // Reagendamento de tarefas recorrentes
                if (tarCompleta.recorrencia && tarCompleta.recorrencia !== 'Nenhuma') {
                    const d = new Date(`${tarCompleta.dataAgendada}T12:00:00`);
                    if (tarCompleta.recorrencia === 'Diária') d.setDate(d.getDate() + 1);
                    else if (tarCompleta.recorrencia === 'Semanal') d.setDate(d.getDate() + 7);
                    else if (tarCompleta.recorrencia === 'Quinzenal') d.setDate(d.getDate() + 14);
                    else if (tarCompleta.recorrencia === 'Mensal') d.setMonth(d.getMonth() + 1);
                    else if (tarCompleta.recorrencia === 'Anual') d.setFullYear(d.getFullYear() + 1);
                    else if (tarCompleta.recorrencia === 'Personalizado') {
                        const v = tarCompleta.recorrenciaCustomValor || 1;
                        const u = tarCompleta.recorrenciaCustomUnidade || 'dia';
                        if (u === 'dia') d.setDate(d.getDate() + v);
                        else if (u === 'semana') d.setDate(d.getDate() + (v * 7));
                        else if (u === 'mes') d.setMonth(d.getMonth() + v);
                        else if (u === 'ano') d.setFullYear(d.getFullYear() + v);
                    }
                    const nextDateStr = d.toISOString().split('T')[0];
                    
                    let recreate = true;
                    if (tarCompleta.terminarRepeticao === 'em_data' && tarCompleta.dataFimRepeticao) {
                        if (nextDateStr > tarCompleta.dataFimRepeticao) recreate = false;
                    }

                    if (recreate) {
                        const novaTarefa = { ...tarCompleta, status: 'pendente', dataAgendada: nextDateStr, notificadoWhatsApp: false, timestamp: Date.now() };
                        delete novaTarefa.dataConclusao;
                        novaTarefa.codigo = Math.floor(1000 + Math.random() * 9000).toString();
                        if (nextContaVinculadaId) novaTarefa.contaVinculadaId = nextContaVinculadaId;
                        await db.ref('tarefas').push(novaTarefa);
                    }
                }
            } else {
                await msg.reply(`Tudo limpo, ${funcionarioNome.split(' ')[0]}! Você não tem nenhuma tarefa pendente no momento para dar baixa. 🍔`);
            }
        } 
        else if (isFalta) {
            const dataSP = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
            const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
            
            await db.ref(`gestao_equipe/${funcionarioId}/faltas`).push({
                data: hojeStr,
                motivo: msg.body,
                timestamp: Date.now()
            });
            console.log(`✅ Falta automática registrada para ${funcionarioNome}.`);

            let mensagemAlerta = `🚨 *ALERTA DE FALTA (Bot)*\n\nO funcionário *${funcionarioNome}* (${funcionarioCargo}) acabou de avisar pelo WhatsApp que vai faltar.\n\n*Mensagem original:* "${msg.body}"`;
            
            for (const [idAlvo, funcAlvo] of Object.entries(funcionarios)) {
                if (idAlvo === funcionarioId) continue;
                const cargosAlvo = Array.isArray(funcAlvo.cargo) ? funcAlvo.cargo : [funcAlvo.cargo || ''];
                const isGestor = cargosAlvo.some(c => c.toLowerCase() === 'dono' || c.toLowerCase() === 'gerente' || c.toLowerCase() === 'administrador' || c.toLowerCase() === 'ti');
                
                if (isGestor) {
                    if (funcAlvo.whatsappId) {
                        try { await client.sendMessage(funcAlvo.whatsappId, mensagemAlerta); } catch (err) {}
                    } else if (funcAlvo.telefone) {
                        let telLimpo = funcAlvo.telefone.replace(/\D/g, '');
                        if (!telLimpo.startsWith('55')) telLimpo = '55' + telLimpo;
                        await db.ref('fila_mensagens').push({ telefone: telLimpo, mensagem: mensagemAlerta, status: 'pendente', timestamp: Date.now() });
                    }
                }
            }
            await msg.reply(`🤖 *Assistente ArttBurger:*\n\n${respostaIA}`);
        } else {
            await msg.reply(`🤖 *Assistente ArttBurger:*\n\n${respostaIA}`);
        }

    } catch (error) {
        console.error('❌ Erro na IA:', error);
        await msg.reply('Desculpe, meu sistema de inteligência artificial está temporariamente indisponível.');
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

                // Lógica de Follow-up 24h depois do vencimento
                if (isPendente && !tarefa.notificadoAtraso24h) {
                    const dataTarefa = tarefa.dataAgendada;
                    const horaTarefa = tarefa.horaAgendada;

                    if (dataTarefa && horaTarefa) {
                        // Cria a data da tarefa no fuso horário local do servidor, que é o mesmo que o 'dataSP' usa para 'agora'
                        const dataTarefaCompleta = new Date(`${dataTarefa}T${horaTarefa}`);
                        const diffHoras = (dataSP.getTime() - dataTarefaCompleta.getTime()) / (1000 * 60 * 60);

                        // Se a diferença for de 24 horas ou mais
                        if (diffHoras >= 24) {
                            console.log(`⏰ Tarefa "${tarefa.titulo}" está atrasada há 24h. Enviando lembrete de follow-up.`);

                            let responsaveis = [];
                            if (Array.isArray(tarefa.responsaveisIds)) responsaveis = tarefa.responsaveisIds;
                            else if (tarefa.responsaveisIds && typeof tarefa.responsaveisIds === 'object') responsaveis = Object.values(tarefa.responsaveisIds);
                            else if (tarefa.responsavelId) responsaveis = [tarefa.responsavelId];

                            for (const funcId of responsaveis) {
                                const funcionario = funcionarios[funcId];
                                if (funcionario && funcionario.telefone) {
                                    let telefoneLimpo = funcionario.telefone.replace(/\D/g, '');
                                    if (!telefoneLimpo.startsWith('55')) telefoneLimpo = '55' + telefoneLimpo;

                                    const codigoExibicao = tarefa.codigo ? ` #${tarefa.codigo}` : '';
                                    const mensagem = `🤔 *Lembrete de Tarefa Atrasada*\n\nOlá *${funcionario.nome.split(' ')[0]}*, notei que a tarefa *"${tarefa.titulo}"* que venceu ontem ainda está pendente no sistema.\n\nEla já foi concluída? Se sim, por favor responda com *concluído${codigoExibicao}* para darmos baixa.`;

                                    // Enfileira a mensagem para o robô enviar
                                    await db.ref('fila_mensagens').push({
                                        telefone: telefoneLimpo,
                                        mensagem: mensagem,
                                        status: 'pendente',
                                        timestamp: Date.now()
                                    });
                                }
                            }
                            // Marca que o follow-up de 24h foi enviado para não enviar de novo
                            await db.ref(`tarefas/${id}`).update({ notificadoAtraso24h: true });
                        }
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
