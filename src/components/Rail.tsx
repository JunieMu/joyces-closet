import { useRef, useState } from "react";

import type { ClosetItem } from "../features/closet/types";

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
  tintClass?: string; // watercolor dot tint beside the label (pure decoration)
}

/** How far a pointer has to travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 40;

const ARROW_CLASS =
  "border-ink/10 text-ink/40 hover:border-accent/40 hover:bg-wash/50 hover:text-accent " +
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border " +
  "text-xl leading-none transition select-none";

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
  tintClass,
}: RailProps) {
  const swipeStartX = useRef<number | null>(null);

  // The frame remounts (and so re-animates) whenever the item or the cascade tick changes.
  // Its delay is decided once, at mount, and frozen for the frame's lifetime: a re-render
  // while the cascade is still in flight must not rewrite animation-delay mid-animation.
  const [frame, setFrame] = useState({ key: "", tick: cascadeTick, delay: 0 });

  // "None" is a real, browsable position on optional rails — there is no none.png sentinel.
  const positions: (ClosetItem | null)[] = allowNone ? [null, ...items] : items;
  if (positions.length === 0) return null;

  const current = Math.max(
    0,
    positions.findIndex((item) => (item?.id ?? null) === activeId),
  );
  const active = positions[current] ?? null;

  const frameKey = `${active?.id ?? "none"}:${cascadeTick}`;
  if (frame.key !== frameKey) {
    setFrame({
      key: frameKey,
      tick: cascadeTick,
      // A Shuffle All (tick bumped) staggers; an arrow step or per-rail shuffle plays at once.
      delay: cascadeTick === frame.tick ? 0 : cascadeDelayMs,
    });
  }

  // Wraps around at both ends, so a single-item rail simply lands back on itself.
  const step = (delta: number) => {
    const next = (current + delta + positions.length) % positions.length;
    onChange(positions[next]?.id ?? null);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX === null) return;

    const distance = event.clientX - startX;
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    step(distance < 0 ? 1 : -1);
  };

  return (
    <section aria-label={label} className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center justify-center gap-2">
        {tintClass && (
          <span
            aria-hidden="true"
            className={`watercolor-dot h-2 w-2 ${tintClass}`}
          />
        )}
        <span className="font-body text-ink/45 text-[11px] tracking-[0.18em] uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={onShuffle}
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

        <div
          className={`flex flex-1 touch-pan-y items-center justify-center ${className}`}
          onPointerDown={(event) => (swipeStartX.current = event.clientX)}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => (swipeStartX.current = null)}
        >
          <div
            key={frameKey}
            style={{
              animationDelay: `${frame.key === frameKey ? frame.delay : 0}ms`,
            }}
            className={`animate-rail-in flex h-full w-full justify-center ${
              align === "top" ? "items-start" : "items-center"
            }`}
          >
            {active ? (
              <img
                src={active.image}
                alt={active.name}
                draggable={false}
                className={`max-h-full object-contain select-none ${imageClassName}`}
              />
            ) : (
              // No frame around the empty position: an outlined box read as heavier than the
              // garment it stands in for, and its straight edges invited comparison to a true
              // rectangle. The paper holds the space instead.
              <div className="font-display text-ink/35 flex h-full w-full items-center justify-center text-sm italic">
                {emptyLabel ?? `no ${label.toLowerCase()}`}
              </div>
            )}
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
