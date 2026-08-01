/**
 * A faint hand-sewn hairline (2026-07-30 Decision 7) trailing off a section header to the
 * row's edge: visible when looked for, invisible when reading.
 *
 * The viewBox is fixed at 1200 user units — wider than any real row at the app's 5xl max
 * width — and sliced rather than scaled, so the dash rhythm stays identical at every row
 * width and is simply cropped at the edge. `preserveAspectRatio="none"` would stretch the
 * stitches into longer dashes on wider rows.
 */
export function RunningStitch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 8"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      className={`text-ink/15 h-2 min-w-0 flex-1 ${className}`}
    >
      <path
        d="M0 4 C 100 2.4, 200 5.6, 300 4 S 500 2.4, 600 4 S 800 5.6, 900 4 S 1100 2.4, 1200 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="7 6"
      />
    </svg>
  );
}
