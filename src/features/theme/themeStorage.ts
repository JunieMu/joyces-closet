import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

export const THEME_KEY = "joyces-closet:theme:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * The value is the raw theme id, not JSON — the pre-paint script in index.html reads it
 * with a bare getItem. Anything unreadable (missing key, unknown id, storage errors)
 * degrades to the default; reading the theme must never throw.
 */
export function readTheme(storage: StorageLike = window.localStorage): ThemeId {
  try {
    const raw = storage.getItem(THEME_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(
  id: ThemeId,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(THEME_KEY, id);
  } catch {
    // Quota/private-mode errors: the choice just won't survive a reload.
  }
}
