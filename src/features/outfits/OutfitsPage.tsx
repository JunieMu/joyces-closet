import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Aura } from "../../components/Aura";
import { Ribbon } from "../../components/Ribbon";
import { getCloset } from "../closet/closet";
import { repairOutfit } from "../shuffle/outfit";
import { useShuffleStore } from "../shuffle/useShuffleStore";
import { OutfitCard } from "./OutfitCard";
import type { SavedOutfit } from "./store";
import { useOutfitsStore } from "./useOutfitsStore";

export function OutfitsPage() {
  const navigate = useNavigate();
  const saved = useOutfitsStore((state) => state.saved);
  const deleteOutfit = useOutfitsStore((state) => state.deleteOutfit);
  const loadOutfit = useShuffleStore((state) => state.loadOutfit);
  // One id means the one-at-a-time rule (Decision 6) falls out for free. The handover across
  // cards works because useDismiss listens on pointerdown: card A's dismissal nulls the id,
  // THEN card B's click sets it to B.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const newestFirst = [...saved].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const handleLoad = (outfit: SavedOutfit) => {
    // Items removed from the closet since this was saved are skipped, not crashed on.
    const wearable = repairOutfit(outfit.outfit, getCloset());
    if (!wearable) return;

    loadOutfit(wearable);
    void navigate("/");
  };

  // The confirmation now lives on the card (2026-07-30 Decision 3), so this just deletes.
  const handleDelete = (outfit: SavedOutfit) => {
    deleteOutfit(outfit.id);
    setConfirmingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Fixed to the viewport, so scrolling a long grid pans across it (page-auras
          Decision 9). Absolutely positioned, so it is not a flex item and adds no gap. */}
      <Aura variant="gallery" />

      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          saved outfits
        </h1>
        <Ribbon variant="stripe" className="h-6 w-44 sm:h-7 sm:w-52" />
      </header>

      {newestFirst.length === 0 ? (
        <div className="font-body text-ink/60 flex flex-col items-center gap-3 py-10 text-center">
          <p>nothing saved yet.</p>
          <Link
            to="/"
            className="border-accent/40 text-accent hover:bg-wash/60 rounded-full border px-6 py-2 transition-colors"
          >
            put an outfit together
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {newestFirst.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              saved={outfit}
              confirming={confirmingId === outfit.id}
              onLoad={() => handleLoad(outfit)}
              onDelete={() => handleDelete(outfit)}
              onRequestConfirm={() => setConfirmingId(outfit.id)}
              onCancelConfirm={() => setConfirmingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
