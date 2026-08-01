import { useRef, useState } from "react";

import { Aura } from "../../components/Aura";
import { CategoryShape } from "../../components/CategoryShape";
import { ConfirmDelete } from "../../components/ConfirmDelete";
import { Ribbon } from "../../components/Ribbon";
import { RunningStitch } from "../../components/RunningStitch";
import { useDismiss } from "../../components/useDismiss";
import { useOutfitsStore } from "../outfits/useOutfitsStore";
import { outfitUsesItem } from "../shuffle/outfit";
import { exportBackup, importBackup } from "../uploads/backupFile";
import { UploadFlow } from "../uploads/UploadFlow";
import { useCloset } from "./closet";
import { CATEGORIES, CATEGORY_LABEL } from "./railScale";
import type { ClosetItem } from "./types";
import { useClosetStore } from "./useClosetStore";

const PRIMARY_PILL =
  "btn-painterly bg-accent text-paper font-body cursor-pointer rounded-full px-6 py-2.5 " +
  "text-sm font-medium shadow-sm transition hover:bg-accent/90 active:scale-[0.98]";

const QUIET_PILL =
  "border-ink/15 text-ink/60 font-body cursor-pointer rounded-full border px-4 py-1.5 " +
  "text-xs transition hover:bg-wash/60 hover:text-accent active:scale-[0.98] " +
  "disabled:cursor-default disabled:opacity-50";

interface TileProps {
  item: ClosetItem;
  confirming: boolean;
  onDelete: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
}

/** Every item in the closet was uploaded, so every tile is renameable and deletable. */
function Tile({
  item,
  confirming,
  onDelete,
  onRequestConfirm,
  onCancelConfirm,
}: TileProps) {
  const renameUpload = useClosetStore((state) => state.renameUpload);
  const saved = useOutfitsStore((state) => state.saved);
  const tileRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(item.name);
  const [leaving, setLeaving] = useState(false);
  // See OutfitCard: keeps the layer mounted just long enough to fade out.
  const [closing, setClosing] = useState(false);

  // This delete is irreversible — the blob goes and the object URL is revoked — so the
  // confirmation says what it will cost (Decision 4). Subscribing every tile to `saved` is free
  // in practice: an outfit cannot be saved from this page, so the list never changes under it.
  const wornIn = saved.filter((entry) =>
    outfitUsesItem(entry.outfit, item.id),
  ).length;

  const cancel = () => {
    onCancelConfirm();
    setClosing(true);
    triggerRef.current?.focus();
  };

  // Same reasoning as OutfitCard: the region is the whole tile so the × can toggle, and
  // dismissal switches off once the delete is committed.
  useDismiss(tileRef, confirming && !leaving ? cancel : null);

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (leaving) onDelete();
  };

  return (
    <div
      ref={tileRef}
      onAnimationEnd={handleAnimationEnd}
      className={`group border-ink/10 paper-card relative flex flex-col rounded-2xl border bg-white p-2 shadow-sm transition ${
        leaving ? "animate-card-leave" : ""
      }`}
    >
      {/* Ghost delete, mirroring OutfitCard.tsx:103-110: hidden until hover on a
          mouse-driven desktop, always visible on a touch screen where there is no hover.
          While confirming it becomes the close button — it is painted above the confirm
          layer, so leaving it inert would read as broken. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={confirming ? cancel : onRequestConfirm}
        aria-label={`Delete ${item.name}`}
        aria-expanded={confirming}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-1 right-1 z-10 h-6 w-6 cursor-pointer rounded-full text-base leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
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

      {/* The rename field keeps its own Escape handler, so it is pulled out of the tab order
          while confirming rather than disabled: the two Escapes must never both be live, and a
          disabled input would grey out visibly through the ghosted tile. */}
      <input
        value={draft}
        aria-label={`Rename ${item.name}`}
        tabIndex={confirming ? -1 : undefined}
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

      {/* The short question throughout: tiles run ~110px on a phone at grid-cols-3 up to ~160px
          at lg:grid-cols-6, and "remove this from the closet?" wraps to three lines even at the
          wide end. The full wording stays in the decisions doc for any roomier surface. */}
      {(confirming || closing) && (
        <ConfirmDelete
          compact
          question="remove?"
          closing={!confirming}
          onClosed={() => setClosing(false)}
          note={
            wornIn > 0
              ? `worn in ${wornIn} ${wornIn === 1 ? "outfit" : "outfits"}`
              : undefined
          }
          confirmLabel="remove"
          onConfirm={() => setLeaving(true)}
          onCancel={cancel}
        />
      )}
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
      if (result.plansAdded > 0)
        parts.push(
          `${result.plansAdded} planned ${result.plansAdded === 1 ? "day" : "days"}`,
        );
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
  const removeUpload = useClosetStore((state) => state.removeUpload);
  const [adding, setAdding] = useState(false);
  // A single id here covers all six category sections, so one-at-a-time holds across
  // categories, not just within one.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const total = Object.values(closet).flat().length;

  // Fire-and-forget as before: the store persists first, then mirrors, so a rejected delete
  // leaves the closet untouched.
  const handleDelete = (id: string) => {
    void removeUpload(id);
    setConfirmingId(null);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* The page's longest scroll would otherwise open cold, on bare paper, while everything
          below it carried colour (page-auras Decision 10). */}
      <header className="relative flex flex-col items-center gap-4 text-center">
        <Aura variant="pool" />
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          the closet
        </h1>
        {/* The header's gap-4 is generous for a trim, so the ribbon pulls up under the
            title rather than floating midway to the count. */}
        <Ribbon variant="gingham" className="-mt-2 h-6 w-44 sm:h-7 sm:w-52" />
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
          <section key={category} className="relative flex flex-col gap-3">
            {/* Anchored to the section, so the pool travels with it — a pool that identifies
                the tops section has to move with the tops. An empty section is short and gets
                a small pool for free (Decision 11). */}
            <Aura variant="pool" category={category} />

            <div className="flex items-center gap-2">
              <CategoryShape category={category} />
              <h2 className="font-body text-ink/45 text-[11px] tracking-[0.18em] uppercase">
                {CATEGORY_LABEL[category]}
              </h2>
              <RunningStitch />
            </div>

            {items.length === 0 ? (
              <p className="font-body text-ink/45 py-4 text-sm italic">
                Nothing here yet! Add one to get started.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    confirming={confirmingId === item.id}
                    onDelete={() => handleDelete(item.id)}
                    onRequestConfirm={() => setConfirmingId(item.id)}
                    onCancelConfirm={() => setConfirmingId(null)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
