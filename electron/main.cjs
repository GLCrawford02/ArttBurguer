const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyAtwIhdoooZ7AAzFdshRJzArVBKhqEhfFI",
  authDomain: "arttburgercvo.firebaseapp.com",
  databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/",
  projectId: "arttburger",
  storageBucket: "arttburger.firebasestorage.app",
  messagingSenderId: "452751207382",
  appId: "1:452751207382:web:ccbfeac50f0fb4e6299277"
};

let mainWindow;
let firebaseDb;
let fbRef;
let fbOnChildAdded;
let fbUpdate;
let fbSet;
let fbRunTransaction;

async function initFirebasePrintQueue() {
  try {
    const firebaseAppModule = await import('firebase/app');
    const databaseModule = await import('firebase/database');
    const { initializeApp } = firebaseAppModule;
    const { getDatabase, ref, onChildAdded, update, set, runTransaction } = databaseModule;

    initializeApp(firebaseConfig);
    firebaseDb = getDatabase();
    fbRef = ref;
    fbOnChildAdded = onChildAdded;
    fbUpdate = update;
    fbSet = set;
    fbRunTransaction = runTransaction;

    const jobsRef = fbRef(firebaseDb, 'impressoras/jobs');
    fbOnChildAdded(jobsRef, async (snap) => {
      const job = snap.val();
      const jobId = snap.key;
      if (!jobId || !job || job.status !== 'pendente') return;
      await processPrintJob(jobId, job);
    });

    console.log('Firebase print queue initialized.');
  } catch (e) {
    console.error('Falha ao iniciar fila de impressão do Firebase:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../src/assets/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    title: 'ArttBurger',
  });

  mainWindow.maximize();

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('https://arttburger.onrender.com');
  }
}

