// Seeded RNG (mulberry32): same seed => same run. Needed for the Ghost Twin.
export function mulberry32(a) {
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a; next.setState = (v) => { a = v; };     // read/restore the generator position (Practice Lab rewind). The sequence itself is unchanged.
  return next;
}
