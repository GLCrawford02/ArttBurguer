const { execSync } = require('child_process');
const pkg = require('../package.json');
const fs = require('fs');

const version = process.argv[2] || pkg.version;
const step = { current: 0, total: 8 };

function run(cmd, opts = {}) {
  step.current++;
  console.log(`\n[${step.current}/${step.total}] ${opts.label || cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

function tryRun(cmd, opts = {}) {
  try { run(cmd, opts); }
  catch (e) { console.warn(`  ⚠ Ignorado: ${e.message.split('\n')[0]}`); }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`  🚀  Release  V${version}`);
console.log(`${'─'.repeat(50)}`);

// ── 1. Ícone ────────────────────────────────────────
run('node scripts/create-icon.cjs', { label: 'Gerando logo.ico' });

// ── 1.5. Limpeza e Preparação ───────────────────────
if (process.platform === 'win32') {
  tryRun('taskkill /f /im ArttBurger.exe /t', { label: 'Fechando ArttBurger.exe' });
  tryRun('taskkill /f /im electron.exe /t', { label: 'Fechando electron.exe (Modo Dev)' });
}
try {
  if (fs.existsSync('dist-electron')) {
    fs.rmSync('dist-electron', { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  }
} catch (e) {
  console.error(`\n❌ ERRO FATAL: A pasta 'dist-electron' está bloqueada pelo Windows.`);
  console.error(`\nMotivos comuns para esse bloqueio na pasta "Documents":`);
  console.error(`1. O OneDrive/Google Drive está fazendo backup da pasta (Pause a sincronização).`);
  console.error(`2. Você tem um terminal ou Explorador de Arquivos aberto dentro de dist-electron.`);
  console.error(`3. O Antivírus está verificando o arquivo no momento.`);
  console.error(`\nResolva o bloqueio (ou delete a pasta manualmente) e tente novamente.\n`);
  process.exit(1);
}

// ── 2. Build Electron (base: './') ──────────────────
run(
  `cross-env NODE_OPTIONS="--max-old-space-size=4096" BUILD_TARGET=electron npx vite build`,
  { label: 'Build Electron (base: ./)' }
);
run(
  `npx electron-packager . ArttBurger --platform=win32 --arch=x64 --out=dist-electron --overwrite --electron-version=31.7.7 --icon=src/assets/logo.ico --ignore="(node_modules|\\.git|\\.claude|android|arttburger-bot|src|dist-electron)" --ignore-locales=af,am,ar,bg,bn,ca,cs,da,de,el,en-GB,es,es-419,et,fa,fi,fil,fr,gu,he,hi,hr,hu,id,it,ja,kn,ko,lt,lv,ml,mr,ms,nb,nl,pl,pt-PT,ro,ru,sk,sl,sr,sv,sw,ta,te,th,tr,uk,ur,vi,zh-CN,zh-TW`,
  { label: 'Empacotando .exe' }
);

// ── 3. Build Web/APK (base: '/') ────────────────────
run('cross-env NODE_OPTIONS="--max-old-space-size=4096" npx vite build', { label: 'Build Web/APK (base: /)' });
run('npx cap sync',   { label: 'Capacitor sync' });

// ── 4. Git ──────────────────────────────────────────
run('git add .',                      { label: 'git add .' });
tryRun(`git commit -m "V${version}"`, { label: `git commit "V${version}"` });
tryRun('git push',                    { label: 'git push' });

// ── 5. Abrir Android Studio ─────────────────────────
tryRun('npx cap open android', { label: 'Abrindo Android Studio' });

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ✅  Release V${version} concluído!`);
console.log(`  📁  .exe → dist-electron\\ArttBurger-win32-x64\\`);
console.log(`${'─'.repeat(50)}\n`);
