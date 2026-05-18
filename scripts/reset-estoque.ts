import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update } from 'firebase/database';

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
const db = getDatabase(app);

async function resetEstoque() {
  console.log('Lendo insumos no Firebase...');
  const snapshot = await get(ref(db, 'insumos'));

  if (!snapshot.exists()) {
    console.log('Nenhum insumo encontrado. Nada a fazer.');
    process.exit(0);
  }

  const insumos = snapshot.val() as Record<string, unknown>;
  const ids = Object.keys(insumos);

  console.log(`Encontrados ${ids.length} insumos. Aplicando reset...`);

  const updates: Record<string, unknown> = {};
  for (const id of ids) {
    updates[`insumos/${id}/estoqueRotativo`] = 0;
    updates[`insumos/${id}/estoqueEstacionario`] = 0;
    updates[`insumos/${id}/lotes`] = null; // null remove o nó no Firebase
  }

  await update(ref(db), updates);

  console.log('\nReset concluído com sucesso!');
  console.log(`  ${ids.length} insumos atualizados`);
  console.log('  estoqueRotativo  → 0');
  console.log('  estoqueEstacionario → 0');
  console.log('  lotes → removidos');
  console.log('\nAgora faça o Balanço no sistema para inserir as quantidades atuais.');

  process.exit(0);
}

resetEstoque().catch((err) => {
  console.error('Erro ao executar reset:', err);
  process.exit(1);
});
