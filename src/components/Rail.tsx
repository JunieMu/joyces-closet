import { useRef, useState } from "react";

import type { ClosetItem, ItemCategory } from "../features/closet/types";
import { CategoryShape } from "./CategoryShape";

interface RailProps {
  label: string; // "Tops" — used for the shuffle button and screen readers
  items: ClosetItem[];
  activeId: string | null; // null = the "none" position
  allowNone: boolean; // jacket / accessory rails
  emptyLabel?: string; // copy for the "none" position — singular, since it names an outfit slot
  onChange: (id: string | null) => void;
  onShuffle: () => void; // per-slot shuffle
  className?: string; // per-slot sizing of the image frame
  imageClassName?: string; // width cap on the image itself, for rails mixing tall and square art
  align?: "center" | "top"; // "top" hangs the garment from the frame's top edge (waistline anchor)
  cascadeTick?: number; // bumped by Shuffle All — a change means this swap is part of the cascade
  cascadeDelayMs?: number; // this rail's place in the top-to-bottom cascade
  category?: ItemCategory; // fixed category shape beside the label (pure decoration)
}

/** How far a pointer has to travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 40;

const ARROW_CLASS =
  "border-ink/10 text-ink/40 hover:border-accent/40 hover:bg-wash/50 hover:text-accent " +
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border " +
  "text-xl leading-none transition select-none";

/**
 * Which keyframe pair a swap plays. The new item enters from the direction of travel: `›` and
 * a left swipe sweep forward (in from the right), `‹` and a right swipe sweep back. Every
 * programmatic swap — the ⇄ button, Shuffle All, a closet repair — sweeps forward (Decision 4).
 *
 * Spelled out rather than interpolated: Tailwind only generates utilities it can see in source.
 */
const SLIDE = {
  forward: {
    out: "animate-rail-slide-out-left",
    in: "animate-rail-slide-in-right",
  },
  back: {
    out: "animate-rail-slide-out-right",
    in: "animate-rail-slide-in-left",
  },
} as const;

/** What a frame shows. "None" is a real position on optional rails, not an absent item. */
function FrameBody({
  item,
  imageClassName,
  emptyLabel,
}: {
  item: ClosetItem | null;
  imageClassName: string;
  emptyLabel: string;
}) {
  if (item === null)
    // No frame around the empty position: an outlined box read as heavier than the garment it
    // stands in for, and its straight edges invited comparison to a true rectangle. The paper
    // holds the space instead.
    return (
      <div className="font-display text-ink/35 flex h-full w-full items-center justify-center text-sm italic">
        {emptyLabel}
      </div>
    );

  return (
    <img
      src={item.image}
      alt={item.name}
      draggable={false}
      className={`max-h-full object-contain select-none ${imageClassName}`}
    />
  );
}

/** One rendered pair of frames: the item entering, and (briefly) the one it replaced. */
interface Frame {
  key: string; // the frameKey this pair was built for; "" before the first mount
  tick: number;
  delay: number;
  n: number; // bumped per pair, so both frames remount and replay even on a same-item swap
  gestureSeq: number; // the gesture this pair consumed — a later swap must not reuse its direction
  dir: 1 | -1;
  slide: boolean; // false when there was no predecessor: the frame rises instead (Decision 2)
  item: ClosetItem | null; // what is on screen, kept so the next swap knows what to exchange out
  out: { item: ClosetItem | null } | null; // the outgoing frame, alive only while it animates
}

/** Two crossing arrows — the per-rail shuffle, as a quiet icon beside the rail label. */
function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M4 6h3.5l9 12H20" />
      <path d="M4 18h3.5l9-12H20" />
      <path d="m17 3 3 3-3 3" />
      <path d="m17 15 3 3-3 3" />
    </svg>
  );
}

