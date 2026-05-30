import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo que está com problema
const filePath = path.join(__dirname, 'src', 'components', 'LancamentoVendas.tsx');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Faz a conversão dos textos "bugados" para a sintaxe original do React/TypeScript
  content = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Arquivo LancamentoVendas.tsx corrigido com sucesso!');
} else {
  console.log('❌ Arquivo não encontrado.');
}
