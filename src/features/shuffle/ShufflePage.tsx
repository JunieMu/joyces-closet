import { Link } from "react-router";

import { Aura } from "../../components/Aura";
import { Rail } from "../../components/Rail";
import { Ribbon } from "../../components/Ribbon";
import { useCascade } from "../../components/useCascade";
import { useCloset } from "../closet/closet";
import { RAIL_FRAME, RAIL_IMAGE_WIDTH } from "../closet/railScale";
import { TodayPlan } from "../week/TodayPlan";
import { missingForOutfit, type MissingCategory } from "./shuffle";
import { useShuffleStore } from "./useShuffleStore";

/**
 * Rails enter top-to-bottom on Shuffle All, so the outfit cascades into place (Decision 11).
 *
 * The 70ms step is preserved exactly (2026-07-30 shuffle-rail-slide-animation Decision 3);
 * a sixth rail necessarily extends the ladder rather than renumbering it, so `bag` slots in
 * before `accessory` as a carried finishing touch and the last rail settles at 750ms.
 */
const CASCADE_MS = {
  top: 0,
  jacket: 70,
  bottom: 140,
  shoes: 210,
  bag: 280,
  accessory: 350,
};

const MISSING_LABEL: Record<MissingCategory, string> = {
  tops: "a top",
  bottoms: "a bottom",
  shoes: "a pair of shoes",
};

/** "a top", "a top and a bottom", "a top, a bottom and a pair of shoes". */
function listMissing(missing: MissingCategory[]): string {
  const labels = missing.map((category) => MISSING_LABEL[category]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * What the shuffle page is before anything has been uploaded — the state every closet now
 * starts in. It names the pieces still missing rather than just saying "empty", because a
 * closet full of tops with no shoes looks complete but still can't be shuffled.
 */
function NothingToWear({ missing }: { missing: MissingCategory[] }) {
  return (
    // Same `relative isolate` canvas as the shuffle page proper — this early return is why the
    // app's first screen had no aura at all (page-auras Decision 11). Unconditional: an aura
    // is a property of the page, not of its data.
    <div className="relative isolate flex flex-col items-center gap-5 py-20 text-center">
      <Aura variant="stage" />
      <h1 className="font-display text-ink text-3xl font-medium sm:text-4xl">
        your closet is waiting
      </h1>
      <p className="font-body text-ink/55 max-w-sm text-sm leading-relaxed">
        Add {listMissing(missing)} and the shuffle starts here. Photos get cut
        out and sized automatically.
      </p>
      <Link
        to="/closet"
        className="btn-painterly bg-accent text-paper font-body cursor-pointer rounded-full px-6 py-2.5 text-sm font-medium shadow-sm transition hover:bg-accent/90 active:scale-[0.98]"
      >
        add your first piece
      </Link>
    </div>
  );
}

export function ShufflePage() {
  const closet = useCloset();
  const outfit = useShuffleStore((state) => state.outfit);
  const shuffleSlot = useShuffleStore((state) => state.shuffleSlot);
  const setSlot = useShuffleStore((state) => state.setSlot);
  const tick = useCascade((state) => state.tick);

  if (outfit === null)
    return <NothingToWear missing={missingForOutfit(closet)} />;

  const { base } = outfit;

  return (
    <div className="flex flex-col items-center gap-10 pt-6">
      <header className="text-center">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          what am i wearing today?
        </h1>
        {/* The plaid ribbon with its lace trim — the hero of the ribbon family (Decision 3),
            and what replaced the filter-roughed paint stroke that pixelated on retina. */}
        <Ribbon
          variant="plaid"
          className="mx-auto mt-3 h-7 w-48 sm:h-8 sm:w-56"
        />
        <p className="font-body text-ink/55 mt-2 text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>

        {/* Never reached when the closet can't dress anyone — the early return above fires
            first — which is fine: repairOutfit would have nothing to build against anyway. */}
        <TodayPlan />
      </header>

      {/* `isolate` keeps the z-index:-1 aura inside this stacking context — behind the rails
          but above the page background. */}
      <div className="relative isolate w-full">
        {/* Re-blooms on Shuffle All: the tick remounts the aura, replaying aura-bloom. */}
        <Aura key={tick} variant="stage" />

        <div className="paper-doll w-full">
          {/* Distinct keys, so the flip tears the rail down instead of reusing the instance:
              a rail that appears has no predecessor to slide from, and rises in (Decision 2). */}
          {base.kind === "separates" ? (
            <div key="top" className="[grid-area:top]">
              <Rail
                label="Tops"
                items={closet.tops}
                activeId={base.topId}
                allowNone={false}
                onChange={(id) => setSlot("top", id)}
                onShuffle={() => shuffleSlot("top")}
                className={RAIL_FRAME.tops}
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.top}
                category="tops"
              />
            </div>
          ) : (
            // A dress fills the top and bottom slots at once, so the two rails merge into one.
            <div
              key="dress"
              className="[grid-area:top] md:[grid-row:top-start_/_bottom-end]"
            >
              <Rail
                label="Dresses"
                items={closet.dresses}
                activeId={base.dressId}
                allowNone={false}
                onChange={(id) => setSlot("dress", id)}
                onShuffle={() => shuffleSlot("base")}
                className={RAIL_FRAME.dresses}
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.top}
                category="dresses"
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
              emptyLabel="no jacket"
              onChange={(id) => setSlot("jacket", id)}
              onShuffle={() => shuffleSlot("jacket")}
              className={RAIL_FRAME.jackets}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.jacket}
              category="jackets"
            />
          </div>

          {/* Beneath the jacket, sharing its wide column: a bag is a hero object, not a
              trinket. Placed here in source order so the mobile reading order — jacket/top →
              bag → bottom → shoes/accessory — is also the tab order. */}
          <div className="[grid-area:bag] md:self-center">
            <Rail
              label="Bags"
              items={closet.bags}
              activeId={outfit.bagId}
              allowNone
              emptyLabel="no bag"
              onChange={(id) => setSlot("bag", id)}
              onShuffle={() => shuffleSlot("bag")}
              className={RAIL_FRAME.bags}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.bag}
              category="bags"
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
                className={RAIL_FRAME.bottoms}
                imageClassName={RAIL_IMAGE_WIDTH.bottoms}
                align="top"
                cascadeTick={tick}
                cascadeDelayMs={CASCADE_MS.bottom}
                category="bottoms"
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
              className={RAIL_FRAME.shoes}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.shoes}
              category="shoes"
            />
          </div>

          <div className="[grid-area:accessory] md:self-center">
            <Rail
              label="Accessories"
              items={closet.accessories}
              activeId={outfit.accessoryId}
              allowNone
              emptyLabel="no accessory"
              onChange={(id) => setSlot("accessory", id)}
              onShuffle={() => shuffleSlot("accessory")}
              className={RAIL_FRAME.accessories}
              cascadeTick={tick}
              cascadeDelayMs={CASCADE_MS.accessory}
              category="accessories"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
