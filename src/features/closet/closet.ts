import type { Closet, ClosetItem } from "./types";
import { useClosetStore } from "./useClosetStore";

/**
 * The closet as it stands right now: everything Joyce has uploaded, and nothing else.
 * Still synchronous — hydration completes before any of this module's consumers are
 * imported (see main.tsx) — but no longer a constant, and legitimately empty on a first
 * visit or after deleting the last item.
 *
 * Components that must re-render when an upload lands should use the hooks below rather
 * than calling these directly; the plain functions are for module-init and event-handler
 * reads (useShuffleStore).
 */
export function getCloset(): Closet {
  return useClosetStore.getState().closet;
}

export function getItem(id: string): ClosetItem | undefined {
  return useClosetStore.getState().itemsById.get(id);
}

export function useCloset(): Closet {
  return useClosetStore((state) => state.closet);
}

export function useClosetItem(id: string | null): ClosetItem | undefined {
  return useClosetStore((state) =>
    id === null ? undefined : state.itemsById.get(id),
  );
}