app.whenReady().then(async () => {
  createWindow();
  await initFirebasePrintQueue();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Helpers ESC/POS ─────────────────────────────────────────────────────────
function buildEscPosTicket({ itens, destLabel, identificador, lancadoPor, deliveryInfo }) {
  const buf = [];
  const b  = (...bytes) => buf.push(Buffer.from(bytes));
  const t  = (s)        => buf.push(Buffer.from(String(s), 'utf8'));
  const nl = ()         => buf.push(Buffer.from([0x0a]));
  const SEP = '-'.repeat(42);

  b(0x1b, 0x53);               // ESC S — força modo padrão (sai do modo página se ativo)
  b(0x1b, 0x40);               // ESC @ — inicializa / reseta
  b(0x1d, 0x4c, 0x00, 0x00);  // GS L 0 — margem esquerda = 0
  b(0x1b, 0x61, 0x01);         // centralizado
  b(0x1d, 0x21, 0x11);         // fonte 2x (largura + altura)
  b(0x1b, 0x45, 0x01);         // negrito
  t(`*** ${destLabel} ***`); nl();
  b(0x1d, 0x21, 0x00);         // fonte normal
  b(0x1b, 0x45, 0x00);         // negrito off
  b(0x1b, 0x61, 0x00);         // alinhamento esquerdo
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t(identificador); b(0x1b, 0x45, 0x00); nl();
  if (lancadoPor) { t(`LANCADO POR: ${lancadoPor}`); nl(); }
  if (deliveryInfo) {
    t(SEP); nl();
    if (deliveryInfo.clienteNome) { t(`Cliente: ${deliveryInfo.clienteNome}`); nl(); }
    if (deliveryInfo.clienteTelefone) { t(`Tel: ${deliveryInfo.clienteTelefone}`); nl(); }
    if (deliveryInfo.totalPedidosCliente) { t(`Pedidos na loja: ${deliveryInfo.totalPedidosCliente}`); nl(); }
    if (deliveryInfo.pontosFidelidade !== undefined && deliveryInfo.pontosFidelidade !== null) { t(`Pontos Fidelidade: ${deliveryInfo.pontosFidelidade}`); nl(); }
    if (deliveryInfo.isRetirada) {
      b(0x1b, 0x45, 0x01); t('RETIRADA NO BALCAO'); b(0x1b, 0x45, 0x00); nl();
    } else if (deliveryInfo.endereco) {
      const e = deliveryInfo.endereco;
      t(`End: ${e.logradouro || ''}, ${e.numero || ''}`); nl();
      if (e.bairro) { t(`Bairro: ${e.bairro}`); nl(); }
      if (e.complemento) { t(`Comp: ${e.complemento}`); nl(); }
      if (e.cidade) { t(`Cidade: ${e.cidade}`); nl(); }
    }
    if (deliveryInfo.formaPagamento) { t(`Pagamento: ${deliveryInfo.formaPagamento}`); nl(); }
    if (deliveryInfo.subtotal !== undefined) { t(`Subtotal: R$ ${Number(deliveryInfo.subtotal).toFixed(2)}`); nl(); }
    if (!deliveryInfo.isRetirada && deliveryInfo.taxaEntrega) { t(`Taxa Entrega: R$ ${Number(deliveryInfo.taxaEntrega).toFixed(2)}`); nl(); }
    if (deliveryInfo.valorTotal !== undefined) { 
      b(0x1b, 0x45, 0x01); t(`TOTAL: R$ ${Number(deliveryInfo.valorTotal).toFixed(2)}`); b(0x1b, 0x45, 0x00); nl(); 
    }
  }
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t('Qtd  Descricao'); b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();

  for (const item of (itens || [])) {
    b(0x1b, 0x45, 0x01);
    t(`${item.qtd}x   ${item.nome}`);
    b(0x1b, 0x45, 0x00); nl();
    const o = item.opcoes || {};
    const toArr = (v) => v ? (Array.isArray(v) ? v : Object.values(v)) : [];
    const mont = toArr(o.montagem).filter(Boolean);
    if (mont.length) { t(`     Montagem: ${mont.join(', ')}`); nl(); }
    if (o.pontoCarne) { t(`     Ponto: ${o.pontoCarne}`); nl(); }
    for (const a of toArr(o.adicionais)) {
      if (a && a.nome) { t(`     + ${a.qtd || 1}x ${a.nome}`); nl(); }
    }
    const rest = toArr(o.restricoes).filter(Boolean);
    if (rest.length) { b(0x1b, 0x45, 0x01); t(`     SEM: ${rest.join(', ')}`); b(0x1b, 0x45, 0x00); nl(); }
    if (o.observacao) { t(`     Obs: ${o.observacao}`); nl(); }
  }

  t(SEP); nl();
  const now = new Date();
  t(`Data ${now.toLocaleDateString('pt-BR')}  Hora: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
  nl(); nl(); nl();
  b(0x1d, 0x56, 0x41, 0x03);  // corte parcial

  return Buffer.concat(buf);
}

function buildEscPosRecibo({ itens, identificador, clienteNome, clienteTelefone, endereco, isRetirada, formaPagamento, taxaEntrega, subtotal, desconto, total, cupom, timestamp }) {
  const buf = [];
  const b  = (...bytes) => buf.push(Buffer.from(bytes));
  const t  = (s)        => buf.push(Buffer.from(String(s), 'utf8'));
  const nl = ()         => buf.push(Buffer.from([0x0a]));
  const SEP = '-'.repeat(40);
  const W = 40; // largura total em chars

  const rpad = (str, width) => String(str).substring(0, width).padEnd(width);
  const lpad = (str, width) => String(str).padStart(width);

  b(0x1b, 0x40);            // init
  b(0x1b, 0x61, 0x01);     // centralizado
  b(0x1b, 0x45, 0x01); t('Artt Burger Curvelo LTDA'); b(0x1b, 0x45, 0x00); nl();
  t('CNPJ: 46.827.745/0001-20'); nl();
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t('RESUMO DA CONTA'); b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t(identificador); b(0x1b, 0x45, 0x00); nl();
  if (clienteNome) { t(`Cliente: ${clienteNome}`); nl(); }
  if (identificador && identificador.toLowerCase().includes('delivery')) {
    if (clienteTelefone) { t(`Tel: ${clienteTelefone}`); nl(); }
    if (isRetirada) {
      b(0x1b, 0x45, 0x01); t('RETIRADA NO BALCAO'); b(0x1b, 0x45, 0x00); nl();
    } else if (endereco) {
      t(`Endereço: ${endereco.logradouro || ''}, ${endereco.numero || ''}`); nl();
      if (endereco.bairro) { t(`Bairro: ${endereco.bairro}`); nl(); }
      if (endereco.complemento) { t(`Comp: ${endereco.complemento}`); nl(); }
    }
    if (formaPagamento) { t(`Pagamento: ${formaPagamento}`); nl(); }
  }
  t(SEP); nl();

  // cabeçalho de itens
  b(0x1b, 0x61, 0x00);     // esquerda
  b(0x1b, 0x45, 0x01);
  const QW = 5, PW = 24, TW = W - QW - PW;
  t(rpad('Qtd', QW) + rpad('Produto', PW) + lpad('Total', TW));
  b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();

  for (const item of (itens || [])) {
    const priceStr = `R$ ${(item.preco * item.qtd).toFixed(2)}`;
    const namePart = rpad(item.nome, PW);
    b(0x1b, 0x45, 0x01);
    t(rpad(`${item.qtd}x`, QW) + namePart + lpad(priceStr, TW));
    b(0x1b, 0x45, 0x00); nl();

    const o = item.opcoes || {};
    const toArr = (v) => v ? (Array.isArray(v) ? v : Object.values(v)) : [];
    const mont = toArr(o.montagem).filter(Boolean);
    if (mont.length) { t(`     Montagem: ${mont.join(', ')}`); nl(); }
    if (o.pontoCarne) { t(`     Ponto: ${o.pontoCarne}`); nl(); }
    for (const a of toArr(o.adicionais)) {
      if (a && a.nome) { t(`     + ${a.qtd || 1}x ${a.nome}`); nl(); }
    }
    const rest = toArr(o.restricoes).filter(Boolean);
    if (rest.length) { b(0x1b, 0x45, 0x01); t(`     SEM: ${rest.join(', ')}`); b(0x1b, 0x45, 0x00); nl(); }
    if (o.observacao) { t(`     Obs: ${o.observacao}`); nl(); }
  }

  t(SEP); nl();
  const subStr = `R$ ${Number(subtotal).toFixed(2)}`;
  t(rpad('Subtotal:', W - subStr.length) + subStr); nl();
  if (Number(taxaEntrega) > 0) {
    const txStr = `+ R$ ${Number(taxaEntrega).toFixed(2)}`;
    t(rpad('Taxa Entrega:', W - txStr.length) + txStr); nl();
  }
  if (Number(desconto) > 0) {
    const dStr = `- R$ ${Number(desconto).toFixed(2)}`;
    const label = cupom ? `Desconto (${cupom}):` : 'Desconto:';
    t(rpad(label, W - dStr.length) + dStr); nl();
  }
  t(SEP); nl();
  b(0x1b, 0x45, 0x01);
  const totStr = `R$ ${Number(total).toFixed(2)}`;
  t(rpad('Total', W - totStr.length) + totStr);
  b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();

  b(0x1b, 0x61, 0x01); // centralizado
  t('DOCUMENTO SEM VALOR FISCAL'); nl();
  t(SEP); nl();
  const dt = new Date(timestamp || Date.now());
  t(`Data: ${dt.toLocaleDateString('pt-BR')}  Hora: ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); nl();
  t('OBRIGADO PELA PREFERENCIA.'); nl();
  t('VOLTE SEMPRE!'); nl();
  nl(); nl(); nl();
  b(0x1d, 0x56, 0x41, 0x03); // corte parcial

  return Buffer.concat(buf);
}

const DENOMINACOES_CAIXA = [
  { key: 'nota100', label: 'R$ 100,00', valor: 100 },
  { key: 'nota50', label: 'R$ 50,00', valor: 50 },
  { key: 'nota20', label: 'R$ 20,00', valor: 20 },
  { key: 'nota10', label: 'R$ 10,00', valor: 10 },
  { key: 'nota5', label: 'R$ 5,00', valor: 5 },
  { key: 'nota2', label: 'R$ 2,00', valor: 2 },
  { key: 'moeda1', label: 'Moeda R$ 1,00', valor: 1 },
  { key: 'moeda050', label: 'Moeda R$ 0,50', valor: 0.5 },
  { key: 'moeda025', label: 'Moeda R$ 0,25', valor: 0.25 },
  { key: 'moeda010', label: 'Moeda R$ 0,10', valor: 0.10 },
  { key: 'moeda005', label: 'Moeda R$ 0,05', valor: 0.05 },
];

function buildEscPosRelatorioCaixa({ sessao }) {
  const buf = [];
  const b  = (...bytes) => buf.push(Buffer.from(bytes));
  const t  = (s)        => buf.push(Buffer.from(String(s), 'utf8'));
  const nl = ()         => buf.push(Buffer.from([0x0a]));
  const SEP = '-'.repeat(40);
  const W = 40;

  const rpad = (str, width) => String(str).substring(0, width).padEnd(width);

  const linhaDenom = (contagem, d) => {
    const qtd = (contagem && contagem[d.key]) || 0;
    if (!qtd) return;
    const valorStr = `R$ ${(qtd * d.valor).toFixed(2)}`;
    t(rpad(`${d.label} x ${qtd}`, W - valorStr.length) + valorStr); nl();
  };

  b(0x1b, 0x40);            // init
  b(0x1b, 0x61, 0x01);     // centralizado
  b(0x1b, 0x45, 0x01); t('Artt Burger Curvelo LTDA'); b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t('RELATORIO DE CAIXA'); b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();

  b(0x1b, 0x61, 0x00); // esquerda
  const dtAbertura = new Date(sessao.dataAbertura);
  t(`Abertura: ${dtAbertura.toLocaleDateString('pt-BR')} ${dtAbertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); nl();
  t(`Operador: ${sessao.aberturaPorNome || ''}`); nl();
  if (sessao.dataFechamento) {
    const dtFechamento = new Date(sessao.dataFechamento);
    t(`Fechamento: ${dtFechamento.toLocaleDateString('pt-BR')} ${dtFechamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); nl();
    t(`Operador: ${sessao.fechamentoPorNome || ''}`); nl();
  }
  t(SEP); nl();

  b(0x1b, 0x45, 0x01); t('CONTAGEM DE ABERTURA'); b(0x1b, 0x45, 0x00); nl();
  DENOMINACOES_CAIXA.forEach(d => linhaDenom(sessao.contagemAbertura, d));
  const valorAberturaStr = `R$ ${Number(sessao.valorAbertura || 0).toFixed(2)}`;
  b(0x1b, 0x45, 0x01); t(rpad('Total Abertura:', W - valorAberturaStr.length) + valorAberturaStr); b(0x1b, 0x45, 0x00); nl();

  if (sessao.contagemFechamento) {
    t(SEP); nl();
    b(0x1b, 0x45, 0x01); t('CONTAGEM DE FECHAMENTO'); b(0x1b, 0x45, 0x00); nl();
    DENOMINACOES_CAIXA.forEach(d => linhaDenom(sessao.contagemFechamento, d));
    const valorFechamentoStr = `R$ ${Number(sessao.valorFechamento || 0).toFixed(2)}`;
    b(0x1b, 0x45, 0x01); t(rpad('Total Fechamento:', W - valorFechamentoStr.length) + valorFechamentoStr); b(0x1b, 0x45, 0x00); nl();

    t(SEP); nl();
    const vendasStr = `R$ ${Number(sessao.vendasDinheiro || 0).toFixed(2)}`;
    t(rpad('Vendas em Dinheiro:', W - vendasStr.length) + vendasStr); nl();
    const esperadoStr = `R$ ${Number(sessao.valorEsperado || 0).toFixed(2)}`;
    t(rpad('Valor Esperado:', W - esperadoStr.length) + esperadoStr); nl();
    const contadoStr = `R$ ${Number(sessao.valorFechamento || 0).toFixed(2)}`;
    t(rpad('Valor Contado:', W - contadoStr.length) + contadoStr); nl();

    const diferenca = Number(sessao.diferenca || 0);
    const diferencaLabel = diferenca >= 0 ? 'Sobra' : 'Falta';
    const diferencaStr = `R$ ${Math.abs(diferenca).toFixed(2)}`;
    b(0x1b, 0x45, 0x01);
    t(rpad(`Diferenca (${diferencaLabel}):`, W - diferencaStr.length) + diferencaStr);
    b(0x1b, 0x45, 0x00); nl();
  }

  t(SEP); nl();
  b(0x1b, 0x61, 0x01); // centralizado
  const now = new Date();
  t(`Impresso em ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`); nl();
  nl(); nl(); nl();
  b(0x1d, 0x56, 0x41, 0x03); // corte parcial

  return Buffer.concat(buf);
}

function enviarParaImpressora(ip, data) {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(9100, ip, () => { socket.write(data); socket.end(); });
    socket.on('close', () => resolve({ ok: true }));
    socket.on('error', err => { socket.destroy(); reject(err); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`Timeout ao conectar em ${ip}:9100`)); });
  });
}

