import { useRef, useState } from "react";

import { exportBackup, importBackup } from "../uploads/backupFile";
import { UploadFlow } from "../uploads/UploadFlow";
import { useCloset } from "./closet";
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_TINT } from "./railScale";
import type { ClosetItem } from "./types";
import { useClosetStore } from "./useClosetStore";

const PRIMARY_PILL =
  "btn-painterly bg-accent text-paper font-body cursor-pointer rounded-full px-6 py-2.5 " +
  "text-sm font-medium shadow-sm transition hover:bg-accent/90 active:scale-[0.98]";

const QUIET_PILL =
  "border-ink/15 text-ink/60 font-body cursor-pointer rounded-full border px-4 py-1.5 " +
  "text-xs transition hover:bg-wash/60 hover:text-accent active:scale-[0.98] " +
  "disabled:cursor-default disabled:opacity-50";

/** Every item in the closet was uploaded, so every tile is renameable and deletable. */
function Tile({ item }: { item: ClosetItem }) {
  const removeUpload = useClosetStore((state) => state.removeUpload);
  const renameUpload = useClosetStore((state) => state.renameUpload);
  const [draft, setDraft] = useState(item.name);

  const handleDelete = () => {
    if (window.confirm(`Delete "${item.name}"?`)) void removeUpload(item.id);
  };

  return (
    <div className="group border-ink/10 paper-card relative flex flex-col rounded-2xl border bg-white p-2 shadow-sm transition">
      {/* Ghost delete, mirroring OutfitCard.tsx:103-110: hidden until hover on a
          mouse-driven desktop, always visible on a touch screen where there is no hover. */}
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete ${item.name}`}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-1 right-1 z-10 h-6 w-6 cursor-pointer rounded-full text-base leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>

      {/* Where the garment sits inside the frame is baked into the PNG canvas, not set here:
          bottoms are waist-anchored (constants.ts:66-71), so a wide pair of shorts leaves
          ~28% of its square empty underneath while a shirt fills 94%. The frame takes that
          slack — min-h-0 lets it give, and the label's mt-auto keeps every name on the card's
          bottom edge, so a row of tiles reads as one line of labels however short the item. */}
      <div className="flex aspect-square w-full grow items-center justify-center">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <input
        value={draft}
        aria-label={`Rename ${item.name}`}
        onChange={(event) => setDraft(event.target.value)}
        // Committed on blur or Enter rather than per keystroke, so renaming is one
        // IndexedDB write instead of one per letter. A name emptied to whitespace is
        // rejected by the store, so the field snaps back rather than showing blank.
        onBlur={() => {
          if (!draft.trim()) {
            setDraft(item.name);
            return;
          }
          setDraft(draft.trim());
          void renameUpload(item.id, draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(item.name);
            event.currentTarget.blur();
          }
        }}
        className="font-body text-ink focus:border-accent mt-auto w-full shrink-0 truncate rounded border border-transparent bg-transparent pt-1 text-xs outline-none"
      />
    </div>
  );
}

/**
 * The whole wardrobe, grouped by the six categories. Sub-grouping by top subtype is
 * deliberately not done — the subtype only ever sets the upload's size, it is not a way
 * Joyce thinks about her closet.
 */
/**
 * Uploads live only in this browser (Decision 2), so a backup file is the one way a closet
 * survives a cleared cache, a new phone, or moving the app to a different domain — each of
 * which is a different origin with its own empty IndexedDB.
 */
function BackupControls({ hasItems }: { hasItems: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const count = await exportBackup(new Date());
      setStatus(`Exported ${count} ${count === 1 ? "item" : "items"}.`);
    } catch {
      setStatus("Couldn't build the backup file.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared straight away so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setStatus(null);
    try {
      const result = await importBackup(file);
      const parts = [
        `Added ${result.itemsAdded} ${result.itemsAdded === 1 ? "item" : "items"}`,
      ];
      if (result.outfitsAdded > 0)
        parts.push(`${result.outfitsAdded} saved outfits`);
      if (result.itemsAlreadyPresent > 0)
        parts.push(`${result.itemsAlreadyPresent} already here`);
      if (result.skipped > 0) parts.push(`${result.skipped} unreadable`);
      setStatus(`${parts.join(", ")}.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Couldn't read that file.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy || !hasItems}
          className={QUIET_PILL}
        >
          export backup
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className={QUIET_PILL}
        >
          import backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void handleImport(event)}
        />
      </div>

      {status && (
        <p className="font-body text-ink/55 text-xs" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

export function ClosetPage() {
  const closet = useCloset();
  const [adding, setAdding] = useState(false);

  const total = Object.values(closet).flat().length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          the closet
        </h1>
        <p className="font-body text-ink/55 text-sm">
          {total === 0
            ? "Nothing in here yet"
            : `${total} ${total === 1 ? "item" : "items"}`}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={PRIMARY_PILL}
          >
            add an item
          </button>
        )}

        <BackupControls hasItems={total > 0} />
      </header>

      {adding && <UploadFlow onDone={() => setAdding(false)} />}

      {CATEGORIES.map((category) => {
        const items = closet[category];

        return (
          <section key={category} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`watercolor-dot h-2 w-2 ${CATEGORY_TINT[category]}`}
              />
              <h2 className="font-body text-ink/45 text-[11px] tracking-[0.18em] uppercase">
                {CATEGORY_LABEL[category]}
              </h2>
            </div>

            {items.length === 0 ? (
              <p className="font-body text-ink/45 py-4 text-sm italic">
                Nothing here yet — add one and it joins the shuffle straight
                away.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((item) => (
                  <Tile key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
