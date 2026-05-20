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

// ─── IPC: Imprimir ticket silenciosamente ────────────────────────────────────
ipcMain.handle('imprimir-ticket', async (_event, { printerName, html }) => {
  return new Promise((resolve, reject) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true },
    });

    printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    printWin.webContents.once('did-finish-load', () => {
      // Pequeno delay para garantir que o CSS foi aplicado
      setTimeout(() => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName,
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
