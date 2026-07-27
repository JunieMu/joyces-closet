import { useCloset, useClosetItem } from "../closet/closet";
import { isOutfitValid } from "../shuffle/outfit";
import type { SavedOutfit } from "./store";

interface OutfitCardProps {
  saved: SavedOutfit;
  onLoad: () => void;
  onDelete: () => void;
}

/** Scrapbook variety (user decision): each card keeps one tint, keyed off its id. */
const WASH_CLASSES = [
  "wash-tops",
  "wash-bottoms",
  "wash-dresses",
  "wash-jackets",
  "wash-shoes",
  "wash-accessories",
];

function washClass(id: string): string {
  let hash = 0;
  for (const char of id)
    hash = (hash + char.charCodeAt(0)) % WASH_CLASSES.length;
  return WASH_CLASSES[hash] ?? "wash-tops";
}

function Thumbnail({
  id,
  className,
}: {
  id: string | null;
  className: string;
}) {
  const item = useClosetItem(id);
  if (!item) return null;

  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      className={`absolute object-contain ${className}`}
    />
  );
}

/** A mini paper doll: jacket behind the top (or dress), bottom below, shoes at the foot. */
function Preview({ saved }: { saved: SavedOutfit }) {
  const { base, jacketId, shoesId, accessoryId } = saved.outfit;

  return (
    <div className="relative aspect-3/4 w-full">
      <Thumbnail
        id={jacketId}
        className="top-0 left-0 h-[46%] w-[58%] opacity-90"
      />

      {base.kind === "separates" ? (
        <>
          <Thumbnail
            id={base.topId}
            className="top-0 right-0 h-[46%] w-[58%]"
          />
          <Thumbnail
            id={base.bottomId}
            className="top-[42%] left-1/2 h-[40%] w-[64%] -translate-x-1/2"
          />
        </>
      ) : (
        <Thumbnail
          id={base.dressId}
          className="top-0 left-1/2 h-[76%] w-[70%] -translate-x-1/2"
        />
      )}

      <Thumbnail
        id={shoesId}
        className="bottom-0 left-1/2 h-[18%] w-[38%] -translate-x-1/2"
      />
      <Thumbnail
        id={accessoryId}
        className="right-0 bottom-0 h-[22%] w-[30%]"
      />
    </div>
  );
}

export function OutfitCard({ saved, onLoad, onDelete }: OutfitCardProps) {
  const closet = useCloset();
  const complete = isOutfitValid(saved.outfit, closet);
  const created = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={`group border-ink/10 paper-card card-wash ${washClass(saved.id)} relative rounded-2xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-painterly`}
    >
      {/* Ghost delete. Hidden until hover/focus on a mouse-driven desktop; on any touch screen
          (including a tablet past the md breakpoint) it stays visible — there is no hover there. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${saved.name}`}
        className="text-ink/35 hover:bg-wash/60 hover:text-accent absolute top-2 right-2 z-10 h-7 w-7 cursor-pointer rounded-full text-lg leading-none transition md:pointer-fine:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        ×
      </button>

      <button
        type="button"
        onClick={onLoad}
        className="block w-full cursor-pointer text-left"
        aria-label={`Wear ${saved.name}`}
      >
        <Preview saved={saved} />

        <p className="font-body text-ink mt-2 truncate text-sm font-medium">
          {saved.name}
        </p>
        <p className="font-body text-ink/45 text-xs">{created}</p>
        {!complete && (
          <p className="font-body text-accent/70 mt-1 text-xs italic">
            Some items are no longer in the closet
          </p>
        )}
      </button>
    </div>
  );
}
