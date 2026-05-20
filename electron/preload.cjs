const { contextBridge, ipcRenderer } = require('electron');

// Expõe para o React apenas o que é necessário, de forma segura
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Imprime silenciosamente na impressora especificada
  imprimir: (printerName, html) =>
    ipcRenderer.invoke('imprimir-ticket', { printerName, html }),

  // Retorna lista de impressoras instaladas no Windows
  listarImpressoras: () =>
    ipcRenderer.invoke('listar-impressoras'),
});
