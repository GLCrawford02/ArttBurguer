import * as faceapi from 'face-api.js';

// Modelos servidos localmente (public/weights/); CDN como fallback
const MODEL_LOCAL = '/weights';
const MODEL_CDN   = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let loadPromise: Promise<void> | null = null;

async function tryLoadFrom(url: string): Promise<void> {
  // Verifica se o arquivo local é válido antes de tentar carregar
  // (evita parsear página de erro 404 como binário de pesos)
  if (url === MODEL_LOCAL) {
    try {
      const res = await fetch(`${url}/tiny_face_detector_model-shard1`, { method: 'HEAD' });
      if (!res.ok || (res.headers.get('content-length') ?? '0') < '10000') {
        throw new Error('local_unavailable');
      }
    } catch {
      throw new Error('local_unavailable');
    }
  }
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(url),
    faceapi.nets.faceLandmark68Net.loadFromUri(url),
    faceapi.nets.faceRecognitionNet.loadFromUri(url),
  ]);
}

export async function ensureFaceModelsLoaded(): Promise<void> {
  if (faceapi.nets.tinyFaceDetector.isLoaded) return;
  if (!loadPromise) {
    loadPromise = tryLoadFrom(MODEL_LOCAL)
      .catch(() => {
        // Fallback para CDN se os arquivos locais não estiverem disponíveis
        faceapi.nets.tinyFaceDetector.dispose?.();
        faceapi.nets.faceLandmark68Net.dispose?.();
        faceapi.nets.faceRecognitionNet.dispose?.();
        return tryLoadFrom(MODEL_CDN);
      })
      .catch(err => {
        loadPromise = null; // Permite nova tentativa em vez de manter promise rejeitada
        throw err;
      });
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
