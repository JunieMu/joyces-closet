import { UploadError } from "./errors";
import type {
  RemovalProgress,
  RemovalRequest,
  RemovalResponse,
} from "./removalProtocol";

/**
 * The main-thread half of background removal. The worker — and with it Transformers.js and
 * onnxruntime — lives in its own chunk that is only fetched the first time an opaque photo
 * is uploaded, so a Joyce who only ever uploads pre-cut PNGs never downloads any of it
 * (Decision 3).
 */

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  // `new URL(..., import.meta.url)` is what makes Vite emit the worker as its own chunk.
  worker ??= new Worker(new URL("./removal.worker.ts", import.meta.url), {
    type: "module",
    name: "background-removal",
  });
  return worker;
}

function toImageData(bitmap: ImageBitmap): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");
  if (!context)
    throw new UploadError("removal-failed", "This browser has no 2D canvas.");

  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

export function removeBackground(
  bitmap: ImageBitmap,
  onProgress?: (progress: RemovalProgress) => void,
): Promise<ImageBitmap> {
  const { data, width, height } = toImageData(bitmap);
  const id = nextId++;

  // The copy is deliberate: the buffer is transferred to the worker, and detaching the
  // canvas's own ImageData would be a surprise to the caller.
  const pixels = Uint8ClampedArray.from(data).buffer;
  const request: RemovalRequest = { id, pixels, width, height };
  const active = getWorker();

  return new Promise<ImageBitmap>((resolve, reject) => {
    const onMessage = (event: MessageEvent<RemovalResponse>) => {
      const message = event.data;
      if (message.id !== id) return;

      switch (message.type) {
        case "progress":
          onProgress?.({
            stage: "downloading",
            loaded: message.loaded,
            total: message.total,
          });
          return;

        case "stage":
          onProgress?.({ stage: message.stage, loaded: 0, total: 0 });
          return;

        case "done":
          active.removeEventListener("message", onMessage);
          active.removeEventListener("error", onError);
          createImageBitmap(
            new ImageData(
              new Uint8ClampedArray(message.pixels),
              message.width,
              message.height,
            ),
          ).then(resolve, reject);
          return;

        case "error":
          active.removeEventListener("message", onMessage);
          active.removeEventListener("error", onError);
          reject(new UploadError("removal-failed", message.message));
      }
    };

    // Fires when the worker itself fails to load — offline on the very first opaque
    // upload, most often. Without this the promise would simply never settle.
    const onError = () => {
      active.removeEventListener("message", onMessage);
      active.removeEventListener("error", onError);
      reject(
        new UploadError(
          "removal-failed",
          "Background removal could not start. Check your connection, or upload a PNG that already has its background removed.",
        ),
      );
    };

    active.addEventListener("message", onMessage);
    active.addEventListener("error", onError);
    active.postMessage(request, [pixels]);
  });
}
