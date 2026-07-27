export interface Quote {
  text: string;
  /** Real fashion-icon quotes get a short attribution; invented one-liners carry none. */
  by?: string;
}

/**
 * The daily quote pool. Edit freely — this file is the only place quotes live.
 * Order matters only for which day gets which quote.
 */
export const QUOTES: Quote[] = [
  { text: "Fashions fade, style is eternal.", by: "Yves Saint Laurent" },
  { text: "Shuffle until it feels like you." },
  {
    text: "Dress shabbily and they remember the dress; dress impeccably and they remember the woman.",
    by: "Coco Chanel",
  },
  { text: "Trust the shuffle." },
  {
    text: "Style is a way to say who you are without having to speak.",
    by: "Rachel Zoe",
  },
  { text: "Great outfits begin with a little chaos." },
  {
    text: "Give a girl the right shoes, and she can conquer the world.",
    by: "Marilyn Monroe",
  },
  { text: "The right outfit was in the closet all along." },
  {
    text: "People will stare. Make it worth their while.",
    by: "Harry Winston",
  },
  { text: "Wear the thing you keep saving for later." },
  { text: "Elegance is refusal.", by: "Coco Chanel" },
  { text: "Today's forecast: fully dressed, with a chance of compliments." },
  { text: "More is more and less is a bore.", by: "Iris Apfel" },
  { text: "An outfit a day keeps the “nothing to wear” away." },
];

/** Same quote all (local) day, next quote tomorrow — local-midnight day count wrapped onto the list. */
export function quoteOfTheDay(date: Date = new Date()): Quote {
  const localDays = Math.floor(
    (date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000,
  );
  const quote = QUOTES[localDays % QUOTES.length];
  if (!quote) throw new Error("The quote pool is empty");
  return quote;
}
