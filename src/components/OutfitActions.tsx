import { useEffect, useState } from "react";

import { useCloset } from "../features/closet/closet";
import { defaultOutfitName } from "../features/outfits/naming";
import { useOutfitsStore } from "../features/outfits/useOutfitsStore";
import { useShuffleStore } from "../features/shuffle/useShuffleStore";
import { useCascade } from "./useCascade";

interface OutfitActionsProps {
  /**
   * "sidebar": stacked full-width buttons, popover floats right over the canvas.
   * "bar": horizontal row in the mobile bottom bar, popover rises above it.
   */
  variant: "sidebar" | "bar";
}

const PRIMARY_PILL =
  "btn-painterly bg-accent text-paper font-body cursor-pointer rounded-full px-6 py-2.5 " +
  "text-sm font-medium shadow-sm transition hover:bg-accent/90 active:scale-[0.98]";

const SECONDARY_PILL =
  "border-accent/40 text-accent font-body cursor-pointer rounded-full border " +
  "px-6 py-2.5 text-sm transition hover:bg-wash/60 active:scale-[0.98]";

/**
 * Shuffle All / Save Outfit / the dormant dress toggle. Lives in the desktop sidebar and the
 * mobile bottom bar, so the canvas stays purely the outfit (Decisions 4, 5 & 10).
 */
export function OutfitActions({ variant }: OutfitActionsProps) {
  // Subscribed, not read inline: this is what makes the dress toggle appear the moment
  // the first dress is uploaded, with no reload.
  const closet = useCloset();
  const outfit = useShuffleStore((state) => state.outfit);
  const shuffleAll = useShuffleStore((state) => state.shuffleAll);
  const setBaseKind = useShuffleStore((state) => state.setBaseKind);
  const saveOutfit = useOutfitsStore((state) => state.saveOutfit);
  const bump = useCascade((state) => state.bump);

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const openNaming = () => {
    setName(defaultOutfitName(new Date()));
    setNaming(true);
  };

  const handleSave = () => {
    if (outfit === null) return;
    saveOutfit(name, outfit);
    setNaming(false);
    setJustSaved(true);
  };

  // Nothing to shuffle or save until the closet can dress: the page itself is showing the
  // "add your first piece" prompt, so an empty sidebar and bottom bar are the right backdrop.
  if (outfit === null) return null;

  const { base } = outfit;
  const hasDresses = closet.dresses.length > 0;
  const isSidebar = variant === "sidebar";

  // Both variants are mounted at once (one is hidden per breakpoint), so the label needs
  // a target that stays unique in the document.
  const inputId = `outfit-name-${variant}`;

  const toggleClass = (selected: boolean) =>
    `font-body cursor-pointer rounded-full px-3 py-1 text-xs transition ${
      selected
        ? "bg-wash text-accent border-accent/40 border"
        : "text-ink/50 hover:bg-wash/60 hover:text-accent border border-transparent"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Dormant until the first dress is uploaded. */}
      {hasDresses && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBaseKind("separates")}
            className={toggleClass(base.kind === "separates")}
          >
            Top &amp; bottom
          </button>
          <button
            type="button"
            onClick={() => setBaseKind("dress")}
            className={toggleClass(base.kind === "dress")}
          >
            Dress
          </button>
        </div>
      )}

      <div className={isSidebar ? "flex flex-col gap-3" : "flex gap-3"}>
        <button
          type="button"
          onClick={() => {
            bump();
            shuffleAll();
          }}
          className={`${PRIMARY_PILL} ${isSidebar ? "w-full" : "flex-1"}`}
        >
          Shuffle All
        </button>

        <div className={`relative ${isSidebar ? "w-full" : "flex-1"}`}>
          <button
            type="button"
            onClick={openNaming}
            className={`${SECONDARY_PILL} w-full`}
          >
            {justSaved ? "Saved ✓" : "Save Outfit"}
          </button>

          {naming && (
            <form
              className={`border-ink/10 bg-paper animate-pop-in absolute z-20 flex flex-col gap-3 rounded-2xl border p-4 shadow-lg ${
                isSidebar
                  ? "top-0 left-full ml-4 w-72"
                  : "inset-x-0 bottom-full mb-3"
              }`}
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <label
                className="font-body text-ink/70 text-sm"
                htmlFor={inputId}
              >
                Name this outfit
              </label>
              <input
                id={inputId}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border-ink/15 font-body text-ink focus:border-accent rounded-full border bg-white px-4 py-2 text-sm outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNaming(false)}
                  className="font-body text-ink/50 hover:bg-wash/60 hover:text-accent cursor-pointer rounded-full px-4 py-1.5 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="border-accent/40 text-accent font-body hover:bg-wash/60 cursor-pointer rounded-full border px-5 py-1.5 text-sm transition"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
