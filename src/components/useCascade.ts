import { create } from "zustand";

/** UI-only pulse: Shuffle All bumps the tick so every rail remounts and staggers in. */
interface CascadeState {
  tick: number;
  bump: () => void;
}

export const useCascade = create<CascadeState>()((set) => ({
  tick: 0,
  bump: () => set((state) => ({ tick: state.tick + 1 })),
}));
