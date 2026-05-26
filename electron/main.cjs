const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

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

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Helpers ESC/POS ─────────────────────────────────────────────────────────
function buildEscPosTicket({ items, destLabel, identificador, lancadoPor }) {
  const buf = [];
  const b  = (...bytes) => buf.push(Buffer.from(bytes));
  const t  = (s)        => buf.push(Buffer.from(String(s), 'utf8'));
  const nl = ()         => buf.push(Buffer.from([0x0a]));
  const SEP = '-'.repeat(40);

  b(0x1b, 0x40);               // ESC @ — inicializa
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
  t(SEP); nl();
  b(0x1b, 0x45, 0x01); t('Qtd  Descricao'); b(0x1b, 0x45, 0x00); nl();
  t(SEP); nl();

  for (const item of (items || [])) {
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

function buildEscPosRecibo({ itens, identificador, clienteNome, subtotal, desconto, total, cupom, timestamp }) {
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
  return new Promise((resolve, reject) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true },
    });
    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    printWin.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        printWin.webContents.print(
          { silent: true, printBackground: true, deviceName: printerName },
          (success, errorType) => {
            printWin.destroy();
            if (success) resolve({ ok: true });
            else reject(new Error(errorType || 'Erro ao imprimir'));
          }
        );
      }, 300);
    });
  });
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
