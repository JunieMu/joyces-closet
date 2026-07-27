/** The curated preset lineup (Decision 5). Ids double as the data-theme attribute values. */
export const THEMES = [
  { id: "rosewood", label: "Rosewood" },
  { id: "lavender", label: "Lavender Dusk" },
  { id: "garden", label: "Garden" },
  { id: "seaglass", label: "Sea Glass" },
  { id: "marmalade", label: "Marmalade" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "rosewood";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
