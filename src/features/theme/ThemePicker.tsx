import { useId, useState } from "react";

import { THEMES } from "./themes";
import { useThemeStore } from "./useThemeStore";

/** Five petals around a pistil, wound the same way so the nonzero fill reads as one bloom. */
const FLOWER_PATH =
  "M10.66 10.01 C7.09 8.02 8.66 2.15 12 1.8 C15.34 2.15 16.91 8.02 13.34 10.01 L12 12 Z " +
  "M13.48 10.11 C14.27 6.1 20.34 5.78 21.7 8.85 C22.4 12.13 17.3 15.44 14.31 12.66 L12 12 Z " +
  "M14.26 12.82 C18.32 12.33 20.49 18.01 18 20.25 C15.09 21.93 10.36 18.11 12.08 14.4 L12 12 Z " +
  "M11.92 14.4 C13.64 18.11 8.91 21.93 6 20.25 C3.51 18.01 5.68 12.33 9.74 12.82 L12 12 Z " +
  "M9.69 12.66 C6.7 15.44 1.6 12.13 2.3 8.85 C3.66 5.78 9.73 6.1 10.52 10.11 L12 12 Z " +
  "M8.8 12 A3.2 3.2 0 1 1 15.2 12 A3.2 3.2 0 1 1 8.8 12 Z";

/**
 * One uniform 5-petal flower for every swatch (Decision 5): colour IS the information here,
 * so the shape never varies — and it stays visually distinct from the category shape set so
 * the two systems never blur. `currentColor` is what lets the data-theme re-scope work.
 */
function FlowerSwatch({ theme }: { theme?: string }) {
  const highlightId = useId();

  return (
    <svg
      data-theme={theme}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="text-accent h-4 w-4"
    >
      <defs>
        <radialGradient id={highlightId} cx="0.32" cy="0.28" r="0.55">
          <stop offset="0" stopColor="white" stopOpacity="0.5" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={FLOWER_PATH} fill="currentColor" />
      <path d={FLOWER_PATH} fill={`url(#${highlightId})`} />
    </svg>
  );
}

export function ThemePicker({
  className = "",
  onPick,
}: {
  className?: string;
  onPick?: () => void;
}) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`flex items-center gap-2 ${className}`}
    >
      {THEMES.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={theme === preset.id}
          aria-label={preset.label}
          title={preset.label}
          onClick={() => {
            setTheme(preset.id);
            onPick?.();
          }}
          className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition ${
            theme === preset.id ? "ring-ink/35 ring-2" : "hover:scale-110"
          }`}
        >
          {/* data-theme re-scopes the tokens: this flower paints ITS theme's accent
              regardless of the app's active theme. */}
          <FlowerSwatch theme={preset.id} />
        </button>
      ))}
    </div>
  );
}

export function ThemePickerButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Choose color theme"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="hover:bg-wash/60 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition"
      >
        {/* No data-theme: shows the ACTIVE theme's accent. */}
        <FlowerSwatch />
      </button>

      {open && (
        <div className="border-ink/10 bg-paper animate-pop-in absolute top-full right-0 z-30 mt-2 rounded-full border px-3 py-2 shadow-lg">
          <ThemePicker onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
