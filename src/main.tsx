import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import DeliveryApp from './DeliveryApp.tsx';
import './index.css';

// Verifica se a pessoa acessou a URL do delivery
const isDelivery = window.location.pathname.startsWith('/delivery') || window.location.hash.startsWith('#delivery');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDelivery ? <DeliveryApp /> : <App />}
  </StrictMode>,
);
