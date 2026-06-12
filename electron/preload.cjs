const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Ticket cozinha/balcão — RAW ESC/POS via IP:9100
  imprimirTicketIP: (ip, itens, destLabel, identificador, lancadoPor, deliveryInfo) =>
    ipcRenderer.invoke('imprimir-ip-ticket', { ip, itens, destLabel, identificador, lancadoPor, deliveryInfo }),

  // Recibo do cliente — RAW ESC/POS via IP:9100
  imprimirReciboIP: (ip, payload) =>
    ipcRenderer.invoke('imprimir-ip-recibo', { ip, ...payload }),

  // Legado: impressão via driver Windows (mantido para fallback)
  imprimir: (printerName, html) =>
    ipcRenderer.invoke('imprimir-ticket', { printerName, html }),

  listarImpressoras: () =>
    ipcRenderer.invoke('listar-impressoras'),

  getPrinters: () =>
    ipcRenderer.invoke('get-printers'),
});
