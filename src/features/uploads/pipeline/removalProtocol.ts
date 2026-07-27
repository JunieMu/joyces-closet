/** The worker message contract, in its own module so both sides share one definition and
 *  importing it never drags the 545 KB library onto the main thread. */

export interface RemovalRequest {
  id: number;
  pixels: ArrayBuffer; // RGBA, transferred
  width: number;
  height: number;
}

export type RemovalResponse =
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "stage"; id: number; stage: "running" }
  | {
      type: "done";
      id: number;
      pixels: ArrayBuffer;
      width: number;
      height: number;
    }
  | { type: "error"; id: number; message: string };

/** What the upload flow renders while a cutout is in flight. */
export type RemovalStage = "downloading" | "running";

export interface RemovalProgress {
  stage: RemovalStage;
  loaded: number; // bytes, only meaningful while downloading
  total: number;
}
