import { useEffect, useState } from "react";

import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_TINT,
  RAIL_ALIGN,
  RAIL_FRAME,
  RAIL_IMAGE_WIDTH,
} from "../closet/railScale";
import type { ItemCategory } from "../closet/types";
import { useClosetStore } from "../closet/useClosetStore";
import { defaultItemName } from "./naming";
import { isUploadError } from "./pipeline/errors";
import {
  normalizeUpload,
  type NormalizeResult,
} from "./pipeline/normalizeUpload";
import type { RemovalProgress } from "./pipeline/removalProtocol";
import type { TopSubtype, UploadRecord } from "./types";

/** Decision 10: iOS converts HEIC to JPEG on upload, so no special handling is needed. */
const ACCEPTED = "image/png, image/jpeg, image/webp";

const SUBTYPES: { value: TopSubtype; label: string; hint: string }[] = [
  { value: "shirt", label: "Shirt", hint: "Sized to fill the frame" },
  { value: "sweater", label: "Sweater", hint: "Sized to fill the frame" },
  { value: "tank", label: "Tank", hint: "Sized narrower, like a vest" },
];

const PRIMARY_PILL =
  "btn-painterly bg-accent text-paper font-body cursor-pointer rounded-full px-6 py-2.5 " +
  "text-sm font-medium shadow-sm transition hover:bg-accent/90 active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const QUIET_BUTTON =
  "font-body text-ink/50 hover:bg-wash/60 hover:text-accent cursor-pointer " +
  "rounded-full px-4 py-1.5 text-sm transition";

function choiceClass(selected: boolean): string {
  return `font-body cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm transition ${
    selected
      ? "bg-wash text-accent border-accent/40"
      : "border-ink/10 text-ink/70 hover:bg-wash/50 hover:text-accent"
  }`;
}

type Step = "pick" | "category" | "subtype" | "preview";

interface Preview {
  url: string;
  result: NormalizeResult;
}

const MB = 1024 * 1024;

/**
 * Only ever shown for an opaque photo, and only while the cutout is being made. The first
 * one has to fetch ~45 MB of model, which is worth saying plainly rather than leaving a
 * phone on cellular to wonder — and worth saying that it is the only time.
 */
function RemovalNotice({ progress }: { progress: RemovalProgress }) {
  if (progress.stage === "running") {
    return (
      <p className="font-body text-ink/55 text-sm">
        Cutting the background out — this takes a few seconds.
      </p>
    );
  }

  const fraction = progress.total > 0 ? progress.loaded / progress.total : 0;

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="font-body text-ink/70 text-sm">
        Setting up background removal — a one-time download of about 45 MB. It
        is kept for next time, so this only happens once.
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="bg-wash h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full rounded-full transition-[width]"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      <p className="font-body text-ink/45 text-xs">
        {(progress.loaded / MB).toFixed(0)} of{" "}
        {(progress.total / MB).toFixed(0)} MB
      </p>
    </div>
  );
}

/**
 * Pick → category → (subtype, tops only) → preview → name → save (Decision 4). On-page
 * rather than in a popover: the anchored-popover pattern is far too cramped for a flow
 * that has to show the normalized garment at real rail scale.
 */
