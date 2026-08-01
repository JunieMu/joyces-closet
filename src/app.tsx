import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import { Layout } from "./components/Layout";
import { ClosetPage } from "./features/closet/ClosetPage";
import { OutfitsPage } from "./features/outfits/OutfitsPage";
import { ShufflePage } from "./features/shuffle/ShufflePage";
import { WeekPage } from "./features/week/WeekPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: ShufflePage },
      // Route order mirrors nav order, which is temporal: today, then the week ahead.
      { path: "week", Component: WeekPage },
      { path: "outfits", Component: OutfitsPage },
      { path: "closet", Component: ClosetPage },
    ],
  },
]);

/**
 * Mounting lives here, not in main.tsx, so that importing the app — and with it
 * useShuffleStore, which reads the closet at module-init time — can be deferred until
 * after hydration. See the comment in main.tsx.
 */
export function mountApp(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Root element #root not found");

  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