function imprimirViaDriver(printerName, html) {
  return new Promise((resolve, reject) => {
    const printWin = new BrowserWindow({
      show: false,
      width: 300,
      webPreferences: { contextIsolation: true },
    });
    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    printWin.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName,
            margins: { marginType: 'none' }
          },
          (success, errorType) => {
            printWin.destroy();
            if (success) resolve({ ok: true });
            else reject(new Error(errorType || 'Erro ao imprimir'));
          }
        );
      }, 300);
    });
  });
}

async function processPrintJob(jobId, job) {
  if (!firebaseDb || !fbRef || !fbUpdate || !fbRunTransaction) return;
  const jobRef = fbRef(firebaseDb, `impressoras/jobs/${jobId}`);

  // Impressoras identificadas por nome (USB) só podem ser atendidas pelo
  // computador onde estão instaladas — verifica antes de reivindicar o job,
  // deixando pendente para outro cliente conectado que tenha essa impressora.
  if (job.type === 'ticket-nome') {
    if (!job.printerName) return;
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      const temImpressora = printers.some(p => p.name === job.printerName);
      if (!temImpressora) return;
    } catch {
      return;
    }
  }

  // Reivindica o job atomicamente: com várias telas conectadas, garante que
  // apenas uma processe e dispare a impressão.
  const statusRef = fbRef(firebaseDb, `impressoras/jobs/${jobId}/status`);
  const claim = await fbRunTransaction(statusRef, current => (current === 'pendente' ? 'imprimindo' : undefined));
  if (!claim.committed) return;

  try {
    await fbUpdate(jobRef, { startedAt: Date.now() });

    if (job.type === 'ticket') {
      const data = buildEscPosTicket(job);
      await enviarParaImpressora(job.printerIp, data);
    } else if (job.type === 'recibo') {
      const data = buildEscPosRecibo(job);
      await enviarParaImpressora(job.printerIp, data);
    } else if (job.type === 'relatorio') {
      const data = buildEscPosRelatorioCaixa(job);
      await enviarParaImpressora(job.printerIp, data);
    } else if (job.type === 'ticket-nome') {
      await imprimirViaDriver(job.printerName, job.html);
    } else {
      throw new Error(`Tipo de job desconhecido: ${job.type}`);
    }

    await fbUpdate(jobRef, { status: 'concluido', completedAt: Date.now(), lastError: null });
    console.log(`Job de impressão ${jobId} concluído.`);
  } catch (error) {
    const message = error?.message || String(error);
    console.error(`Falha no job de impressão ${jobId}:`, message);
    await fbUpdate(jobRef, {
      status: 'erro',
      lastError: message,
      attempts: (job.attempts || 0) + 1,
      updatedAt: Date.now(),
    });
  }
}