export function UploadFlow({ onDone }: { onDone: () => void }) {
  const addUpload = useClosetStore((state) => state.addUpload);

  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [subtype, setSubtype] = useState<TopSubtype>("shirt");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<RemovalProgress | null>(null);

  // One object URL per preview, revoked when it is replaced or the flow closes. The saved
  // item gets its own URL from toClosetItem, so this never outlives the preview.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function normalize(
    chosen: ItemCategory,
    chosenSubtype: TopSubtype,
    fullLength?: boolean,
  ) {
    if (!file) return;

    setBusy(true);
    setError(null);
    setRemoval(null);
    try {
      const result = await normalizeUpload(file, {
        category: chosen,
        subtype: chosen === "tops" ? chosenSubtype : undefined,
        fullLength,
        // Lazily imported, and only actually called for an opaque photo — a pre-cut PNG
        // never even fetches this chunk, let alone the model (Decision 3).
        removeBackground: async (bitmap) => {
          const { removeBackground } =
            await import("./pipeline/backgroundRemoval");
          return removeBackground(bitmap, setRemoval);
        },
      });
      setPreview({ url: URL.createObjectURL(result.blob), result });
      setName(
        defaultItemName(
          chosen,
          chosen === "tops" ? chosenSubtype : undefined,
          new Date(),
        ),
      );
      setStep("preview");
    } catch (caught) {
      setError(
        isUploadError(caught)
          ? caught.message
          : "Something went wrong preparing that image.",
      );
      // Stay on the step that produced the error rather than stranding a blank preview.
      setStep(chosen === "tops" ? "subtype" : "category");
    } finally {
      setBusy(false);
      setRemoval(null);
    }
  }

  function handleFile(chosen: File | undefined) {
    if (!chosen) return;
    setFile(chosen);
    setPreview(null);
    setError(null);
    setStep("category");
  }

  function handleCategory(chosen: ItemCategory) {
    setCategory(chosen);
    if (chosen === "tops") {
      setStep("subtype");
      return;
    }
    void normalize(chosen, subtype);
  }

  function handleSubtype(chosen: TopSubtype) {
    setSubtype(chosen);
    void normalize("tops", chosen);
  }

  /** The bottoms escape hatch (Decision 6): re-normalize onto the other canvas. */
  function toggleFullLength() {
    if (!category || !preview) return;
    void normalize(category, subtype, !preview.result.fullLength);
  }

  async function handleSave() {
    if (!category || !preview) return;

    setBusy(true);
    setError(null);
    try {
      const record: UploadRecord = {
        id: crypto.randomUUID(),
        name:
          name.trim() ||
          defaultItemName(
            category,
            category === "tops" ? subtype : undefined,
            new Date(),
          ),
        category,
        createdAt: new Date().toISOString(),
        image: preview.result.blob,
        width: preview.result.width,
        height: preview.result.height,
        ...(category === "tops" ? { subtype } : {}),
      };

      await addUpload(record);
      onDone();
    } catch {
      setError(
        "That item could not be saved — this browser's storage may be full.",
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Add an item"
      className="border-ink/10 bg-paper animate-pop-in flex flex-col gap-5 rounded-2xl border p-5 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-ink text-xl">Add an item</h2>
        <button type="button" onClick={onDone} className={QUIET_BUTTON}>
          Cancel
        </button>
      </header>

      {error && (
        <p role="alert" className="font-body text-accent text-sm">
          {error}
        </p>
      )}

      {step === "pick" && (
        <div className="flex flex-col gap-2">
          <label
            className="font-body text-ink/70 text-sm"
            htmlFor="upload-file"
          >
            Choose a photo
          </label>
          <input
            id="upload-file"
            type="file"
            accept={ACCEPTED}
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="font-body text-ink/70 file:border-accent/40 file:text-accent file:font-body hover:file:bg-wash/60 cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border file:bg-transparent file:px-4 file:py-1.5 file:text-sm file:transition"
          />
          <p className="font-body text-ink/45 text-xs">
            A photo with the background already cut out stays exactly as it is.
            Anything else gets cut out for you.
          </p>
        </div>
      )}

      {step === "category" && (
        <div className="flex flex-col gap-3">
          <p className="font-body text-ink/70 text-sm">
            What kind of item is it?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => handleCategory(option)}
                className={`${choiceClass(category === option)} flex items-center gap-2`}
              >
                <span
                  aria-hidden="true"
                  className={`watercolor-dot h-2 w-2 shrink-0 ${CATEGORY_TINT[option]}`}
                />
                {CATEGORY_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "subtype" && (
        <div className="flex flex-col gap-3">
          <p className="font-body text-ink/70 text-sm">
            Which kind of top? This sets how big it hangs on the rail.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SUBTYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => handleSubtype(option.value)}
                className={choiceClass(subtype === option.value)}
              >
                <span className="block">{option.label}</span>
                <span className="text-ink/45 block text-xs">{option.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep("category")}
            className={`${QUIET_BUTTON} self-start`}
          >
            Back
          </button>
        </div>
      )}

      {busy && step !== "preview" && !removal && (
        <p className="font-body text-ink/55 text-sm">Preparing the cutout…</p>
      )}

      {removal && <RemovalNotice progress={removal} />}

      {step === "preview" && category && preview && (
        <div className="flex flex-col gap-4">
          <p className="font-body text-ink/70 text-sm">
            This is exactly how it will hang on the rail.
          </p>

          {/* Real rail scale, on bg-paper, using the very constants the rails use. */}
          <div
            className={`bg-paper flex w-full justify-center ${RAIL_FRAME[category]} ${
              RAIL_ALIGN[category] === "top" ? "items-start" : "items-center"
            }`}
          >
            <img
              src={preview.url}
              alt="Normalized preview"
              className={`max-h-full object-contain ${RAIL_IMAGE_WIDTH[category]}`}
            />
          </div>

          {category === "bottoms" && (
            <button
              type="button"
              disabled={busy}
              onClick={toggleFullLength}
              className={`${QUIET_BUTTON} self-center`}
            >
              {preview.result.fullLength
                ? "Not full length — resize as shorts or a skirt"
                : "Actually full length — resize as trousers"}
            </button>
          )}

          <div className="flex flex-col gap-2">
            <label
              className="font-body text-ink/70 text-sm"
              htmlFor="upload-name"
            >
              Name it
            </label>
            <input
              id="upload-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="border-ink/15 font-body text-ink focus:border-accent rounded-full border bg-white px-4 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setStep(category === "tops" ? "subtype" : "category")
              }
              className={QUIET_BUTTON}
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className={PRIMARY_PILL}
            >
              {busy ? "Saving…" : "Add to closet"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
