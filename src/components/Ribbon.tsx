import { useId } from "react";

export type RibbonVariant = "plaid" | "gingham" | "stripe" | "polka";

/**
 * The title ribbons (2026-07-30 Decision 3). A gently wavy band filled with an axis-aligned
 * woven pattern: SVG patterns tile in straight user space, so a soft wave over a straight
 * weave is what reads as hand-sewn. Frilliness lives in the silhouette, never in warping the
 * pattern — no displacement filters (Decision 2), which is why these stay crisp at any DPI.
 *
 * The whole outline is one path, long edges and ends alike, so an end is the same woven
 * fabric as the band rather than a solid block pasted on its tip.
 *
 * The body is six cubics: a sine arch of amplitude A over length L is exactly a Bezier with
 * its control points at L/3 and 2L/3 raised by 4A/3. Top and bottom bow the same way, which
 * is what holds the band's thickness constant instead of pinching it.
 */
const BODY_TOP =
  "C45.3 16 66.7 16 88 12 C109.3 8 130.7 8 152 12 C173.3 16 194.7 16 216 12";
const BODY_BOTTOM =
  "C194.7 30 173.3 30 152 26 C130.7 22 109.3 22 88 26 C66.7 30 45.3 30 24 26";

/** Each end is walked from y0 to y1 in outline order, so the left one is not a mirror copy. */
const END = {
  notch: {
    right: "L225 10.5 L218.5 19 L225 27.5 L216 26",
    left: "L15 27.5 L21.5 19 L15 10.5 L24 12",
  },
  fishtail: {
    right: "L231 9 L221 19 L231 29 L216 26",
    left: "L9 29 L19 19 L9 9 L24 12",
  },
} as const;

const band = (end: keyof typeof END) =>
  `M24 12 ${BODY_TOP} ${END[end].right} ${BODY_BOTTOM} ${END[end].left} Z`;

/** Stroked scallops dripping below the bottom edge — Today's lace trim. */
const LACE =
  "M24 26 Q30.4 30.1 36.8 27.8 Q43.2 31.6 49.6 28.9 Q56 32.2 62.4 28.9 Q68.8 31.6 75.2 27.8 " +
  "Q81.6 30.1 88 26 Q94.4 28.3 100.8 24.2 Q107.2 26.8 113.6 23.1 Q120 26.2 126.4 23.1 " +
  "Q132.8 26.8 139.2 24.2 Q145.6 28.3 152 26 Q158.4 30.1 164.8 27.8 Q171.2 31.6 177.6 28.9 " +
  "Q184 32.2 190.4 28.9 Q196.8 31.6 203.2 27.8 Q209.6 30.1 216 26";

/**
 * Weave, colourway and edge all differ per page, so the four read as a family without
 * repeating. `ink` is the accent the outline (and Today's lace) is drawn in — it is what
 * makes each page's ribbon lean on a different one of the four accent tokens. The week's
 * polka arrived with --color-accent-4 (2026-07-31 week-planning Decision 10): a fourth
 * page needed a fourth thread, since no accent is ever spent twice.
 */
const VARIANT: Record<
  RibbonVariant,
  { ink: string; path: string; lace?: boolean }
> = {
  plaid: { ink: "var(--color-accent)", path: band("notch"), lace: true },
  gingham: { ink: "var(--color-accent-2)", path: band("fishtail") },
  stripe: { ink: "var(--color-accent-3)", path: band("notch") },
  polka: { ink: "var(--color-accent-4)", path: band("notch") },
};

/**
 * The weaves. Every fill is a CSS `fill` property rather than the presentation attribute:
 * inline SVG only resolves var() through the property, and a data-URI background could not
 * read the theme tokens at all — which is why these ribbons are inline SVG.
 */
function Weave({ variant, id }: { variant: RibbonVariant; id: string }) {
  const paper = { fill: "var(--color-paper)" };

  if (variant === "gingham")
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" style={paper} />
        <rect
          width="8"
          height="4"
          style={{ fill: "var(--color-accent-2)" }}
          opacity="0.45"
        />
        <rect
          width="4"
          height="8"
          style={{ fill: "var(--color-accent-2)" }}
          opacity="0.45"
        />
      </pattern>
    );

  if (variant === "stripe")
    return (
      <pattern
        id={id}
        patternUnits="userSpaceOnUse"
        width="7"
        height="7"
        patternTransform="rotate(-42)"
      >
        <rect width="7" height="7" style={paper} />
        <rect
          width="3"
          height="7"
          style={{ fill: "var(--color-accent-3)" }}
          opacity="0.55"
        />
        <rect
          x="4.4"
          width="1.1"
          height="7"
          style={{ fill: "var(--color-accent)" }}
          opacity="0.4"
        />
      </pattern>
    );

  // Polka: two accent-4 dots half-dropped across an 8x8 tile, with a much smaller accent
  // pinhead in each of the other two corners. The pinheads are what keep the field from
  // reading as gingham's lattice at ribbon height — a plain even grid of one dot size did.
  // Radii are in the 240-wide user space, where the band is 14 units thick: at the deployed
  // 176px width one unit is ~0.73 CSS px, so r=1.6 lands as a ~2.3px dot.
  if (variant === "polka")
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8">
        <rect width="8" height="8" style={paper} />
        <circle
          cx="2"
          cy="2"
          r="1.6"
          style={{ fill: "var(--color-accent-4)" }}
          opacity="0.5"
        />
        <circle
          cx="6"
          cy="6"
          r="1.6"
          style={{ fill: "var(--color-accent-4)" }}
          opacity="0.5"
        />
        <circle
          cx="6"
          cy="2"
          r="0.55"
          style={{ fill: "var(--color-accent)" }}
          opacity="0.4"
        />
        <circle
          cx="2"
          cy="6"
          r="0.55"
          style={{ fill: "var(--color-accent)" }}
          opacity="0.4"
        />
      </pattern>
    );

  // Plaid: two horizontal bands crossing two vertical ones, all partly transparent, so the
  // overlaps darken on their own the way a real weave does.
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="10" height="10">
      <rect width="10" height="10" style={paper} />
      <rect
        width="10"
        height="3.6"
        style={{ fill: "var(--color-accent)" }}
        opacity="0.42"
      />
      <rect
        y="6"
        width="10"
        height="1.5"
        style={{ fill: "var(--color-accent-3)" }}
        opacity="0.62"
      />
      <rect
        width="3.6"
        height="10"
        style={{ fill: "var(--color-accent)" }}
        opacity="0.3"
      />
      <rect
        x="6"
        width="1.5"
        height="10"
        style={{ fill: "var(--color-accent-2)" }}
        opacity="0.7"
      />
    </pattern>
  );
}

export function Ribbon({
  variant,
  className = "",
}: {
  variant: RibbonVariant;
  className?: string;
}) {
  // url(#id) resolves document-wide, so each ribbon needs its own pattern id.
  const patternId = useId();
  const { ink, path, lace } = VARIANT[variant];

  return (
    <svg viewBox="0 0 240 34" aria-hidden="true" className={className}>
      <defs>
        <Weave variant={variant} id={patternId} />
      </defs>
      {lace && (
        <path
          d={LACE}
          fill="none"
          style={{ stroke: ink }}
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.5"
        />
      )}
      <path d={path} fill={`url(#${patternId})`} />
      <path
        d={path}
        fill="none"
        style={{ stroke: ink }}
        strokeWidth="0.7"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  );
}
