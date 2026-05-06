const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');


const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/"
});

const db = admin.database();


const client = new Client({
    // LocalAuth salva a sua sessão. Você só escaneia o QR Code na primeira vez!
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('🤖 Escaneie o QR Code acima com o WhatsApp da Hamburgueria.');
});

client.on('ready', () => {
    console.log('✅ Bot do WhatsApp conectado e pronto para enviar mensagens!');
    iniciarChecagemTarefas();
});

client.initialize();


function iniciarChecagemTarefas() {
    console.log('⏳ Iniciando monitoramento de tarefas...');


    setInterval(async () => {
        try {
            const agora = new Date();

            const hojeStr = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
            const horaAtualStr = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');


            const tarefasSnap = await db.ref('tarefas').once('value');
            const tarefas = tarefasSnap.val();
            if (!tarefas) return;

            const funcionariosSnap = await db.ref('funcionarios').once('value');
            const funcionarios = funcionariosSnap.val() || {};

            for (const [id, tarefa] of Object.entries(tarefas)) {

                if (tarefa.status === 'pendente' && !tarefa.notificadoWhatsApp) {
                    const dataTarefa = tarefa.dataAgendada;
                    const horaTarefa = tarefa.horaAgendada;


                    if (dataTarefa < hojeStr || (dataTarefa === hojeStr && horaTarefa <= horaAtualStr)) {
                        
                        const funcionario = funcionarios[tarefa.responsavelId];

                        if (funcionario && funcionario.telefone) {

                            let telefoneLimpo = funcionario.telefone.replace(/\D/g, '');
                            

                            let numeroMovel = telefoneLimpo;
                            if (!numeroMovel.startsWith('55')) {
                                numeroMovel = '55' + numeroMovel;
                            }

                            const mensagem = `🔔 *ArttBurger Tasks*\nOlá *${funcionario.nome}*, você tem uma tarefa programada para agora!\n\n👉 *${tarefa.titulo}*\n📝 ${tarefa.descricao || 'Sem instruções adicionais.'}\n⏰ Prazo: *${tarefa.horaAgendada}*\n\nPor favor, marque como concluída no sistema após finalizar. Bom trabalho! 🍔`;

                            console.log(`📤 Tentando enviar mensagem para ${funcionario.nome} (${numeroMovel})...`);
                            
                            try {

                                let numberId = await client.getNumberId(numeroMovel);



                                if (!numberId && numeroMovel.startsWith('55') && numeroMovel.length === 13) {

                                    const numeroSemNove = numeroMovel.substring(0, 4) + numeroMovel.substring(5);
                                    numberId = await client.getNumberId(numeroSemNove);
                                }

                                if (numberId) {

                                    await client.sendMessage(numberId._serialized, mensagem);
                                    console.log(`✅ Tarefa "${tarefa.titulo}" notificada com sucesso.`);
                                } else {
                                    console.log(`⚠️ O número ${numeroMovel} não possui WhatsApp ou está incorreto.`);
                                }
                            } catch (sendError) {
                                console.error(`❌ Erro interno do WhatsApp ao notificar ${funcionario.nome}:`, sendError.message);
                                console.log(`💡 DICA: Envie um "Oi" do celular da hamburgueria para este funcionário uma única vez para o WhatsApp criar a rota!`);
                            }

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
