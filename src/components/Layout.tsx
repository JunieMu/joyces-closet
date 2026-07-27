import { NavLink, Outlet, useLocation } from "react-router";

import { ThemePicker, ThemePickerButton } from "../features/theme/ThemePicker";
import { quoteOfTheDay } from "../lib/quotes";
import { OutfitActions } from "./OutfitActions";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `font-body rounded-full px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? "bg-wash text-accent"
      : "text-ink/60 hover:bg-wash/50 hover:text-ink"
  }`;

export function Layout() {
  const isToday = useLocation().pathname === "/";
  const quote = quoteOfTheDay();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[17rem_1fr]">
      {/* Filter defs for the hand-drawn line treatment (Decision 7) — referenced by CSS
          as filter: url(#sketchy). */}
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <filter id="sketchy">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="2"
            seed="7"
          />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </svg>

      {/* Desktop sidebar: brand → nav → actions (Today only) → quote footer (Decision 4). */}
      <aside className="border-ink/10 sticky top-0 hidden h-screen flex-col border-r px-6 py-8 md:flex">
        <NavLink to="/" className="font-display text-ink text-2xl">
          joyce&apos;s closet
        </NavLink>

        <nav className="mt-8 flex flex-col items-start gap-1">
          <NavLink to="/" end className={navLinkClass}>
            today
          </NavLink>
          <NavLink to="/outfits" className={navLinkClass}>
            outfits
          </NavLink>
        </nav>

        <hr className="border-ink/10 my-6 w-full" />

        {isToday && <OutfitActions variant="sidebar" />}

        <div className="flex-1" />

        <figure className="quote-wash">
          <blockquote className="font-display text-ink/60 text-sm leading-relaxed italic">
            “{quote.text}”
          </blockquote>
          {quote.by && (
            <figcaption className="font-body text-ink/40 mt-1.5 text-xs">
              — {quote.by}
            </figcaption>
          )}
        </figure>

        {/* The palette row sits under the quote like a painter's signature. */}
        <ThemePicker className="mt-6" />
      </aside>

      {/* Mobile slim top bar (Decision 5). */}
      <header className="border-ink/10 flex items-center justify-between border-b px-4 py-3 md:hidden">
        <NavLink to="/" className="font-display text-ink text-lg">
          joyce&apos;s closet
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            today
          </NavLink>
          <NavLink to="/outfits" className={navLinkClass}>
            outfits
          </NavLink>
          <ThemePickerButton />
        </nav>
      </header>

      <main
        className={`mx-auto w-full max-w-5xl px-4 py-8 md:px-10 ${
          isToday ? "pb-32 md:pb-8" : ""
        }`}
      >
        <Outlet />
      </main>

      {/* Mobile sticky action bar, Today only — always thumb-reachable (Decision 5). */}
      {isToday && (
        <div className="border-ink/10 bg-paper/95 fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <OutfitActions variant="bar" />
        </div>
      )}
    </div>
  );
}
