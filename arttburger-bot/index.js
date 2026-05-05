const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');


const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// 2. Inicializar o Cliente do WhatsApp
const client = new Client({
    // LocalAuth salva a sua sessão. Você só escaneia o QR Code na primeira vez!
    authStrategy: new LocalAuth() 
});

client.on('qr', (qr) => {
    // Exibe o QR Code no terminal de comando
    qrcode.generate(qr, { small: true });
    console.log('🤖 Escaneie o QR Code acima com o WhatsApp da Hamburgueria.');
});

client.on('ready', () => {
    console.log('✅ Bot do WhatsApp conectado e pronto para enviar mensagens!');
    iniciarChecagemTarefas();
});

client.initialize();

// 3. Lógica de Checagem Automática (Roda a cada 1 minuto)
function iniciarChecagemTarefas() {
    console.log('⏳ Iniciando monitoramento de tarefas...');
    
    // 60000 milissegundos = 1 minuto
    setInterval(async () => {
        try {
            const agora = new Date();
            // Pega data (YYYY-MM-DD) e hora (HH:MM) atuais de forma local
            const hojeStr = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
            const horaAtualStr = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');

            // Busca as tarefas e funcionários do banco
            const tarefasSnap = await db.ref('tarefas').once('value');
            const tarefas = tarefasSnap.val();
            if (!tarefas) return;

            const funcionariosSnap = await db.ref('funcionarios').once('value');
            const funcionarios = funcionariosSnap.val() || {};

            for (const [id, tarefa] of Object.entries(tarefas)) {
                // Se a tarefa tá pendente e AINDA NÃO FOI notificada
                if (tarefa.status === 'pendente' && !tarefa.notificadoWhatsApp) {
                    const dataTarefa = tarefa.dataAgendada;
                    const horaTarefa = tarefa.horaAgendada;

                    // Verifica se a data é hoje (ou antes) e a hora já deu
                    if (dataTarefa < hojeStr || (dataTarefa === hojeStr && horaTarefa <= horaAtualStr)) {
                        
                        const funcionario = funcionarios[tarefa.responsavelId];
                        
                        if (funcionario && funcionario.telefone) {
                            // Limpa o telefone deixando só números
                            let telefoneLimpo = funcionario.telefone.replace(/\D/g, '');
                            
                            // Formata o telefone (Adiciona 55 se não tiver)
                            let numeroMovel = telefoneLimpo;
                            if (!numeroMovel.startsWith('55')) {
                                numeroMovel = '55' + numeroMovel;
                            }

                            const mensagem = `🔔 *ArttBurger Tasks*\nOlá *${funcionario.nome}*, você tem uma tarefa programada para agora!\n\n👉 *${tarefa.titulo}*\n📝 ${tarefa.descricao || 'Sem instruções adicionais.'}\n⏰ Prazo: *${tarefa.horaAgendada}*\n\nPor favor, marque como concluída no sistema após finalizar. Bom trabalho! 🍔`;

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
                                    console.log(`✅ Tarefa "${tarefa.titulo}" notificada com sucesso.`);
                                } else {
                                    console.log(`⚠️ O número ${numeroMovel} não possui WhatsApp ou está incorreto.`);
                                }
                            } catch (sendError) {
                                console.error(`❌ Erro interno do WhatsApp ao notificar ${funcionario.nome}:`, sendError.message);
                                console.log(`💡 DICA: Envie um "Oi" do celular da hamburgueria para este funcionário uma única vez para o WhatsApp criar a rota!`);
                            }
                            
                            // Marca a tarefa como notificada independente de erro para não travar o loop
                            await db.ref(`tarefas/${id}`).update({ notificadoWhatsApp: true });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar tarefas:', error);
        }
    }, 60000); 
}
