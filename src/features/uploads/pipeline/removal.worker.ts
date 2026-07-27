import { AutoModel, AutoProcessor, RawImage } from "@huggingface/transformers";

import type { RemovalRequest, RemovalResponse } from "./removalProtocol";

/**
 * Background removal, off the main thread. Inference is multi-second on a phone, and the
 * upload flow has to stay responsive while it runs.
 *
 * briaai/RMBG-1.4 (Apache-2.0 library; the weights are Bria's non-commercial license,
 * which a personal closet app satisfies), quantized to ~44 MB. Transformers.js caches
 * every fetched file under the `transformers-cache` Cache API key, so the download really
 * does happen only once — which is the whole reason this engine was chosen over
 * @imgly/background-removal, whose CDN sends no cache-control at all.
 */
const MODEL_ID = "briaai/RMBG-1.4";

/** Minimal view of the worker global, so this file typechecks under the DOM lib. */
interface WorkerScope {
  postMessage(message: RemovalResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<RemovalRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

type ProgressEvent = {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
};
interface Loaded {
  model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
}

let loading: Promise<Loaded> | null = null;

function load(onProgress: (event: ProgressEvent) => void): Promise<Loaded> {
  // Model and processor are loaded once and reused for every later upload in this session.
  loading ??= Promise.all([
    // "q8" resolves to onnx/model_quantized.onnx — 44 MB rather than the 176 MB fp32.
    AutoModel.from_pretrained(MODEL_ID, {
      dtype: "q8",
      progress_callback: onProgress,
    }),
    AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: onProgress }),
  ])
    .then(([model, processor]) => ({ model, processor }))
    .catch((error: unknown) => {
      // A failed load is not cached, so going back online and retrying works.
      loading = null;
      throw error;
    });

  return loading;
}

async function cutOut(request: RemovalRequest): Promise<RawImage> {
  const { id, width, height } = request;
  const pixels = new Uint8ClampedArray(request.pixels);

  // Bytes are summed across every file the hub hands us, so the bar is determinate even
  // though the model arrives as several requests.
  const bytes = new Map<string, { loaded: number; total: number }>();
  const { model, processor } = await load((event) => {
    if (event.status !== "progress" || !event.file) return;
    bytes.set(event.file, {
      loaded: event.loaded ?? 0,
      total: event.total ?? 0,
    });

    let loaded = 0;
    let total = 0;
    for (const file of bytes.values()) {
      loaded += file.loaded;
      total += file.total;
    }
    ctx.postMessage({ type: "progress", id, loaded, total });
  });

  ctx.postMessage({ type: "stage", id, stage: "running" });

  const image = new RawImage(pixels, width, height, 4);

  // The processor resizes to 1024x1024 in place-ish; clone so the full-resolution pixels
  // survive to carry the mask.
  const { pixel_values } = await processor(image.clone());
  const outputs: Record<
    string,
    { mul(v: number): { to(t: string): unknown } }[]
  > = await model({ input: pixel_values });

  const tensor = outputs.output ?? Object.values(outputs)[0];
  if (!tensor?.[0]) throw new Error("The model returned no mask");

  // A single-channel mask at model resolution, stretched back over the original pixels.
  const mask = await RawImage.fromTensor(
    tensor[0].mul(255).to("uint8") as never,
  ).resize(width, height);

  return image.putAlpha(mask);
}

ctx.addEventListener("message", (event) => {
  const request = event.data;

  cutOut(request)
    .then((image) => {
      const pixels = Uint8ClampedArray.from(image.data).buffer;
      ctx.postMessage(
        {
          type: "done",
          id: request.id,
          pixels,
          width: image.width,
          height: image.height,
        },
        [pixels],
      );
    })
    .catch((error: unknown) => {
      ctx.postMessage({
        type: "error",
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
});
