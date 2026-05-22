import * as faceapi from 'face-api.js';

// Modelos servidos localmente (public/weights/) — sem dependência de internet
const MODEL_URL = '/weights';

let loadPromise: Promise<void> | null = null;

export async function ensureFaceModelsLoaded(): Promise<void> {
  if (faceapi.nets.tinyFaceDetector.isLoaded) return;
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined);
  }
  await loadPromise;
}

/** Abre a câmera frontal com fallback automático para qualquer câmera disponível. */
export async function getCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('HTTPS_REQUIRED') as any;
    err.name = 'HttpsRequired';
    throw err;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  } catch (e: any) {
    // Se a câmera frontal falhou por constraint, tenta qualquer câmera disponível
    if (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError') {
      return await navigator.mediaDevices.getUserMedia({ video: true });
    }
    throw e;
  }
}

/** Retorna mensagem amigável para erros de câmera. */
export function getCameraErrorMsg(e: any): string {
  if (e?.name === 'HttpsRequired') return 'A câmera requer HTTPS. Acesse via https:// no navegador.';
  if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') return 'Permissão de câmera negada. Autorize nas configurações do navegador/app.';
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') return 'Nenhuma câmera encontrada neste dispositivo.';
  if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') return 'Câmera em uso por outro aplicativo. Feche-o e tente novamente.';
  return `Erro ao acessar câmera: ${e?.name ?? 'desconhecido'}.`;
}

export { faceapi };
