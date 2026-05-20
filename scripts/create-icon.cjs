const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, '../src/assets/logo.png');
const output = path.join(__dirname, '../src/assets/logo.ico');

import('png-to-ico').then(({ default: pngToIco }) => {
  return pngToIco(input);
}).then(buf => {
  fs.writeFileSync(output, buf);
  console.log('✓ logo.ico gerado com sucesso');
}).catch(err => {
  console.error('Erro ao converter ícone:', err.message);
  process.exit(1);
});
