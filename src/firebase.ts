import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// O usuário forneceu a URL do banco de dados. 
// Em um cenário real, as chaves viriam do console do Firebase.
// Como não temos as chaves completas, usaremos um placeholder mas configuraremos a databaseURL.
const firebaseConfig = {
  apiKey: "AIzaSy...", // Placeholder, o usuário deve configurar no console se necessário
  authDomain: "arttburguer.firebaseapp.com",
  databaseURL: "https://arttburguer-default-rtdb.firebaseio.com/",
  projectId: "arttburguer",
  storageBucket: "arttburguer.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
