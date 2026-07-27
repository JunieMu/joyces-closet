import { useState } from "react";

import { THEMES } from "./themes";
import { useThemeStore } from "./useThemeStore";

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
          {/* data-theme re-scopes the tokens: this dot paints ITS theme's accent
              regardless of the app's active theme. */}
          <span
            data-theme={preset.id}
            aria-hidden="true"
            className="watercolor-dot text-accent h-4 w-4"
          />
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
        <span
          aria-hidden="true"
          className="watercolor-dot text-accent h-4 w-4"
        />
      </button>

      {open && (
        <div className="border-ink/10 bg-paper animate-pop-in absolute top-full right-0 z-30 mt-2 rounded-full border px-3 py-2 shadow-lg">
          <ThemePicker onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
