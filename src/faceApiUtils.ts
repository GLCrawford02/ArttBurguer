import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';

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

export { faceapi };
