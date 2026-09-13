/**
 * mulberry32 — a small, well-known deterministic PRNG. Same seed always
 * produces the same sequence of numbers in [0, 1), which is what Phase 3b
 * AC #5 requires (building positions must be identical across reloads).
 * Not cryptographic — that's fine, this is only ever used for layout.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
