/** The name a saved outfit gets when Joyce doesn't type one: "Outfit · Jul 13". */
export function defaultOutfitName(date: Date): string {
  return `Outfit · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