export function Rail({
  label,
  items,
  activeId,
  allowNone,
  emptyLabel,
  onChange,
  onShuffle,
  className = "h-40",
  imageClassName = "max-w-full",
  align = "center",
  cascadeTick = 0,
  cascadeDelayMs = 0,
  category,
}: RailProps) {
  const swipeStartX = useRef<number | null>(null);

  // Every rail gesture bumps `seq` and records where it travels. The nonce is what makes a
  // re-roll that lands back on the same item still play (Decision 5) — and, because a gesture
  // always produces a new frame, the direction it recorded is always consumed by the swap it
  // caused, never left behind for a later Shuffle All to pick up.
  const [gesture, setGesture] = useState<{ dir: 1 | -1; seq: number }>({
    dir: 1,
    seq: 0,
  });

  // The frame pair is rebuilt in the render phase whenever the key changes, and its delay and
  // direction are frozen at that moment: a re-render while the cascade is still in flight must
  // not rewrite an animation that is already running.
  const [frame, setFrame] = useState<Frame>({
    key: "",
    tick: cascadeTick,
    delay: 0,
    n: 0,
    gestureSeq: 0,
    dir: 1,
    slide: false,
    item: null,
    out: null,
  });

  // "None" is a real, browsable position on optional rails — there is no none.png sentinel.
  const positions: (ClosetItem | null)[] = allowNone ? [null, ...items] : items;
  if (positions.length === 0) return null;

  const current = Math.max(
    0,
    positions.findIndex((item) => (item?.id ?? null) === activeId),
  );
  const active = positions[current] ?? null;

  const frameKey = `${active?.id ?? "none"}:${cascadeTick}:${gesture.seq}`;
  // Built from the committed frame only, never from the value being written: StrictMode
  // double-invokes render-phase updates, and both invocations have to agree.
  const view: Frame =
    frame.key === frameKey
      ? frame
      : {
          key: frameKey,
          tick: cascadeTick,
          // A Shuffle All (tick bumped) staggers; an arrow step, swipe or ⇄ plays at once.
          delay: cascadeTick === frame.tick ? 0 : cascadeDelayMs,
          n: frame.n + 1,
          gestureSeq: gesture.seq,
          // A swap the user steered follows their travel; everything else sweeps forward.
          dir: gesture.seq === frame.gestureSeq ? 1 : gesture.dir,
          // A rail's first frame has nothing to exchange with, so it rises in (Decision 2).
          slide: frame.key !== "",
          item: active,
          out: frame.key === "" ? null : { item: frame.item },
        };
  if (view !== frame) setFrame(view);

  // Wraps around at both ends, so a single-item rail simply lands back on itself — the nonce
  // is what makes that land visibly rather than as a dead arrow.
  const step = (delta: 1 | -1) => {
    const next = (current + delta + positions.length) % positions.length;
    setGesture((previous) => ({ dir: delta, seq: previous.seq + 1 }));
    onChange(positions[next]?.id ?? null);
  };

  // shuffleSlot re-rolls uniformly over every item including the current one, so with three
  // tops roughly one press in three hands back what was already there. The nonce keeps the
  // button honest: the sweep plays either way, and the distribution stays untouched
  // (Decision 5).
  const handleShuffle = () => {
    setGesture((previous) => ({ dir: 1, seq: previous.seq + 1 }));
    onShuffle();
  };

  // The outgoing frame has finished leaving; drop it so its <img> stops holding the DOM. Guarded
  // on the pair it belongs to, so a swap landing in the same batch keeps its own exit frame.
  const dropExitingFrame = (n: number) =>
    setFrame((previous) =>
      previous.n === n && previous.out !== null
        ? { ...previous, out: null }
        : previous,
    );

  const handlePointerUp = (event: React.PointerEvent) => {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX === null) return;

    const distance = event.clientX - startX;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    step(distance < 0 ? 1 : -1);
  };

  const slide = view.dir > 0 ? SLIDE.forward : SLIDE.back;
  const alignClass = align === "top" ? "items-start" : "items-center";
  const emptyText = emptyLabel ?? `no ${label.toLowerCase()}`;

  return (
    <section aria-label={label} className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center justify-center gap-2">
        {category && <CategoryShape category={category} />}
        <span className="font-body text-ink/45 text-[11px] tracking-[0.18em] uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={handleShuffle}
          aria-label={`Shuffle ${label}`}
          className="text-ink/40 hover:bg-wash/60 hover:text-accent flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition"
        >
          <ShuffleIcon />
        </button>
      </div>

      <div className="flex w-full items-center justify-center">
        <button
          type="button"
          aria-label={`Previous ${label}`}
          className={ARROW_CLASS}
          onClick={() => step(-1)}
        >
          ‹
        </button>

        {/* The filmstrip window: frames stack on top of each other and are clipped at its
            edge, so a swap slides one item out of view exactly as the next arrives. */}
        <div
          className={`relative flex-1 touch-pan-y overflow-hidden ${className}`}
          onPointerDown={(event) => (swipeStartX.current = event.clientX)}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => (swipeStartX.current = null)}
        >
          {view.out !== null && (
            <div
              key={`out-${view.n}`}
              aria-hidden="true"
              style={{ animationDelay: `${view.delay}ms` }}
              className={`${slide.out} absolute inset-0 flex justify-center ${alignClass}`}
              onAnimationEnd={() => dropExitingFrame(view.n)}
            >
              <FrameBody
                item={view.out.item}
                imageClassName={imageClassName}
                emptyLabel={emptyText}
              />
            </div>
          )}

          {/* The class hangs off `view.slide`, not off whether the exit frame is still here:
              swapping it when the exit frame drops would restart a settled animation. */}
          <div
            key={`in-${view.n}`}
            style={{ animationDelay: `${view.delay}ms` }}
            className={`${view.slide ? slide.in : "animate-rail-in"} absolute inset-0 flex justify-center ${alignClass}`}
          >
            <FrameBody
              item={active}
              imageClassName={imageClassName}
              emptyLabel={emptyText}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label={`Next ${label}`}
          className={ARROW_CLASS}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
    </section>
  );
}
