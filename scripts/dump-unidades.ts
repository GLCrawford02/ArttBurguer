import { ref, get } from "firebase/database";
import { db } from "../src/firebase";

async function dumpUnidades() {
  const insumosRef = ref(db, "insumos");
  const snapshot = await get(insumosRef);
  if (!snapshot.exists()) {
    console.log("No insumos found.");
    return;
  }

  const insumos = snapshot.val();
  const unidades = new Set();
  
  for (const insumo of Object.values(insumos)) {
    if ((insumo as any).unidade) {
      unidades.add((insumo as any).unidade);
    }
  }

  console.log("Unidades found:", Array.from(unidades));
  process.exit(0);
}

dumpUnidades().catch(console.error);