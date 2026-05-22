/**
 * Baixa os pesos do face-api.js para public/weights/
 * Execute: node scripts/download-models.cjs
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const DEST = path.join(__dirname, '..', 'public', 'weights');

const FILES = [
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_recognition_model-weights_manifest.json',
];

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

const MIN_SIZES = {
  'tiny_face_detector_model-shard1': 100_000,
  'face_landmark_68_model-shard1': 100_000,
  'face_recognition_model-shard1': 1_000_000,
  'face_recognition_model-shard2': 1_000_000,
};

function download(file) {
  return new Promise((resolve, reject) => {
    const dest = path.join(DEST, file);
    const minSize = MIN_SIZES[file] || 100;
    if (fs.existsSync(dest) && fs.statSync(dest).size >= minSize) {
      console.log(`  já existe: ${file}`); return resolve();
    }
    const out = fs.createWriteStream(dest);
    const url = `${BASE}/${file}`;
    console.log(`  baixando: ${file}`);
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} - ${file}`));
      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

(async () => {
  console.log('Baixando modelos face-api.js para public/weights/ ...');
  for (const f of FILES) await download(f);
  console.log('Concluído! Modelos disponíveis em public/weights/');
})();
