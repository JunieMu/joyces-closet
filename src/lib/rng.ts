/** Math.random-compatible source of randomness in [0, 1). Injected so shuffle is testable. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;
