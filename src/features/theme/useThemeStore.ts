import { create } from "zustand";

import { readTheme, writeTheme } from "./themeStorage";
import { DEFAULT_THEME, type ThemeId } from "./themes";

/** <html data-theme> is the single CSS switch; the default theme carries no attribute. */
function applyTheme(id: ThemeId): void {
  if (id === DEFAULT_THEME)
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", id);
}

// The pre-paint script in index.html applied the raw stored value blindly; re-validate
// here so a stale/unknown id is corrected before React renders anything themed.
const initialTheme = readTheme();
applyTheme(initialTheme);

interface ThemeState {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: initialTheme,
  setTheme: (id) => {
    writeTheme(id);
    applyTheme(id);
    set({ theme: id });
  },
}));