// ─── IPC: Ticket cozinha/balcão via IP (ESC/POS RAW porta 9100) ─────────────
ipcMain.handle('imprimir-ip-ticket', async (_event, payload) => {
  const data = buildEscPosTicket(payload);
  return enviarParaImpressora(payload.ip, data);
});

// ─── IPC: Recibo do cliente via IP (ESC/POS RAW porta 9100) ─────────────────
ipcMain.handle('imprimir-ip-recibo', async (_event, payload) => {
  const data = buildEscPosRecibo(payload);
  return enviarParaImpressora(payload.ip, data);
});

// ─── IPC: Imprimir ticket via driver Windows (legado / fallback) ─────────────
ipcMain.handle('imprimir-ticket', async (_event, { printerName, html }) => {
  return imprimirViaDriver(printerName, html);
});

// ─── IPC: Listar impressoras instaladas no Windows ───────────────────────────
ipcMain.handle('listar-impressoras', async () => {
  try {
    const impressoras = await mainWindow.webContents.getPrintersAsync();
    return impressoras.map(p => ({ nome: p.name, padrao: p.isDefault }));
  } catch {
    return [];
  }
});

// ─── IPC: Buscar impressoras (Padrão Web/React) ──────────────────────────────
ipcMain.handle('get-printers', async (event) => {
  try {
    return await event.sender.getPrintersAsync();
  } catch (error) {
    console.error("Erro ao buscar impressoras:", error);
    return [];
  }
});
