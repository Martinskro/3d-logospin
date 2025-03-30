import { Shape, Vector2 } from 'three';

let worker: Worker | null = null;

interface WorkerResponse {
  shapes: { x: number; y: number }[][];
}

export function createShapeFromMask(mask: ImageData): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    if (!worker) {
      worker = new Worker(new URL('../workers/shapeWorker.ts', import.meta.url));
    }

    worker.onmessage = (e) => {
      const response = e.data as WorkerResponse;
      resolve(response);
    };

    worker.postMessage({ mask });
  });
}