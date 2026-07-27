import { Rail } from "../../components/Rail";
import { useCascade } from "../../components/useCascade";
import { getCloset } from "../closet/closet";
import { useShuffleStore } from "./useShuffleStore";

// Paper-doll proportions (Decision 6): tops and jackets render at equal scale, the small
// slots (shoes, accessories) stay smaller. The bottoms frame is tall enough for full-length
// pants; BOTTOM_IMAGE_WIDTH caps square art (shorts, skirts) at its old rendered size so
// only the tall pieces use the extra height (never wider than the frame itself).
const SIZE = {
  top: "h-52 sm:h-64",
  jacket: "h-52 sm:h-64",
  bottom: "h-80 sm:h-96",
  small: "h-28 sm:h-32",
};

const BOTTOM_IMAGE_WIDTH = "max-w-[min(12rem,100%)] sm:max-w-[min(15rem,100%)]";

/** Rails enter top-to-bottom on Shuffle All, so the outfit cascades into place (Decision 11). */
const CASCADE_MS = {
  top: 0,
  jacket: 70,
  bottom: 140,
  shoes: 210,
  accessory: 280,
};

export function ShufflePage() {
  const closet = getCloset();
  const outfit = useShuffleStore((state) => state.outfit);
  const shuffleSlot = useShuffleStore((state) => state.shuffleSlot);
  const setSlot = useShuffleStore((state) => state.setSlot);
  const tick = useCascade((state) => state.tick);

  const { base } = outfit;

  return (
    <div className="flex flex-col items-center gap-10 pt-6">
      <header className="text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          what am i wearing today?
        </h1>
        {/* Two overlapping strokes read as layered watercolor passes; the sketchy filter
            roughs the edges. Paints in the active theme's accent. */}
        <svg
          viewBox="0 0 220 12"
          aria-hidden="true"
          className="text-accent mx-auto mt-3 h-3 w-44 sm:w-52"
          style={{ filter: "url(#sketchy)" }}
        >
          <path
            d="M4 8 C 45 3, 120 2, 216 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M8 9.5 C 60 5.5, 140 4.5, 212 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
        <p className="font-body text-ink/55 mt-2 text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {/* `isolate` keeps the z-index:-1 aura inside this stacking context — behind the rails
          but above the page background. */}
      <div className="relative isolate w-full">
        {/* Re-blooms on Shuffle All: the tick remounts the aura, replaying aura-bloom. */}
        <div key={tick} className="aura" aria-hidden="true">
          <div className="aura-blob-1" />
          <div className="aura-blob-2" />
          <div className="aura-blob-3" />
        </div>

        <div className="paper-doll w-full">
          {base.kind === "separates" ? (
            <div className="[grid-area:top]">
              <Rail
                label="Tops"
                items={closet.tops}
                activeId={base.topId}
                allowNone={false}
                onChange={(id) => setSlot("top", id)}
                onShuffle={() => shuffleSlot("top")}
                className={SIZE.top}
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.top}
                tintClass="text-tint-tops"
              />
            </div>
          ) : (
            // A dress fills the top and bottom slots at once, so the two rails merge into one.
            <div className="[grid-area:top] md:[grid-row:top-start_/_bottom-end]">
              <Rail
                label="Dresses"
                items={closet.dresses}
                activeId={base.dressId}
                allowNone={false}
                onChange={(id) => setSlot("dress", id)}
                onShuffle={() => shuffleSlot("base")}
                className="h-80 sm:h-96"
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.top}
                tintClass="text-tint-dresses"
              />
            </div>
          )}

          {/* Flank rails centre on the top's midline, mirroring the shoes beside the bottoms. */}
          <div className="[grid-area:jacket] md:self-center">
            <Rail
              label="Jackets"
              items={closet.jackets}
              activeId={outfit.jacketId}
              allowNone
              onChange={(id) => setSlot("jacket", id)}
              onShuffle={() => shuffleSlot("jacket")}
              className={SIZE.jacket}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.jacket}
              tintClass="text-tint-jackets"
            />
          </div>

          {base.kind === "separates" && (
            <div className="[grid-area:bottom]">
              <Rail
                label="Bottoms"
                items={closet.bottoms}
                activeId={base.bottomId}
                allowNone={false}
                onChange={(id) => setSlot("bottom", id)}
                onShuffle={() => shuffleSlot("bottom")}
                className={SIZE.bottom}
                imageClassName={BOTTOM_IMAGE_WIDTH}
                align="top"
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.bottom}
                tintClass="text-tint-bottoms"
              />
            </div>
          )}

          {/* The grid baseline-aligns rows; centring the shoes sits them alongside the bottoms. */}
          <div className="[grid-area:shoes] md:self-center">
            <Rail
              label="Shoes"
              items={closet.shoes}
              activeId={outfit.shoesId}
              allowNone={false}
              onChange={(id) => setSlot("shoes", id)}
              onShuffle={() => shuffleSlot("shoes")}
              className={SIZE.small}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.shoes}
              tintClass="text-tint-shoes"
            />
          </div>

          <div className="[grid-area:accessory] md:self-center">
            <Rail
              label="Accessories"
              items={closet.accessories}
              activeId={outfit.accessoryId}
              allowNone
              onChange={(id) => setSlot("accessory", id)}
              onShuffle={() => shuffleSlot("accessory")}
              className={SIZE.small}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.accessory}
              tintClass="text-tint-accessories"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
