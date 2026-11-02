/** Seeded PRNG (mulberry32). Same seed, same wobble — every visit. */
export function rng(seed = 1): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, for deriving stable seeds from content. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed: number): (x: number) => number {
  const r = rng(seed);
  const v = new Float32Array(256).map(() => r() * 2 - 1);
  return (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = v[i & 255], b = v[(i + 1) & 255];
    return a + (b - a) * u;
  };
}
