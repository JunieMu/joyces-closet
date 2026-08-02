import { useId } from "react";

import { CATEGORY_TINT } from "../features/closet/railScale";
import type { ItemCategory } from "../features/closet/types";

/**
 * Fixed mapping (2026-07-30 Decision 4): the same category always shows the same shape,
 * everywhere a category is labelled — shuffle rails, closet headers, the upload category
 * picker. Geometry is generated, not drawn: each silhouette is a single subpath centred on
 * (12,12) so the fill + highlight idiom below works with one `d`.
 */
const SHAPE_PATH: Record<ItemCategory, string> = {
  // sun — eight rays alternating with arcs along the disc rim
  tops:
    "M10.87 6.21 L12 1.4 L13.13 6.21 A5.9 5.9 0 0 1 15.3 7.11 L19.5 4.5 L16.89 8.7 " +
    "A5.9 5.9 0 0 1 17.79 10.87 L22.6 12 L17.79 13.13 A5.9 5.9 0 0 1 16.89 15.3 " +
    "L19.5 19.5 L15.3 16.89 A5.9 5.9 0 0 1 13.13 17.79 L12 22.6 L10.87 17.79 " +
    "A5.9 5.9 0 0 1 8.7 16.89 L4.5 19.5 L7.11 15.3 A5.9 5.9 0 0 1 6.21 13.13 " +
    "L1.4 12 L6.21 10.87 A5.9 5.9 0 0 1 7.11 8.7 L4.5 4.5 L8.7 7.11 " +
    "A5.9 5.9 0 0 1 10.87 6.21 Z",
  // crescent moon — a big disc with a smaller one bitten out of its right side
  bottoms: "M17.6 3.6 A9.4 9.4 0 1 0 17.6 20.4 A8.1 8.1 0 1 1 17.6 3.6 Z",
  // five-point star, one point up
  dresses:
    "M12 1.6 L14.59 8.44 L21.89 8.79 L16.18 13.36 L18.11 20.41 L12 16.4 " +
    "L5.89 20.41 L7.82 13.36 L2.11 8.79 L9.41 8.44 Z",
  // cloud — three overlapping lobes on a flat base
  jackets:
    "M6.4 19.6 A4.6 4.6 0 0 1 6.1 10.42 A5.9 5.9 0 0 1 16.9 7.9 " +
    "A4.9 4.9 0 0 1 18.2 19.6 Z",
  // teardrop — a point at the top over a round bulb, the inverse silhouette of the heart
  bags:
    "M12 2 C10.4 5.5 4.6 11 4.6 14.6 A7.4 7.4 0 0 0 19.4 14.6 " +
    "C19.4 11 13.6 5.5 12 2 Z",
  // four-point sparkle, concave between the points
  shoes:
    "M12 1.2 C13.15 8.4 15.6 10.85 22.8 12 C15.6 13.15 13.15 15.6 12 22.8 " +
    "C10.85 15.6 8.4 13.15 1.2 12 C8.4 10.85 10.85 8.4 12 1.2 Z",
  // heart
  accessories:
    "M12 21.4 C12 21.4 2.6 15.1 2.6 9 C2.6 5.9 5 3.5 8 3.5 C9.9 3.5 11.3 4.6 12 5.9 " +
    "C12.7 4.6 14.1 3.5 16 3.5 C19 3.5 21.4 5.9 21.4 9 C21.4 15.1 12 21.4 12 21.4 Z",
};

/**
 * A 12px solid watercolor-tinted category marker: the category's tint with the soft white
 * highlight the old paint dabs had. Fills stay solid — a pattern cannot read at this size
 * (Decision 4). Pure decoration, so it is hidden from screen readers; the label beside it
 * carries the meaning.
 */
export function CategoryShape({
  category,
  className = "",
}: {
  category: ItemCategory;
  className?: string;
}) {
  // SVG url(#id) references resolve document-wide, so every instance mints its own gradient
  // — duplicate ids would all silently resolve to whichever landed in the DOM first.
  const highlightId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 ${CATEGORY_TINT[category]} ${className}`}
    >
      <defs>
        <radialGradient id={highlightId} cx="0.32" cy="0.3" r="0.55">
          <stop offset="0" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={SHAPE_PATH[category]} fill="currentColor" />
      <path d={SHAPE_PATH[category]} fill={`url(#${highlightId})`} />
    </svg>
  );
}
