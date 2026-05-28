import { ref, get, update } from "firebase/database";
import { db } from "../src/firebase";

async function updateUnidadesStrict() {
  const insumosRef = ref(db, "insumos");
  const snapshot = await get(insumosRef);
  if (!snapshot.exists()) {
    console.log("No insumos found.");
    return;
  }

  const insumos = snapshot.val();
  const updates: Record<string, any> = {};
  let count = 0;

  for (const [id, insumo] of Object.entries(insumos)) {
    let unidade = (insumo as any).unidade;
    if (!unidade) continue;

    const lowerUnidade = unidade.trim().toLowerCase();
    let newUnidade = unidade;

    // Map to un
    if (['g', 'ml', 'un', 'unidade', 'unidades', 'unid', 'unid.', 'un.'].includes(lowerUnidade)) {
      newUnidade = 'un';
    }
    // Map to pct
    else if (['pct', 'pacote', 'pacotes', 'fd', 'fardo', 'pc'].includes(lowerUnidade)) {
      newUnidade = 'pct';
    }
    // Map to cx
    else if (['cx', 'caixa', 'caixas', 'kg', 'l', 'litro', 'litros'].includes(lowerUnidade)) {
      newUnidade = 'cx';
    }

    if (newUnidade !== unidade) {
      updates[`${id}/unidade`] = newUnidade;
      count++;
      console.log(`Updating ${id} (${(insumo as any).nome}): ${unidade} -> ${newUnidade}`);
    }
  }

  if (count > 0) {
    console.log(`Found ${count} insumos to update. Updating...`);
    await update(insumosRef, updates);
    console.log("Update completed.");
  } else {
    console.log("No insumos needed updating.");
  }
  process.exit(0);
}

updateUnidadesStrict().catch(console.error);