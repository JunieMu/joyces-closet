import { Link, useNavigate } from "react-router";

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

  const handleDelete = (outfit: SavedOutfit) => {
    if (window.confirm(`Delete "${outfit.name}"?`)) deleteOutfit(outfit.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-ink text-center text-4xl font-medium sm:text-5xl">
        saved outfits
      </h1>

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
              onLoad={() => handleLoad(outfit)}
              onDelete={() => handleDelete(outfit)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
