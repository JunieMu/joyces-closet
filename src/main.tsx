import "./index.css";
import { hydrateCloset } from "./features/uploads/hydrate";

/**
 * Uploads must be in the closet before anything reads it (Decision 8). useShuffleStore
 * shuffles and re-validates the persisted outfit at module-init time
 * (useShuffleStore.ts:54,101-106) — and ES imports evaluate before the importing module's
 * body, so awaiting here is only sufficient because the app is imported dynamically
 * afterwards. A static `import { mountApp }` would defeat this entirely.
 *
 * Same correctness-before-first-paint posture as the theme script in index.html.
 */
void hydrateCloset()
  .catch(() => {
    // A failed hydration must not cost Joyce the app — it opens on the empty-closet state,
    // the same one a first visit gets, rather than failing to mount at all.
  })
  .then(async () => {
    const { mountApp } = await import("./app");
    mountApp();
  });
