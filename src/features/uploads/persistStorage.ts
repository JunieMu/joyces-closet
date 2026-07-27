/**
 * Asks the browser to mark this origin's storage persistent, so uploaded images are exempt
 * from automatic eviction (Chrome reclaiming disk under pressure; Safari's 7-day purge of
 * script-writable storage on sites not visited as a first party).
 *
 * Deliberately called after a successful upload rather than during hydration: Firefox shows
 * a permission prompt, and asking a first-time visitor to protect data she does not have yet
 * is a prompt she can only refuse. Chrome never prompts — it grants silently on its own
 * engagement heuristics (bookmarked, installed, high engagement) and otherwise returns false.
 *
 * Best-effort by construction: a refusal, an older browser without the API, or a rejected
 * promise all leave the app exactly as it was. Nothing downstream reads the result — it is
 * insurance, not a feature.
 */
let requested = false;

export async function requestPersistentStorage(): Promise<boolean> {
  if (requested) return false;
  requested = true;

  try {
    // Optional chaining covers both the missing API and non-secure contexts, where
    // navigator.storage is undefined.
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
