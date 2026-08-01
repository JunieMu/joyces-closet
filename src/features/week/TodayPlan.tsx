import { getCloset } from "../closet/closet";
import { useSavedOutfit } from "../outfits/useOutfitsStore";
import { repairOutfit } from "../shuffle/outfit";
import { useShuffleStore } from "../shuffle/useShuffleStore";
import { planFor } from "./plan";
import { usePlanStore } from "./usePlanStore";

/**
 * Today's plan handed back on the day (2026-07-31 week-planning Decision 2): one line, one
 * tap. Renders nothing when nothing is planned, or when today is deliberately skipped — the
 * strip only earns its place when it has something to say.
 *
 * Nothing auto-loads. "wear this" goes through repairOutfit before loadOutfit, exactly as
 * OutfitsPage.handleLoad does (OutfitsPage.tsx:26-33), so a shuffle already in progress is
 * never stomped unasked and an outfit missing a since-deleted item still loads, minus it.
 */
export function TodayPlan() {
  const entries = usePlanStore((state) => state.entries);
  const loadOutfit = useShuffleStore((state) => state.loadOutfit);

  const resolution = planFor(new Date(), entries);
  const outfitId = resolution.source === "none" ? null : resolution.outfitId;
  const saved = useSavedOutfit(outfitId);

  if (outfitId === null) return null;

  // Same register as the week rows (Decision 7): the plan is never repaired, so the day says
  // what became of it rather than quietly looking unplanned.
  if (!saved)
    return (
      <p className="font-body text-accent/70 mt-2 text-xs italic">
        that outfit is gone
      </p>
    );

  const handleWear = () => {
    const wearable = repairOutfit(saved.outfit, getCloset());
    if (!wearable) return;

    loadOutfit(wearable); // no navigate — this only ever renders on Today
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
      <p className="font-body text-ink/55 text-sm">
        planned: <span className="text-ink">{saved.name}</span>
      </p>
      <button
        type="button"
        onClick={handleWear}
        className="border-accent/40 text-accent hover:bg-wash/60 font-body cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors active:scale-[0.98]"
      >
        wear this
      </button>
    </div>
  );
}
