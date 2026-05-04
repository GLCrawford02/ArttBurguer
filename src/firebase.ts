import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAtwIhdoooZ7AAzFdshRJzArVBKhqEhfFI",
  authDomain: "arttburgercvo.firebaseapp.com",
  databaseURL: "https://arttburgercvo-default-rtdb.firebaseio.com/",
  projectId: "arttburger",
  storageBucket: "arttburger.firebasestorage.app",
  messagingSenderId: "452751207382",
  appId: "1:452751207382:web:ccbfeac50f0fb4e6299277"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
