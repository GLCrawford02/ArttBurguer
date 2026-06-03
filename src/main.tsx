import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import DeliveryApp from './DeliveryApp.tsx';
import './index.css';
import { logError } from './utils/logger';

// Captura erros JS não tratados
window.addEventListener('error', (e) => {
  logError('Window', e.message, { file: e.filename, line: e.lineno, col: e.colno });
});

// Captura Promises rejeitadas sem catch
window.addEventListener('unhandledrejection', (e) => {
  logError('Promise', String(e.reason));
});

// Verifica se a pessoa acessou a URL do delivery
const isDelivery = window.location.pathname.startsWith('/delivery') || window.location.hash.startsWith('#delivery');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDelivery ? <DeliveryApp /> : <App />}
  </StrictMode>,
);
