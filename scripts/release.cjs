const { execSync } = require('child_process');
const pkg = require('../package.json');

const version = process.argv[2] || pkg.version;
const step = { current: 0, total: 7 };

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

// ── 2. Build Electron (base: './') ──────────────────
run(
  `cross-env BUILD_TARGET=electron npx vite build`,
  { label: 'Build Electron (base: ./)' }
);
run(
  `npx electron-packager . ArttBurger --platform=win32 --arch=x64 --out=dist-electron --overwrite --electron-version=31.7.7 --icon=src/assets/logo.ico --ignore="(node_modules|\\.git|\\.claude|android|arttburger-bot|src|dist-electron)"`,
  { label: 'Empacotando .exe' }
);

// ── 3. Build Web/APK (base: '/') ────────────────────
run('npx vite build', { label: 'Build Web/APK (base: /)' });
run('npx cap sync',   { label: 'Capacitor sync' });

// ── 4. Git ──────────────────────────────────────────
run('git add .',                      { label: 'git add .' });
run(`git commit -m "V${version}"`,    { label: `git commit "V${version}"` });
run('git push',                       { label: 'git push' });

// ── 5. Abrir Android Studio ─────────────────────────
tryRun('npx cap open android', { label: 'Abrindo Android Studio' });

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ✅  Release V${version} concluído!`);
console.log(`  📁  .exe → dist-electron\\ArttBurger-win32-x64\\`);
console.log(`${'─'.repeat(50)}\n`);
