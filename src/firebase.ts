import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSy...", // Pode deixar assim por enquanto
  authDomain: "arttburguer.firebaseapp.com",
  databaseURL: "https://arttburguer-default-rtdb.firebaseio.com/",
  projectId: "arttburguer",
  storageBucket: "arttburguer.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
