const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const readline = require('readline');

// ─── FIREBASE ────────────────────────────────────────────────────────────────
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/"
});
const db = admin.database();

const GROK_KEY = 'xai-Fh7xVsGIiq5cwKfvQVosE35aPsE4kT2hTJJGAgVHt2B2bnc0aMBWPfkuWvay0cfPok2Gmxlxs7iAqP4Z';

// ─── CACHES EM MEMÓRIA (atualizados em tempo real pelo Firebase) ──────────────
let cacheTarefas = {};
let cacheFuncionarios = {};
let cacheFila = {};
let checagemInterval = null;
let botReady = false;
let autoReloaded = false;

db.ref('tarefas').on('child_added',   s => { cacheTarefas[s.key] = s.val(); });
db.ref('tarefas').on('child_changed', s => { cacheTarefas[s.key] = s.val(); });
db.ref('tarefas').on('child_removed', s => { delete cacheTarefas[s.key]; });

db.ref('funcionarios').on('child_added',   s => { cacheFuncionarios[s.key] = s.val(); });
db.ref('funcionarios').on('child_changed', s => { cacheFuncionarios[s.key] = s.val(); });
db.ref('funcionarios').on('child_removed', s => { delete cacheFuncionarios[s.key]; });

db.ref('fila_mensagens').on('child_added',   s => { cacheFila[s.key] = s.val(); });
db.ref('fila_mensagens').on('child_changed', s => { cacheFila[s.key] = s.val(); });
db.ref('fila_mensagens').on('child_removed', s => { delete cacheFila[s.key]; });

