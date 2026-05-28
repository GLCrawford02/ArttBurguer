import { ref, get, update } from "firebase/database";
import { db } from "../src/firebase";

async function updateUnidades() {
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
    let newUnidade = null;

    if (lowerUnidade === "unidade" || lowerUnidade === "unidades" || lowerUnidade === "unid" || lowerUnidade === "unid.") {
      newUnidade = "un";
    } else if (lowerUnidade === "caixa" || lowerUnidade === "caixas") {
      newUnidade = "cx";
    } else if (lowerUnidade === "pacote" || lowerUnidade === "pacotes" || lowerUnidade === "fd" || lowerUnidade === "pc") {
      newUnidade = "pct";
    }

    if (newUnidade && newUnidade !== unidade) {
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

updateUnidades().catch(console.error);