// ─── HELPER DE INPUT ─────────────────────────────────────────────────────────
const pergunta = (texto) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(texto, ans => { rl.close(); resolve(ans); }));
};

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
async function iniciarBot() {
    console.log('\n==================================================');
    console.log('  BOT ARTTBURGER - CONEXÃO WHATSAPP');
    console.log('==================================================');

    const resp = await pergunta('Conectar via Código de Telefone? (s/n): ');
    const usarCodigo = resp.trim().toLowerCase() === 's';

    let telefone = null;
    if (usarCodigo) {
        const num = await pergunta('Número com DDD (Ex: 38999999999): ');
        telefone = num.replace(/\D/g, '');
        if (!telefone.startsWith('55')) telefone = '55' + telefone;
        console.log(`\n✅ Número registrado: ${telefone}`);
        console.log('⏳ Iniciando... o código aparecerá em breve.\n');
    }

    const client = new Client({
        authStrategy: new LocalAuth(),
        waitForPairingCode: usarCodigo,
        puppeteer: {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=IsolateOrigins,site-per-process',
            ]
        }
    });

    // ── QR / Código de Pareamento ─────────────────────────────────────────────
    client.on('qr', async (qr) => {
        if (usarCodigo && telefone) {
            console.log('⏳ Solicitando código de pareamento ao WhatsApp...');
            try {
                const code = await client.requestPairingCode(telefone);
                console.log('\n==============================================');
                console.log(`📲  CÓDIGO DE CONEXÃO: ${code}`);
                console.log('  WhatsApp > Aparelhos Conectados');
                console.log('  > Conectar com Número de Telefone');
                console.log('==============================================\n');
            } catch (e) {
                console.error('❌ Não foi possível gerar o código:', e.message);
                console.log('↩️  Exibindo QR Code como alternativa...\n');
                qrcode.generate(qr, { small: true });
            }
        } else {
            qrcode.generate(qr, { small: true });
        }
    });

    // ── Loading ───────────────────────────────────────────────────────────────
    client.on('loading_screen', (percent, message) => {
        console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
        if (Number(percent) === 100 && !botReady && !autoReloaded) {
            setTimeout(async () => {
                if (!botReady && client.pupPage) {
                    console.log('🔄 WhatsApp abriu mas não respondeu — recarregando para destravar...');
                    autoReloaded = true;
                    try { await client.pupPage.reload(); } catch (e) {}
                }
            }, 15000);
        }
    });

    // ── Pronto ────────────────────────────────────────────────────────────────
    client.on('ready', () => {
        if (botReady) return;
        botReady = true;
        autoReloaded = false;
        console.log('\n✅ Bot do WhatsApp conectado e pronto!\n');
        setTimeout(() => iniciarChecagemTarefas(client), 5000);
    });

    // ── Desconectado ──────────────────────────────────────────────────────────
    client.on('disconnected', async (reason) => {
        console.log(`❌ Desconectado: ${reason}`);
        console.log('🔄 Reconectando automaticamente...');
        botReady = false;
        try { await client.destroy(); } catch (e) {}
        client.initialize();
    });

    // ── Mensagens Recebidas ───────────────────────────────────────────────────
    client.on('message', async (msg) => {
        if (msg.from === 'status@broadcast') return;
        console.log(`📩 Mensagem de ${msg.from}: ${msg.body}`);

        const textoLimpo = msg.body.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
        const funcionarios = cacheFuncionarios;

        let funcionarioId = null;
        let funcionarioNome = '';
        let funcionarioCargo = 'Funcionário';
        let numeroRemetente = '';

        // Tentativa 1: ID vinculado
        for (const [id, func] of Object.entries(funcionarios)) {
            if (func.whatsappId === msg.from) {
                funcionarioId = id;
                funcionarioNome = func.nome;
                funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                break;
            }
        }

        // Tentativa 2: PIN
        if (!funcionarioId && textoLimpo.startsWith('vincular ')) {
            const possivelPin = textoLimpo.replace(/\D/g, '');
            if (possivelPin.length === 4) {
                for (const [id, func] of Object.entries(funcionarios)) {
                    if (String(func.pin) === possivelPin) {
                        funcionarioId = id;
                        funcionarioNome = func.nome;
                        funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                        await db.ref(`funcionarios/${funcionarioId}`).update({ whatsappId: msg.from });
                        console.log(`🔗 VÍNCULO via PIN: ${msg.from} → ${funcionarioNome}`);
                        break;
                    }
                }
            }
        }

        // Tentativa 3: Telefone cadastrado
        if (!funcionarioId) {
            const contact = await msg.getContact();
            numeroRemetente = contact.number || msg.from.split('@')[0];

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

                    const bate = telLimpo === remetenteFormatado ||
                        (telLimpo.length === 13 && telLimpo.substring(0,4) + telLimpo.substring(5) === remetenteFormatado) ||
                        (remetenteFormatado.length === 13 && remetenteFormatado.substring(0,4) + remetenteFormatado.substring(5) === telLimpo);

                    if (bate) {
                        funcionarioId = id;
                        funcionarioNome = func.nome;
                        funcionarioCargo = Array.isArray(func.cargo) ? func.cargo[0] : (func.cargo || 'Funcionário');
                        await db.ref(`funcionarios/${funcionarioId}`).update({ whatsappId: msg.from });
                        console.log(`🔗 VÍNCULO via telefone: ${msg.from} → ${funcionarioNome}`);
                        break;
                    }
                }
            }
        }

        if (!funcionarioId) {
            if (textoLimpo.startsWith('vincular')) {
                await msg.reply(`⚠️ *Não foi possível realizar o vínculo!*\n\nO PIN informado está incorreto ou o número não corresponde.\nPor favor, responda com a palavra vincular seguida do seu PIN exato de 4 dígitos cadastrado no sistema.\n\nExemplo:\n*vincular 1234*`);
                return;
            }
            console.log(`🚫 Número ${numeroRemetente || msg.from} não é funcionário cadastrado.`);
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

        // ── IA ────────────────────────────────────────────────────────────────
        try {
            const tarefas = cacheTarefas;
            const tarefasPendentes = [];
            for (const [id, tar] of Object.entries(tarefas)) {
                if (tar.status === 'pendente') {
                    const responsaveis = tar.responsaveisIds || (tar.responsavelId ? [tar.responsavelId] : []);
                    if (responsaveis.includes(funcionarioId)) {
                        tarefasPendentes.push({ id, titulo: tar.titulo, codigo: tar.codigo });
                    }
                }
            }

            const contextoTarefas = tarefasPendentes.length > 0
                ? `O funcionário possui as seguintes tarefas pendentes: ${tarefasPendentes.map(t => `"${t.titulo}" (Código: #${t.codigo})`).join(', ')}.`
                : `O funcionário NÃO possui tarefas pendentes no momento.`;

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
                        if (tarEncontrada) { tarefaParaBaixar = tarEncontrada; idDaTarefa = tarEncontrada.id; }
                    }
                    if (!tarefaParaBaixar) {
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
                    await msg.reply(`Tudo limpo, ${funcionarioNome.split(' ')[0]}! Você não tem nenhuma tarefa pendente no momento. 🍔`);
                }
            } else if (isFalta) {
                const dataSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
                await db.ref(`gestao_equipe/${funcionarioId}/faltas`).push({ data: hojeStr, motivo: msg.body, timestamp: Date.now() });
                console.log(`✅ Falta registrada para ${funcionarioNome}.`);

                const mensagemAlerta = `🚨 *ALERTA DE FALTA (Bot)*\n\nO funcionário *${funcionarioNome}* (${funcionarioCargo}) avisou pelo WhatsApp que vai faltar.\n\n*Mensagem:* "${msg.body}"`;
                for (const [idAlvo, funcAlvo] of Object.entries(funcionarios)) {
                    if (idAlvo === funcionarioId) continue;
                    const cargosAlvo = Array.isArray(funcAlvo.cargo) ? funcAlvo.cargo : [funcAlvo.cargo || ''];
                    const isGestor = cargosAlvo.some(c => ['dono','gerente','administrador','ti'].includes(c.toLowerCase()));
                    if (isGestor) {
                        if (funcAlvo.whatsappId) {
                            try { await client.sendMessage(funcAlvo.whatsappId, mensagemAlerta); } catch (e) {}
                        } else if (funcAlvo.telefone) {
                            let tel = funcAlvo.telefone.replace(/\D/g, '');
                            if (!tel.startsWith('55')) tel = '55' + tel;
                            await db.ref('fila_mensagens').push({ telefone: tel, mensagem: mensagemAlerta, status: 'pendente', timestamp: Date.now() });
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
}

iniciarBot();

// ─── CHECAGEM DE TAREFAS (a cada 5 segundos) ─────────────────────────────────
function iniciarChecagemTarefas(client) {
    console.log('⏳ Iniciando monitoramento de tarefas...');
    if (checagemInterval) clearInterval(checagemInterval);

    let rastreadorDePendentes = -1;
    let isRunning = false;

    checagemInterval = setInterval(async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            const dataSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
            const hojeStr = dataSP.getFullYear() + '-' + String(dataSP.getMonth() + 1).padStart(2, '0') + '-' + String(dataSP.getDate()).padStart(2, '0');
            const horaAtualStr = String(dataSP.getHours()).padStart(2, '0') + ':' + String(dataSP.getMinutes()).padStart(2, '0');

            const tarefas = cacheTarefas;
            const funcionarios = cacheFuncionarios;

            const tarefasAguardando = Object.values(tarefas).filter(t => t.status?.trim().toLowerCase() === 'pendente' && !t.notificadoWhatsApp);
            if (tarefasAguardando.length !== rastreadorDePendentes) {
                console.log(`[RADAR] ${tarefasAguardando.length} tarefa(s) pendente(s) não notificada(s).`);
                rastreadorDePendentes = tarefasAguardando.length;
            }

            for (const [id, tarefa] of Object.entries(tarefas)) {
                const status = tarefa.status?.trim().toLowerCase();

                // Limpeza de tarefas concluídas há mais de 7 dias
                if (status === 'concluida') {
                    if (!tarefa.dataConclusao) {
                        await db.ref(`tarefas/${id}`).update({ dataConclusao: Date.now() });
                        continue;
                    }
                    if (Date.now() - tarefa.dataConclusao > 7 * 24 * 60 * 60 * 1000) {
                        await db.ref(`tarefas/${id}`).remove();
                        console.log(`🧹 Tarefa removida (7 dias): ${tarefa.titulo || 'Sem título'}`);
                        continue;
                    }
                }

                if (status !== 'pendente') continue;

                // Notificação inicial
                if (!tarefa.notificadoWhatsApp) {
                    const { dataAgendada: dataTarefa, horaAgendada: horaTarefa } = tarefa;
                    if (!dataTarefa || !horaTarefa) {
                        await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                        continue;
                    }
                    if (dataTarefa < hojeStr || (dataTarefa === hojeStr && horaTarefa <= horaAtualStr)) {
                        let responsaveis = [];
                        if (Array.isArray(tarefa.responsaveisIds)) responsaveis = tarefa.responsaveisIds;
                        else if (tarefa.responsaveisIds && typeof tarefa.responsaveisIds === 'object') responsaveis = Object.values(tarefa.responsaveisIds);
                        else if (tarefa.responsavelId) responsaveis = [tarefa.responsavelId];

                        if (responsaveis.length === 0) {
                            await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                            continue;
                        }

                        for (const funcId of responsaveis) {
                            const funcionario = funcionarios[funcId];
                            if (!funcionario?.telefone) continue;

                            let tel = funcionario.telefone.replace(/\D/g, '');
                            if (!tel.startsWith('55')) tel = '55' + tel;

                            const codigoExibicao = tarefa.codigo ? `[#${tarefa.codigo}] ` : '';
                            const mensagem = `🔔 *ArttBurger Tasks*\nOlá *${funcionario.nome}*, você tem uma tarefa agora!\n\n👉 *${codigoExibicao}${tarefa.titulo}*\n📝 ${tarefa.descricao || 'Sem instruções adicionais.'}\n⏰ Prazo: *${tarefa.horaAgendada}*\n\nResponda com *"Concluído ${tarefa.codigo ? '#' + tarefa.codigo : ''}"* para finalizar. 🍔`;

                            console.log(`📤 Notificando ${funcionario.nome} (${tel})...`);
                            try {
                                let numberId = await client.getNumberId(tel);
                                if (!numberId && tel.startsWith('55') && tel.length === 13) {
                                    numberId = await client.getNumberId(tel.substring(0, 4) + tel.substring(5));
                                }
                                if (numberId) {
                                    await client.sendMessage(numberId._serialized, mensagem);
                                    console.log(`✅ Notificado: ${funcionario.nome}`);
                                } else {
                                    console.log(`⚠️ ${tel} sem WhatsApp ou número incorreto.`);
                                }
                            } catch (e) {
                                console.error(`❌ Erro ao notificar ${funcionario.nome}:`, e.message);
                            }
                        }
                        await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                    }
                }

                // Follow-up 24h
                if (!tarefa.notificadoAtraso24h && tarefa.dataAgendada && tarefa.horaAgendada) {
                    const dataTarefaCompleta = new Date(`${tarefa.dataAgendada}T${tarefa.horaAgendada}`);
                    const diffHoras = (dataSP.getTime() - dataTarefaCompleta.getTime()) / (1000 * 60 * 60);
                    if (diffHoras >= 24) {
                        let responsaveis = [];
                        if (Array.isArray(tarefa.responsaveisIds)) responsaveis = tarefa.responsaveisIds;
                        else if (tarefa.responsaveisIds && typeof tarefa.responsaveisIds === 'object') responsaveis = Object.values(tarefa.responsaveisIds);
                        else if (tarefa.responsavelId) responsaveis = [tarefa.responsavelId];

                        for (const funcId of responsaveis) {
                            const funcionario = funcionarios[funcId];
                            if (!funcionario?.telefone) continue;
                            let tel = funcionario.telefone.replace(/\D/g, '');
                            if (!tel.startsWith('55')) tel = '55' + tel;
                            const codigoExibicao = tarefa.codigo ? ` #${tarefa.codigo}` : '';
                            const mensagem = `🤔 *Lembrete de Tarefa Atrasada*\n\nOlá *${funcionario.nome.split(' ')[0]}*, a tarefa *"${tarefa.titulo}"* ainda está pendente.\n\nJá concluiu? Responda *concluído${codigoExibicao}* para dar baixa.`;
                            await db.ref('fila_mensagens').push({ telefone: tel, mensagem, status: 'pendente', timestamp: Date.now() });
                        }
                        await db.ref(`tarefas/${id}`).update({ notificadoAtraso24h: true });
                    }
                }
            }

            // Fila de mensagens avulsas
            for (const [idMsg, itemMsg] of Object.entries(cacheFila)) {
                if ((itemMsg.status === 'enviada' || itemMsg.status === 'erro') && itemMsg.timestamp && (Date.now() - itemMsg.timestamp > 7 * 24 * 60 * 60 * 1000)) {
                    await db.ref(`fila_mensagens/${idMsg}`).remove();
                    continue;
                }
                if (itemMsg.status !== 'pendente') continue;

                await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'processando' });
                console.log(`📤 Enviando mensagem avulsa para ${itemMsg.telefone}...`);
                try {
                    let numberId = await client.getNumberId(itemMsg.telefone);
                    if (!numberId && itemMsg.telefone.startsWith('55') && itemMsg.telefone.length === 13) {
                        numberId = await client.getNumberId(itemMsg.telefone.substring(0, 4) + itemMsg.telefone.substring(5));
                    } else if (!numberId && itemMsg.telefone.startsWith('55') && itemMsg.telefone.length === 12) {
                        numberId = await client.getNumberId(itemMsg.telefone.substring(0, 4) + '9' + itemMsg.telefone.substring(4));
                    }
                    if (numberId) {
                        await client.sendMessage(numberId._serialized, itemMsg.mensagem);
                        await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'enviada' });
                        console.log(`✅ Mensagem avulsa enviada.`);
                    } else {
                        await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'erro' });
                        console.log(`⚠️ Número ${itemMsg.telefone} sem WhatsApp.`);
                    }
                } catch (e) {
                    await db.ref(`fila_mensagens/${idMsg}`).update({ status: 'erro' });
                    console.error(`❌ Erro na mensagem avulsa:`, e.message);
                }
            }
        } catch (error) {
            console.error('❌ Erro na checagem:', error);
        } finally {
            isRunning = false;
        }
    }, 5000);
}
